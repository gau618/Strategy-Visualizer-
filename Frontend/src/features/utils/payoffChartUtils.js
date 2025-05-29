// src/features/StrategyVisualizer/utils/payoffChartUtils.js

// Ensure these utilities are available and correctly implemented in their respective files
import { black76Price, timeToExpiryDays } from './optionPricingUtils'; 
import { PAYOFF_CHART_POINTS, PAYOFF_CHART_XAXIS_STRIKE_PADDING_FACTOR, SPOT_SLIDER_STEP } from '../../config'; // Adjust path as needed
// Example for optionPricingUtils.js
const timeToExpiry = (expiryDateISOString, fromDate = new Date()) => {
  const expiry = new Date(expiryDateISOString); // Parses ISO string
  
  // Option 1: Simple difference, might give 0 for same day if target time is past
  // const diffTime = expiry.getTime() - fromDate.getTime();
  // const diffDays = diffTime / (1000 * 60 * 60 * 24);
  // return Math.max(0, diffDays); // Ensure it's not negative for this use case

  // Option 2: More robust "calendar days until" (often preferred for DTE in options)
  // Set both to midnight in their respective local timezones to count calendar days
  const expiryAtMidnight = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  const fromAtMidnight = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  
  const diffTimeMs = expiryAtMidnight.getTime() - fromAtMidnight.getTime();
  if (diffTimeMs < 0) return 0; // Target date is in the past

  const diffDays = Math.ceil(diffTimeMs / (1000 * 60 * 60 * 24)); 
  // Use Math.ceil if "any part of today counts as 1 day if expiry is today"
  // Use Math.round or Math.floor if partial days are handled differently.
  // For SD bands, a small positive DTE is needed if expiry is today but later.
  // If you need sub-day precision for SD bands, the timeFactor should be calculated differently.

  // For SD bands, if it's the same day but future time, you might want a fraction of a day.
  // If targetDateISO is today, but future time:
  if (expiryAtMidnight.getTime() === fromAtMidnight.getTime()) {
      const timeDiffMsToday = expiry.getTime() - fromDate.getTime();
      if (timeDiffMsToday > 0) {
          return timeDiffMsToday / (1000 * 60 * 60 * 24); // Returns a fraction e.g., 0.25 for 6 hours left
      }
      return 0; // Target time has passed today
  }
  
  return diffDays > 0 ? diffDays : 0; // Ensure non-negative
};


// Helper: P&L for a single leg at Expiry
const calculateLegPnLAtExpiry = (leg, underlyingPriceAtExpiry) => {
  const strike = Number(leg.strike);
  const entryPrice = parseFloat(leg.price);
  // Ensure lots and lotSize are numbers, default to 1 if not provided or invalid
  const lots = (typeof leg.lots === 'number' && leg.lots > 0) ? leg.lots : 1;
  const lotSize = (typeof leg.lotSize === 'number' && leg.lotSize > 0) ? leg.lotSize : 1;
  const quantity = lots * lotSize;
  const direction = leg.buySell === "Buy" ? 1 : -1;
  let optionValueAtExpiry = 0;

  if (leg.optionType === "CE") {
    optionValueAtExpiry = Math.max(0, underlyingPriceAtExpiry - strike);
  } else if (leg.optionType === "PE") {
    optionValueAtExpiry = Math.max(0, strike - underlyingPriceAtExpiry);
  }
  // Ensure entryPrice is a number
  if (isNaN(entryPrice)) {
      console.warn(`[payoffChartUtils.calculateLegPnLAtExpiry] Invalid entry price for leg:`, leg);
      return (optionValueAtExpiry * direction * quantity); // P&L is just payoff if entry price is invalid
  }
  return (optionValueAtExpiry - entryPrice) * direction * quantity;
};

