// src/features/StrategyVisualizer/utils/strategyPayoffUtils.js
import {
  black76Price,
  black76Greeks,
  timeToExpiry,
  timeToExpiryDays,
} from "./optionPricingUtils"; // Existing

import {
  PAYOFF_CHART_POINTS, // Renamed from PAYOFF_GRAPH_POINTS for clarity if this is for chart
  PAYOFF_TABLE_POINTS, // Keep if different for table utility
  PAYOFF_TABLE_INTERVAL_STEP, // Keep if different for table utility
  PAYOFF_CHART_XAXIS_STRIKE_PADDING_FACTOR,
} from "../../config";

// --- Helper Functions ---

// MODIFIED: calculateLegValueAtExpiry - handles options and futures (futures have no 'strike'-based intrinsic beyond spot diff)
const calculateLegValueAtExpiry = (leg, underlyingPriceAtExpiry, instrumentDetails) => {
  if (leg.legType === 'option') {
    const strike = Number(instrumentDetails?.strike || leg.strike); // Use details if available
    if (isNaN(strike) || !leg.optionType) return 0; // Guard against missing option data
    if (leg.optionType === "CE") return Math.max(0, underlyingPriceAtExpiry - strike);
    if (leg.optionType === "PE") return Math.max(0, strike - underlyingPriceAtExpiry);
  } else if (leg.legType === 'future') {
    // For a future, its "value" at expiry *is* the underlyingPriceAtExpiry.
    // The P&L comes from (exitPrice - entryPrice).
    return underlyingPriceAtExpiry;
  }
  return 0;
};

// MODIFIED: calculateLegPnLAtExpiry - handles options and futures
const calculateLegPnLAtExpiry = (leg, underlyingPriceAtExpiry, instrumentDetails) => {
  const entryPricePerShare = parseFloat(leg.price);
  if (isNaN(entryPricePerShare)) return 0;

  // MODIFIED: Use leg.lotSize consistently (should be contract multiplier)
  const contractMultiplier = (Number(leg.lots) || 1) * (Number(leg.lotSize) || 1);
  const direction = leg.buySell === "Buy" ? 1 : -1;

  if (leg.legType === 'option') {
    const legValuePerShareAtExpiry = calculateLegValueAtExpiry(leg, underlyingPriceAtExpiry, instrumentDetails);
    const pnlPerShare = legValuePerShareAtExpiry - entryPricePerShare;
    return pnlPerShare * contractMultiplier * direction;
  } else if (leg.legType === 'future') {
    // P&L for future = (Exit Price - Entry Price) * Multiplier * Direction
    // Here, Exit Price at expiry is underlyingPriceAtExpiry
    const pnlPerShare = underlyingPriceAtExpiry - entryPricePerShare;
    return pnlPerShare * contractMultiplier * direction;
  }
  return 0;
};

