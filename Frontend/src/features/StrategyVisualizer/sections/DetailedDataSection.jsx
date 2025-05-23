// src/features/StrategyVisualizer/sections/DetailedDataSection.jsx
import React, { useState, useMemo, useCallback } from 'react';
import Button from '../../../components/Button/Button';
import Checkbox from '../../../components/Checkbox/Checkbox';
import { black76Greeks, timeToExpiry } from '../../utils/optionPricingUtils';
import { DEFAULT_VOLATILITY, GLOBAL_IV_OFFSET_STEP, IV_ADJUSTMENT_STEP } from '../../../config';
import './DetailedDataSection.scss'; // Ensure this SCSS file exists and is linked

const DetailedDataSection = ({
  strategyLegs, currentUnderlying, getOptionByToken, riskFreeRate, liveOptionChainMap,
  projectedNiftyTarget, projectedTargetDate,
  individualIvAdjustments, onIndividualIvAdjustmentChange, 
  globalIvOffset, onGlobalIvOffsetChange, // globalIvOffset and its handler now from props
  onResetAllIvAdjustments, 
  getScenarioIV,
  multiplyByLotSize, onMultiplyByLotSizeChange,
  multiplyByNumLots, onMultiplyByNumLotsChange,
}) => {

  const handleLocalGlobalIvOffsetChange = useCallback((increment) => {
    onGlobalIvOffsetChange(prevOffset => prevOffset + increment); // Call parent's handler
  }, [onGlobalIvOffsetChange]);

  const handleLocalIndividualIvAdjust = useCallback((token, currentAdjustment, increment) => {
    const newValue = parseFloat((currentAdjustment + increment).toFixed(1));
    onIndividualIvAdjustmentChange(token, newValue);
  }, [onIndividualIvAdjustmentChange]);

  const strikewiseIVsDisplayData = useMemo(() => {
    return strategyLegs.filter(leg => leg.selected && leg.token).map(leg => {
      const liveOption = getOptionByToken(leg.token);
      if (!liveOption || liveOption.iv === undefined) return { id: leg.id, token: leg.token, strike: leg.strike, expiry: leg.expiry, effectiveIVDisplay: 'N/A', originalIV:0, chg:'N/A', currentIndividualAdjustment:0 };
      const originalIV = parseFloat(liveOption.iv);
      const individualAdjustment = individualIvAdjustments[leg.token] || 0;
      const effectiveIV = originalIV + individualAdjustment + globalIvOffset; // globalIvOffset from props
      return { id: leg.id, token: leg.token, strike: liveOption.strike, expiry: liveOption.expiry.substring(0,9).replace(/(\d{2})([A-Z]{3})(\d{2})/, '$1-$2-$3'), effectiveIVDisplay: effectiveIV.toFixed(2), originalIV, currentIndividualAdjustment: individualAdjustment, chg: (effectiveIV - originalIV).toFixed(1) };
    });
  }, [strategyLegs, getOptionByToken, globalIvOffset, individualIvAdjustments]);

  const greeksSourceLabel = useMemo(() => {
    const numericProjectedTarget = parseFloat(projectedNiftyTarget);
    return (projectedTargetDate && !isNaN(numericProjectedTarget)) ? "Projected Scenario" : "Live Scenario (IV Adj.)";
  }, [projectedNiftyTarget, projectedTargetDate]);

  const greeksSummary = useMemo(() => {
    let aggDelta = 0, aggGamma = 0, aggTheta = 0, aggVega = 0;
    const numericProjectedTarget = parseFloat(projectedNiftyTarget);
    const useProjectedScenario = projectedTargetDate && !isNaN(numericProjectedTarget);
    const projectionDate = useProjectedScenario ? new Date(projectedTargetDate) : new Date();

    strategyLegs.filter(leg => leg.selected && leg.token).forEach(leg => {
      const liveOption = getOptionByToken(leg.token);
      if (!liveOption || !liveOption.strike || !liveOption.expiry || liveOption.optionType === undefined) return;
      const scenarioIVForLeg = getScenarioIV(leg.token); // Uses globalIvOffset from StrategyVisualizer
      const T_to_calc = timeToExpiry(liveOption.expiry, projectionDate);
      let F_for_calc;
      if (useProjectedScenario) {
        F_for_calc = numericProjectedTarget * Math.exp(riskFreeRate * T_to_calc);
      } else {
        const spot = liveOption.marketData?.spot ? parseFloat(liveOption.marketData.spot) : numericProjectedTarget;
        F_for_calc = parseFloat(liveOption.marketData?.futures ?? (spot * Math.exp(riskFreeRate * T_to_calc)));
        if(isNaN(F_for_calc)) F_for_calc = spot;
      }
      if(isNaN(F_for_calc) || F_for_calc <=0) return;
      let legGreeks = black76Greeks(F_for_calc, Number(liveOption.strike), T_to_calc, riskFreeRate, scenarioIVForLeg, liveOption.optionType);
      const direction = leg.buySell === 'Buy' ? 1 : -1;
      let scale = 1; if (multiplyByLotSize) scale *= (leg.lotSize || 1); if (multiplyByNumLots) scale *= (leg.lots || 1);
      if(!isNaN(legGreeks.delta)) aggDelta += legGreeks.delta * direction * scale;
      if(!isNaN(legGreeks.gamma)) aggGamma += legGreeks.gamma * scale; 
      if(!isNaN(legGreeks.theta)) aggTheta += legGreeks.theta * direction * scale;
      if(!isNaN(legGreeks.vega)) aggVega += legGreeks.vega * scale; // Raw vega
    });
    return { delta: aggDelta, gamma: aggGamma, theta: aggTheta, vega: aggVega / 100 }; // Scale final vega
  }, [strategyLegs, getOptionByToken, projectedNiftyTarget, projectedTargetDate, riskFreeRate, multiplyByLotSize, multiplyByNumLots, getScenarioIV, individualIvAdjustments]); // Added individualIvAdjustments

  const targetDayFuturesInfo = useMemo(() => { /* ... Placeholder or your existing logic from paste.txt, ensure getScenarioIV is used if it depends on scenario IV ... */
     const firstLeg = strategyLegs.find(l => l.selected && l.token);
     const liveOptForSpot = firstLeg ? getOptionByToken(firstLeg.token) : null;
     const spotPrice = liveOptForSpot?.marketData?.spot ? parseFloat(liveOptForSpot.marketData.spot) : (currentUnderlying === "BANKNIFTY" ? 48000 : 23000);
     const sdVolatility = firstLeg ? getScenarioIV(firstLeg.token) : DEFAULT_VOLATILITY; // Use scenario IV
     const TTM = 30/365.25; const oneSdPoints = spotPrice * sdVolatility * Math.sqrt(TTM);
     const date = new Date(); date.setDate(date.getDate() + 30);
     return { date: date.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}), price:spotPrice>0?spotPrice.toFixed(2):'N/A', sd:spotPrice>0&&oneSdPoints>0&&!isNaN(oneSdPoints)?[{level:'1 SD',points:`${oneSdPoints.toFixed(1)} (${(oneSdPoints/spotPrice*100).toFixed(1)}%)`,priceLow:(spotPrice-oneSdPoints).toFixed(1),priceHigh:(spotPrice+oneSdPoints).toFixed(1)},{level:'2 SD',points:`${(oneSdPoints*2).toFixed(1)} (${(oneSdPoints*2/spotPrice*100).toFixed(1)}%)`,priceLow:(spotPrice-oneSdPoints*2).toFixed(1),priceHigh:(spotPrice+oneSdPoints*2).toFixed(1)}]:[]};
  }, [strategyLegs, getOptionByToken, currentUnderlying, getScenarioIV, liveOptionChainMap]);

  return (
    <section className="sv-detailed-data-section">
      <div className="data-column strikewise-ivs-column">
        <h4>Strikewise IVs <Button variant="link" size="small" onClick={onResetAllIvAdjustments}>Reset All IVs</Button></h4>
        <div className="offset-control">
          <span>Global Offset</span>
          <Button variant="tertiary" size="small" onClick={() => handleLocalGlobalIvOffsetChange(-GLOBAL_IV_OFFSET_STEP)}>-</Button>
          <span className="offset-value">{globalIvOffset.toFixed(1)}%</span>
          <Button variant="tertiary" size="small" onClick={() => handleLocalGlobalIvOffsetChange(GLOBAL_IV_OFFSET_STEP)}>+</Button>
        </div>
        <table><thead><tr><th>Strike</th><th>Expiry</th><th>Effective IV</th><th>Chg (Live)</th><th>Adjust Indiv.</th></tr></thead><tbody>
          {strikewiseIVsDisplayData.map((item) => (<tr key={item.id}><td>{item.strike}</td><td>{item.expiry}</td><td>{item.effectiveIVDisplay}%</td><td>{item.chg}%</td>
            <td className="iv-adjust-cell">
              <Button variant="icon" size="small" className="iv-adjust-btn" onClick={() => handleLocalIndividualIvAdjust(item.token, item.currentIndividualAdjustment, -IV_ADJUSTMENT_STEP)}>–</Button>
              <span className="individual-offset-value">{(item.currentIndividualAdjustment || 0).toFixed(1)}%</span>
              <Button variant="icon" size="small" className="iv-adjust-btn" onClick={() => handleLocalIndividualIvAdjust(item.token, item.currentIndividualAdjustment, IV_ADJUSTMENT_STEP)}>+</Button>
            </td></tr>))}
          {strikewiseIVsDisplayData.length === 0 && <tr><td colSpan="5" className="no-data-row">No legs selected.</td></tr>}
        </tbody></table>
      </div>
      <div className="data-column greeks-summary-column">
        <h4>Greeks <span className="greeks-source-label">({greeksSourceLabel})</span></h4>
        <Checkbox label="Lot Size" checked={multiplyByLotSize} onChange={onMultiplyByLotSizeChange} className="greeks-checkbox"/>
        <Checkbox label="Num Lots" checked={multiplyByNumLots} onChange={onMultiplyByNumLotsChange} className="greeks-checkbox"/>
        <table><tbody>
            <tr><td>Delta</td><td>{greeksSummary.delta?.toFixed(2) || '-'}</td></tr>
            <tr><td>Gamma</td><td>{greeksSummary.gamma?.toFixed(4) || '-'}</td></tr>
            <tr><td>Theta</td><td>{greeksSummary.theta?.toFixed(2) || '-'}</td></tr>
            <tr><td>Vega</td><td>{greeksSummary.vega?.toFixed(2) || '-'}</td></tr>
        </tbody></table>
      </div>
      <div className="data-column target-day-futures-column">
         <h4>Target Day Futures</h4>
         {(targetDayFuturesInfo.price && targetDayFuturesInfo.price !== "0.00" && targetDayFuturesInfo.price !== 'N/A') && (<p className="futures-price-display">{targetDayFuturesInfo.date} <span className="price-value">{targetDayFuturesInfo.price}</span></p>)}
         <h4>Standard Deviation</h4>
         <table><thead><tr><th>SD</th><th>Points</th><th>Price</th></tr></thead><tbody>
            {targetDayFuturesInfo.sd?.length > 0 ? (targetDayFuturesInfo.sd.map((item, index) => (<tr key={index}><td>{item.level}</td><td>{item.points}</td><td>{item.priceLow}<br/>{item.priceHigh}</td></tr>))) : (<tr><td colSpan="3" className="no-data-row">SD data unavailable.</td></tr>)}
         </tbody></table>
      </div>
    </section>
  );
};
export default React.memo(DetailedDataSection);
