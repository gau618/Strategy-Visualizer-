// src/features/StrategyVisualizer/sections/PayoffChartSection.jsx
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import StrategyTabs from "../components/StrategyTabs";
import Button from "../../../components/Button/Button";
import Select from "../../../components/Select/Select";
import Input from "../../../components/Input/Input";
import Checkbox from "../../../components/Checkbox/Checkbox";
import GreeksTable from "../components/GreeksTable";
import PnLTable from "../components/PnLTable";

import { black76Price, black76Greeks, timeToExpiry } from '../../utils/optionPricingUtils';
import { DEFAULT_VOLATILITY, SPOT_SLIDER_RANGE_PERCENT, SPOT_SLIDER_STEP, MAX_DAYS_FOR_DATE_SLIDER } from '../../../config';

import "./PayoffChartSection.scss";

const PayoffChartSection = ({
  activeChartTab,
  onChartTabChange,
  niftyTarget, 
  onNiftyTargetChange,
  targetDate,   
  onTargetDateChange,
  strategyLegs,
  getOptionByToken,
  liveOptionChainMap, 
  currentUnderlying,
  riskFreeRate,
  multiplyByLotSize,
  onMultiplyByLotSizeChange,
  multiplyByNumLots,
  onMultiplyByNumLotsChange,
}) => {
  const chartRef = useRef(null); // For actual chart instance

  const [currentDisplaySpot, setCurrentDisplaySpot] = useState(null);
  const [spotSliderMin, setSpotSliderMin] = useState(0);
  const [spotSliderMax, setSpotSliderMax] = useState(0);

  const [minDateForSlider, setMinDateForSlider] = useState('');
  const [maxDateForSlider, setMaxDateForSlider] = useState('');

  // Initialize niftyTarget and date slider ranges based on current market data / strategy
  useEffect(() => {
    let spot = null;
    let latestExpiryDateInStrategy = new Date(); // Default to today for max date if no legs

    if (strategyLegs.length > 0 && strategyLegs.some(leg => leg.selected)) {
      const firstSelectedLegToken = strategyLegs.find(leg => leg.selected && leg.token)?.token;
      if (firstSelectedLegToken) {
        const option = getOptionByToken(firstSelectedLegToken);
        spot = option?.marketData?.spot || option?.marketData?.futures;
      }
      strategyLegs.forEach(leg => {
        if (leg.selected && leg.expiry) {
          try {
            const [day, monthStr, year] = [leg.expiry.substring(0,2), leg.expiry.substring(2,5), leg.expiry.substring(5,9)];
            const monthMap = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
            const legExpiryDate = new Date(year, monthMap[monthStr.toUpperCase()], day, 15, 30, 0);
            if (legExpiryDate > latestExpiryDateInStrategy) {
              latestExpiryDateInStrategy = legExpiryDate;
            }
          } catch (e) { console.warn("Error parsing leg expiry for date slider range:", leg.expiry); }
        }
      });
    } else if (currentUnderlying && liveOptionChainMap && liveOptionChainMap.size > 0) {
        const anyOption = Array.from(liveOptionChainMap.values()).find(opt => opt.underlying === currentUnderlying && opt.marketData);
        spot = anyOption?.marketData?.spot || anyOption?.marketData?.futures;
        // If no legs, set a default max date for slider
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + MAX_DAYS_FOR_DATE_SLIDER);
        latestExpiryDateInStrategy = futureDate;
    }

    const numericSpot = parseFloat(spot);
    if (!isNaN(numericSpot)) {
      setCurrentDisplaySpot(numericSpot);
      if (!niftyTarget) { // Set initial niftyTarget if not already set
        onNiftyTargetChange(numericSpot.toString());
      }
      setSpotSliderMin(Math.round(numericSpot * (1 - SPOT_SLIDER_RANGE_PERCENT) / SPOT_SLIDER_STEP) * SPOT_SLIDER_STEP);
      setSpotSliderMax(Math.round(numericSpot * (1 + SPOT_SLIDER_RANGE_PERCENT) / SPOT_SLIDER_STEP) * SPOT_SLIDER_STEP);
    } else {
      const fallbackSpot = currentUnderlying === "BANKNIFTY" ? 48000 : 23000; // General fallback
      setCurrentDisplaySpot(fallbackSpot);
      if (!niftyTarget) {
          onNiftyTargetChange(fallbackSpot.toString());
      }
      setSpotSliderMin(Math.round(fallbackSpot * (1 - SPOT_SLIDER_RANGE_PERCENT) / SPOT_SLIDER_STEP) * SPOT_SLIDER_STEP);
      setSpotSliderMax(Math.round(fallbackSpot * (1 + SPOT_SLIDER_RANGE_PERCENT) / SPOT_SLIDER_STEP) * SPOT_SLIDER_STEP);
    }
    
    const todayForSlider = new Date();
    todayForSlider.setMinutes(todayForSlider.getMinutes() - todayForSlider.getTimezoneOffset());
    setMinDateForSlider(todayForSlider.toISOString().slice(0, 16));

    latestExpiryDateInStrategy.setMinutes(latestExpiryDateInStrategy.getMinutes() - latestExpiryDateInStrategy.getTimezoneOffset());
    setMaxDateForSlider(latestExpiryDateInStrategy.toISOString().slice(0, 16));

  }, [strategyLegs, getOptionByToken, currentUnderlying, liveOptionChainMap, niftyTarget]); // Removed onNiftyTargetChange

  const chartTabs = [
    { id: "payoffgraph", label: "Payoff Graph" },
    { id: "p&ltable", label: "P&L Table" },
    { id: "greeks", label: "Greeks" },
    { id: "strategychart", label: "Strategy Chart" },
  ];

  const projectedStrategyData = useMemo(() => {
    // console.log("PROJECTED STRATEGY DATA RECALC for NiftyTarget:", niftyTarget, "TargetDate:", targetDate);
    if (!niftyTarget || !targetDate || strategyLegs.length === 0 || !getOptionByToken || !riskFreeRate) { // Added !riskFreeRate check
      return { legs: [], totals: { projectedPnL: 0, delta: 0, gamma: 0, theta: 0, vega: 0 } };
    }

    const numericNiftyTarget = parseFloat(niftyTarget);
    if (isNaN(numericNiftyTarget)) {
         return { legs: [], totals: { projectedPnL: 0, delta: 0, gamma: 0, theta: 0, vega: 0 } };
    }
    const projectionDate = new Date(targetDate);

    let aggProjectedPnL = 0;
    let aggDelta = 0, aggGamma = 0, aggTheta = 0, aggVega = 0;

    const projectedLegs = strategyLegs
      .filter(leg => leg.selected && leg.token)
      .map(leg => {
        const liveOption = getOptionByToken(leg.token);
        // More robust check for liveOption and its critical properties
        if (!liveOption || !liveOption.strike || !liveOption.expiry || liveOption.iv === undefined || liveOption.optionType === undefined) {
          console.warn("Skipping leg due to missing liveOption data:", leg.token);
          return { /* ... placeholder leg data ... */
            ...leg, // Keep original leg data for ID, etc.
            instrument: `${leg.buySell === 'Buy' ? '' : 'S '} ${leg.lots || 1} X ${leg.expiry?.substring(0,9).replace(/(\d{2})([A-Z]{3})(\d{2})/, '$1-$2-$3') || 'N/A'} ${leg.strike || 'N/A'} ${leg.optionType || 'N/A'}`,
            projectedOptionPrice: null,
            projectedPnLPerShare: null,
            projectedGreeks: { delta: 0, gamma: 0, theta: 0, vega: 0 }, // Ensure greeks obj exists
            entryPrice: parseFloat(leg.price),
            ltp: null
          };
        }

        const T_to_option_expiry = timeToExpiry(liveOption.expiry, projectionDate);
        let projectedOptPrice;
        let legGreeks = { delta: 0, gamma: 0, theta: 0, vega: 0 }; // Default to zero greeks
        const currentIV = parseFloat(liveOption.iv) / 100 || DEFAULT_VOLATILITY; // Use default if IV is 0 or NaN

        if (T_to_option_expiry > 0 && currentIV > 0) { // Greeks require T > 0 and sigma > 0
          const F_projected = numericNiftyTarget * Math.exp(riskFreeRate * T_to_option_expiry);
          
          projectedOptPrice = black76Price(
            F_projected, Number(liveOption.strike), T_to_option_expiry,
            riskFreeRate, currentIV, liveOption.optionType
          );
          // VVVV THIS IS WHERE PROJECTED GREEKS ARE CALCULATED VVVV
          legGreeks = black76Greeks( // Ensure this function is correct and being called
            F_projected, Number(liveOption.strike), T_to_option_expiry,
            riskFreeRate, currentIV, liveOption.optionType
          );
          // console.log(`Leg ${liveOption.symbol} Projected Greeks:`, legGreeks); // << DEBUG
        } else {
          // Option expired or zero volatility scenario
          projectedOptPrice = liveOption.optionType === 'CE'
            ? Math.max(0, numericNiftyTarget - Number(liveOption.strike))
            : Math.max(0, Number(liveOption.strike) - numericNiftyTarget);
          
          // For expired/zero-vol options, set terminal greeks
          if (T_to_option_expiry <= 0) { // Expired
            legGreeks.delta = liveOption.optionType === 'CE' 
                              ? (numericNiftyTarget > Number(liveOption.strike) ? 1 : (numericNiftyTarget < Number(liveOption.strike) ? 0 : 0.5))
                              : (numericNiftyTarget < Number(liveOption.strike) ? -1 : (numericNiftyTarget > Number(liveOption.strike) ? 0 : -0.5));
          } else { // Sigma is effectively 0 (currentIV <= 0)
            if (liveOption.optionType === 'CE') legGreeks.delta = numericNiftyTarget >= Number(liveOption.strike) ? Math.exp(-riskFreeRate * T_to_option_expiry) : 0;
            else legGreeks.delta = numericNiftyTarget <= Number(liveOption.strike) ? -Math.exp(-riskFreeRate * T_to_option_expiry) : 0;
            const intrinsicPrice = liveOption.optionType === 'CE' ? Math.max(0, numericNiftyTarget - Number(liveOption.strike)) : Math.max(0, Number(liveOption.strike) - numericNiftyTarget);
            legGreeks.theta = -riskFreeRate * intrinsicPrice * Math.exp(-riskFreeRate * T_to_option_expiry) / 365.25; // Daily theta due to discounting
          }
        }

        const entryPriceNum = parseFloat(leg.price);
        const pnlPerShare = (projectedOptPrice - entryPriceNum) * (leg.buySell === 'Buy' ? 1 : -1);
        
        let scaleForTotal = 1;
        if (multiplyByLotSize) scaleForTotal *= (leg.lotSize || 1);
        if (multiplyByNumLots) scaleForTotal *= (leg.lots || 1);
        const direction = leg.buySell === 'Buy' ? 1 : -1;

        aggProjectedPnL += pnlPerShare * scaleForTotal;
        aggDelta += legGreeks.delta * direction * scaleForTotal;
        aggGamma += legGreeks.gamma * scaleForTotal; // Gamma sums up, direction doesn't flip its sign for strategy
        aggTheta += legGreeks.theta * direction * scaleForTotal;
        aggVega += legGreeks.vega * scaleForTotal;   // Vega sums up, direction doesn't flip its sign for strategy

        return {
          ...leg,
          instrument: `${leg.buySell === 'Buy' ? '' : 'S '} ${leg.lots || 1} X ${liveOption.expiry.substring(0,9).replace(/(\d{2})([A-Z]{3})(\d{2})/, '$1-$2-$3')} ${liveOption.strike} ${liveOption.optionType}`,
          projectedOptionPrice: projectedOptPrice,
          projectedPnLPerShare: pnlPerShare,
          projectedGreeks: legGreeks, // <<< ENSURE THIS OBJECT CONTAINS THE NEWLY CALCULATED GREEKS
          entryPrice: entryPriceNum,
          ltp: parseFloat(liveOption.lastPrice)
        };
      });

    return {
      legs: projectedLegs,
      totals: { projectedPnL: aggProjectedPnL, delta: aggDelta, gamma: aggGamma, theta: aggTheta, vega: aggVega }
    };
  }, [strategyLegs, niftyTarget, targetDate, getOptionByToken, riskFreeRate, multiplyByLotSize, multiplyByNumLots, currentUnderlying]); // Added currentUnderlying if DEFAULT_VOLATILITY depends on it indirectly

  const dynamicPayoffData = useMemo(() => { // For Payoff Chart
    if (!currentDisplaySpot || strategyLegs.length === 0 || !projectedStrategyData || !projectedStrategyData.legs.length) return null;

    const numPoints = 40; // More points for smoother chart
    const numericCenterSpot = parseFloat(niftyTarget || currentDisplaySpot);
    const priceRange = numericCenterSpot * SPOT_SLIDER_RANGE_PERCENT * 1.5; // Wider range for chart

    const labels = [];
    const pnlOnExpiryData = [];
    const pnlOnTargetDateData = [];

    for (let i = 0; i <= numPoints; i++) {
      const underlyingPriceAtTick = (numericCenterSpot - priceRange) + (2 * priceRange * i / numPoints);
      labels.push(underlyingPriceAtTick.toFixed(0));
      let expiryPnLForTick = 0;
      let targetDatePnLForTick = 0;

      projectedStrategyData.legs.forEach(leg => {
        if(!leg.token) return; // Skip if leg is somehow invalid after projection
        const liveOption = getOptionByToken(leg.token); // For IV
        const currentIV = liveOption ? parseFloat(liveOption.iv) / 100 : DEFAULT_VOLATILITY;
        const entryPriceNum = parseFloat(leg.entryPrice);
        const legLots = leg.lots || 1;
        const legLotSize = leg.lotSize || 1;
        const direction = leg.buySell === 'Buy' ? 1 : -1;

        // P&L on Expiry
        let expiryOptVal = 0;
        if (leg.optionType === 'CE') expiryOptVal = Math.max(0, underlyingPriceAtTick - Number(leg.strike));
        else expiryOptVal = Math.max(0, Number(leg.strike) - underlyingPriceAtTick);
        expiryPnLForTick += (expiryOptVal - entryPriceNum) * direction * legLots * legLotSize;

        // P&L on Target Date
        const T_target = timeToExpiry(leg.expiry, new Date(targetDate));
        let targetOptVal = 0;
        if (T_target > 0) {
          const F_target = underlyingPriceAtTick * Math.exp(riskFreeRate * T_target);
          targetOptVal = black76Price(F_target, Number(leg.strike), T_target, riskFreeRate, currentIV, leg.optionType);
        } else {
          if (leg.optionType === 'CE') targetOptVal = Math.max(0, underlyingPriceAtTick - Number(leg.strike));
          else targetOptVal = Math.max(0, Number(leg.strike) - underlyingPriceAtTick);
        }
        targetDatePnLForTick += (targetOptVal - entryPriceNum) * direction * legLots * legLotSize;
      });
      pnlOnExpiryData.push(expiryPnLForTick);
      pnlOnTargetDateData.push(targetDatePnLForTick);
    }
    return {
      labels,
      datasets: [
        { label: 'P&L on Expiry', data: pnlOnExpiryData, borderColor: 'rgb(75, 192, 192)', tension: 0.1, pointRadius: 0 },
        { label: `P&L on ${new Date(targetDate).toLocaleDateString('en-GB', {day:'numeric', month:'short'})}`, data: pnlOnTargetDateData, borderColor: 'rgb(255, 99, 132)', tension: 0.1, pointRadius: 0 },
      ],
    };
  }, [strategyLegs, niftyTarget, targetDate, currentDisplaySpot, getOptionByToken, riskFreeRate, projectedStrategyData.legs]);


  const handleDateSliderChange = useCallback((e) => {
    const sliderValue = parseInt(e.target.value, 10); // 0-100
    const minDateTime = new Date(minDateForSlider).getTime();
    const maxDateTime = new Date(maxDateForSlider).getTime();
    if (isNaN(minDateTime) || isNaN(maxDateTime) || minDateTime >= maxDateTime) {
        onTargetDateChange(new Date().toISOString().slice(0,16)); return;
    }
    const newTargetTime = minDateTime + (maxDateTime - minDateTime) * (sliderValue / 100);
    const newTargetDateObj = new Date(newTargetTime);
    newTargetDateObj.setMinutes(newTargetDateObj.getMinutes() - newTargetDateObj.getTimezoneOffset());
    onTargetDateChange(newTargetDateObj.toISOString().slice(0, 16));
  }, [minDateForSlider, maxDateForSlider, onTargetDateChange]);

  const dateSliderValue = useMemo(() => {
    const minDateTime = new Date(minDateForSlider).getTime();
    const maxDateTime = new Date(maxDateForSlider).getTime();
    const currentTargetTime = new Date(targetDate).getTime();
    if (isNaN(minDateTime) || isNaN(maxDateTime) || isNaN(currentTargetTime) || maxDateTime <= minDateTime) return 0;
    if (currentTargetTime <= minDateTime) return 0;
    if (currentTargetTime >= maxDateTime) return 100;
    return Math.round(((currentTargetTime - minDateTime) / (maxDateTime - minDateTime)) * 100);
  }, [targetDate, minDateForSlider, maxDateForSlider]);

  const daysToTargetDisplay = useMemo(() => {
    if (!targetDate) return 'N/A';
    const target = new Date(targetDate);
    const today = new Date();
    target.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    const diffTime = target.getTime() - today.getTime();
    if (diffTime < 0 && Math.abs(diffTime) < 1000*60*60*24 ) return '0'; // if target is today but slightly in past
    if (diffTime < 0) return 'Past';
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [targetDate]);


  // Chart.js rendering effect
  useEffect(() => {
    if (activeChartTab === "payoffgraph" && chartRef.current && dynamicPayoffData) {
        const Chart = window.Chart; // Assuming Chart.js is globally available
        if (!Chart) {
            console.error("Chart.js not loaded");
            return;
        }
        const ctx = chartRef.current.getContext('2d');
        if (chartRef.current.chartInstance) {
            chartRef.current.chartInstance.destroy();
        }
        chartRef.current.chartInstance = new Chart(ctx, {
            type: 'line',
            data: dynamicPayoffData,
            options: {
                responsive: true, maintainAspectRatio: false, scales: { y: { title: { display: true, text: 'Profit / Loss'}}, x: { title: {display: true, text: 'Underlying Price at Expiry/Target'}}}
            }
        });
    }
  }, [dynamicPayoffData, activeChartTab]);


  return (
    <section className="sv-payoff-chart-section">
      <StrategyTabs
        tabs={chartTabs}
        activeTab={activeChartTab}
        onTabChange={onChartTabChange}
        className="chart-section-tabs"
      />

      <div className="tab-content-area">
        {activeChartTab === "payoffgraph" && (
          <div className="payoff-graph-content">
            {/* Subtabs and OI bar can remain as per your previous UI */}
            <div className="chart-display-area" style={{height: '350px', position: 'relative'}}> {/* Ensure height for canvas */}
              <canvas ref={chartRef} id="payoffChartCanvas"></canvas>
              {(!dynamicPayoffData && strategyLegs.length > 0) && <div className="chart-loading-placeholder">Calculating Payoff...</div>}
              {(strategyLegs.length === 0) && <div className="chart-loading-placeholder">Add strategy legs to see payoff.</div>}
            </div>
          </div>
        )}
        {activeChartTab === "p&ltable" && (
           <>   <div className="greeks-controls-header">
              <Checkbox label="Multiply by Lot Size" checked={multiplyByLotSize} onChange={(value) => onMultiplyByLotSizeChange(value)} className="greeks-multiplier-checkbox"/>
              <Checkbox label="Multiply by Number of Lots" checked={multiplyByNumLots} onChange={(value) => onMultiplyByNumLotsChange(value)} className="greeks-multiplier-checkbox"/>
            </div>
          <PnLTable
            projectedLegsData={projectedStrategyData.legs}
            totals={projectedStrategyData.totals}
             multiplyByLotSize={multiplyByLotSize}
             multiplyByNumLots={multiplyByNumLots}
          />
          </>
        )}
         {activeChartTab === "greeks" && (
        <div className="greeks-tab-content">
          <div className="greeks-controls-header">
            <Checkbox label="Multiply by Lot Size" checked={multiplyByLotSize} onChange={(value) => onMultiplyByLotSizeChange(value)} className="greeks-multiplier-checkbox"/>
            <Checkbox label="Multiply by Number of Lots" checked={multiplyByNumLots} onChange={(value) => onMultiplyByNumLotsChange(value)} className="greeks-multiplier-checkbox"/>
          </div>
          {/* VVVV DEBUG HERE VVVV */}
          {console.log("PayoffChartSection rendering GreeksTable with:", {
            projectedLegsData: projectedStrategyData.legs,
            totals: projectedStrategyData.totals
          })}
          <GreeksTable
            projectedLegsData={projectedStrategyData.legs} // Pass processed legs with projectedGreeks
            totals={projectedStrategyData.totals}       // Pass processed totals with summed greeks
          />
        </div>
      )}
         {activeChartTab === "strategychart" && ( <div className="tab-content-placeholder"><p>Strategy Chart Content Placeholder</p></div> )}
      </div>

      <div className="global-chart-controls">
        <div className="target-controls-row spot-controls">
          <div className="input-slider-group">
            <label htmlFor="spotTargetInput">{currentUnderlying || 'Spot'} Target</label>
            <div className="input-with-buttons">
                <Button variant="icon" size="small" icon="-" onClick={() => onNiftyTargetChange(prev => (parseFloat(prev || currentDisplaySpot || 0) - SPOT_SLIDER_STEP).toString())} />
                <Input id="spotTargetInput" type="number" value={niftyTarget} onChange={(e) => onNiftyTargetChange(e.target.value)} className="target-value-input"/>
                <Button variant="icon" size="small" icon="+" onClick={() => onNiftyTargetChange(prev => (parseFloat(prev || currentDisplaySpot || 0) + SPOT_SLIDER_STEP).toString())}/>
            </div>
            <input type="range" min={spotSliderMin} max={spotSliderMax} value={parseFloat(niftyTarget) || currentDisplaySpot || spotSliderMin} step={SPOT_SLIDER_STEP} onChange={(e) => onNiftyTargetChange(e.target.value)} className="global-target-slider spot-slider"/>
            <Button variant="link" size="small" onClick={() => onNiftyTargetChange(currentDisplaySpot?.toString() || "")}>Reset</Button>
          </div>
        </div>

        <div className="target-controls-row date-controls">
          <div className="input-slider-group">
            <label htmlFor="dateTargetInput">Date: {daysToTargetDisplay}D to Expiry</label>
            <div className="input-with-buttons date-input-actual-wrapper">
                {/* Simplified date display, actual input is hidden */}
                <Input id="dateTargetDisplay" type="text" value={targetDate ? new Date(targetDate).toLocaleDateString("en-GB", {day:"2-digit", month:"short", year:"numeric"}) : ''} readOnly className="target-value-input date-display-input" onClick={() => document.getElementById('hiddenDateTargetInput')?.showPicker?.()}/>
                <Input id="hiddenDateTargetInput" type="datetime-local" value={targetDate} onChange={(e) => onTargetDateChange(e.target.value)} className="hidden-date-input"/>
            </div>
            <input type="range" min="0" max="100" value={dateSliderValue} onChange={handleDateSliderChange} className="global-target-slider date-slider"/>
             <Button variant="link" size="small" onClick={() => { const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset()); onTargetDateChange(today.toISOString().slice(0,16)); }}>Reset</Button>
          </div>
        </div>
         {/* <div className="date-slider-labels">
            <span>{minDateForSlider ? new Date(minDateForSlider).toLocaleDateString("en-GB", {day:'2-digit', month:'short'}) : 'Today'}</span>
            <span>{maxDateForSlider ? new Date(maxDateForSlider).toLocaleDateString("en-GB", {day:'2-digit', month:'short'}) : 'Max Expiry'}</span>
        </div> */}
      </div>
    </section>
  );
};
export default React.memo(PayoffChartSection);