// MODIFIED: calculateLegTheoreticalPrice - handles options and futures
const calculateLegTheoreticalPrice = (
  leg,
  underlyingPrice, // This is the target spot for projection
  targetDateISO,
  riskFreeRate,
  getScenarioIV, // Function to get IV for an option leg
  getInstrumentByToken // MODIFIED: Use new generic getter
) => {
  const instrumentDetails = getInstrumentByToken(leg.token);
  if (!instrumentDetails) return parseFloat(leg.price); // Fallback if no details

  if (leg.legType === 'option') {
    if (!instrumentDetails.expiry || !instrumentDetails.strike || !instrumentDetails.optionType || instrumentDetails.legTypeDb !== 'option') {
        return parseFloat(leg.price); // Fallback for invalid option data
    }
    const scenarioIV = getScenarioIV(leg.token); // getScenarioIV should return decimal
    const TTE = timeToExpiry(instrumentDetails.expiry, new Date(targetDateISO));

    if (TTE <= 0.000001) return calculateLegValueAtExpiry(leg, underlyingPrice, instrumentDetails);
    if (scenarioIV <= 0.000001) return calculateLegValueAtExpiry(leg, underlyingPrice, instrumentDetails); // Or discounted intrinsic

    // For options, use Black-76. F can be spot or futures price depending on underlying.
    // Assuming 'underlyingPrice' is the spot and needs to be converted to Forward for Black-76.
    // A common simplification for index options is to use Spot as F directly if cost of carry is low or TTE is short.
    // For equity options, F = S * e^((r-q)T), where q is dividend yield.
    // For simplicity, using F = S * e^(rT) if not an option on future.
    // If instrumentDetails contains a field like `instrumentDetails.isOptionOnFuture` you could use `instrumentDetails.underlyingFuturesPrice`.
    const forwardPrice = underlyingPrice * Math.exp(riskFreeRate * TTE); // Simplified forward price

    return black76Price(
      forwardPrice,
      Number(instrumentDetails.strike),
      TTE,
      riskFreeRate,
      scenarioIV, // Expects decimal (e.g., 0.2 for 20%)
      instrumentDetails.optionType
    );
  } else if (leg.legType === 'future') {
    // Theoretical price of a future at a target date *before* its expiry is complex
    // and depends on cost of carry (F = S * e^((r-q)T)).
    // If targetDateISO is AT or AFTER the future's expiry, its price is just the underlyingPrice.
    // For simplicity in P&L projection to a date BEFORE future's expiry, we can:
    // 1. Assume the future's price simply moves with the underlying (delta 1).
    //    So, its "theoretical price" relative to the target 'underlyingPrice' is just 'underlyingPrice'.
    //    This is a common simplification for P&L projection charts.
    // 2. OR calculate the expected future price: F_target = underlyingPrice * e^((r-q)T_to_future_expiry_from_target_date)
    //    This requires knowing the future's actual expiry and dividend yield (q).

    // Simplification: Assume future's price at target date is the projected 'underlyingPrice'.
    // This means its P&L will be (underlyingPrice - entryPrice).
    return underlyingPrice; // The "value" of the future contract tracks the underlying
  }
  return parseFloat(leg.price); // Fallback
};

// MODIFIED: calculateLegPnLAtTargetDate - handles options and futures
const calculateLegPnLAtTargetDate = (
  leg,
  underlyingPrice,
  targetDateISO,
  riskFreeRate,
  getScenarioIV,
  getInstrumentByToken
) => {
  const theoreticalPricePerShare = calculateLegTheoreticalPrice(
    leg,
    underlyingPrice,
    targetDateISO,
    riskFreeRate,
    getScenarioIV, // Pass the function itself
    getInstrumentByToken
  );
  const entryPricePerShare = parseFloat(leg.price);
  if (isNaN(entryPricePerShare) || isNaN(theoreticalPricePerShare)) return 0;

  const contractMultiplier = (Number(leg.lots) || 1) * (Number(leg.lotSize) || 1);
  const direction = leg.buySell === "Buy" ? 1 : -1;
  const pnlPerShare = theoreticalPricePerShare - entryPricePerShare;
  return pnlPerShare * contractMultiplier * direction;
};

// MODIFIED: getRepresentativeIVForSD - now uses getInstrumentByToken
const getRepresentativeIVForSD = (
  selectedLegs, // These are strategy legs from UI
  underlyingSpotPrice,
  getInstrumentByToken, // MODIFIED
  getScenarioIV, // NEW: To get scenario-adjusted IV
  defaultIV = 20 // e.g. 20%
) => {
  if (!selectedLegs || selectedLegs.length === 0 || !underlyingSpotPrice)
    return defaultIV / 100; // Return decimal

  let closestAtmOptionLeg = null;
  let minDiffToAtm = Infinity;

  // Find the ATM option leg among selected legs
  selectedLegs.forEach((sl) => {
    if (sl.legType === 'option' && sl.token) { // Only consider options
      const instrumentDetails = getInstrumentByToken(sl.token);
      if (instrumentDetails && instrumentDetails.legTypeDb === 'option' && instrumentDetails.strike !== undefined) {
        const strikeDiff = Math.abs(Number(instrumentDetails.strike) - underlyingSpotPrice);
        if (strikeDiff < minDiffToAtm) {
          minDiffToAtm = strikeDiff;
          closestAtmOptionLeg = sl; // Store the leg from strategyLegs
        }
      }
    }
  });

  if (closestAtmOptionLeg) {
    const scenarioIV = getScenarioIV(closestAtmOptionLeg.token); // Get scenario-adjusted IV (decimal)
    if (scenarioIV > 0) return scenarioIV;
  }
  // Fallback if no suitable option leg found or IV is zero
  return defaultIV / 100;
};


