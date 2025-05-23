// src/features/StrategyVisualizer/sections/PayoffChartSection.jsx
import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import StrategyTabs from "../components/StrategyTabs"; // Assuming component exists
import Button from "../../../components/Button/Button"; // Assuming component exists
import Input from "../../../components/Input/Input"; // Assuming component exists
import Checkbox from "../../../components/Checkbox/Checkbox"; // Assuming component exists
import GreeksTable from "../components/GreeksTable"; // Assuming component exists
import PnLTable from "../components/PnLTable"; // Assuming component exists
import { Chart, registerables } from "chart.js"; // For payoff graph

import {
  black76Price,
  black76Greeks,
  timeToExpiry,
} from "../../utils/optionPricingUtils";
import {
  DEFAULT_VOLATILITY,
  SPOT_SLIDER_RANGE_PERCENT,
  SPOT_SLIDER_STEP,
  MAX_DAYS_FOR_DATE_SLIDER,
} from "../../../config";
import "./PayoffChartSection.scss"; // Ensure this SCSS file exists

Chart.register(...registerables); // Register all Chart.js components

const PayoffChartSection = ({
  activeChartTab,
  onChartTabChange,
  niftyTarget,
  onNiftyTargetChange, // Projected Underlying Price from StrategyVisualizer
  targetDate,
  onTargetDateChange, // Projection Date from StrategyVisualizer
  strategyLegs,
  getOptionByToken,
  liveOptionChainMap,
  currentUnderlying,
  riskFreeRate,
  multiplyByLotSize,
  onMultiplyByLotSizeChange,
  multiplyByNumLots,
  onMultiplyByNumLotsChange,
  getScenarioIV, // Function from StrategyVisualizer to get IV with all adjustments
}) => {
  const chartInstanceRef = useRef(null); // To store the Chart.js instance
  const canvasRef = useRef(null); // Ref for the canvas element

  // State for spot price slider range and current market spot display
  const [currentDisplaySpot, setCurrentDisplaySpot] = useState(null);
  const [spotSliderMin, setSpotSliderMin] = useState(0);
  const [spotSliderMax, setSpotSliderMax] = useState(0);

  // State for date slider range (these will hold valid datetime-local strings)
  const [minDateForSliderRange, setMinDateForSliderRange] = useState("");
  const [maxDateForSliderRange, setMaxDateForSliderRange] = useState("");

  // Effect to initialize niftyTarget based on current spot and setup slider ranges
  useEffect(() => {
    let spot = null;
    let latestExpiryDateInStrategy = new Date(); // Default to today
    let foundMaxExpiry = false;

    // Determine spot price for niftyTarget initialization and spot slider range
    const firstSelectedLegToken = strategyLegs.find(
      (leg) => leg.selected && leg.token
    )?.token;
    if (firstSelectedLegToken) {
      const option = getOptionByToken(firstSelectedLegToken);
      spot = option?.marketData?.spot ?? option?.marketData?.futures;
    } else if (currentUnderlying && liveOptionChainMap?.size > 0) {
      const anyOption = Array.from(liveOptionChainMap.values()).find(
        (opt) => opt.underlying === currentUnderlying && opt.marketData
      );
      spot = anyOption?.marketData?.spot ?? anyOption?.marketData?.futures;
    }

    const numericSpot = parseFloat(spot);
    const fallbackSpot =
      currentUnderlying === "BANKNIFTY"
        ? 48000
        : currentUnderlying === "NIFTY"
        ? 23000
        : 0;
    const spotToUse =
      !isNaN(numericSpot) && numericSpot > 0 ? numericSpot : fallbackSpot;

    setCurrentDisplaySpot(spotToUse);
    // Initialize niftyTarget only if it's empty or invalid, and spotToUse is valid
    if (
      (niftyTarget === "" || isNaN(parseFloat(niftyTarget))) &&
      spotToUse > 0
    ) {
      onNiftyTargetChange(spotToUse.toFixed(2));
    }

    if (spotToUse > 0) {
      setSpotSliderMin(
        Math.max(
          0,
          Math.round(
            (spotToUse * (1 - SPOT_SLIDER_RANGE_PERCENT)) / SPOT_SLIDER_STEP
          ) * SPOT_SLIDER_STEP
        )
      );
      setSpotSliderMax(
        Math.round(
          (spotToUse * (1 + SPOT_SLIDER_RANGE_PERCENT)) / SPOT_SLIDER_STEP
        ) * SPOT_SLIDER_STEP
      );
    } else {
      // Handle case where spotToUse is 0 or invalid (e.g., no data yet)
      setSpotSliderMin(0);
      setSpotSliderMax(
        Math.round((fallbackSpot * 1.5) / SPOT_SLIDER_STEP) *
          SPOT_SLIDER_STEP || 30000
      ); // Default max if fallback is 0
    }

    // Determine date slider range
    if (strategyLegs.length > 0 && strategyLegs.some((l) => l.selected)) {
      strategyLegs.forEach((leg) => {
        if (leg.selected && leg.expiry) {
          try {
            const day = parseInt(leg.expiry.substring(0, 2), 10);
            const monthStr = leg.expiry.substring(2, 5).toUpperCase();
            const year = parseInt(leg.expiry.substring(5, 9), 10);
            const months = {
              JAN: 0,
              FEB: 1,
              MAR: 2,
              APR: 3,
              MAY: 4,
              JUN: 5,
              JUL: 6,
              AUG: 7,
              SEP: 8,
              OCT: 9,
              NOV: 10,
              DEC: 11,
            };
            const legExpiryDate = new Date(
              Date.UTC(year, months[monthStr], day, 10, 0, 0)
            ); // Use UTC for consistency
            if (!isNaN(legExpiryDate.getTime())) {
              if (
                !foundMaxExpiry ||
                legExpiryDate > latestExpiryDateInStrategy
              ) {
                latestExpiryDateInStrategy = legExpiryDate;
                foundMaxExpiry = true;
              }
            }
          } catch (e) {
            console.warn(
              "Error parsing leg expiry for date slider range:",
              leg.expiry,
              e
            );
          }
        }
      });
    }

    if (!foundMaxExpiry) {
      // If no valid expiries found or no legs, default max date
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + MAX_DAYS_FOR_DATE_SLIDER);
      latestExpiryDateInStrategy = futureDate;
    }

    const todayForSliderInternal = new Date();
    todayForSliderInternal.setMinutes(
      todayForSliderInternal.getMinutes() -
        todayForSliderInternal.getTimezoneOffset()
    ); // Adjust to local for input type=datetime-local
    const newMinDateISO = todayForSliderInternal.toISOString().slice(0, 16);
    setMinDateForSliderRange(newMinDateISO);

    let maxDateObjInternal = new Date(latestExpiryDateInStrategy);
    // Ensure maxDate is not before today
    if (maxDateObjInternal.getTime() < todayForSliderInternal.getTime()) {
      const futureMax = new Date(todayForSliderInternal); // Start from today
      futureMax.setDate(futureMax.getDate() + MAX_DAYS_FOR_DATE_SLIDER); // Add default days
      maxDateObjInternal = futureMax;
    }
    maxDateObjInternal.setMinutes(
      maxDateObjInternal.getMinutes() - maxDateObjInternal.getTimezoneOffset()
    ); // Adjust to local
    const newMaxDateISO = maxDateObjInternal.toISOString().slice(0, 16);
    setMaxDateForSliderRange(newMaxDateISO);

    // Ensure current targetDate is within the new valid range
    // This is important if legs change and the old targetDate becomes out of bounds
    if (targetDate < newMinDateISO) {
      onTargetDateChange(newMinDateISO);
    } else if (targetDate > newMaxDateISO) {
      onTargetDateChange(newMaxDateISO);
    }
  }, [
    strategyLegs,
    getOptionByToken,
    currentUnderlying,
    liveOptionChainMap,
    onNiftyTargetChange,
    targetDate,
    onTargetDateChange,
  ]);
  // Added targetDate & onTargetDateChange to dep array of above useEffect
  // This ensures that if targetDate is programmatically changed (e.g. by parent)
  // and it falls outside the current slider range (which might also change due to leg updates),
  // it gets clamped. This might cause a quick double update if targetDate was the cause of the re-evaluation,
  // but ensures consistency. Removing niftyTarget from dep array helps prevent loops with its own updater.

  const chartTabs = [
    { id: "payoffgraph", label: "Payoff Graph" },
    { id: "p&ltable", label: "P&L Table" }, // Use &lt; for <
    { id: "greeks", label: "Greeks" },
    { id: "strategychart", label: "Strategy Chart" }, // Placeholder
  ];

  const projectedStrategyData = useMemo(() => {
    // console.log("PAYOFFCHART: Recalculating projectedStrategyData. NiftyTarget:", niftyTarget, "TargetDate:", targetDate, "IVFn:", !!getScenarioIV);
    if (
      !niftyTarget ||
      !targetDate ||
      strategyLegs.length === 0 ||
      !getOptionByToken ||
      !riskFreeRate ||
      !getScenarioIV
    ) {
      return {
        legs: [],
        totals: { projectedPnL: 0, delta: 0, gamma: 0, theta: 0, vega: 0 },
      };
    }
    const numericNiftyTarget = parseFloat(niftyTarget);
    if (isNaN(numericNiftyTarget)) {
      // console.warn("Projected Data: NiftyTarget is NaN", niftyTarget);
      return {
        legs: [],
        totals: { projectedPnL: 0, delta: 0, gamma: 0, theta: 0, vega: 0 },
      };
    }
    const projectionDate = new Date(targetDate); // Uses targetDate from props
    let aggProjectedPnL = 0,
      aggDelta = 0,
      aggGamma = 0,
      aggTheta = 0,
      aggVega = 0;

    const projectedLegsResult = strategyLegs
      .filter((leg) => leg.selected && leg.token)
      .map((leg) => {
        const liveOption = getOptionByToken(leg.token);
        if (
          !liveOption ||
          !liveOption.strike ||
          !liveOption.expiry ||
          liveOption.optionType === undefined
        ) {
          // console.warn("Projected Data: Missing live option data for leg", leg.token);
          return {
            ...leg,
            instrument: `${leg.buySell} ${leg.lots || 1}x Data N/A`,
            projectedOptionPrice: null,
            projectedPnLPerShare: null,
            projectedGreeks: {},
            entryPrice: parseFloat(leg.price),
            ltp: null,
          };
        }

        const scenarioIVForLeg = getScenarioIV(leg.token); // Uses getScenarioIV from StrategyVisualizer
        const T_to_option_expiry = timeToExpiry(
          liveOption.expiry,
          projectionDate
        ); // Uses projectionDate
        let projectedOptPrice,
          legGreeks = { delta: 0, gamma: 0, theta: 0, vega: 0 };

        if (T_to_option_expiry > 0 && scenarioIVForLeg > 0) {
          const F_projected =
            numericNiftyTarget * Math.exp(riskFreeRate * T_to_option_expiry);
          projectedOptPrice = black76Price(
            F_projected,
            Number(liveOption.strike),
            T_to_option_expiry,
            riskFreeRate,
            scenarioIVForLeg,
            liveOption.optionType
          );
          legGreeks = black76Greeks(
            F_projected,
            Number(liveOption.strike),
            T_to_option_expiry,
            riskFreeRate,
            scenarioIVForLeg,
            liveOption.optionType
          );
        } else {
          // Option expired or zero volatility for projection
          projectedOptPrice =
            liveOption.optionType === "CE"
              ? Math.max(0, numericNiftyTarget - Number(liveOption.strike))
              : Math.max(0, Number(liveOption.strike) - numericNiftyTarget);
          // Get terminal greeks (delta is 0, 0.5, or 1/-1, others 0 if T_to_option_expiry is truly 0)
          legGreeks = black76Greeks(
            numericNiftyTarget,
            Number(liveOption.strike),
            T_to_option_expiry,
            riskFreeRate,
            scenarioIVForLeg,
            liveOption.optionType
          );
        }
        const entryPriceNum = parseFloat(leg.price);
        const pnlPerShare =
          isNaN(projectedOptPrice) || isNaN(entryPriceNum)
            ? 0
            : (projectedOptPrice - entryPriceNum) *
              (leg.buySell === "Buy" ? 1 : -1);

        let scale = 1;
        if (multiplyByLotSize) scale *= leg.lotSize || 1;
        if (multiplyByNumLots) scale *= leg.lots || 1;
        console.log(scale,multiplyByLotSize,multiplyByNumLots,leg.lots,leg.lotSize);
        const direction = leg.buySell === "Buy" ? 1 : -1;

        if (!isNaN(pnlPerShare)) aggProjectedPnL += pnlPerShare * scale;
        if (!isNaN(legGreeks.delta))
          aggDelta += legGreeks.delta * direction * scale;
        if (!isNaN(legGreeks.gamma)) aggGamma += legGreeks.gamma * scale; // Gamma typically sums up (strategy convexity)
        if (!isNaN(legGreeks.theta))
          aggTheta += legGreeks.theta * direction * scale;
        if (!isNaN(legGreeks.vega)) aggVega += legGreeks.vega * scale; // Vega typically sums up (strategy vega exposure, raw vega)

        return {
          ...leg,
          instrument: `${leg.buySell === "Buy" ? "" : "S "} ${
            leg.lots || 1
          } X ${liveOption.expiry
            .substring(0, 9)
            .replace(/(\d{2})([A-Z]{3})(\d{2})/, "$1-$2-$3")} ${
            liveOption.strike
          }${liveOption.optionType}`,
          projectedOptionPrice: projectedOptPrice,
          projectedPnLPerShare: pnlPerShare,
          projectedGreeks: legGreeks, // Store unscaled, per-contract greeks
          entryPrice: entryPriceNum,
          ltp:
            liveOption.lastPrice !== undefined
              ? parseFloat(liveOption.lastPrice)
              : null,
        };
      });
    return {
      legs: projectedLegsResult,
      totals: {
        projectedPnL: aggProjectedPnL,
        delta: aggDelta,
        gamma: aggGamma,
        theta: aggTheta,
        vega: aggVega,
      },
    };
  }, [
    strategyLegs,
    niftyTarget,
    targetDate,
    getOptionByToken,
    riskFreeRate,
    multiplyByLotSize,
    multiplyByNumLots,
    getScenarioIV,
  ]); // `targetDate` is a key dependency

  const dynamicPayoffData = useMemo(() => {
    if (
      !currentDisplaySpot ||
      strategyLegs.length === 0 ||
      !projectedStrategyData ||
      !projectedStrategyData.legs.length ||
      !getScenarioIV ||
      !targetDate
    )
      return null;
    const numPoints = 40;
    const numericCenterSpot = parseFloat(niftyTarget || currentDisplaySpot);
    const priceRange = numericCenterSpot * SPOT_SLIDER_RANGE_PERCENT * 1.2; // A bit wider range for the chart
    const labels = [];
    const pnlOnExpiryData = [];
    const pnlOnTargetDateData = [];

    for (let i = 0; i <= numPoints; i++) {
      const underlyingPriceAtTick =
        numericCenterSpot - priceRange + (2 * priceRange * i) / numPoints;
      labels.push(underlyingPriceAtTick.toFixed(0));
      let expiryPnLForTick = 0,
        targetDatePnLForTick = 0;

      projectedStrategyData.legs.forEach((leg) => {
        if (!leg.token || leg.entryPrice === undefined) return;
        const scenarioIV = getScenarioIV(leg.token); // Use scenario IV for T+0 line
        const entryPriceNum = parseFloat(leg.entryPrice);
        const scale = (leg.lots || 1) * (leg.lotSize || 1);
        const direction = leg.buySell === "Buy" ? 1 : -1;

        // P&L on Expiry
        let expiryOptVal =
          leg.optionType === "CE"
            ? Math.max(0, underlyingPriceAtTick - Number(leg.strike))
            : Math.max(0, Number(leg.strike) - underlyingPriceAtTick);
        if (!isNaN(expiryOptVal) && !isNaN(entryPriceNum))
          expiryPnLForTick +=
            (expiryOptVal - entryPriceNum) * direction * scale;

        // P&L on Target Date (T+0 line)
        const T_target = timeToExpiry(leg.expiry, new Date(targetDate)); // Uses targetDate from props
        let targetOptVal = 0;
        if (T_target > 0 && scenarioIV > 0) {
          const F_target =
            underlyingPriceAtTick * Math.exp(riskFreeRate * T_target);
          targetOptVal = black76Price(
            F_target,
            Number(leg.strike),
            T_target,
            riskFreeRate,
            scenarioIV,
            leg.optionType
          );
        } else {
          // Option expired by targetDate
          targetOptVal =
            leg.optionType === "CE"
              ? Math.max(0, underlyingPriceAtTick - Number(leg.strike))
              : Math.max(0, Number(leg.strike) - underlyingPriceAtTick);
        }
        if (!isNaN(targetOptVal) && !isNaN(entryPriceNum))
          targetDatePnLForTick +=
            (targetOptVal - entryPriceNum) * direction * scale;
      });
      pnlOnExpiryData.push(expiryPnLForTick);
      pnlOnTargetDateData.push(targetDatePnLForTick);
    }
    const targetDateLabel = targetDate
      ? new Date(targetDate).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        })
      : "Target Date";
    return {
      labels,
      datasets: [
        {
          label: "P&L on Expiry",
          data: pnlOnExpiryData,
          borderColor: "rgb(75, 192, 192)",
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 1.5,
        },
        {
          label: `P&L on ${targetDateLabel}`,
          data: pnlOnTargetDateData,
          borderColor: "rgb(255, 99, 132)",
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 1.5,
        },
      ],
    };
  }, [
    strategyLegs,
    niftyTarget,
    targetDate,
    currentDisplaySpot,
    getOptionByToken,
    riskFreeRate,
    projectedStrategyData.legs,
    getScenarioIV,
  ]);

  // --- Date Slider Logic ---
  const handleDateSliderChange = useCallback(
    (e) => {
      const sliderValue = parseInt(e.target.value, 10); // 0-100
      if (!minDateForSliderRange || !maxDateForSliderRange) {
        console.warn("Date slider range not set for handleDateSliderChange.");
        return;
      }
      const minEpoch = new Date(minDateForSliderRange).getTime();
      const maxEpoch = new Date(maxDateForSliderRange).getTime();
      if (isNaN(minEpoch) || isNaN(maxEpoch) || minEpoch >= maxEpoch) {
        console.warn("Date slider: Invalid min/max range.");
        const today = new Date();
        today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
        onTargetDateChange(today.toISOString().slice(0, 16)); // Fallback
        return;
      }
      const newTargetEpoch =
        minEpoch + (maxEpoch - minEpoch) * (sliderValue / 100);
      const newTargetDateObj = new Date(newTargetEpoch);
      newTargetDateObj.setMinutes(
        newTargetDateObj.getMinutes() - newTargetDateObj.getTimezoneOffset()
      ); // Adjust for datetime-local
      onTargetDateChange(newTargetDateObj.toISOString().slice(0, 16));
    },
    [minDateForSliderRange, maxDateForSliderRange, onTargetDateChange]
  );

  const dateSliderValue = useMemo(() => {
    if (!minDateForSliderRange || !maxDateForSliderRange || !targetDate)
      return 0;
    const minEpoch = new Date(minDateForSliderRange).getTime();
    const maxEpoch = new Date(maxDateForSliderRange).getTime();
    const currentTargetEpoch = new Date(targetDate).getTime();
    if (
      isNaN(minEpoch) ||
      isNaN(maxEpoch) ||
      isNaN(currentTargetEpoch) ||
      maxEpoch <= minEpoch
    )
      return 0;
    if (currentTargetEpoch <= minEpoch) return 0;
    if (currentTargetEpoch >= maxEpoch) return 100;
    return Math.round(
      ((currentTargetEpoch - minEpoch) / (maxEpoch - minEpoch)) * 100
    );
  }, [targetDate, minDateForSliderRange, maxDateForSliderRange]);

  const daysToTargetDisplay = useMemo(() => {
    if (!targetDate) return "N/A";
    const targetD = new Date(targetDate);
    const todayD = new Date();
    targetD.setHours(0, 0, 0, 0);
    todayD.setHours(0, 0, 0, 0); // Compare dates only
    const diffTime = targetD.getTime() - todayD.getTime();
    if (diffTime < 0 && Math.abs(diffTime) < 1000 * 60 * 60 * 24) return "0"; // If target is today but slightly in past
    if (diffTime < 0) return "Past";
    return String(Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }, [targetDate]);

  const handleResetDate = useCallback(() => {
    if (minDateForSliderRange) {
      // Reset to the calculated min date for the slider
      onTargetDateChange(minDateForSliderRange);
    } else {
      // Fallback if minDateForSliderRange isn't set yet
      const today = new Date();
      today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
      onTargetDateChange(today.toISOString().slice(0, 16));
    }
  }, [onTargetDateChange, minDateForSliderRange]);

  const currentNiftyTargetForInput = isNaN(parseFloat(niftyTarget))
    ? currentDisplaySpot !== null
      ? currentDisplaySpot.toFixed(2)
      : ""
    : parseFloat(niftyTarget).toFixed(2);

  // Chart.js Rendering Effect
  useEffect(() => {
    if (
      activeChartTab === "payoffgraph" &&
      canvasRef.current &&
      dynamicPayoffData &&
      window.Chart
    ) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
      chartInstanceRef.current = new window.Chart(
        canvasRef.current.getContext("2d"),
        {
          type: "line",
          data: dynamicPayoffData,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 200 }, // Faster animation
            interaction: { mode: "index", intersect: false },
            plugins: { legend: { position: "bottom" } },
            scales: {
              y: { title: { display: true, text: "Profit / Loss" } },
              x: {
                title: {
                  display: true,
                  text: `${currentUnderlying || "Asset"} Price`,
                },
              },
            },
          },
        }
      );
    }
    // Cleanup function to destroy chart instance on component unmount or before re-render
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [dynamicPayoffData, activeChartTab, currentUnderlying]); // Dependencies for chart update

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
            <div className="chart-display-area">
              {" "}
              {/* Ensure this div has a defined height via CSS */}
              <canvas ref={canvasRef} id="payoffChartCanvas"></canvas>
              {!dynamicPayoffData && strategyLegs.length > 0 && (
                <div className="chart-loading-placeholder">
                  Calculating Payoff...
                </div>
              )}
              {strategyLegs.length === 0 && (
                <div className="chart-loading-placeholder">
                  Add strategy legs to see payoff.
                </div>
              )}
            </div>
          </div>
        )}
        {activeChartTab === "p&ltable" && (
          <>
            <div className="greeks-controls-header">
              {" "}
              {/* Using same class for consistency if styles match */}
              <Checkbox
                label="Multiply by Lot Size"
                checked={multiplyByLotSize}
                onChange={onMultiplyByLotSizeChange}
              />
              <Checkbox
                label="Multiply by Number of Lots"
                checked={multiplyByNumLots}
                onChange={onMultiplyByNumLotsChange}
              />
            </div>
            <PnLTable
              projectedLegsData={projectedStrategyData.legs}
              totals={projectedStrategyData.totals}
            />
          </>
        )}
        {activeChartTab === "greeks" && (
          <div className="greeks-tab-content">
            <div className="greeks-controls-header">
              <Checkbox
                label="Multiply by Lot Size"
                checked={multiplyByLotSize}
                onChange={onMultiplyByLotSizeChange}
                className="greeks-multiplier-checkbox"
              />
              <Checkbox
                label="Multiply by Number of Lots"
                checked={multiplyByNumLots}
                onChange={onMultiplyByNumLotsChange}
                className="greeks-multiplier-checkbox"
              />
            </div>
            <GreeksTable
              projectedLegsData={projectedStrategyData.legs}
              totals={projectedStrategyData.totals}
            />
          </div>
        )}
        {activeChartTab === "strategychart" && (
          <div className="tab-content-placeholder">
            <p>Strategy Chart View (To be implemented)</p>
          </div>
        )}
      </div>

      <div className="global-chart-controls">
        <div className="target-controls-row spot-controls">
          <div className="input-slider-group">
            <label htmlFor="spotTargetInput">
              {currentUnderlying || "Spot"} Target
            </label>
            <div className="input-with-buttons">
              <Button
                variant="icon"
                size="small"
                icon="-"
                onClick={() =>
                  onNiftyTargetChange((prev) =>
                    (
                      parseFloat(prev || currentDisplaySpot || 0) -
                      SPOT_SLIDER_STEP
                    ).toFixed(2)
                  )
                }
              />
              <Input
                id="spotTargetInput"
                type="number"
                value={currentNiftyTargetForInput}
                onChange={(e) => onNiftyTargetChange(e.target.value)}
                className="target-value-input"
                step={SPOT_SLIDER_STEP / 10}
              />
              <Button
                variant="icon"
                size="small"
                icon="+"
                onClick={() =>
                  onNiftyTargetChange((prev) =>
                    (
                      parseFloat(prev || currentDisplaySpot || 0) +
                      SPOT_SLIDER_STEP
                    ).toFixed(2)
                  )
                }
              />
            </div>
            <input
              type="range"
              min={spotSliderMin}
              max={spotSliderMax}
              value={
                parseFloat(niftyTarget) || currentDisplaySpot || spotSliderMin
              }
              step={SPOT_SLIDER_STEP}
              onChange={(e) => onNiftyTargetChange(e.target.value)}
              className="global-target-slider spot-slider"
            />
            <Button
              variant="link"
              size="small"
              onClick={() =>
                onNiftyTargetChange(currentDisplaySpot?.toFixed(2) || "")
              }
            >
              Reset Spot
            </Button>
          </div>
        </div>

        <div className="target-controls-row date-controls">
          <div className="input-slider-group">
            <label htmlFor="dateTargetInput">
              Date: {daysToTargetDisplay}D{" "}
              {daysToTargetDisplay !== "Past" && daysToTargetDisplay !== "N/A"
                ? "to Expiry"
                : ""}
            </label>
            <div className="input-with-buttons date-input-actual-wrapper">
              <Input
                id="dateTargetDisplay"
                type="text"
                value={
                  targetDate
                    ? new Date(targetDate).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : ""
                }
                readOnly
                className="target-value-input date-display-input"
                onClick={() =>
                  document
                    .getElementById("hiddenDateTargetInput")
                    ?.showPicker?.()
                }
              />
              <Input
                id="hiddenDateTargetInput"
                type="datetime-local"
                value={targetDate}
                onChange={(e) => onTargetDateChange(e.target.value)}
                className="hidden-date-input"
              />
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={dateSliderValue}
              onChange={handleDateSliderChange}
              className="global-target-slider date-slider"
              disabled={
                !minDateForSliderRange ||
                !maxDateForSliderRange ||
                minDateForSliderRange >= maxDateForSliderRange
              }
            />
            <Button variant="link" size="small" onClick={handleResetDate}>
              Reset Date
            </Button>
          </div>
        </div>
        <div className="date-slider-labels">
          <span>
            {minDateForSliderRange
              ? new Date(minDateForSliderRange).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                })
              : "Today"}
          </span>
          <span>
            {maxDateForSliderRange
              ? new Date(maxDateForSliderRange).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                })
              : "Max Expiry"}
          </span>
        </div>
      </div>
    </section>
  );
};
export default React.memo(PayoffChartSection);
