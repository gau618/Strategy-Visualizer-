// src/features/StrategyVisualizer/utils/strategyPayoffUtils.js
import {
  black76Price,
  black76Greeks,
  timeToExpiry,
  timeToExpiryDays,
} from "./optionPricingUtils"; // Corrected relative path

import {
  PAYOFF_CHART_POINTS,
  PAYOFF_TABLE_POINTS,
  PAYOFF_TABLE_INTERVAL_STEP,
  PAYOFF_CHART_XAXIS_STRIKE_PADDING_FACTOR,
} from "../../config"; // Corrected relative path

// --- Helper Functions (calculateLegValueAtExpiry, calculateLegPnLAtExpiry, calculateLegTheoreticalPrice, calculateLegPnLAtTargetDate, getRepresentativeIVForSD) ---
// These are the same as in the previous full code response for this file. I'll include them for completeness.

const calculateLegValueAtExpiry = (leg, underlyingPriceAtExpiry) => {
  const strike = Number(leg.strike);
  if (leg.optionType === "CE")
    return Math.max(0, underlyingPriceAtExpiry - strike);
  if (leg.optionType === "PE")
    return Math.max(0, strike - underlyingPriceAtExpiry);
  return 0;
};
const calculateLegPnLAtExpiry = (leg, underlyingPriceAtExpiry) => {
  const legValuePerShareAtExpiry = calculateLegValueAtExpiry(
    leg,
    underlyingPriceAtExpiry
  );
  const entryPricePerShare = parseFloat(leg.price);
  const multiplier = (leg.lots || 1) * (leg.lotSize || 1);
  const pnlPerShare = legValuePerShareAtExpiry - entryPricePerShare;
  return pnlPerShare * multiplier * (leg.buySell === "Buy" ? 1 : -1);
};
const calculateLegTheoreticalPrice = (
  leg,
  underlyingPrice,
  targetDateISO,
  riskFreeRate,
  scenarioIV,
  getOptionByToken
) => {
  const liveOption = getOptionByToken(leg.token);
  if (!liveOption || !liveOption.expiry) return parseFloat(leg.price);
  const TTE = timeToExpiry(liveOption.expiry, new Date(targetDateISO));
  if (TTE <= 0) return calculateLegValueAtExpiry(leg, underlyingPrice);
  if (scenarioIV <= 0) return calculateLegValueAtExpiry(leg, underlyingPrice);
  const forwardPrice = underlyingPrice; // Assuming spot is used as F for Black76
  return black76Price(
    forwardPrice,
    Number(leg.strike),
    TTE,
    riskFreeRate,
    scenarioIV,
    leg.optionType
  );
};
const calculateLegPnLAtTargetDate = (
  leg,
  underlyingPrice,
  targetDateISO,
  riskFreeRate,
  scenarioIV,
  getOptionByToken
) => {
  const theoreticalPricePerShare = calculateLegTheoreticalPrice(
    leg,
    underlyingPrice,
    targetDateISO,
    riskFreeRate,
    scenarioIV,
    getOptionByToken
  );
  const entryPricePerShare = parseFloat(leg.price);
  const multiplier = (leg.lots || 1) * (leg.lotSize || 1);
  const pnlPerShare = theoreticalPricePerShare - entryPricePerShare;
  return pnlPerShare * multiplier * (leg.buySell === "Buy" ? 1 : -1);
};
const getRepresentativeIVForSD = (
  selectedLegs,
  underlyingSpotPrice,
  getOptionByToken,
  defaultIV = 20
) => {
  if (!selectedLegs || selectedLegs.length === 0 || !underlyingSpotPrice)
    return defaultIV / 100;
  let closestAtmLegData = null;
  let minDiffToAtm = Infinity;
  selectedLegs.forEach((sl) => {
    const legDataFromContext = getOptionByToken(sl.token);
    if (
      legDataFromContext &&
      legDataFromContext.iv &&
      legDataFromContext.strike
    ) {
      const strikeDiff = Math.abs(
        Number(legDataFromContext.strike) - underlyingSpotPrice
      );
      if (strikeDiff < minDiffToAtm) {
        minDiffToAtm = strikeDiff;
        closestAtmLegData = legDataFromContext;
      }
    }
  });
  if (closestAtmLegData && closestAtmLegData.iv)
    return parseFloat(closestAtmLegData.iv) / 100;
  if (selectedLegs.length > 0) {
    const firstLegDataFromContext = getOptionByToken(selectedLegs[0].token);
    if (firstLegDataFromContext && firstLegDataFromContext.iv)
      return parseFloat(firstLegDataFromContext.iv) / 100;
  }
  return defaultIV / 100;
};

