// src/features/StrategyVisualizer/sections/SummaryMetricsSection.jsx
import React, { useMemo, useState } from "react";
import MetricItem from "../components/MetricItem";
import Button from "../../../components/Button/Button";
import "./SummaryMetricsSection.scss";

const NOT_APPLICABLE = "N/A";
const UNLIMITED = "Unlimited";
const API_REQUIRED = "API Req.";

// This helper function is correct and does not need changes.
const formatDisplayValue = (value, type = "number", options = {}) => {
  const {
    digits = 2,
    prefix = "₹",
    suffix = "",
    showSign = false,
    useAbsolute = false,
    noPrefixForZero = false,
  } = options;
  if (value === UNLIMITED) return value;
  if (
    value === null ||
    value === undefined ||
    (typeof value === "number" && isNaN(value))
  )
    return NOT_APPLICABLE;
  let numValue =
    typeof value === "string"
      ? parseFloat(value.replace(/[^0-9.-]+/g, ""))
      : value;
  if (typeof numValue !== "number" || isNaN(numValue)) return NOT_APPLICABLE;
  const displayPrefixVal = noPrefixForZero && numValue === 0 ? "" : prefix;
  let signVal = "";
  if (showSign) {
    if (numValue > 0.0001) signVal = "+";
    else if (numValue < -0.0001) signVal = "-";
  } else if (numValue < -0.0001 && !useAbsolute) {
    signVal = "-";
  }
  const valToFormat = useAbsolute ? Math.abs(numValue) : Math.abs(numValue);
  if (type === "breakeven_val_only") return numValue.toFixed(0);
  return `${signVal}${displayPrefixVal}${valToFormat.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}${suffix}`;
};

/**
 * Helper function to calculate P&L of a leg at a specific spot price at expiry.
 * This is used to find the theoretical max loss/profit at spot=0.
 */
const calculateTheoreticalLegPnl = (leg, spotAtExpiry) => {
  const entryPrice = parseFloat(leg.price);
  if (isNaN(entryPrice)) return 0;

  const contractMultiplier =
    (Number(leg.lots) || 1) * (Number(leg.lotSize) || 1);
  const direction = leg.buySell === "Buy" ? 1 : -1;
  let valueAtExpiry = 0;

  if (leg.legType === "option") {
    const strike = Number(leg.strike);
    if (isNaN(strike) || !leg.optionType) return 0;
    if (leg.optionType === "CE")
      valueAtExpiry = Math.max(0, spotAtExpiry - strike);
    else if (leg.optionType === "PE")
      valueAtExpiry = Math.max(0, strike - spotAtExpiry);
  } else if (leg.legType === "future") {
    valueAtExpiry = spotAtExpiry;
  }

  const pnlPerShare = valueAtExpiry - entryPrice;
  return pnlPerShare * contractMultiplier * direction;
};

