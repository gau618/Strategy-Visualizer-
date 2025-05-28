// src/features/StrategyVisualizer/sections/SummaryMetricsSection.jsx
import React, { useMemo } from 'react';
import MetricItem from '../components/MetricItem';
import Button from '../../../components/Button/Button';
import './SummaryMetricsSection.scss';

const NOT_APPLICABLE = "N/A";
const UNLIMITED = "Unlimited";
const COMPLEX_STRATEGY = "Complex"; // For metrics too complex for simple frontend calculation

// Enhanced Formatting Helper
const formatDisplayValue = (value, type = "number", options = {}) => {
  const { digits = 2, prefix = "₹", suffix = "", showSign = false, useAbsolute = false } = options;

  if (value === UNLIMITED || value === COMPLEX_STRATEGY) return value;
  if (value === null || value === undefined || (typeof value === 'number' && isNaN(value))) return NOT_APPLICABLE;
  
  let numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g,"")) : value;
  if (typeof numValue !== 'number' || isNaN(numValue)) return NOT_APPLICABLE;

  let sign = "";
  if (showSign && numValue > 0) sign = "+";
  else if (numValue < 0) sign = "-";
  
  const valToFormat = useAbsolute ? Math.abs(numValue) : numValue * (sign === "-" ? -1 : 1); // Use Math.abs if sign is already handled

  switch (type) {
    case "currency":
    case "currency_pnl": // currency_pnl implies showSign might be true
      return `${sign}${prefix}${valToFormat.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`;
    case "percentage":
      return `${sign}${valToFormat.toFixed(digits)}${suffix || '%'}`;
    case "breakeven": 
        return `${prefix}${numValue.toFixed(digits)}${suffix}`;
    default: // number (like Greeks)
      return `${sign}${valToFormat.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`;
  }
};

