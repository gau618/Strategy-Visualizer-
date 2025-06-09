// src/features/StrategyVisualizer/utils/payoffTableUtils.js
import { black76Price, timeToExpiry } from "./optionPricingUtils"; // Ensure timeToExpiry is imported

// Helper: Value of a leg at its expiry.
// For options, it's the intrinsic value.
// For futures, its value at expiry is the spot price of the underlying.
// MODIFIED: Added instrumentDetails and legType handling
function calculateLegValueAtExpiry(leg, spotAtExpiry, instrumentDetails) {
  if (leg.legType === 'option') {
    // Use strike from instrumentDetails if available, otherwise from leg (e.g., for new legs not yet matched)
    const strike = Number(instrumentDetails?.strike !== undefined ? instrumentDetails.strike : leg.strike);
    if (isNaN(strike) || !leg.optionType) return 0; // Invalid option data

    if (leg.optionType === "CE") return Math.max(0, spotAtExpiry - strike);
    if (leg.optionType === "PE") return Math.max(0, strike - spotAtExpiry);
  } else if (leg.legType === 'future') {
    // The "value" of a future contract at its expiry (settlement) is the spot price.
    // The P&L calculation will then be (spotAtExpiry - entryPrice).
    return spotAtExpiry;
  }
  return 0;
}

// Helper: P&L of a leg at its expiry.
// MODIFIED: Added instrumentDetails and legType handling, ensures leg.lotSize is used
function calculateLegPnLAtExpiry(leg, spotAtExpiry, instrumentDetails) {
  const entryPrice = parseFloat(leg.price);
  if (isNaN(entryPrice)) return 0;

  const lots = Number(leg.lots) || 1;
  const contractSize = Number(leg.lotSize) || 1; // Use leg.lotSize as contract multiplier
  const quantity = lots * contractSize;
  const direction = leg.buySell === "Buy" ? 1 : -1;

  if (leg.legType === 'option') {
    const valueAtExpiry = calculateLegValueAtExpiry(leg, spotAtExpiry, instrumentDetails);
    const pnlPerShare = valueAtExpiry - entryPrice;
    return pnlPerShare * direction * quantity;
  } else if (leg.legType === 'future') {
    // Future P&L = (Settlement Price - Entry Price) * Direction * Quantity
    // Here, Settlement Price is spotAtExpiry
    const pnlPerShare = spotAtExpiry - entryPrice;
    return pnlPerShare * direction * quantity;
  }
  return 0;
}

// Helper: Theoretical price of a leg at a target date before its expiry.
// MODIFIED: Renamed getOptionByToken to getInstrumentByToken, added legType handling
function calculateLegTheoreticalPrice(
  leg,
  spotAtTargetDate, // Spot price of the underlying at the target date
  targetDateISO,    // The target date for projection
  riskFreeRate,
  getScenarioIV,      // Function to get scenario-adjusted IV for an option leg
  getInstrumentByToken // MODIFIED: Generic instrument getter
) {
  const instrumentDetails = getInstrumentByToken(leg.token);
  if (!instrumentDetails) return parseFloat(leg.price); // Fallback if no live data

  if (leg.legType === 'option') {
    // Ensure it's a valid option with necessary details
    if (!instrumentDetails.expiry || instrumentDetails.strike === undefined || !instrumentDetails.optionType || instrumentDetails.legTypeDb !== 'option') {
      return parseFloat(leg.price); // Fallback if option details are incomplete
    }

    const scenarioIVForLeg = getScenarioIV(leg.token); // getScenarioIV returns decimal IV
    const TTE = timeToExpiry(instrumentDetails.expiry, new Date(targetDateISO)); // Time to option's expiry from target date

    if (TTE <= 0.000001) { // Option is at or past its expiry on the target date
      return calculateLegValueAtExpiry(leg, spotAtTargetDate, instrumentDetails);
    }
    if (scenarioIVForLeg <= 0.000001) { // IV is effectively zero
      // Return intrinsic value (or discounted intrinsic if precise)
      return calculateLegValueAtExpiry(leg, spotAtTargetDate, instrumentDetails);
    }

    // For Black-76, F is the forward price of the underlying.
    // Simplified: F = S * e^(rT) where T is time to option expiry.
    const forwardPrice = spotAtTargetDate * Math.exp(riskFreeRate * TTE);

    return black76Price(
      forwardPrice,
      Number(instrumentDetails.strike),
      TTE,
      riskFreeRate,
      scenarioIVForLeg, // Expected to be decimal (e.g., 0.15 for 15%)
      instrumentDetails.optionType
    );
  } else if (leg.legType === 'future') {
    // For a future contract, its theoretical price at a targetDate *before its own expiry*
    // is generally the forward price of the underlying: F_target = S_target * e^(r*T_future)
    // where T_future is time from targetDate to the future's actual expiry.
    // However, for P&L projection to a common target date for a strategy,
    // a common simplification is to assume the future's price will be the projected 'spotAtTargetDate'.
    // This means the future's P&L contribution is linear: (spotAtTargetDate - entryPrice).
    if (!instrumentDetails.expiry) return parseFloat(leg.price); // Need future's expiry for precise calc

    const futureActualExpiryDate = new Date(instrumentDetails.expiryDate || instrumentDetails.expiry); // Prefer standardized expiryDate
    const targetDate = new Date(targetDateISO);

    if (targetDate >= futureActualExpiryDate) { // If target date is at or after future's expiry
      return spotAtTargetDate; // It settles to spot
    } else {
      // Project future's price to targetDate based on cost of carry from spotAtTargetDate
      // T_future_from_target = time from targetDate to future's own expiry
      const T_future_from_target = timeToExpiry(futureActualExpiryDate, targetDate);
      if (T_future_from_target > 0) {
        return spotAtTargetDate * Math.exp(riskFreeRate * T_future_from_target);
      } else { // Should be covered by above, but as fallback
        return spotAtTargetDate;
      }
    }
  }
  return parseFloat(leg.price); // Fallback for unknown legType
}

