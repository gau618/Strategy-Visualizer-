// src/features/StrategyVisualizer/utils/payoffGraphUtils.js

import { black76Price } from "./optionPricingUtils";

// --- Calculation Helpers --- (Keep these as they are)
function calculateLegValueAtExpiry(leg, spot) {
  const strike = Number(leg.strike);
  if (leg.optionType === "CE") return Math.max(0, spot - strike);
  if (leg.optionType === "PE") return Math.max(0, strike - spot);
  return 0;
}

function calculateLegPnLAtExpiry(leg, spot) {
  const intrinsic = calculateLegValueAtExpiry(leg, spot);
  const premium = parseFloat(leg.price);
  const lotSize = leg.contractInfo?.lotSize || leg.lotSize || 1;
  const lots = leg.lots || 1;
  const quantity = lotSize * lots;
  const direction = leg.buySell === "Buy" ? 1 : -1;
  return (intrinsic - premium) * direction * quantity;
}

function calculateLegTheoreticalPrice(
  leg, spot, targetDateISO, riskFreeRate, scenarioIV, getOptionByToken
) {
  const option = getOptionByToken(leg.token);
  if (!option || !option.expiry) return parseFloat(leg.price);
  const expiryDate = new Date(option.expiry);
  const targetDate = new Date(targetDateISO);
  const msInYear = 365 * 24 * 60 * 60 * 1000;
  const timeToExpiry = Math.max((expiryDate - targetDate) / msInYear, 0);
  if (timeToExpiry <= 0 || scenarioIV <= 0) {
    return calculateLegValueAtExpiry(leg, spot);
  }
  return black76Price(spot, Number(leg.strike), timeToExpiry, riskFreeRate, scenarioIV, leg.optionType);
}

function calculateLegPnLAtTargetDate(
  leg, spot, targetDateISO, riskFreeRate, scenarioIV, getOptionByToken
) {
  const theoPrice = calculateLegTheoreticalPrice(leg, spot, targetDateISO, riskFreeRate, scenarioIV, getOptionByToken);
  const premium = parseFloat(leg.price);
  const lotSize = leg.contractInfo?.lotSize || leg.lotSize || 1;
  const lots = leg.lots || 1;
  const quantity = lotSize * lots;
  const direction = leg.buySell === "Buy" ? 1 : -1;
  return (theoPrice - premium) * direction * quantity;
}

function snapToInterval(spot, interval) {
  if (interval === 0 || isNaN(interval)) return spot;
  return Math.round(spot / interval) * interval;
}