// --- Exported Main Calculation Functions ---

// MODIFIED: generatePayoffChartData (for the main chart in PayoffChart.jsx)
export const generatePayoffChartData = ({
  strategyLegs,
  niftyTargetString, // Scenario spot from input/slider
  displaySpotForSlider, // Fallback spot if niftyTargetString is invalid
  targetDateISO,
  riskFreeRate,
  getScenarioIV, // For options
  getInstrumentByToken, // MODIFIED: Was getOptionByToken
  underlyingSpotPrice, // Actual live spot price
  fullInstrumentChainData = [], // MODIFIED: Was fullOptionChainData, now all instruments
  sdDays = 30, // NEW from PayoffChart.jsx
  PAYOFF_CHART_X_AXIS_RANGE_FACTOR = 0.2, // How much % range around strikes/spot for X-axis
  // PAYOFF_CHART_POINTS from config
}) => {
  const selectedLegs = strategyLegs.filter(
    (l) => l.selected && l.token && typeof l.price === "number" && l.legType // Ensure legType exists
  );
  // If no legs, no graph. Or graph of underlying if no legs? For now, empty.
  // if (selectedLegs.length === 0) return { points: [], sdBands: null, minX: 0, maxX: 0, pnlAtCurrentTarget:0, currentActualSpot: underlyingSpotPrice };

  // Determine the center of the x-axis for the chart
  const centerSpotForChart =
    niftyTargetString !== "" && !isNaN(parseFloat(niftyTargetString))
      ? parseFloat(niftyTargetString)
      : typeof displaySpotForSlider === "number" && displaySpotForSlider > 0
      ? displaySpotForSlider
      : underlyingSpotPrice > 0 ? underlyingSpotPrice : 0;

  if (centerSpotForChart <= 0 && selectedLegs.length === 0) return { points: [], sdBands: null, minX:0, maxX:0, pnlAtCurrentTarget:0, currentActualSpot: underlyingSpotPrice };


  let minStrike = Infinity, maxStrike = 0, hasOptionLegs = false;
  selectedLegs.forEach((leg) => {
    if (leg.legType === 'option' && leg.strike !== undefined) {
      hasOptionLegs = true;
      const strikeNum = Number(leg.strike);
      minStrike = Math.min(minStrike, strikeNum);
      maxStrike = Math.max(maxStrike, strikeNum);
    }
  });

  let lowBound, highBound;
  if (hasOptionLegs && minStrike !== Infinity && maxStrike > 0) {
    const strikeRange = maxStrike - minStrike;
    const padding = strikeRange > 0 ? strikeRange * PAYOFF_CHART_XAXIS_STRIKE_PADDING_FACTOR : centerSpotForChart * PAYOFF_CHART_X_AXIS_RANGE_FACTOR;
    lowBound = minStrike - padding;
    highBound = maxStrike + padding;
  } else { // No option legs, or only future legs, or invalid strikes
    const padding = centerSpotForChart * PAYOFF_CHART_X_AXIS_RANGE_FACTOR || 1000; // Default padding if centerSpotForChart is 0
    lowBound = centerSpotForChart - padding;
    highBound = centerSpotForChart + padding;
  }
  lowBound = Math.max(0.01, lowBound); // Ensure non-negative

  const labels = []; // Spot prices for x-axis
  const pnlOnExpiryData = [];
  const pnlOnTargetDateData = [];
  const callOIData = [];
  const putOIData = [];

  for (let i = 0; i <= PAYOFF_CHART_POINTS; i++) {
    const underlyingPriceAtTick = lowBound + ((highBound - lowBound) * i) / PAYOFF_CHART_POINTS;
    labels.push(underlyingPriceAtTick); // Store the exact float for calculations

    let totalExpiryPnLForTick = 0;
    let totalTargetDatePnLForTick = 0;

    selectedLegs.forEach((leg) => {
      const instrumentDetails = getInstrumentByToken(leg.token); // Get details for lotSize etc.
      totalExpiryPnLForTick += calculateLegPnLAtExpiry(leg, underlyingPriceAtTick, instrumentDetails);
      totalTargetDatePnLForTick += calculateLegPnLAtTargetDate(
        leg,
        underlyingPriceAtTick,
        targetDateISO,
        riskFreeRate,
        getScenarioIV, // Pass the function
        getInstrumentByToken
      );
    });
    pnlOnExpiryData.push(totalExpiryPnLForTick);
    pnlOnTargetDateData.push(totalTargetDatePnLForTick);

    // MODIFIED: OI Data - filter fullInstrumentChainData for options only
    let callOIForTick = 0, putOIForTick = 0;
    if (Array.isArray(fullInstrumentChainData)) {
        fullInstrumentChainData.forEach(instrument => {
            // Ensure it's an option and matches the current spot price tick (as strike)
            if (instrument.legTypeDb === 'option' && instrument.strike !== undefined && Math.abs(Number(instrument.strike) - underlyingPriceAtTick) < 0.01) {
                if (instrument.optionType === 'CE' && instrument.marketData?.oi) {
                    callOIForTick += Number(instrument.marketData.oi);
                } else if (instrument.optionType === 'PE' && instrument.marketData?.oi) {
                    putOIForTick += Number(instrument.marketData.oi);
                }
            }
        });
    }
    callOIData.push(callOIForTick);
    putOIData.push(putOIForTick);
  }

  // P&L at the specific niftyTarget / currentScenarioSpot for annotation
  let pnlAtNiftyTargetOnDate = 0;
  selectedLegs.forEach((leg) => {
    pnlAtNiftyTargetOnDate += calculateLegPnLAtTargetDate(
      leg,
      centerSpotForChart, // Use the chart's center spot for this annotation
      targetDateISO,
      riskFreeRate,
      getScenarioIV,
      getInstrumentByToken
    );
  });

  // SD Bands calculation
  let sdLevels = null;
  if (underlyingSpotPrice && underlyingSpotPrice > 0 && sdDays > 0) { // Use live underlyingSpotPrice for SD bands
    const representativeIV = getRepresentativeIVForSD(selectedLegs, underlyingSpotPrice, getInstrumentByToken, getScenarioIV); // Pass getScenarioIV
    const dteForSDbandsInYears = sdDays / 365.25; // Use sdDays
    if (representativeIV > 0 && dteForSDbandsInYears > 0) {
      const oneSdMove = underlyingSpotPrice * representativeIV * Math.sqrt(dteForSDbandsInYears);
      sdLevels = {
        center: underlyingSpotPrice, // SD bands centered around live spot
        plusOneSD: underlyingSpotPrice + oneSdMove,
        minusOneSD: underlyingSpotPrice - oneSdMove,
        plusTwoSD: underlyingSpotPrice + 2 * oneSdMove,
        minusTwoSD: underlyingSpotPrice - 2 * oneSdMove,
      };
    }
  }

  // Format labels for display if needed (e.g., toFixed(0))
  const displayLabels = labels.map(l => l.toFixed(0));
  
  // Return structure for PayoffChart.jsx (points for chart.js {x,y} format)
  const pointsData = labels.map((spot, index) => ({
      spot: spot, // Store the precise float value
      pnlAtExpiry: pnlOnExpiryData[index],
      pnlAtTargetDate: pnlOnTargetDateData[index],
      callOI: callOIData[index],
      putOI: putOIData[index],
      // isCurrentSpot: Math.abs(spot - centerSpotForChart) < 0.01 // Or related to underlyingSpotPrice
  }));


  return {
    points: pointsData, // This structure is now expected by PayoffChart.jsx
    sdBands: sdLevels, // Renamed from sdLevels for consistency with PayoffChart.jsx
    // Removed minX, maxX, pnlAtCurrentTarget, currentActualSpot as PayoffChart.jsx derives these or gets them differently
  };
};