// Helper: P&L for a single leg at Target Date (T+0)
const calculateLegPnLAtTargetDate = (
  leg,
  underlyingPriceAtTarget,
  targetDateISO,
  riskFreeRate,
  scenarioIV, // Decimal IV for this leg's scenario (e.g., 0.25 for 25%)
  getOptionByToken // Function to get leg.expiry (ISO string), leg.strike (number)
) => {

  const liveOptionData = getOptionByToken(leg.token); // Expects { expiry: 'ISO_STRING', strike: number }
 // console.log(liveOptionData, leg.token, "liveOptionData for leg");
  if (!liveOptionData || !liveOptionData.expiry) {
    console.warn(`[payoffChartUtils.calculateLegPnLAtTargetDate] Missing expiry/strike for leg ${leg.token} for T+0 calc. Falling back to expiry P&L.`);
    return calculateLegPnLAtExpiry(leg, underlyingPriceAtTarget);
  }

  const TTE = timeToExpiry(liveOptionData.expiry, new Date(targetDateISO)); // Expects timeToExpiry to handle dates correctly
  const strike = Number(liveOptionData.strike); // Use strike from liveOptionData if more reliable
  const entryPrice = parseFloat(leg.price);
  const lots = (typeof leg.lots === 'number' && leg.lots > 0) ? leg.lots : 1;
  const lotSize = (typeof leg.lotSize === 'number' && leg.lotSize > 0) ? leg.lotSize : 1;
  const quantity = lots * lotSize;
  const direction = leg.buySell === "Buy" ? 1 : -1;

  if (TTE <= 0.000001) { // At or past expiry (using a small epsilon)
    return calculateLegPnLAtExpiry(leg, underlyingPriceAtTarget);
  }

  if (isNaN(scenarioIV) || scenarioIV <= 0) {
    console.warn(`[payoffChartUtils.calculateLegPnLAtTargetDate] Invalid scenarioIV (${scenarioIV}) for leg ${leg.token}. Using intrinsic for T+0.`);
    let intrinsicValue = 0;
    if (leg.optionType === "CE") intrinsicValue = Math.max(0, underlyingPriceAtTarget - strike);
    else if (leg.optionType === "PE") intrinsicValue = Math.max(0, strike - underlyingPriceAtTarget);
    
    if (isNaN(entryPrice)) return (intrinsicValue * direction * quantity);
    return (intrinsicValue - entryPrice) * direction * quantity;
  }
  
  if (isNaN(riskFreeRate)) {
      console.warn(`[payoffChartUtils.calculateLegPnLAtTargetDate] Invalid riskFreeRate (${riskFreeRate}). Using 0.`);
      riskFreeRate = 0;
  }

  const theoreticalPrice = black76Price(
    underlyingPriceAtTarget, // Assuming F = S for spot options pricing model
    strike,
    TTE,
    riskFreeRate,
    scenarioIV,
    leg.optionType
  );

  if (isNaN(theoreticalPrice)) {
      console.warn(`[payoffChartUtils.calculateLegPnLAtTargetDate] black76Price returned NaN for leg ${leg.token}. Inputs: S=${underlyingPriceAtTarget}, K=${strike}, TTE=${TTE}, r=${riskFreeRate}, IV=${scenarioIV}, Type=${leg.optionType}`);
      // Fallback if pricing model fails, perhaps to intrinsic or zero change from entry
      let fallbackValue = 0;
      if (leg.optionType === "CE") fallbackValue = Math.max(0, underlyingPriceAtTarget - strike);
      else if (leg.optionType === "PE") fallbackValue = Math.max(0, strike - underlyingPriceAtTarget);
      if (isNaN(entryPrice)) return (fallbackValue * direction * quantity);
      return (fallbackValue - entryPrice) * direction * quantity;
  }
  if (isNaN(entryPrice)) return (theoreticalPrice * direction * quantity);
  return (theoreticalPrice - entryPrice) * direction * quantity;
};

// Helper to get a representative IV for SD bands
const getRepresentativeIVForSD = (selectedLegs, currentSpot, getOptionByToken, defaultIV = 0.20) => {
    if (!selectedLegs || selectedLegs.length === 0 || !currentSpot || currentSpot <= 0 || !getOptionByToken) {
        console.warn("[payoffChartUtils.getRepresentativeIVForSD] Invalid inputs for SD IV calc. Using default.", { legs: selectedLegs?.length, currentSpot, getOptionByToken: !!getOptionByToken });
        return defaultIV;
    }
    
    let closestAtmLegIV = null; 
    let minDiffToAtm = Infinity;

    selectedLegs.forEach(sl => {
        const legData = getOptionByToken(sl.token); // Expects getOptionByToken to return { ..., iv: numericIV_in_percent (e.g., 25.5), strike: numericStrike }
        if (legData && typeof Number(legData.iv) === 'number' && legData.iv > 0) {
            const strikeDiff = Math.abs(legData.strike - currentSpot);
            if (strikeDiff < minDiffToAtm) {
                minDiffToAtm = strikeDiff;
                closestAtmLegIV = Number(legData.iv) / 100; // Convert % to decimal
            }
        }
    });
    console.log(closestAtmLegIV)
    if (closestAtmLegIV !== null && closestAtmLegIV > 0) {
        return closestAtmLegIV;
    }
    
    // Fallback: average IV of selected legs if available and valid
    let ivSum = 0;
    let validIVCount = 0;
    selectedLegs.forEach(sl => { 
        const legData = getOptionByToken(sl.token); 
        if (legData && typeof legData.iv === 'number' && legData.iv > 0) { 
            ivSum += legData.iv; 
            validIVCount++; 
        }
    });
    if (validIVCount > 0) {
        return (ivSum / validIVCount) / 100; // Average IV, converted to decimal
    }
    
    console.warn("[payoffChartUtils.getRepresentativeIVForSD] Could not determine representative IV for SD bands, using default:", defaultIV);
    return defaultIV;
};


