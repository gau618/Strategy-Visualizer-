// src/features/StrategyVisualizer/utils/payoffDataCalculator.js
import { black76Price, black76Greeks, timeToExpiry } from './optionPricingUtils'; // Adjust path
import { SPOT_SLIDER_RANGE_PERCENT } from '../../config'; // Adjust path

export const calculateProjectedStrategyData = ({
  strategyLegs,
  niftyTarget, // This is the string value for target spot
  targetDate, // This is the ISO string for target date
  getOptionByToken,
  riskFreeRate,
  getScenarioIV,
  multiplyByLotSize,
  multiplyByNumLots,
}) => {
  if (
    !niftyTarget || !targetDate || strategyLegs.length === 0 ||
    !getOptionByToken || !riskFreeRate || !getScenarioIV
  ) {
    return { legs: [], totals: { projectedPnL: 0, delta: 0, gamma: 0, theta: 0, vega: 0 } };
  }
  const numericNiftyTarget = parseFloat(niftyTarget);
  if (isNaN(numericNiftyTarget)) {
    return { legs: [], totals: { projectedPnL: 0, delta: 0, gamma: 0, theta: 0, vega: 0 } };
  }

  const projectionDate = new Date(targetDate);
  let aggProjectedPnL = 0, aggDelta = 0, aggGamma = 0, aggTheta = 0, aggVega = 0;

  const projectedLegsResult = strategyLegs
    .filter((leg) => leg.selected && leg.token)
    .map((leg) => {
      const liveOption = getOptionByToken(leg.token);
      if (!liveOption || !liveOption.strike || !liveOption.expiry || liveOption.optionType === undefined) {
        return { /* ... error leg structure ... */
            ...leg, instrument: `${leg.buySell} ${leg.lots || 1}x ${leg.instrumentSymbol || "Data N/A"}`,
            projectedOptionPrice: null, projectedPnLPerShare: null, projectedGreeks: {},
            entryPrice: parseFloat(leg.price), ltp: null,
        };
      }

      const scenarioIVForLeg = getScenarioIV(leg.token);
      const T_to_option_expiry = timeToExpiry(liveOption.expiry, projectionDate);
      let projectedOptPrice, legGreeks = { delta: 0, gamma: 0, theta: 0, vega: 0 };

      if (T_to_option_expiry > 0 && scenarioIVForLeg > 0) {
        const F_projected = numericNiftyTarget * Math.exp(riskFreeRate * T_to_option_expiry);
        projectedOptPrice = black76Price(F_projected, Number(liveOption.strike), T_to_option_expiry, riskFreeRate, scenarioIVForLeg, liveOption.optionType);
        legGreeks = black76Greeks(F_projected, Number(liveOption.strike), T_to_option_expiry, riskFreeRate, scenarioIVForLeg, liveOption.optionType);
      } else {
        projectedOptPrice = liveOption.optionType === "CE"
            ? Math.max(0, numericNiftyTarget - Number(liveOption.strike))
            : Math.max(0, Number(liveOption.strike) - numericNiftyTarget);
        legGreeks = black76Greeks(numericNiftyTarget, Number(liveOption.strike), T_to_option_expiry <= 0 ? 0.000001 : T_to_option_expiry, riskFreeRate, scenarioIVForLeg > 0 ? scenarioIVForLeg : 0.001, liveOption.optionType);
      }
      
      const entryPriceNum = parseFloat(leg.price);
      const pnlPerShare = isNaN(projectedOptPrice) || isNaN(entryPriceNum) ? 0 : (projectedOptPrice - entryPriceNum) * (leg.buySell === "Buy" ? 1 : -1);
      let scale = 1;
      if (multiplyByLotSize && leg.lotSize) scale *= leg.lotSize;
      if (multiplyByNumLots && leg.lots) scale *= leg.lots;
      const direction = leg.buySell === "Buy" ? 1 : -1;

      if (!isNaN(pnlPerShare)) aggProjectedPnL += pnlPerShare * scale;
      if (!isNaN(legGreeks.delta)) aggDelta += legGreeks.delta * direction * scale;
      if (!isNaN(legGreeks.gamma)) aggGamma += legGreeks.gamma * scale; // Gamma is added regardless of buy/sell direction for portfolio
      if (!isNaN(legGreeks.theta)) aggTheta += legGreeks.theta * direction * scale;
      if (!isNaN(legGreeks.vega)) aggVega += legGreeks.vega * direction * scale; // Vega can be directional for portfolio

      return { /* ... leg result structure ... */
        ...leg, instrument: `${leg.buySell === "Buy" ? "" : "S "} ${leg.lots || 1} X ${liveOption.expiry.substring(0,9).replace(/(\d{2})([A-Z]{3})(\d{2})/, '$1-$2-$3')} ${liveOption.strike}${liveOption.optionType}`,
        projectedOptionPrice: projectedOptPrice, projectedPnLPerShare: pnlPerShare, projectedGreeks: legGreeks,
        entryPrice: entryPriceNum, ltp: liveOption.lastPrice !== undefined ? parseFloat(liveOption.lastPrice) : null,
      };
    });

  return {
    legs: projectedLegsResult,
    totals: { projectedPnL: aggProjectedPnL, delta: aggDelta, gamma: aggGamma, theta: aggTheta, vega: aggVega },
  };
};