// Helper: P&L of a leg at a target date (before its expiry).
// MODIFIED: Renamed getOptionByToken to getInstrumentByToken, ensures leg.lotSize used
function calculateLegPnLAtTargetDate(
  leg,
  spotAtTargetDate,
  targetDateISO,
  riskFreeRate,
  getScenarioIV,
  getInstrumentByToken // MODIFIED
) {
  const theoPriceAtTargetDate = calculateLegTheoreticalPrice(
    leg,
    spotAtTargetDate,
    targetDateISO,
    riskFreeRate,
    getScenarioIV, // Pass the function itself
    getInstrumentByToken
  );
  const entryPrice = parseFloat(leg.price);
  if (isNaN(theoPriceAtTargetDate) || isNaN(entryPrice)) return 0;

  const lots = Number(leg.lots) || 1;
  const contractSize = Number(leg.lotSize) || 1; // Use leg.lotSize
  const quantity = lots * contractSize;
  const direction = leg.buySell === "Buy" ? 1 : -1;
  const pnlPerShare = theoPriceAtTargetDate - entryPrice;

  return pnlPerShare * direction * quantity;
}

// Helper: Snap a spot price to the nearest interval
function snapToInterval(spot, interval) {
  if (isNaN(spot) || isNaN(interval) || interval === 0) return spot; // Guard invalid inputs
  return Math.round(spot / interval) * interval;
}