// --- Main Payoff Graph Data Generator ---
export function generatePayoffGraphData({
  strategyLegs,
  niftyTargetString,
  displaySpotForSlider,
  targetDateISO,
  riskFreeRate,
  getScenarioIV,
  getOptionByToken,
  targetInterval,
  PAYOFF_GRAPH_POINTS = 40,
  PAYOFF_GRAPH_INTERVAL_STEP = 100,
  underlyingSpotPrice,
  showPercentage = false,
  sdDays = 30,
  fullOptionChainData = [], // Ensure this is an array of option objects
}) {
  const selectedLegs = strategyLegs.filter(
    (l) => l.selected && l.token && typeof l.price === "number"
  );

  // Determine the central spot for SD band calculation and P&L grid focus
  const rawScenarioSpot =
    niftyTargetString !== "" && !isNaN(parseFloat(niftyTargetString))
      ? parseFloat(niftyTargetString)
      : typeof displaySpotForSlider === "number"
      ? displaySpotForSlider
      : (typeof displaySpotForSlider === 'string' && !isNaN(parseFloat(displaySpotForSlider)) ? parseFloat(displaySpotForSlider) : undefined);

  const centerForCalculations = !isNaN(rawScenarioSpot) && rawScenarioSpot > 0 
                                 ? rawScenarioSpot 
                                 : (typeof underlyingSpotPrice === 'number' && underlyingSpotPrice > 0 ? underlyingSpotPrice : undefined);
  
  if (centerForCalculations === undefined && selectedLegs.length === 0 && (!Array.isArray(fullOptionChainData) || fullOptionChainData.length === 0)) {
    return { points: [], sdBands: null };
  }

  // 1. Calculate SD bands (based on centerForCalculations)
  let sdBands = null;
  if (centerForCalculations !== undefined && centerForCalculations > 0 && sdDays > 0) {
    let representativeIv = 0.15;
    if (selectedLegs.length > 0) {
        const atmLeg = selectedLegs.find(
            (l) => Math.abs(Number(l.strike) - centerForCalculations) === Math.min(...selectedLegs.map((x) => Math.abs(Number(x.strike) - centerForCalculations)))
        ) || selectedLegs[0];
        if (atmLeg) {
            const ivValue = atmLeg.iv || getScenarioIV(atmLeg.token);
            if (typeof ivValue === 'string' || typeof ivValue === 'number') {
                const parsedIV = parseFloat(ivValue);
                if (!isNaN(parsedIV) && parsedIV > 0) representativeIv = parsedIV / 100;
            }
        }
    } else if (Array.isArray(fullOptionChainData) && fullOptionChainData.length > 0) {
        const atmOptionFromChain = fullOptionChainData
            .filter(opt => opt && opt.iv && (typeof opt.iv === 'string' || typeof opt.iv === 'number') && parseFloat(opt.iv) > 0)
            .reduce((prev, curr) => {
                if (!prev) return curr;
                return Math.abs(parseFloat(curr.strike) - centerForCalculations) < Math.abs(parseFloat(prev.strike) - centerForCalculations) ? curr : prev;
            }, null);
        if (atmOptionFromChain && atmOptionFromChain.iv) {
            const parsedIV = parseFloat(atmOptionFromChain.iv);
            if(!isNaN(parsedIV) && parsedIV > 0) representativeIv = parsedIV / 100;
        }
    }
    if (representativeIv > 0) {
        const timeToExpiryForSD = sdDays / 365;
        if (timeToExpiryForSD > 0) {
            const sd = centerForCalculations * representativeIv * Math.sqrt(timeToExpiryForSD);
            sdBands = {
                minus2SD: Number((centerForCalculations - 2 * sd).toFixed(2)),
                minus1SD: Number((centerForCalculations - sd).toFixed(2)),
                plus1SD:  Number((centerForCalculations + sd).toFixed(2)),
                plus2SD:  Number((centerForCalculations + 2 * sd).toFixed(2)),
                center: Number(centerForCalculations.toFixed(2))
            };
        }
    }
  }

  // 2. Generate P&L Spot Grid (your original logic)
  let pnlSpotGrid = [];
  if (centerForCalculations !== undefined) {
    const intervalStep = Number(targetInterval) || PAYOFF_GRAPH_INTERVAL_STEP || 100;
    const actualIntervalStep = intervalStep === 0 ? 100 : intervalStep;
    const snappedSpot = snapToInterval(centerForCalculations, actualIntervalStep);
    const halfPoints = Math.floor(PAYOFF_GRAPH_POINTS / 2);
    for (let i = -halfPoints; i <= halfPoints; i++) {
      let spotVal;
      if (i === 0) {
        spotVal = centerForCalculations;
      } else {
        spotVal = snappedSpot + i * actualIntervalStep;
        if (spotVal === centerForCalculations && i!==0) continue;
      }
      if (spotVal < 0.01) continue;
      const roundedSpot = Number(spotVal.toFixed(2));
      if(!pnlSpotGrid.includes(roundedSpot)) pnlSpotGrid.push(roundedSpot);
    }
    if (!pnlSpotGrid.includes(Number(centerForCalculations.toFixed(2)))) {
        pnlSpotGrid.push(Number(centerForCalculations.toFixed(2)));
    }
  }

  // 3. Generate OI Spot Grid (unique strikes from fullOptionChainData within ±2SD)
  let oiSpotGrid = [];
  if (Array.isArray(fullOptionChainData) && fullOptionChainData.length > 0 && sdBands) {
    oiSpotGrid = Array.from(
      new Set(
        fullOptionChainData
          .map(opt => opt && typeof opt.strike !== 'undefined' ? parseFloat(opt.strike) : null)
          .filter(strikeNum => 
            strikeNum !== null && 
            !isNaN(strikeNum) &&
            strikeNum >= sdBands.minus2SD && 
            strikeNum <= sdBands.plus2SD
          )
      )
    ).map(s => Number(s.toFixed(2))); // Ensure consistent formatting
  }

  // 4. Merge and sort all unique spot points for the final chart x-axis
  const finalSpotGrid = Array.from(new Set([...pnlSpotGrid, ...oiSpotGrid])).sort((a, b) => a - b);

  if (finalSpotGrid.length === 0 && selectedLegs.length === 0) {
    return { points: [], sdBands };
  }
   if (finalSpotGrid.length === 0 && selectedLegs.length > 0) {
      console.warn("Final spot grid is empty, but strategy legs exist. P&L cannot be plotted on a range.");
      return { points: [], sdBands }; // Or handle by plotting P&L at leg strikes only
   }


  // 5. Calculate P&L and OI for each point in the finalSpotGrid
  const points = finalSpotGrid.map((spot) => {
    let pnlAtExpiry = 0;
    let pnlAtTargetDate = 0;
    if (selectedLegs.length > 0) {
        selectedLegs.forEach((leg) => {
        pnlAtExpiry += calculateLegPnLAtExpiry(leg, spot);
        pnlAtTargetDate += calculateLegPnLAtTargetDate(
            leg, spot, targetDateISO, riskFreeRate, getScenarioIV(leg.token), getOptionByToken
        );
        });
    }

    let callOI = 0, putOI = 0;
    // Check if this 'spot' is one of the strikes from oiSpotGrid (i.e., an actual option strike within ±2SD)
    if (Array.isArray(fullOptionChainData) && fullOptionChainData.length > 0 && sdBands && 
        spot >= sdBands.minus2SD && spot <= sdBands.plus2SD) { // Double check range condition
        
      // Find matching options in the full chain for this specific spot
      const callOption = fullOptionChainData.find(
        (option) =>
          option && option.optionType === "CE" &&
          Math.abs(parseFloat(option.strike) - spot) < 0.001 && // Robust comparison
          option.marketData && typeof option.marketData.oi === "number"
      );
      if (callOption) callOI = callOption.marketData.oi;

      const putOption = fullOptionChainData.find(
        (option) =>
          option && option.optionType === "PE" &&
          Math.abs(parseFloat(option.strike) - spot) < 0.001 && // Robust comparison
          option.marketData && typeof option.marketData.oi === "number"
      );
      if (putOption) putOI = putOption.marketData.oi;
    }

    let pnlAtExpiryPct, pnlAtTargetDatePct;
    if (showPercentage && typeof underlyingSpotPrice === 'number' && underlyingSpotPrice !== 0) {
      pnlAtExpiryPct = (pnlAtExpiry / underlyingSpotPrice) * 100;
      pnlAtTargetDatePct = (pnlAtTargetDate / underlyingSpotPrice) * 100;
    }

    return {
      spot,
      pnlAtExpiry: Number(pnlAtExpiry.toFixed(2)),
      pnlAtTargetDate: Number(pnlAtTargetDate.toFixed(2)),
      pnlAtExpiryPct: pnlAtExpiryPct !== undefined ? Number(pnlAtExpiryPct.toFixed(2)) : undefined,
      pnlAtTargetDatePct: pnlAtTargetDatePct !== undefined ? Number(pnlAtTargetDatePct.toFixed(2)) : undefined,
      callOI,
      putOI,
      isCurrentSpot: centerForCalculations !== undefined ? spot === Number(centerForCalculations.toFixed(2)) : false,
    };
  });

  return { points, sdBands };
}