export const generateFreshPayoffChartData = ({
  strategyLegs,
  niftyTargetString,
  displaySpotForSlider,
  targetDateISO,
  riskFreeRate,
  getScenarioIV,      // Function: (legToken) => decimal IV (e.g., 0.25)
  getOptionByToken,   // Function: (legToken) => { expiry: string, strike: number, iv: number (percentage e.g. 25.5), lotSize: number, ... }
  underlyingSpotPrice,
}) => {
  console.log("[payoffChartUtils.generateFreshPayoffChartData] INPUTS:", 
    { legsCount: strategyLegs?.length, niftyTargetString, displaySpotForSlider, targetDateISO, underlyingSpotPrice, riskFreeRate }
  );

  const selectedLegs = strategyLegs.filter(
    (l) => l.selected && l.token && typeof l.price === 'number' && 
           typeof l.strike === 'number' && l.optionType && l.expiry &&
           typeof l.lots === 'number' && typeof l.lotSize === 'number' // Ensure these are present
  );

  if (selectedLegs.length === 0) {
    console.warn("[payoffChartUtils] No valid selected legs with all required properties for chart data generation.");
    return null;
  }
  
  const numericCenterSpot = (niftyTargetString !== "" && !isNaN(parseFloat(niftyTargetString))) 
                              ? parseFloat(niftyTargetString) 
                              : (typeof displaySpotForSlider === 'number' && displaySpotForSlider > 0 
                                ? displaySpotForSlider 
                                : (typeof underlyingSpotPrice === 'number' && underlyingSpotPrice > 0 ? underlyingSpotPrice : 0));

  if (numericCenterSpot <= 0 || !targetDateISO || isNaN(riskFreeRate)) {
    console.warn("[payoffChartUtils] Invalid critical inputs. CenterSpot:", numericCenterSpot, "TargetDateISO:", targetDateISO, "RiskFreeRate:", riskFreeRate);
    return null;
  }
  
  let minStrike = Infinity, maxStrike = 0;
  selectedLegs.forEach(leg => {
      const strikeNum = Number(leg.strike);
      minStrike = Math.min(minStrike, strikeNum);
      maxStrike = Math.max(maxStrike, strikeNum);
  });

  const strikeRange = (maxStrike > 0 && minStrike !== Infinity && maxStrike > minStrike) ? (maxStrike - minStrike) : 0;
  const paddingFactor = PAYOFF_CHART_XAXIS_STRIKE_PADDING_FACTOR || 0.30;
  const defaultPadding = numericCenterSpot * 0.20; // 20% if no strike range
  const padding = strikeRange > 0 ? strikeRange * paddingFactor : defaultPadding; 

  let lowBound = (minStrike !== Infinity && minStrike > 0 ? minStrike : numericCenterSpot) - padding;
  let highBound = (maxStrike > 0 ? maxStrike : numericCenterSpot) + padding;
  const stepSize = SPOT_SLIDER_STEP || 50;

  lowBound = Math.max(1, Math.floor(lowBound / stepSize) * stepSize);
  highBound = Math.ceil(highBound / stepSize) * stepSize;
  if (lowBound >= highBound) {
      lowBound = Math.max(1, numericCenterSpot - stepSize * 10);
      highBound = numericCenterSpot + stepSize * 10;
      lowBound = Math.max(1, Math.floor(lowBound / stepSize) * stepSize); 
      highBound = Math.ceil(highBound / stepSize) * stepSize;
  }
  if (lowBound <= 0) lowBound = stepSize; // Ensure lowBound is positive


  const labels = [];
  const pnlOnExpiryLine = [];
  const pnlOnTargetDateLine = [];
  const numPoints = PAYOFF_CHART_POINTS || 60;

  for (let i = 0; i <= numPoints; i++) {
    const underlyingPriceAtTick = parseFloat((lowBound + ((highBound - lowBound) * i) / numPoints).toFixed(2));
    labels.push(underlyingPriceAtTick.toFixed(0));
    
    let totalExpiryPnL = 0;
    let totalTargetDatePnL = 0;

    selectedLegs.forEach((leg) => {
      const scenarioIVForLeg = getScenarioIV(leg.token); // Expects decimal IV
      if (typeof scenarioIVForLeg !== 'number') {
          console.warn(`[payoffChartUtils] Invalid IV from getScenarioIV for leg ${leg.token}:`, scenarioIVForLeg);
      }

      totalExpiryPnL += calculateLegPnLAtExpiry(leg, underlyingPriceAtTick);
      totalTargetDatePnL += calculateLegPnLAtTargetDate(
        leg, underlyingPriceAtTick, targetDateISO, riskFreeRate,
        scenarioIVForLeg, // Pass the retrieved scenario IV
        getOptionByToken
      );
    });
    pnlOnExpiryLine.push(parseFloat(totalExpiryPnL.toFixed(2)));
    pnlOnTargetDateLine.push(parseFloat(totalTargetDatePnL.toFixed(2)));
  }
  
  let pnlAtCurrentNiftyTarget = 0;
  selectedLegs.forEach((leg) => {
      pnlAtCurrentNiftyTarget += calculateLegPnLAtTargetDate(
          leg, numericCenterSpot, targetDateISO, riskFreeRate,
          getScenarioIV(leg.token), getOptionByToken
      );
  });
  pnlAtCurrentNiftyTarget = parseFloat(pnlAtCurrentNiftyTarget.toFixed(2));
  let sdLevels = null;
  const liveSpotForSDBands = typeof underlyingSpotPrice === 'number' && underlyingSpotPrice > 0 ? underlyingSpotPrice : numericCenterSpot;

  if (liveSpotForSDBands > 0 && targetDateISO && timeToExpiryDays) {
    const representativeIV = getRepresentativeIVForSD(selectedLegs, liveSpotForSDBands, getOptionByToken); 
    const today = new Date();
    const dteForSDbands = timeToExpiryDays(targetDateISO, today);
          sdLevels = {
        plusOneSD: 56000,
        minusOneSD: 54000,
        plusTwoSD: 57000,
        minusTwoSD: 53000,
      };
    if (representativeIV > 0 && dteForSDbands > 0) {
      const timeFactor = Math.sqrt(dteForSDbands / 365);
      const oneSdMove = liveSpotForSDBands * representativeIV * timeFactor;
      sdLevels = {
        plusOneSD: parseFloat((liveSpotForSDBands + oneSdMove).toFixed(2)),
        minusOneSD: parseFloat((liveSpotForSDBands - oneSdMove).toFixed(2)),
        plusTwoSD: parseFloat((liveSpotForSDBands + (2 * oneSdMove)).toFixed(2)),
        minusTwoSD: parseFloat((liveSpotForSDBands - (2 * oneSdMove)).toFixed(2)),
      };
    } else {
        console.warn("[payoffChartUtils] SD bands not calculated. RepIV:", representativeIV, "DTE for SD:", dteForSDbands);
    }
  }
  
  const targetDateLabel = targetDateISO ? new Date(targetDateISO).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Target Date";

  const chartData = {
    labels,
    datasets: [
      { 
        label: "P&L on Expiry", data: pnlOnExpiryLine, 
        borderColor: "rgb(220, 53, 69)", borderWidth: 2, tension: 0, pointRadius: 0,
        segment: { borderColor: ctx => (ctx.p0.parsed.y < 0 && ctx.p1.parsed.y < 0) ? 'rgb(220, 53, 69)' : ((ctx.p0.parsed.y > 0 && ctx.p1.parsed.y > 0) ? 'rgb(25, 135, 84)' : 'rgb(108, 117, 125)')}
      },
      { 
        label: `P&L on ${targetDateLabel}`, data: pnlOnTargetDateLine, 
        borderColor: "rgb(13, 110, 253)", borderWidth: 2, tension: 0.1, pointRadius: 0, borderDash: [5, 5]
      },
    ],
    minX: lowBound,
    maxX: highBound,
    pnlAtCurrentTarget: pnlAtCurrentNiftyTarget,
    currentActualSpot: typeof underlyingSpotPrice === 'number' && underlyingSpotPrice > 0 ? parseFloat(underlyingSpotPrice.toFixed(2)) : null,
    sdLevels: sdLevels,
  };
  console.log("[payoffChartUtils.generateFreshPayoffChartData] FINAL OUTPUT:", JSON.parse(JSON.stringify(chartData)));
  return chartData;
};
