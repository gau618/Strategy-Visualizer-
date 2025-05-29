import { black76Price } from "./optionPricingUtils";

// Helper: Intrinsic value at expiry for a leg
function calculateLegValueAtExpiry(leg, spot) {
  const strike = Number(leg.strike);
  if (leg.optionType === "CE") return Math.max(0, spot - strike);
  if (leg.optionType === "PE") return Math.max(0, strike - spot);
  return 0;
}

// Helper: P&L at expiry for a leg
function calculateLegPnLAtExpiry(leg, spot) {
  const intrinsic = calculateLegValueAtExpiry(leg, spot);
  const premium = parseFloat(leg.price);
  const lotSize = leg.lotSize || 1;
  const lots = leg.lots || 1;
  const quantity = lotSize * lots;
  const direction = leg.buySell === "Buy" ? 1 : -1;
  return (intrinsic - premium) * direction * quantity;
}

// Helper: Theoretical price at target date using Black-76
function calculateLegTheoreticalPrice(
  leg,
  spot,
  targetDateISO,
  riskFreeRate,
  scenarioIV,
  getOptionByToken
) {
  const option = getOptionByToken(leg.token);
  if (!option || !option.expiry) return parseFloat(leg.price);

  // Time to expiry in years
  const expiryDate = new Date(option.expiry);
  const targetDate = new Date(targetDateISO);
  const msInYear = 365 * 24 * 60 * 60 * 1000;
  const timeToExpiry = Math.max((expiryDate - targetDate) / msInYear, 0);

  if (timeToExpiry <= 0 || scenarioIV <= 0) {
    return calculateLegValueAtExpiry(leg, spot);
  }
  let futurePrice = spot * Math.exp(riskFreeRate * timeToExpiry);
  // For index options, spot is used as future in Black-76
  return black76Price(
    futurePrice,
    Number(leg.strike),
    timeToExpiry,
    riskFreeRate,
    scenarioIV,
    leg.optionType
  );
}

// Helper: P&L at target date for a leg
function calculateLegPnLAtTargetDate(
  leg,
  spot,
  targetDateISO,
  riskFreeRate,
  scenarioIV,
  getOptionByToken
) {
  const newR=riskFreeRate;
  const theoPrice = calculateLegTheoreticalPrice(
    leg,
    spot,
    targetDateISO,
    newR,
    scenarioIV,
    getOptionByToken
  );
  const premium = parseFloat(leg.price);
  const lotSize = leg.lotSize || 1;
  const lots = leg.lots || 1;
  const quantity = lotSize * lots;
  const direction = leg.buySell === "Buy" ? 1 : -1;
  return (theoPrice - premium) * direction * quantity;
}

// Helper: Snap a spot price to the nearest interval (e.g., 23450, 23500, etc.)
function snapToInterval(spot, interval) {
  return Math.round(spot / interval) * interval;
}

// --- Main Function ---

export const generatePayoffTableData = ({
  strategyLegs,
  niftyTargetString,
  displaySpotForSlider,
  targetDateISO,
  riskFreeRate,
  getScenarioIV,
  getOptionByToken,
  targetInterval,
  PAYOFF_TABLE_POINTS = 20,
  PAYOFF_TABLE_INTERVAL_STEP = 50,
  underlyingSpotPriceForPercentage,
  showPercentage,
}) => {
  // Filter valid, selected legs
  const selectedLegs = strategyLegs.filter(
    (l) => l.selected && l.token && typeof l.price === "number"
  );
  if (selectedLegs.length === 0) return [];

  // Determine scenario spot
  const rawScenarioSpot =
    niftyTargetString !== "" && !isNaN(parseFloat(niftyTargetString))
      ? parseFloat(niftyTargetString)
      : typeof displaySpotForSlider === "number"
      ? displaySpotForSlider
      : parseFloat(displaySpotForSlider);
  if (isNaN(rawScenarioSpot) || rawScenarioSpot <= 0) return [];

  // Snap the scenario spot to the nearest interval for a clean grid
  const intervalStep = Number(targetInterval) || PAYOFF_TABLE_INTERVAL_STEP;
  const snappedSpot = snapToInterval(rawScenarioSpot, intervalStep);

  const tableRows = [];
  const halfPoints = Math.floor(PAYOFF_TABLE_POINTS / 2);

  for (let i = -halfPoints; i <= halfPoints; i++) {
    let targetPrice;

    if (i === 0) {
      // Center row: use the actual current spot
      targetPrice = rawScenarioSpot;
    } else {
      // Other rows: use snapped grid
      targetPrice = snappedSpot + i * intervalStep;
      // If the snapped grid would duplicate the center spot, skip it
      if (targetPrice === rawScenarioSpot) continue;
    }

    if (targetPrice < 0.01) continue;

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

    // If showPercentage is true and underlyingSpotPriceForPercentage is provided,
    // also compute percentage returns
    let pnlAtTargetDatePct = undefined;
    let pnlAtExpiryPct = undefined;
    if (
      showPercentage &&
      underlyingSpotPriceForPercentage &&
      !isNaN(underlyingSpotPriceForPercentage) &&
      underlyingSpotPriceForPercentage !== 0
    ) {
      pnlAtTargetDatePct =
        (pnlAtTargetDate / underlyingSpotPriceForPercentage) * 100;
      pnlAtExpiryPct = (pnlAtExpiry / underlyingSpotPriceForPercentage) * 100;
    }

    tableRows.push({
      targetPrice: Number(targetPrice.toFixed(2)),
      pnlAtTargetDate: Number(pnlAtTargetDate.toFixed(2)),
      pnlAtExpiry: Number(pnlAtExpiry.toFixed(2)),
      pnlAtTargetDatePct:
        pnlAtTargetDatePct !== undefined
          ? Number(pnlAtTargetDatePct.toFixed(2))
          : undefined,
      pnlAtExpiryPct:
        pnlAtExpiryPct !== undefined
          ? Number(pnlAtExpiryPct.toFixed(2))
          : undefined,
      isCurrentTarget: i === 0,
    });
  }
  return tableRows;
};