// --- Exported Main Calculation Functions ---
export const generatePayoffChartData = ({
  strategyLegs,
  niftyTargetString,
  displaySpotForSlider,
  targetDateISO,
  riskFreeRate,
  getScenarioIV,
  getOptionByToken,
  underlyingSpotPrice,
}) => {
  const selectedLegs = strategyLegs.filter(
    (l) => l.selected && l.token && typeof l.price === "number"
  );
  if (selectedLegs.length === 0) return null;
  const currentScenarioSpot =
    niftyTargetString !== "" && !isNaN(parseFloat(niftyTargetString))
      ? parseFloat(niftyTargetString)
      : typeof displaySpotForSlider === "number"
      ? displaySpotForSlider
      : parseFloat(displaySpotForSlider);
  if (isNaN(currentScenarioSpot) || currentScenarioSpot <= 0) return null;
  let minStrike = Infinity,
    maxStrike = 0;
  selectedLegs.forEach((leg) => {
    const strikeNum = Number(leg.strike);
    minStrike = Math.min(minStrike, strikeNum);
    maxStrike = Math.max(maxStrike, strikeNum);
  });
  const strikeRange =
    maxStrike > 0 && minStrike !== Infinity && maxStrike > minStrike
      ? maxStrike - minStrike
      : 0;
  const padding =
    strikeRange > 0
      ? strikeRange * PAYOFF_CHART_XAXIS_STRIKE_PADDING_FACTOR
      : currentScenarioSpot * 0.2;
  let lowBound =
    (minStrike !== Infinity ? minStrike : currentScenarioSpot) - padding;
  let highBound = (maxStrike > 0 ? maxStrike : currentScenarioSpot) + padding;
  lowBound = Math.max(0.01, lowBound);
  const labels = [];
  const pnlOnExpiryData = [];
  const pnlOnTargetDateData = [];
  for (let i = 0; i <= PAYOFF_CHART_POINTS; i++) {
    const underlyingPriceAtTick =
      lowBound + ((highBound - lowBound) * i) / PAYOFF_CHART_POINTS;
    labels.push(underlyingPriceAtTick.toFixed(0));
    let totalExpiryPnLForTick = 0;
    let totalTargetDatePnLForTick = 0;
    selectedLegs.forEach((leg) => {
      totalExpiryPnLForTick += calculateLegPnLAtExpiry(
        leg,
        underlyingPriceAtTick
      );
      totalTargetDatePnLForTick += calculateLegPnLAtTargetDate(
        leg,
        underlyingPriceAtTick,
        targetDateISO,
        riskFreeRate,
        getScenarioIV(leg.token),
        getOptionByToken
      );
    });
    pnlOnExpiryData.push(totalExpiryPnLForTick);
    pnlOnTargetDateData.push(totalTargetDatePnLForTick);
  }
  let pnlAtNiftyTargetOnDate = 0;
  selectedLegs.forEach((leg) => {
    pnlAtNiftyTargetOnDate += calculateLegPnLAtTargetDate(
      leg,
      currentScenarioSpot,
      targetDateISO,
      riskFreeRate,
      getScenarioIV(leg.token),
      getOptionByToken
    );
  });
  let sdLevels = null;
  if (underlyingSpotPrice && targetDateISO) {
    const representativeIV = getRepresentativeIVForSD(
      selectedLegs,
      underlyingSpotPrice,
      getOptionByToken
    );
    const today = new Date();
    const dteForSDbands = timeToExpiryDays(targetDateISO, today);
    if (representativeIV > 0 && dteForSDbands > 0) {
      const timeFactor = Math.sqrt(dteForSDbands / 365);
      const oneSdMove = underlyingSpotPrice * representativeIV * timeFactor;
      sdLevels = {
        plusOneSD: underlyingSpotPrice + oneSdMove,
        minusOneSD: underlyingSpotPrice - oneSdMove,
        plusTwoSD: underlyingSpotPrice + 2 * oneSdMove,
        minusTwoSD: underlyingSpotPrice - 2 * oneSdMove,
      };
    }
  }
  const targetDateLabel = targetDateISO
    ? new Date(targetDateISO).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })
    : "Target";
  return {
    labels,
    datasets: [
      {
        label: "On Expiry",
        data: pnlOnExpiryData,
        borderColor: "#DC3545",
        tension: 0,
        pointRadius: 0,
        borderWidth: 2,
        fill: false,
        segment: {
          borderColor: (ctx) =>
            ctx.p0.raw < 0 && ctx.p1.raw < 0
              ? "#DC3545"
              : ctx.p0.raw > 0 && ctx.p1.raw > 0
              ? "#28A745"
              : "#6c757d",
        },
      },
      {
        label: `On ${targetDateLabel}`,
        data: pnlOnTargetDateData,
        borderColor: "#007BFF",
        tension: 0.1,
        pointRadius: 0,
        borderWidth: 2,
        fill: false,
        borderDash: [5, 5],
      },
    ],
    minX: lowBound,
    maxX: highBound,
    pnlAtCurrentTarget: pnlAtNiftyTargetOnDate,
    currentActualSpot: underlyingSpotPrice,
    sdLevels: sdLevels,
  };
};