const SummaryMetricsSection = ({
  strategyLegs,
  underlyingSpotPrice,  // Real-time spot price
  getOptionByToken,     // Function to get live option data (LTP, IV, Greeks)
  riskFreeRate,         // For any future calculations needing it (e.g. advanced POP)
}) => {

  const selectedLegs = useMemo(() => {
    if (!Array.isArray(strategyLegs)) return [];
    return strategyLegs.filter(leg => 
        leg.selected && 
        leg.token && 
        typeof leg.price === 'number' &&
        (typeof leg.strike === 'number' || (typeof leg.strike === 'string' && !isNaN(parseFloat(leg.strike)))) &&
        leg.optionType &&
        leg.buySell &&
        typeof leg.lots === 'number' &&
        typeof leg.lotSize === 'number'
    ).map(leg => ({ ...leg, strike: Number(leg.strike) })); // Ensure strike is a number
  }, [strategyLegs]);

  const calculatedMetrics = useMemo(() => {
    const initialReturn = {
      netPremiumAtEntry: NOT_APPLICABLE,
      currentMarketValue: NOT_APPLICABLE,
      unrealizedPnL: NOT_APPLICABLE,
      portfolioDelta: NOT_APPLICABLE, portfolioGamma: NOT_APPLICABLE,
      portfolioTheta: NOT_APPLICABLE, portfolioVega: NOT_APPLICABLE,
      totalIntrinsicValue: NOT_APPLICABLE, totalTimeValue: NOT_APPLICABLE,
      maxProfit: NOT_APPLICABLE, maxLoss: NOT_APPLICABLE,
      breakevenPointsDisplay: NOT_APPLICABLE,
      pop: "API Req.", fundsRequired: "API Req.", standaloneMargin: "API Req.",
    };

    if (selectedLegs.length === 0) {
      return initialReturn;
    }

    let netPremiumAtEntryNum = 0;
    let currentMarketValueNum = 0;
    let portfolioDeltaNum = 0, portfolioGammaNum = 0, portfolioThetaNum = 0, portfolioVegaNum = 0;
    let totalIntrinsicValueNum = 0;
    let sumOfLegTimeValuesNum = 0;
    let canCalculateGreeks = true;
    let canCalculateCurrentMarketValue = true;

    selectedLegs.forEach(leg => {
      // Net Premium at Entry (Cost to Establish)
      const entryCostOrCredit = leg.price * leg.lots * leg.lotSize * (leg.buySell === "Buy" ? -1 : 1);
      netPremiumAtEntryNum += entryCostOrCredit;

      const liveOpt = getOptionByToken(leg.token);
      const currentLTP = liveOpt?.lastPrice !== undefined ? parseFloat(liveOpt.lastPrice) : leg.price; // Fallback to entry for current value if no LTP
      
      if (liveOpt?.lastPrice === undefined) canCalculateCurrentMarketValue = false;

      // Current Market Value of Position
      currentMarketValueNum += currentLTP * leg.lots * leg.lotSize * (leg.buySell === "Buy" ? 1 : -1); // Positive for long, negative for short value

      // Portfolio Greeks
      if (liveOpt?.greeks) {
        const g = liveOpt.greeks;
        const multiplier = leg.lots * leg.lotSize * (leg.buySell === "Buy" ? 1 : -1);
        if (typeof g.delta === 'number') portfolioDeltaNum += g.delta * multiplier; else canCalculateGreeks = false;
        if (typeof g.gamma === 'number') portfolioGammaNum += g.gamma * leg.lots * leg.lotSize; // Gamma is positive for long/short options, scaled by contracts
        else canCalculateGreeks = false;
        if (typeof g.theta === 'number') portfolioThetaNum += g.theta * multiplier; else canCalculateGreeks = false;
        if (typeof g.vega === 'number') portfolioVegaNum += g.vega * multiplier; else canCalculateGreeks = false;
      } else {
        canCalculateGreeks = false;
      }

      // Intrinsic and Time Value (based on real-time spot)
      if (underlyingSpotPrice !== null && typeof underlyingSpotPrice === 'number') {
        let intrinsicPerShare = 0;
        if (leg.optionType === "CE") {
          intrinsicPerShare = Math.max(0, underlyingSpotPrice - leg.strike);
        } else { // PE
          intrinsicPerShare = Math.max(0, leg.strike - underlyingSpotPrice);
        }
        totalIntrinsicValueNum += intrinsicPerShare * leg.lots * leg.lotSize * (leg.buySell === "Buy" ? 1 : -1);
        
        const timeValuePerShare = currentLTP - intrinsicPerShare;
        if (timeValuePerShare > 0) { // Only sum positive time values
            sumOfLegTimeValuesNum += timeValuePerShare * leg.lots * leg.lotSize; // Sum of absolute time values in the position
        }
      }
    });
    
    const unrealizedPnLNum = canCalculateCurrentMarketValue ? (currentMarketValueNum + netPremiumAtEntryNum) : NOT_APPLICABLE;


    // Max Profit / Max Loss / Breakeven (Simplified)
    let maxProfitNum = COMPLEX_STRATEGY;
    let maxLossNum = COMPLEX_STRATEGY;
    let breakevenPointsNum = [COMPLEX_STRATEGY];

    if (selectedLegs.length === 1) {
        const leg = selectedLegs[0];
        const legInitialPremium = leg.price * leg.lots * leg.lotSize;
        if (leg.buySell === "Buy") {
            maxProfitNum = UNLIMITED;
            maxLossNum = legInitialPremium;
            breakevenPointsNum = [leg.optionType === "CE" ? leg.strike + leg.price : leg.strike - leg.price];
        } else { // Sell
            maxProfitNum = legInitialPremium;
            maxLossNum = UNLIMITED;
            breakevenPointsNum = [leg.optionType === "CE" ? leg.strike + leg.price : leg.strike - leg.price];
        }
    } else if (selectedLegs.length === 2) {
        // Attempt basic spreads
        const leg1 = selectedLegs[0];
        const leg2 = selectedLegs[1];
        // Example: Long Vertical Call Spread (Buy lower strike CE, Sell higher strike CE)
        if (leg1.optionType === "CE" && leg2.optionType === "CE" && leg1.expiry === leg2.expiry) {
            const longCall = leg1.buySell === "Buy" ? leg1 : (leg2.buySell === "Buy" ? leg2 : null);
            const shortCall = leg1.buySell === "Sell" ? leg1 : (leg2.buySell === "Sell" ? leg2 : null);

            if (longCall && shortCall && longCall.strike < shortCall.strike && longCall.lots === shortCall.lots) {
                const netDebit = (longCall.price - shortCall.price) * longCall.lots * longCall.lotSize;
                if (netDebit > 0) { // Must be a debit spread
                    maxProfitNum = (shortCall.strike - longCall.strike - (longCall.price - shortCall.price)) * longCall.lots * longCall.lotSize;
                    maxLossNum = netDebit;
                    breakevenPointsNum = [longCall.strike + (longCall.price - shortCall.price)];
                }
            }
        }
        // Add more 2-leg spread logic here (Put Spreads, Straddles, Strangles etc.)
        // This gets very extensive quickly.
    }


    const formatBreakevenDisplay = (bpArray) => {
        if (bpArray.length === 0 || bpArray[0] === NOT_APPLICABLE || bpArray[0] === COMPLEX_STRATEGY) return bpArray[0] || NOT_APPLICABLE;
        return bpArray.map(bp => {
            if (typeof bp !== 'number' || isNaN(bp)) return NOT_APPLICABLE;
            let diffPercentStr = "";
            if (underlyingSpotPrice && typeof underlyingSpotPrice === 'number' && underlyingSpotPrice > 0) {
                const diff = bp - underlyingSpotPrice;
                const percent = (diff / underlyingSpotPrice) * 100;
                diffPercentStr = ` (${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%)`;
            }
            return `${bp.toFixed(0)}${diffPercentStr}`;
        }).join(' & ');
    };

    return {
      ...initialReturn, // Start with defaults for API Req fields
      netPremiumAtEntry: formatDisplayValue(netPremiumAtEntryNum, "currency", { showSign: true, useAbsolute: netPremiumAtEntryNum === 0 ? false : true, suffix: netPremiumAtEntryNum !== 0 ? (netPremiumAtEntryNum > 0 ? " Cr" : " Dr") : "" }),
      currentMarketValue: formatDisplayValue(currentMarketValueNum, "currency", { showSign: true }),
      unrealizedPnL: formatDisplayValue(unrealizedPnLNum, "currency_pnl", { showSign: true }),
      
      portfolioDelta: formatDisplayValue(canCalculateGreeks ? portfolioDeltaNum : NOT_APPLICABLE, "number", { digits: 0, showSign: true }),
      portfolioGamma: formatDisplayValue(canCalculateGreeks ? portfolioGammaNum : NOT_APPLICABLE, "number", { digits: 4 }),
      portfolioTheta: formatDisplayValue(canCalculateGreeks ? portfolioThetaNum : NOT_APPLICABLE, "number", { digits: 0, showSign: true }),
      portfolioVega: formatDisplayValue(canCalculateGreeks ? portfolioVegaNum / 100 : NOT_APPLICABLE, "number", { digits: 0, showSign: true }), // Assuming vega per 1% change

      totalIntrinsicValue: formatDisplayValue(underlyingSpotPrice !== null ? totalIntrinsicValueNum : NOT_APPLICABLE, "currency", { showSign: true }),
      totalTimeValue: formatDisplayValue(underlyingSpotPrice !== null ? sumOfLegTimeValuesNum : NOT_APPLICABLE, "currency"),
      
      maxProfit: formatDisplayValue(maxProfitNum, maxProfitNum === UNLIMITED || maxProfitNum === COMPLEX_STRATEGY ? "string" : "currency_pnl", { showSign: true }),
      maxLoss: formatDisplayValue(maxLossNum, maxLossNum === UNLIMITED || maxLossNum === COMPLEX_STRATEGY ? "string" : "currency", { useAbsolute: true, digits:0 }),
      breakevenPointsDisplay: formatBreakevenDisplay(breakevenPointsNum),
    };
  }, [selectedLegs, underlyingSpotPrice, getOptionByToken]); // riskFreeRate might be needed for more advanced POP/BE


  const handleRiskRewardMultiplierChange = () => {
    console.log("Risk/Reward multiplier toggle (placeholder)");
  };

  return (
    <section className="sv-summary-metrics-section">
      <div className="metrics-grid">
        {/* Group 2: Max P/L & Breakeven */}
        <div className="metric-group payoff-limits">
          <MetricItem label="Max. Profit" value={calculatedMetrics.maxProfit} valueClass={calculatedMetrics.maxProfit !== UNLIMITED && calculatedMetrics.maxProfit !== COMPLEX_STRATEGY && calculatedMetrics.maxProfit !== NOT_APPLICABLE && parseFloat(calculatedMetrics.maxProfit.replace(/[^0-9.-]+/g,"")) >= 0 ? 'profit-value' : ''} showInfoIcon/>
          <MetricItem label="Max. Loss" value={calculatedMetrics.maxLoss} valueClass={calculatedMetrics.maxLoss !== UNLIMITED && calculatedMetrics.maxLoss !== COMPLEX_STRATEGY && calculatedMetrics.maxLoss !== NOT_APPLICABLE && parseFloat(calculatedMetrics.maxLoss.replace(/[^0-9.-]+/g,"")) > 0 ? 'loss-value' : ''} showInfoIcon/>
          <MetricItem label="Breakeven(s)" value={calculatedMetrics.breakevenPointsDisplay} showInfoIcon/>
        </div>
        {/* Group 4: Value Components & Probabilities */}
        <div className="metric-group value-components">
            <MetricItem label="Risk/Reward">
                <Button variant="tertiary" size="small" className="risk-reward-btn" onClick={handleRiskRewardMultiplierChange}>1X</Button>
            </MetricItem>
            <MetricItem label="Intrinsic Value" value={calculatedMetrics.totalIntrinsicValue} showInfoIcon infoIconTitle="Net intrinsic value of the options portfolio based on current spot."/>
            <MetricItem label="Time Value" value={calculatedMetrics.totalTimeValue} showInfoIcon infoIconTitle="Net time value in the options portfolio based on current LTPs and spot."/>
            <MetricItem label="POP" value={calculatedMetrics.pop} showInfoIcon infoIconTitle="Probability Of Profit. Complex calculation, typically API driven."/>
        </div>

        {/* Group 5: Funds & Margin (Primarily Placeholders) */}
        <div className="metric-group funds-margin-details">
          <MetricItem label="Funds & Margin" /> {/* Title for the group */}
          <MetricItem label="Funds Required" value={calculatedMetrics.fundsRequired} showInfoIcon infoIconTitle="Estimated total funds required for this strategy (SPAN + Exposure). Typically from broker API." />
          <MetricItem label="Standalone Margin" value={calculatedMetrics.standaloneMargin} showInfoIcon infoIconTitle="Margin if this strategy is traded standalone. Typically from broker API." />
        </div>
      </div>
    </section>
  );
};

export default React.memo(SummaryMetricsSection);