// --- Main Function ---
// MODIFIED: generatePayoffTableData
export const generatePayoffTableData = ({
  strategyLegs,
  niftyTargetString, // Current target from input/slider, used as center for the grid
  displaySpotForSlider, // Fallback if niftyTargetString is empty/invalid, or live spot
  targetDateISO,
  riskFreeRate,
  getScenarioIV,        // Function to get scenario IV for an option token
  getInstrumentByToken, // MODIFIED: Was getOptionByToken
  targetInterval,       // User-selected interval for the table rows (e.g., 50, 100)
  PAYOFF_TABLE_POINTS = 20, // How many rows above/below center
  PAYOFF_TABLE_INTERVAL_STEP = 50, // Default interval if targetInterval not provided
  underlyingSpotPriceForPercentage, // Base spot for calculating % P&L (usually live spot)
  showPercentage,
  // niftyTargetSliderValue // This prop was in your paste but seems unused here; rawNiftyTarget is used
}) => {
  // Filter valid, selected legs that have a legType
  const selectedLegs = strategyLegs.filter(
    (l) => l.selected && l.token && typeof l.price === "number" && l.legType
  );
  if (selectedLegs.length === 0) return [];

  // Determine the central spot price for the P&L matrix calculations
  let centerSpotForMatrix =
    niftyTargetString !== "" && !isNaN(parseFloat(niftyTargetString))
      ? parseFloat(niftyTargetString)
      : (typeof displaySpotForSlider === "number" && displaySpotForSlider > 0
         ? displaySpotForSlider
         : (typeof underlyingSpotPriceForPercentage === 'number' && underlyingSpotPriceForPercentage > 0
            ? underlyingSpotPriceForPercentage // Fallback to the base for % P&L if other spots are invalid
            : 0)); // Last resort, though P&L at 0 spot might not be meaningful

  if (isNaN(centerSpotForMatrix) || centerSpotForMatrix <= 0.001) { // If center spot is still invalid or zero
      console.warn("generatePayoffTableData: Center spot for matrix is invalid or zero. Table might be empty or skewed.");
      // Optionally, try to find a reference from legs if centerSpotForMatrix is still 0
      if (centerSpotForMatrix <= 0.001 && selectedLegs.length > 0) {
          const firstLegPrice = parseFloat(selectedLegs[0].price);
          if (!isNaN(firstLegPrice) && firstLegPrice > 0) centerSpotForMatrix = firstLegPrice;
      }
      if (centerSpotForMatrix <= 0.001) return []; // Still invalid, return empty
  }


  // Snap the scenario spot to the nearest interval for a clean grid, unless it's the exact target
  const intervalStep = Number(targetInterval) || PAYOFF_TABLE_INTERVAL_STEP;
  const snappedCenterSpot = snapToInterval(centerSpotForMatrix, intervalStep);

  const tableRows = [];
  const halfPoints = Math.floor(PAYOFF_TABLE_POINTS / 2);

  for (let i = -halfPoints; i <= halfPoints; i++) {
    let currentSpotPriceForTick;

    if (i === 0) {
      // The center row of the table should use the exact centerSpotForMatrix value
      currentSpotPriceForTick = centerSpotForMatrix;
    } else {
      // Other rows are based on the snapped grid around the center
      currentSpotPriceForTick = snappedCenterSpot + i * intervalStep;
      // Avoid duplicating the center spot if it happens to align with a grid point and i is not 0
      if (Math.abs(currentSpotPriceForTick - centerSpotForMatrix) < 0.001 && i !== 0) {
          // Check if this point is too close to an already added point (can happen if intervalStep is small relative to precision)
          if (tableRows.some(row => Math.abs(row.targetPrice - currentSpotPriceForTick) < 0.001)) continue;
      }
    }
    
    // Ensure prices are positive, unless the center itself was near zero.
    if (currentSpotPriceForTick < 0.01 && centerSpotForMatrix > 0.01) continue;
    // Ensure prices are always non-negative if starting from a non-negative base
    currentSpotPriceForTick = Math.max(0.001, currentSpotPriceForTick);


    let pnlAtTargetDateTotal = 0;
    let pnlAtExpiryTotal = 0;

    selectedLegs.forEach((leg) => {
      const instrumentDetails = getInstrumentByToken(leg.token); // Get details for each leg
      // If instrumentDetails are crucial for a leg type (e.g., options) and missing, that leg's P&L might be 0 or fallback.
      
      pnlAtTargetDateTotal += calculateLegPnLAtTargetDate(
        leg,
        currentSpotPriceForTick,
        targetDateISO,
        riskFreeRate,
        getScenarioIV, // Pass the function that returns IV for a token
        getInstrumentByToken
      );
      pnlAtExpiryTotal += calculateLegPnLAtExpiry(leg, currentSpotPriceForTick, instrumentDetails);
    });

    let pnlAtTargetDatePct, pnlAtExpiryPct;
    if (
      showPercentage &&
      underlyingSpotPriceForPercentage && // Use the specific base for % calculation
      !isNaN(underlyingSpotPriceForPercentage) &&
      underlyingSpotPriceForPercentage !== 0
    ) {
      pnlAtTargetDatePct = (pnlAtTargetDateTotal / underlyingSpotPriceForPercentage) * 100;
      pnlAtExpiryPct = (pnlAtExpiryTotal / underlyingSpotPriceForPercentage) * 100;
    }

    tableRows.push({
      targetPrice: Number(currentSpotPriceForTick.toFixed(2)),
      pnlAtTargetDate: Number(pnlAtTargetDateTotal.toFixed(2)),
      pnlAtExpiry: Number(pnlAtExpiryTotal.toFixed(2)),
      pnlAtTargetDatePct: pnlAtTargetDatePct !== undefined ? Number(pnlAtTargetDatePct.toFixed(2)) : undefined,
      pnlAtExpiryPct: pnlAtExpiryPct !== undefined ? Number(pnlAtExpiryPct.toFixed(2)) : undefined,
      isCurrentTarget: i === 0, // Center row of the generated table points
    });
  }
  // Ensure unique target prices and sort, especially if centerSpotForMatrix caused non-uniform steps
  const uniqueRows = Array.from(new Map(tableRows.map(row => [row.targetPrice, row])).values());
  uniqueRows.sort((a, b) => a.targetPrice - b.targetPrice);
  
  return uniqueRows;
};
