// src/features/StrategyVisualizer/sections/DetailedDataSection.jsx
import React, { useMemo, useCallback } from "react";
import Button from "../../../components/Button/Button";
import Checkbox from "../../../components/Checkbox/Checkbox";
// MODIFIED: optionPricingUtils are primarily for options
import { black76Greeks, timeToExpiry } from "../../utils/optionPricingUtils";
import {calculateProjectedStrategyData } from "../../utils/payoffDataCalculator"; // Adjust path as needed
import {
  DEFAULT_VOLATILITY,
  GLOBAL_IV_OFFSET_STEP,
  IV_ADJUSTMENT_STEP,
} from "../../../config";
import "./DetailedDataSection.scss";

const DetailedDataSection = ({
  strategyLegs, // Existing (now contains legType)
  currentUnderlying, // Existing
  getInstrumentByToken, // MODIFIED: Was getOptionByToken
  riskFreeRate, // Existing
  // MODIFIED: liveOptionChainMap to liveInstrumentChainArray if directly used, or rely on underlyingSpotPrice prop
  liveInstrumentChainArray, // Or pass underlyingSpotPrice directly if preferred for spot
  underlyingSpotPrice, // NEW: Pass live spot price for consistency
  projectedNiftyTarget, // Existing
  projectedTargetDate, // Existing
  individualIvAdjustments, // Existing (for options)
  onIndividualIvAdjustmentChange, // Existing (for options)
  globalIvOffset, // Existing (for options)
  onGlobalIvOffsetChange, // Existing (for options)
  onResetAllIvAdjustments, // Existing (for options)
  getScenarioIV, // Existing (for options, from StrategyVisualizer)
  multiplyByLotSize, // Existing
  onMultiplyByLotSizeChange, // Existing
  multiplyByNumLots, // Existing
  onMultiplyByNumLotsChange, // Existing
  sdDays, // Existing
  multiplier = 1, // Existing (overall strategy display multiplier)
}) => {
  // Existing: IV offset handlers (apply to options)
  const handleLocalGlobalIvOffsetChange = useCallback(
    (increment) => {
      onGlobalIvOffsetChange((prevOffset) => prevOffset + increment);
    },
    [onGlobalIvOffsetChange]
  );

  const handleLocalIndividualIvAdjust = useCallback(
    (token, currentAdjustment, increment) => {
      const newValue = parseFloat((currentAdjustment + increment).toFixed(1));
      onIndividualIvAdjustmentChange(token, newValue);
    },
    [onIndividualIvAdjustmentChange]
  );

  // MODIFIED: strikewiseIVsDisplayData is ONLY for OPTION legs
  const strikewiseIVsDisplayData = useMemo(() => {
    return strategyLegs
      .filter((leg) => leg.selected && leg.token && leg.legType === "option") // Filter for selected OPTION legs
      .map((leg) => {
        const instrumentDetails = getInstrumentByToken(leg.token); // Use new getter
        // Ensure it's an option and has necessary data
        if (
          !instrumentDetails ||
          instrumentDetails.legTypeDb !== "option" ||
          instrumentDetails.iv === undefined ||
          !instrumentDetails.strike ||
          !instrumentDetails.optionType
        ) {
          return {
            // Fallback structure for missing option data
            id: leg.id,
            token: leg.token,
            instrumentSymbol:
              leg.instrumentSymbol ||
              `${leg.strike || "STK"}${leg.optionType || "OPT"}`,
            strike: leg.strike,
            expiry: leg.expiry,
            effectiveIVDisplay: "N/A",
            originalIV: "N/A", // Changed from 0 to N/A
            chg: "N/A",
            currentIndividualAdjustment: 0,
          };
        }
        const originalIV = parseFloat(instrumentDetails.iv);
        const individualAdjustment = individualIvAdjustments[leg.token] || 0;
        const effectiveIV = originalIV + individualAdjustment + globalIvOffset;
        return {
          id: leg.id,
          token: leg.token,
          instrumentSymbol:
            instrumentDetails.instrumentSymbol ||
            instrumentDetails.symbol ||
            `${instrumentDetails.strike}${instrumentDetails.optionType}`, // Use details from fetched instrument
          strike: instrumentDetails.strike,
          expiry: instrumentDetails.expiry // Use full expiry from instrument
            ?.substring(0, 9) // Keep existing formatting if desired
            .replace(/(\d{2})([A-Z]{3})(\d{2,4})/, "$1-$2-$3"),
          effectiveIVDisplay: effectiveIV.toFixed(2),
          originalIV: originalIV.toFixed(2), // Format original IV
          currentIndividualAdjustment: individualAdjustment,
          chg: (effectiveIV - originalIV).toFixed(1),
        };
      });
  }, [
    strategyLegs,
    getInstrumentByToken,
    globalIvOffset,
    individualIvAdjustments,
  ]);

  // Existing: greeksSourceLabel
  const greeksSourceLabel = useMemo(() => {
    const numericProjectedTarget = parseFloat(projectedNiftyTarget);
    return projectedTargetDate &&
      !isNaN(numericProjectedTarget) &&
      numericProjectedTarget > 0
      ? "Projected Scenario"
      : "Live Scenario (IV Adj.)";
  }, [projectedNiftyTarget, projectedTargetDate]);

  const singleScenarioPerLegData = useMemo(
    () =>
      calculateProjectedStrategyData({
        strategyLegs,
         niftyTarget:projectedNiftyTarget, // Existing
        targetDate: projectedTargetDate, // Use projected target date
        getInstrumentByToken, // MODIFIED: Pass new generic getter
        riskFreeRate,
        getScenarioIV, // For options
        multiplyByLotSize,
        multiplyByNumLots,
      }),
    [
      strategyLegs,
      projectedNiftyTarget, // Existing
      projectedTargetDate,
      getInstrumentByToken, // MODIFIED
      riskFreeRate,
      getScenarioIV,
      multiplyByLotSize,
      multiplyByNumLots,
    ]
  );
// console.log("Single Scenario Data:", singleScenarioPerLegData);
  // MODIFIED: targetDayFuturesInfo - uses underlyingSpotPrice prop now
  const targetDayFuturesInfo = useMemo(() => {
    // Use the live underlying spot price passed as a prop
    const spotPriceToUse =
      underlyingSpotPrice !== null && underlyingSpotPrice > 0
        ? underlyingSpotPrice
        : currentUnderlying === "BANKNIFTY"
        ? 48000
        : currentUnderlying === "NIFTY"
        ? 23000
        : 0; // Fallback if prop is null

    let sdVolatility = DEFAULT_VOLATILITY; // Default IV (e.g., 0.15 for 15%)
    // Try to get a representative IV from a selected option leg if available
    const firstOptionLeg = strategyLegs.find(
      (l) => l.selected && l.token && l.legType === "option"
    );
    if (firstOptionLeg) {
      const ivForFirstLeg = getScenarioIV(firstOptionLeg.token); // This returns decimal
      if (ivForFirstLeg > 0) {
        sdVolatility = ivForFirstLeg;
      }
    }

    const TTM = sdDays / 365.25; // Time to maturity in years for SD calculation
    const oneSdPoints = spotPriceToUse * sdVolatility * Math.sqrt(TTM);

    const targetDisplayDate = new Date(); // Date for display purposes
    targetDisplayDate.setDate(targetDisplayDate.getDate() + Number(sdDays)); // Use sdDays for target date display

    return {
      date: targetDisplayDate.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      }),
      price: spotPriceToUse > 0 ? spotPriceToUse.toFixed(2) : "N/A",
      sd:
        spotPriceToUse > 0 && oneSdPoints > 0 && !isNaN(oneSdPoints)
          ? [
              {
                level: "1 SD",
                points: `${oneSdPoints.toFixed(1)} (${(
                  (oneSdPoints / spotPriceToUse) *
                  100
                ).toFixed(1)}%)`,
                priceLow: (spotPriceToUse - oneSdPoints).toFixed(1),
                priceHigh: (spotPriceToUse + oneSdPoints).toFixed(1),
              },
              {
                level: "2 SD",
                points: `${(oneSdPoints * 2).toFixed(1)} (${(
                  ((oneSdPoints * 2) / spotPriceToUse) *
                  100
                ).toFixed(1)}%)`,
                priceLow: (spotPriceToUse - oneSdPoints * 2).toFixed(1),
                priceHigh: (spotPriceToUse + oneSdPoints * 2).toFixed(1),
              },
            ]
          : [],
    };
  }, [
    // MODIFIED: Dependencies
    strategyLegs, // To find an option leg for IV
    getScenarioIV, // To get IV for that option leg
    currentUnderlying,
    sdDays,
    underlyingSpotPrice, // Use direct prop
  ]);

  return (
    <section className="sv-detailed-data-section">
      <div className="data-column strikewise-ivs-column">
        <h4>
          {" "}
          {/* Strikewise IVs are only for Options */}
          Strikewise IVs (Options Only)
          <Button variant="link" size="small" onClick={onResetAllIvAdjustments}>
            Reset All IVs
          </Button>
        </h4>
        <div className="offset-control">
          <span>Global Offset</span>
          <Button
            variant="tertiary"
            size="small"
            onClick={() =>
              handleLocalGlobalIvOffsetChange(-GLOBAL_IV_OFFSET_STEP)
            }
          >
            {" "}
            -{" "}
          </Button>
          <span className="offset-value">{globalIvOffset.toFixed(1)}%</span>
          <Button
            variant="tertiary"
            size="small"
            onClick={() =>
              handleLocalGlobalIvOffsetChange(GLOBAL_IV_OFFSET_STEP)
            }
          >
            {" "}
            +{" "}
          </Button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Instrument</th>
              <th>Effective IV</th>
              <th>Chg (Live)</th>
              <th>Adjust Indiv.</th>
            </tr>
          </thead>
          <tbody>
            {strikewiseIVsDisplayData.map(
              (
                item // This already filters for options
              ) => (
                <tr key={item.id}>
                  <td title={`Token: ${item.token}`}>
                    {item.instrumentSymbol}
                  </td>
                  <td>
                    {item.effectiveIVDisplay === "N/A"
                      ? "N/A"
                      : `${item.effectiveIVDisplay}%`}
                  </td>
                  <td>{item.chg === "N/A" ? "N/A" : `${item.chg}%`}</td>
                  <td className="iv-adjust-cell">
                    <Button
                      variant="icon"
                      size="small"
                      className="iv-adjust-btn"
                      onClick={() =>
                        handleLocalIndividualIvAdjust(
                          item.token,
                          item.currentIndividualAdjustment,
                          -IV_ADJUSTMENT_STEP
                        )
                      }
                    >
                      {" "}
                      –{" "}
                    </Button>
                    <span className="individual-offset-value">
                      {(item.currentIndividualAdjustment || 0).toFixed(1)}%
                    </span>
                    <Button
                      variant="icon"
                      size="small"
                      className="iv-adjust-btn"
                      onClick={() =>
                        handleLocalIndividualIvAdjust(
                          item.token,
                          item.currentIndividualAdjustment,
                          IV_ADJUSTMENT_STEP
                        )
                      }
                    >
                      {" "}
                      +{" "}
                    </Button>
                  </td>
                </tr>
              )
            )}
            {strikewiseIVsDisplayData.length === 0 && ( // Message if no option legs are selected
              <tr>
                <td colSpan="4" className="no-data-row">
                  No option legs selected or live option data missing.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="data-column greeks-summary-column">
        <h4>
          {" "}
          Greeks{" "}
          <span className="greeks-source-label">
            ({greeksSourceLabel})
          </span>{" "}
        </h4>
        <Checkbox
          label="Lot Size / Contract Multiplier"
          checked={multiplyByLotSize}
          onChange={onMultiplyByLotSizeChange}
          className="greeks-checkbox"
        />
        <Checkbox
          label="Num Lots"
          checked={multiplyByNumLots}
          onChange={onMultiplyByNumLotsChange}
          className="greeks-checkbox"
        />
        <table>
          <tbody>
            <tr>
              <td>Delta</td>
              <td>{(singleScenarioPerLegData.totals.delta * multiplier)?.toFixed(2) || "-"}</td>
            </tr>
            <tr>
              <td>Gamma</td>
              <td>{(singleScenarioPerLegData.totals.gamma * multiplier)?.toFixed(4) || "-"}</td>
            </tr>
            <tr>
              <td>Theta</td>
              <td>{(singleScenarioPerLegData.totals.theta * multiplier)?.toFixed(2) || "-"}</td>
            </tr>
            <tr>
              <td>Vega</td>
              <td>{(singleScenarioPerLegData.totals.vega * multiplier)?.toFixed(2) || "-"}</td>
            </tr>{" "}
            {/* Display Vega as calculated */}
          </tbody>
        </table>
      </div>
      <div className="data-column target-day-futures-column">
        {/* MODIFIED: Header now reflects sdDays dynamically */}
        <h4>Futures & SD ({sdDays}D Est.)</h4>
        {targetDayFuturesInfo.price &&
          targetDayFuturesInfo.price !== "0.00" &&
          targetDayFuturesInfo.price !== "N/A" && (
            <p className="futures-price-display">
              {" "}
              Live Spot{" "}
              <span className="price-value">
                {targetDayFuturesInfo.price}
              </span>{" "}
            </p>
          )}
        <table>
          <thead>
            <tr>
              <th>SD</th>
              <th>Points</th>
              <th>Range</th>
            </tr>
          </thead>
          <tbody>
            {targetDayFuturesInfo.sd?.length > 0 ? (
              targetDayFuturesInfo.sd.map((item, index) => (
                <tr key={index}>
                  <td>{item.level}</td>
                  <td>{item.points}</td>
                  <td>
                    {item.priceLow} - {item.priceHigh}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="no-data-row">
                  SD data unavailable. Check spot price and IV.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
export default React.memo(DetailedDataSection);