const SummaryMetricsSection = ({
  strategyLegs,
  underlyingSpotPrice,
  getInstrumentByToken,
  payoffGraphData,
}) => {
  const [showRewardRisk, setShowRewardRisk] = useState(false);

  const {
    intrinsicValue,
    timeValue,
    maxProfit,
    maxLoss,
    breakevenPoints,
    riskRewardRatio,
  } = useMemo(() => {
    // This section for IV/TV and filtering legs is correct and remains unchanged.
    let totalIntrinsicForOptions = 0,
      totalTimeValueForOptions = 0;
    let rawMaxProfitFromGraph = NOT_APPLICABLE,
      rawMaxLossFromGraph = NOT_APPLICABLE;
    const breakevens = new Set();

    const allSelectedStrategyLegs = Array.isArray(strategyLegs)
      ? strategyLegs.filter(
          (leg) =>
            leg?.selected &&
            leg.legType &&
            typeof leg.price === "number" &&
            typeof leg.lots === "number" &&
            typeof leg.lotSize === "number"
        )
      : [];

    const selectedOptionLegsForIVTV = allSelectedStrategyLegs.filter(
      (leg) =>
        leg.legType === "option" &&
        leg.strike !== undefined &&
        !isNaN(Number(leg.strike)) &&
        ["CE", "PE"].includes(leg.optionType)
    );

    if (
      selectedOptionLegsForIVTV.length > 0 &&
      underlyingSpotPrice !== null &&
      typeof underlyingSpotPrice === "number" &&
      underlyingSpotPrice > 0
    ) {
      selectedOptionLegsForIVTV.forEach((leg) => {
        const legStrike = Number(leg.strike);
        const currentSpot = Number(underlyingSpotPrice);
        const intrinsicPerShare =
          leg.optionType === "CE"
            ? Math.max(0, currentSpot - legStrike)
            : Math.max(0, legStrike - currentSpot);
        const instrumentDetails = getInstrumentByToken?.(leg.token);
        let marketPricePerShare = parseFloat(leg.price);
        if (
          instrumentDetails &&
          instrumentDetails.legTypeDb === "option" &&
          instrumentDetails.lastPrice !== undefined
        )
          marketPricePerShare = parseFloat(instrumentDetails.lastPrice);
        const timeValuePerShare = marketPricePerShare - intrinsicPerShare;
        const totalContractsForLeg = leg.lots * leg.lotSize;
        const directionMultiplier = leg.buySell === "Buy" ? 1 : -1;
        totalIntrinsicForOptions +=
          intrinsicPerShare * totalContractsForLeg * directionMultiplier;
        totalTimeValueForOptions +=
          timeValuePerShare * totalContractsForLeg * directionMultiplier;
      });
    }

    // This logic for analytical unlimited P&L detection is correct and remains unchanged.
    let analyticallyUnlimitedProfit = false,
      analyticallyUnlimitedLoss = false;
    if (allSelectedStrategyLegs.length > 0) {
      let netLongCallExposure = 0,
        netShortCallExposure = 0,
        netLongPutExposure = 0,
        netShortPutExposure = 0,
        netLongFutureExposure = 0,
        netShortFutureExposure = 0;
      allSelectedStrategyLegs.forEach((leg) => {
        const quantityEffect = leg.lots * leg.lotSize;
        if (leg.legType === "option") {
          if (leg.optionType === "CE") {
            if (leg.buySell === "Buy") netLongCallExposure += quantityEffect;
            else netShortCallExposure += quantityEffect;
          } else if (leg.optionType === "PE") {
            if (leg.buySell === "Buy") netLongPutExposure += quantityEffect;
            else netShortPutExposure += quantityEffect;
          }
        } else if (leg.legType === "future") {
          if (leg.buySell === "Buy") netLongFutureExposure += quantityEffect;
          else netShortFutureExposure += quantityEffect;
        }
      });
      if (
        netLongFutureExposure > netShortFutureExposure ||
        netLongCallExposure > netShortCallExposure
      )
        analyticallyUnlimitedProfit = true;
      if (
        netShortFutureExposure > netLongFutureExposure ||
        netShortPutExposure > netLongPutExposure ||
        netShortCallExposure > netLongCallExposure
      )
        analyticallyUnlimitedLoss = true;
    }

    // This logic for getting graph-based P&L and breakevens is correct and remains unchanged.
    if (payoffGraphData?.points?.length > 0) {
      const pnlValues = payoffGraphData.points
        .map((p) => p.pnlAtExpiry)
        .filter((pnl) => typeof pnl === "number" && !isNaN(pnl));
      if (pnlValues.length > 0) {
        rawMaxProfitFromGraph = Math.max(...pnlValues);
        rawMaxLossFromGraph = Math.min(...pnlValues);
      }
      payoffGraphData.points.forEach((point, index) => {
        if (
          index === 0 ||
          typeof point.pnlAtExpiry !== "number" ||
          typeof point.spot !== "number"
        )
          return;
        const prev = payoffGraphData.points[index - 1];
        if (
          typeof prev.pnlAtExpiry !== "number" ||
          typeof prev.spot !== "number"
        )
          return;
        if (
          prev.pnlAtExpiry * point.pnlAtExpiry < 0 ||
          (Math.abs(prev.pnlAtExpiry) < 1e-9 &&
            Math.abs(point.pnlAtExpiry) > 1e-9) ||
          (Math.abs(point.pnlAtExpiry) < 1e-9 &&
            Math.abs(prev.pnlAtExpiry) > 1e-9)
        ) {
          if (Math.abs(point.pnlAtExpiry - prev.pnlAtExpiry) > 1e-9) {
            const breakeven =
              prev.spot -
              (prev.pnlAtExpiry * (point.spot - prev.spot)) /
                (point.pnlAtExpiry - prev.pnlAtExpiry);
            if (!isNaN(breakeven)) breakevens.add(breakeven.toFixed(0));
          } else if (Math.abs(prev.pnlAtExpiry) < 1e-9 && !isNaN(prev.spot)) {
            breakevens.add(prev.spot.toFixed(0));
          } else if (Math.abs(point.pnlAtExpiry) < 1e-9 && !isNaN(point.spot)) {
            breakevens.add(point.spot.toFixed(0));
          }
        }
      });
    }

    // --- FINAL MAX PROFIT & MAX LOSS LOGIC ---

    // Start with the values from the graph.
    let finalMaxProfit = rawMaxProfitFromGraph;
    let finalMaxLoss = rawMaxLossFromGraph;

    // ** FIX FOR MAX PROFIT **
    // If profit is NOT unlimited, calculate the theoretical profit at spot=0
    // and see if it's better than what's on the graph. This is for short futures/puts.
    if (!analyticallyUnlimitedProfit && allSelectedStrategyLegs.length > 0) {
      let theoreticalProfitAtZero = 0;
      allSelectedStrategyLegs.forEach((leg) => {
        theoreticalProfitAtZero += calculateTheoreticalLegPnl(leg, 0);
      });
      // The true max profit is the HIGHER of the two values.
      finalMaxProfit = Math.max(rawMaxProfitFromGraph, theoreticalProfitAtZero);
    }

    // ** FIX FOR MAX LOSS (from previous request) **
    // If loss is NOT unlimited, calculate the theoretical loss at spot=0
    // and see if it's worse than what's on the graph. This is for long futures/calls.
    if (!analyticallyUnlimitedLoss && allSelectedStrategyLegs.length > 0) {
      let theoreticalLossAtZero = 0;
      allSelectedStrategyLegs.forEach((leg) => {
        theoreticalLossAtZero += calculateTheoreticalLegPnl(leg, 0);
      });
      // The true max loss is the LOWER (more negative) of the two values.
      finalMaxLoss = Math.min(rawMaxLossFromGraph, theoreticalLossAtZero);
    }

    // Finally, ensure the analytical UNLIMITED flags override everything.
    if (analyticallyUnlimitedProfit) finalMaxProfit = UNLIMITED;
    if (analyticallyUnlimitedLoss) finalMaxLoss = UNLIMITED;

    // --- END OF FIX ---

    // Risk/Reward ratio logic is correct and remains unchanged.
    let ratio = NOT_APPLICABLE;
    const numericFinalMaxProfit =
      finalMaxProfit === UNLIMITED
        ? Infinity
        : typeof finalMaxProfit === "number"
        ? finalMaxProfit
        : NaN;
    const numericFinalMaxLoss =
      finalMaxLoss === UNLIMITED
        ? -Infinity
        : typeof finalMaxLoss === "number"
        ? finalMaxLoss
        : NaN;
    const absoluteRisk = Math.abs(numericFinalMaxLoss);
    if (!isNaN(numericFinalMaxProfit) && !isNaN(absoluteRisk)) {
      if (numericFinalMaxProfit === Infinity && absoluteRisk === Infinity)
        ratio = `${UNLIMITED}/${UNLIMITED}`;
      else if (numericFinalMaxProfit === Infinity)
        ratio = `${UNLIMITED} Reward`;
      else if (absoluteRisk === Infinity) ratio = `${UNLIMITED} Risk`;
      else if (absoluteRisk < 1e-9 && numericFinalMaxProfit < 1e-9)
        ratio = "0.00X";
      else if (absoluteRisk < 1e-9 && numericFinalMaxProfit > 0) ratio = "∞";
      else if (numericFinalMaxProfit <= 0 && absoluteRisk > 0) ratio = "0.00X";
      else if (absoluteRisk > 0 && numericFinalMaxProfit > 0) {
        ratio = showRewardRisk
          ? (numericFinalMaxProfit / absoluteRisk).toFixed(2) + "X"
          : (absoluteRisk / numericFinalMaxProfit).toFixed(2) + "X";
      }
    }

    return {
      intrinsicValue: formatDisplayValue(totalIntrinsicForOptions, "currency", {
        showSign: true,
        noPrefixForZero: true,
      }),
      timeValue: formatDisplayValue(totalTimeValueForOptions, "currency", {
        showSign: true,
        noPrefixForZero: true,
      }),
      maxProfit:
        finalMaxProfit === UNLIMITED
          ? UNLIMITED
          : formatDisplayValue(numericFinalMaxProfit, "currency", {
              noPrefixForZero: true,
            }),
      maxLoss:
        finalMaxLoss === UNLIMITED
          ? UNLIMITED
          : formatDisplayValue(absoluteRisk, "currency", {
              noPrefixForZero: true,
            }),
      breakevenPoints:
        breakevens.size > 0
          ? Array.from(breakevens)
              .sort((a, b) => Number(a) - Number(b))
              .join(" & ")
          : NOT_APPLICABLE,
      riskRewardRatio: ratio,
    };
  }, [
    strategyLegs,
    underlyingSpotPrice,
    getInstrumentByToken,
    payoffGraphData,
    showRewardRisk,
  ]);

  // The JSX part of your component remains entirely unchanged.
  return (
    <section className="sv-summary-metrics-section">
      <div className="metrics-grid">
        <div className="metric-row">
          <MetricItem
            label="Max. Profit"
            value={maxProfit}
            valueClass={
              maxProfit === UNLIMITED ? "unlimited-value" : "profit-value"
            }
          />
          <Button
            onClick={() => setShowRewardRisk(!showRewardRisk)}
            className="reward-risk-toggle-btn"
          >
            {showRewardRisk ? "Reward / Risk" : "Risk / Reward"}
          </Button>
          <MetricItem
            value={riskRewardRatio}
            valueClass={
              riskRewardRatio === `${UNLIMITED} Reward` ||
              riskRewardRatio === "∞"
                ? "profit-value"
                : riskRewardRatio === `${UNLIMITED} Risk`
                ? "loss-value"
                : "neutral-value"
            }
          />
          <MetricItem
            label="Funds & Margin"
            value={API_REQUIRED}
            infoIconTitle="Estimated funds & total margin (SPAN + Exposure)"
          />
        </div>
        <div className="metric-row">
          <MetricItem
            label="Max. Loss"
            value={maxLoss}
            valueClass={
              maxLoss === UNLIMITED ? "unlimited-value" : "loss-value"
            }
          />
          <MetricItem
            label="Intrinsic Value"
            value={intrinsicValue}
            infoIconTitle="Current intrinsic value of selected OPTION positions"
          />
          <MetricItem
            label="Funds Required"
            value={API_REQUIRED}
            infoIconTitle="Approximate funds needed for this strategy"
          />
        </div>
        <div className="metric-row">
          <MetricItem
            label="Breakeven(s)"
            value={breakevenPoints}
            infoIconTitle="Price points where strategy breaks even at expiry"
          />
          <MetricItem
            label="Time Value"
            value={timeValue}
            infoIconTitle="Remaining time value in selected OPTION positions"
          />
          <MetricItem
            label="Standalone Margin"
            value={API_REQUIRED}
            infoIconTitle="Margin if this was the only position (indicative)"
          />
        </div>
        <div className="metric-row single-metric">
          <MetricItem
            label="POP"
            value={API_REQUIRED}
            infoIconTitle="Probability of Profit (estimated)"
          />
        </div>
      </div>
    </section>
  );
};

export default React.memo(SummaryMetricsSection);