export const generatePayoffTableData = ({
  strategyLegs,
  niftyTargetString,
  displaySpotForSlider,
  targetDateISO,
  riskFreeRate,
  getScenarioIV,
  getOptionByToken,
  targetInterval,
}) => {
  const selectedLegs = strategyLegs.filter(
    (l) => l.selected && l.token && typeof l.price === "number"
  );
  if (selectedLegs.length === 0) return [];
  const currentScenarioSpot =
    niftyTargetString !== "" && !isNaN(parseFloat(niftyTargetString))
      ? parseFloat(niftyTargetString)
      : typeof displaySpotForSlider === "number"
      ? displaySpotForSlider
      : parseFloat(displaySpotForSlider);
  if (isNaN(currentScenarioSpot) || currentScenarioSpot <= 0) return [];
  const tableRows = [];
  const halfPoints = Math.floor(PAYOFF_TABLE_POINTS / 2);
  const intervalStep = Number(targetInterval) || PAYOFF_TABLE_INTERVAL_STEP;
  for (let i = -halfPoints; i <= halfPoints; i++) {
    const targetPrice = currentScenarioSpot + i * intervalStep;
    if (targetPrice < 0.01 && i !== 0) continue;
    let pnlAtTargetDate = 0;
    let pnlAtExpiry = 0;
    selectedLegs.forEach((leg) => {
      pnlAtTargetDate += calculateLegPnLAtTargetDate(
        leg,
        targetPrice,
        targetDateISO,
        riskFreeRate,
        getScenarioIV(leg.token),
        getOptionByToken
      );
      pnlAtExpiry += calculateLegPnLAtExpiry(leg, targetPrice);
    });
    tableRows.push({
      targetPrice: targetPrice,
      pnlAtTargetDate: pnlAtTargetDate,
      pnlAtExpiry: pnlAtExpiry,
      isCurrentTarget: i === 0,
    });
  }
  return tableRows;
};