// MODIFIED: generateGreeksTableData (for P&L Table and Greeks Table in PayoffChartSection.jsx)
export const generateGreeksTableData = ({ // This is the function previously named calculateProjectedStrategyData
  strategyLegs,
  niftyTarget, // Target spot string
  targetDate,  // Target date ISO string
  getInstrumentByToken, // MODIFIED: Was getOptionByToken
  riskFreeRate,
  getScenarioIV, // For options
  multiplyByLotSize,
  multiplyByNumLots,
  underlyingSpotPrice, // NEW: Pass live spot for live Greeks calculation
}) => {
  if (
    strategyLegs.length === 0 || !getInstrumentByToken || !riskFreeRate || !getScenarioIV
  ) {
    return { legs: [], totals: { projectedPnL: 0, delta: 0, gamma: 0, theta: 0, vega: 0 }};
  }

  const numericScenarioSpot = parseFloat(niftyTarget);
  const useProjectedScenario = targetDate && !isNaN(numericScenarioSpot) && numericScenarioSpot > 0;
  
  // If not using projected scenario (e.g., niftyTarget is empty), use live spot for Greeks.
  const spotForCalc = useProjectedScenario ? numericScenarioSpot : (underlyingSpotPrice || 0);
  if (spotForCalc <= 0) { // If no valid spot can be determined
      return { legs: [], totals: { projectedPnL: 0, delta: 0, gamma: 0, theta: 0, vega: 0 }};
  }

  const projectionDate = useProjectedScenario ? new Date(targetDate) : new Date(); // If not projected, use "now"

  let aggProjectedPnL = 0, aggDelta = 0, aggGamma = 0, aggTheta = 0, aggVega = 0;

  const projectedLegsResult = strategyLegs
    .filter((leg) => leg.selected && leg.token && leg.legType)
    .map((leg) => {
      const instrumentDetails = getInstrumentByToken(leg.token);
      if (!instrumentDetails) {
        return { /* ... error leg structure ... */
            ...leg, instrumentSymbolConcise: `${leg.buySell} ${leg.lots || 1}L ${leg.instrumentSymbol || "Data N/A"}`,
            projectedValue: null, projectedPnL: 0, projectedGreeks: {}, entryPrice: parseFloat(leg.price), ltp: null,
        };
      }

      const entryPriceNum = parseFloat(leg.price);
      // MODIFIED: Use leg.lotSize for contract multiplier for both types
      const legContractSize = Number(leg.lotSize) || 1;
      let legGreeks = { delta: 0, gamma: 0, theta: 0, vega: 0 };
      let projectedValuePerShare = entryPriceNum; // Default to entry price if cannot calculate

      if (leg.legType === 'option') {
        if (!instrumentDetails.strike || !instrumentDetails.expiry || !instrumentDetails.optionType || instrumentDetails.legTypeDb !== 'option') {
          // Invalid option data for calculation
        } else {
            const scenarioIVForLeg = getScenarioIV(leg.token); // Decimal IV
            const T_to_option_expiry = timeToExpiry(instrumentDetails.expiry, projectionDate);

            if (T_to_option_expiry <= 0.000001) { // At or past expiry
                projectedValuePerShare = calculateLegValueAtExpiry(leg, spotForCalc, instrumentDetails);
                // For Greeks at T=0, some conventions use limit, others 0 for gamma/theta/vega
                legGreeks = black76Greeks(spotForCalc, Number(instrumentDetails.strike), 0.000001, riskFreeRate, scenarioIVForLeg > 0 ? scenarioIVForLeg : 0.001, instrumentDetails.optionType);
            } else if (scenarioIVForLeg > 0) {
                // Using spotForCalc as F; for equity options, a proper F = S * e^((r-q)T) is better.
                // For index options, F is often approximated by S.
                const F_calc = spotForCalc * Math.exp(riskFreeRate * T_to_option_expiry); // Simple forward
                projectedValuePerShare = black76Price(F_calc, Number(instrumentDetails.strike), T_to_option_expiry, riskFreeRate, scenarioIVForLeg, instrumentDetails.optionType);
                legGreeks = black76Greeks(F_calc, Number(instrumentDetails.strike), T_to_option_expiry, riskFreeRate, scenarioIVForLeg, instrumentDetails.optionType);
            } else { // IV is zero, value is intrinsic (or discounted intrinsic if TTE > 0)
                projectedValuePerShare = calculateLegValueAtExpiry(leg, spotForCalc, instrumentDetails);
                 // Greeks for zero IV (delta is 0 or +/-1, others 0)
                legGreeks = black76Greeks(spotForCalc, Number(instrumentDetails.strike), T_to_option_expiry, riskFreeRate, 0.000001, instrumentDetails.optionType);
            }
        }
      } else if (leg.legType === 'future') {
        // For a future, its projected "value" per share IS the spotForCalc.
        projectedValuePerShare = spotForCalc;
        // Simplified Greeks for Futures
        legGreeks.delta = 1; // Base delta is 1 per unit. Sign comes from buySell.
        legGreeks.gamma = 0;
        legGreeks.theta = 0; // Can be non-zero if considering funding costs/cost of carry daily change
        legGreeks.vega = 0;
      }
      
      const pnlPerShare = isNaN(projectedValuePerShare) || isNaN(entryPriceNum) ? 0 : (projectedValuePerShare - entryPriceNum);
      let scaleFactor = 1;
      if (multiplyByLotSize) scaleFactor *= legContractSize;
      if (multiplyByNumLots && leg.lots) scaleFactor *= Number(leg.lots);
      
      const positionDirection = leg.buySell === "Buy" ? 1 : -1;
      const totalLegPnl = pnlPerShare * scaleFactor * positionDirection;

      // Aggregate scaled greeks
      if (!isNaN(totalLegPnl)) aggProjectedPnL += totalLegPnl;
      if (!isNaN(legGreeks.delta)) aggDelta += legGreeks.delta * positionDirection * scaleFactor;
      if (!isNaN(legGreeks.gamma)) aggGamma += legGreeks.gamma * scaleFactor; // Gamma usually additive for portfolio
      if (!isNaN(legGreeks.theta)) aggTheta += legGreeks.theta * positionDirection * scaleFactor;
      if (!isNaN(legGreeks.vega)) aggVega += legGreeks.vega * positionDirection * scaleFactor;


      // Construct display symbol
      let displaySymbol = leg.instrumentSymbol || "N/A";
      if (instrumentDetails) {
        if (leg.legType === 'option' && instrumentDetails.strike && instrumentDetails.optionType && instrumentDetails.expiry) {
            displaySymbol = `${Number(instrumentDetails.strike)}${instrumentDetails.optionType} ${formatDisplayExpiry(instrumentDetails.expiry)}`;
        } else if (leg.legType === 'future' && instrumentDetails.instrumentSymbol) {
            displaySymbol = instrumentDetails.instrumentSymbol;
        }
      }


      return {
        ...leg, // Spread original leg data
        instrumentSymbolConcise: `${leg.buySell === "Buy" ? "B" : "S"} ${leg.lots || 1}x ${displaySymbol}`,
        projectedValue: isNaN(projectedValuePerShare) ? null : projectedValuePerShare,
        projectedPnL: totalLegPnl,
        // Return UNscaled greeks for the leg. Scaling is applied to totals and can be applied in table display.
        projectedGreeks: {
            delta: legGreeks.delta * positionDirection, // Make delta directional per leg
            gamma: legGreeks.gamma,
            theta: legGreeks.theta * positionDirection, // Theta is directional P&L effect
            vega: legGreeks.vega * positionDirection   // Vega effect is directional
        },
        entryPrice: entryPriceNum,
        ltp: instrumentDetails?.lastPrice !== undefined ? parseFloat(instrumentDetails.lastPrice) : null,
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
};