export const calculateDynamicPayoffData = ({
  strategyLegs,
  niftyTarget, // String value from prop
  displaySpotForSlider, // Fallback spot if niftyTarget is invalid
  targetDate, // ISO string
  riskFreeRate,
  getScenarioIV,
  // For multi-leg, we need a more robust way to determine min/max strikes for x-axis, or use SPOT_SLIDER_RANGE_PERCENT
}) => {
  const numericCenterSpot = (niftyTarget !== "" && !isNaN(parseFloat(niftyTarget))) 
                              ? parseFloat(niftyTarget) 
                              : displaySpotForSlider;

  if (numericCenterSpot <= 0 || strategyLegs.length === 0 || !getScenarioIV || !targetDate) return null;
  
  const selectedLegsForPayoff = strategyLegs.filter(
    (leg) => leg.selected && leg.token && leg.price !== undefined && 
             leg.strike !== undefined && leg.optionType !== undefined && leg.expiry !== undefined
  );
  if (selectedLegsForPayoff.length === 0) return null;

  const numPoints = 40; // Number of points on the chart
  // Determine price range for the chart dynamically based on strikes or fixed percentage
  let minStrike = Infinity, maxStrike = 0;
  selectedLegsForPayoff.forEach(leg => {
      minStrike = Math.min(minStrike, Number(leg.strike));
      maxStrike = Math.max(maxStrike, Number(leg.strike));
  });

  const priceRangePercent = SPOT_SLIDER_RANGE_PERCENT * 1.2; // How far out from center spot to plot
  const chartCenter = numericCenterSpot; 
  // More robust range based on strikes if they exist and are widespread
  let lowBound = chartCenter * (1 - priceRangePercent);
  let highBound = chartCenter * (1 + priceRangePercent);

  if (minStrike !== Infinity && maxStrike !== 0) {
      const padding = (maxStrike - minStrike) * 0.3 || chartCenter * 0.1; // Padding around strikes
      lowBound = Math.min(lowBound, minStrike - padding);
      highBound = Math.max(highBound, maxStrike + padding);
  }
  lowBound = Math.max(0, lowBound); // Ensure lower bound is not negative


  const labels = [];
  const pnlOnExpiryData = [];
  const pnlOnTargetDateData = [];

  for (let i = 0; i <= numPoints; i++) {
    const underlyingPriceAtTick = lowBound + ((highBound - lowBound) * i) / numPoints;
    labels.push(underlyingPriceAtTick.toFixed(0));
    let expiryPnLForTick = 0, targetDatePnLForTick = 0;

    selectedLegsForPayoff.forEach((leg) => {
      const scenarioIV = getScenarioIV(leg.token);
      const entryPriceNum = parseFloat(leg.price); // This is leg.price (entry for active, LTP for new)
      const scale = (leg.lots || 1) * (leg.lotSize || 1);
      const direction = leg.buySell === "Buy" ? 1 : -1;

      // P&L at Expiry
      let expiryOptVal = leg.optionType === "CE"
          ? Math.max(0, underlyingPriceAtTick - Number(leg.strike))
          : Math.max(0, Number(leg.strike) - underlyingPriceAtTick);
      if (!isNaN(expiryOptVal) && !isNaN(entryPriceNum)) {
        expiryPnLForTick += (expiryOptVal - entryPriceNum) * direction * scale;
      }

      // P&L at Target Date (T+0 line)
      const T_target = timeToExpiry(leg.expiry, new Date(targetDate));
      let targetOptVal = 0;
      if (T_target > 0 && scenarioIV > 0) {
        const F_target = underlyingPriceAtTick * Math.exp(riskFreeRate * T_target);
        targetOptVal = black76Price(F_target, Number(leg.strike), T_target, riskFreeRate, scenarioIV, leg.optionType);
      } else { // At or after expiry, value is intrinsic
        targetOptVal = expiryOptVal;
      }
      if (!isNaN(targetOptVal) && !isNaN(entryPriceNum)) {
        targetDatePnLForTick += (targetOptVal - entryPriceNum) * direction * scale;
      }
    });
    pnlOnExpiryData.push(expiryPnLForTick);
    pnlOnTargetDateData.push(targetDatePnLForTick);
  }

  const targetDateLabel = targetDate ? new Date(targetDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Target";
  return {
    labels,
    datasets: [
      { label: "P&L on Expiry", data: pnlOnExpiryData, borderColor: "rgb(75, 192, 192)", tension: 0.1, pointRadius: 0, borderWidth: 1.5 },
      { label: `P&L on ${targetDateLabel}`, data: pnlOnTargetDateData, borderColor: "rgb(255, 99, 132)", tension: 0.1, pointRadius: 0, borderWidth: 1.5 },
    ],
  };
};