export const generateGreeksTableData = ({
  strategyLegs,
  niftyTarget,
  targetDate,
  getOptionByToken,
  riskFreeRate,
  getScenarioIV,
  multiplyByLotSize,
  multiplyByNumLots,
}) => {
  if (
    !niftyTarget ||
    !targetDate ||
    strategyLegs.length === 0 ||
    !getOptionByToken ||
    !riskFreeRate ||
    !getScenarioIV
  )
    return {
      legs: [],
      totals: { projectedPnL: 0, delta: 0, gamma: 0, theta: 0, vega: 0 },
    };
  const numericNiftyTarget = parseFloat(niftyTarget);
  if (isNaN(numericNiftyTarget))
    return {
      legs: [],
      totals: { projectedPnL: 0, delta: 0, gamma: 0, theta: 0, vega: 0 },
    };
  const projectionDate = new Date(targetDate);
  let aggProjectedPnL = 0,
    aggDelta = 0,
    aggGamma = 0,
    aggTheta = 0,
    aggVega = 0;
  const projectedLegsResult = strategyLegs
    .filter((leg) => leg.selected && leg.token && typeof leg.price === "number")
    .map((leg) => {
      const liveOption = getOptionByToken(leg.token);
      if (
        !liveOption ||
        !liveOption.strike ||
        !liveOption.expiry ||
        liveOption.optionType === undefined
      )
        return {
          ...leg,
          instrumentSymbolConcise: `${leg.buySell} ${leg.lots || 1}L ${
            leg.strike || "N/A"
          }${leg.optionType || "N/A"}`,
          projectedOptionPrice: null,
          projectedPnL: 0,
          projectedGreeks: {},
          entryPrice: parseFloat(leg.price),
          ltp: null,
        };
      const scenarioIVForLeg = getScenarioIV(leg.token);
      const TTE = timeToExpiry(liveOption.expiry, projectionDate);
      let projectedOptPricePerShare;
      let legGreeks = { delta: 0, gamma: 0, theta: 0, vega: 0 };
      if (TTE <= 0) {
        projectedOptPricePerShare = calculateLegValueAtExpiry(
          leg,
          numericNiftyTarget
        );
        const F_g = numericNiftyTarget;
        legGreeks = black76Greeks(
          F_g,
          Number(leg.strike),
          0.000001,
          riskFreeRate,
          scenarioIVForLeg > 0 ? scenarioIVForLeg : 0.01,
          leg.optionType
        );
      } else if (scenarioIVForLeg > 0) {
        const F_p = numericNiftyTarget;
        projectedOptPricePerShare = black76Price(
          F_p,
          Number(leg.strike),
          TTE,
          riskFreeRate,
          scenarioIVForLeg,
          leg.optionType
        );
        legGreeks = black76Greeks(
          F_p,
          Number(leg.strike),
          TTE,
          riskFreeRate,
          scenarioIVForLeg,
          leg.optionType
        );
      } else
        projectedOptPricePerShare = calculateLegValueAtExpiry(
          leg,
          numericNiftyTarget
        );
      const entryPriceNum = parseFloat(leg.price);
      const pnlPerShare =
        isNaN(projectedOptPricePerShare) || isNaN(entryPriceNum)
          ? 0
          : projectedOptPricePerShare - entryPriceNum;
      let scaleFactor = 1;
      if (multiplyByLotSize && leg.lotSize) scaleFactor *= leg.lotSize;
      if (multiplyByNumLots && leg.lots) scaleFactor *= leg.lots;
      const positionDirection = leg.buySell === "Buy" ? 1 : -1;
      const totalLegPnl = pnlPerShare * scaleFactor * positionDirection;
      aggProjectedPnL += totalLegPnl;
      const contractMultiplier = (leg.lots || 1) * (leg.lotSize || 1);
      if (!isNaN(legGreeks.delta))
        aggDelta += legGreeks.delta * contractMultiplier * positionDirection;
      if (!isNaN(legGreeks.gamma))
        aggGamma += legGreeks.gamma * contractMultiplier;
      if (!isNaN(legGreeks.theta))
        aggTheta += legGreeks.theta * contractMultiplier * positionDirection;
      if (!isNaN(legGreeks.vega))
        aggVega += legGreeks.vega * contractMultiplier * positionDirection;
      return {
        ...leg,
        instrumentSymbolConcise: `${leg.buySell === "Buy" ? "" : "S "} ${
          leg.lots || 1
        }L ${Number(leg.strike)}${leg.optionType} ${new Date(
          liveOption.expiry
        ).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`,
        projectedOptionPrice: projectedOptPricePerShare,
        projectedPnL: totalLegPnl,
        projectedGreeks: legGreeks,
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
};
