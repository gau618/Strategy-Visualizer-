// src/features/StrategyVisualizer/sections/SummaryMetricsSection.jsx
import React, { useMemo } from 'react';
import MetricItem from '../components/MetricItem';
import Button from '../../../components/Button/Button';
import './SummaryMetricsSection.scss';

const NOT_APPLICABLE = "N/A";
const UNLIMITED = "Unlimited";
const COMPLEX_STRATEGY = "Complex";

// Enhanced Formatting Helper (Your existing function - seems good)
const formatDisplayValue = (value, type = "number", options = {}) => {
  const { digits = 2, prefix = "₹", suffix = "", showSign = false, useAbsolute = false } = options;
  if (value === UNLIMITED || value === COMPLEX_STRATEGY) return value;
  if (value === null || value === undefined || (typeof value === 'number' && isNaN(value))) return NOT_APPLICABLE;
  let numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g,"")) : value;
  if (typeof numValue !== 'number' || isNaN(numValue)) return NOT_APPLICABLE;
  let sign = "";
  if (showSign && numValue > 0) sign = "+";
  else if (numValue < 0 && !useAbsolute) sign = "-"; // Only add sign if not using absolute and value is negative
  
  const valToFormat = useAbsolute ? Math.abs(numValue) : (sign === "-" ? numValue * -1 : numValue);

  switch (type) {
    case "currency":
    case "currency_pnl":
      return `${sign}${prefix}${valToFormat.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`;
    case "percentage":
      return `${sign}${valToFormat.toFixed(digits)}${suffix || '%'}`;
    case "breakeven": 
        return `${prefix}${numValue.toFixed(digits)}${suffix}`; // Breakeven usually doesn't take sign
    default: // number (like Greeks)
      return `${sign}${valToFormat.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`;
  }
};


const SummaryMetricsSection = ({
  strategyLegs,
  underlyingSpotPrice,
  getOptionByToken,
  riskFreeRate, // Currently unused in this simplified metric calculation
}) => {

  const selectedLegs = useMemo(() => {
    if (!Array.isArray(strategyLegs)) return [];
    return strategyLegs.filter(leg => 
        leg && leg.selected && leg.token && 
        typeof leg.price === 'number' && !isNaN(leg.price) &&
        (typeof leg.strike === 'number' || (typeof leg.strike === 'string' && !isNaN(parseFloat(leg.strike)))) &&
        leg.optionType && leg.buySell &&
        typeof leg.lots === 'number' && !isNaN(leg.lots) && leg.lots > 0 &&
        typeof leg.lotSize === 'number' && !isNaN(leg.lotSize) && leg.lotSize > 0
    ).map(leg => ({ 
        ...leg, 
        strike: Number(leg.strike),
        contracts: leg.lots * leg.lotSize // Calculate total contracts
    }));
  }, [strategyLegs]);

  const calculatedMetrics = useMemo(() => {
    const initialReturn = {
      netPremiumAtEntry: NOT_APPLICABLE, currentMarketValue: NOT_APPLICABLE,
      unrealizedPnL: NOT_APPLICABLE, portfolioDelta: NOT_APPLICABLE, 
      portfolioGamma: NOT_APPLICABLE, portfolioTheta: NOT_APPLICABLE, 
      portfolioVega: NOT_APPLICABLE, totalIntrinsicValue: NOT_APPLICABLE, 
      totalTimeValue: NOT_APPLICABLE, maxProfit: NOT_APPLICABLE, 
      maxLoss: NOT_APPLICABLE, breakevenPointsDisplay: NOT_APPLICABLE,
      pop: "API Req.", fundsRequired: "API Req.", standaloneMargin: "API Req.",
    };

    if (selectedLegs.length === 0) return initialReturn;

    let netPremiumAtEntryNum = 0; // Positive for net credit, negative for net debit
    let currentMarketValueNum = 0;
    let portfolioDeltaNum = 0, portfolioGammaNum = 0, portfolioThetaNum = 0, portfolioVegaNum = 0;
    let totalIntrinsicValueNum = 0;
    let sumOfLegTimeValuesNum = 0;
    let canCalculateGreeks = true;
    let canCalculateCurrentMarketValue = true;

    selectedLegs.forEach(leg => {
      const entryCostOrCredit = leg.price * leg.contracts * (leg.buySell === "Buy" ? -1 : 1);
      netPremiumAtEntryNum += entryCostOrCredit;

      const liveOpt = getOptionByToken(leg.token);
      const currentLTP = (liveOpt?.lastPrice !== undefined && !isNaN(parseFloat(liveOpt.lastPrice))) 
                         ? parseFloat(liveOpt.lastPrice) 
                         : leg.price; // Fallback to entry for current value if no LTP
      
      if (liveOpt?.lastPrice === undefined || isNaN(parseFloat(liveOpt.lastPrice))) {
          canCalculateCurrentMarketValue = false;
      }

      currentMarketValueNum += currentLTP * leg.contracts * (leg.buySell === "Buy" ? 1 : -1);

      if (liveOpt?.greeks) {
        const g = liveOpt.greeks;
        const greekMultiplier = leg.contracts * (leg.buySell === "Buy" ? 1 : -1);
        // For Gamma, it's always positive contribution for long options, negative for short, scaled by contracts.
        // However, portfolio gamma is the sum of individual gammas. Long option gamma is positive. Short option gamma is negative.
        // So the multiplier should apply to gamma as well for portfolio effect.
        if (typeof g.delta === 'number' && !isNaN(g.delta)) portfolioDeltaNum += g.delta * greekMultiplier; else canCalculateGreeks = false;
        if (typeof g.gamma === 'number' && !isNaN(g.gamma)) portfolioGammaNum += g.gamma * greekMultiplier; else canCalculateGreeks = false; // This calculation might be off if g.gamma is per share and not total contracts
        if (typeof g.theta === 'number' && !isNaN(g.theta)) portfolioThetaNum += g.theta * greekMultiplier; else canCalculateGreeks = false;
        if (typeof g.vega === 'number' && !isNaN(g.vega)) portfolioVegaNum += g.vega * greekMultiplier; else canCalculateGreeks = false;
      } else {
        canCalculateGreeks = false;
      }

      if (typeof underlyingSpotPrice === 'number' && !isNaN(underlyingSpotPrice)) {
        let intrinsicPerShare = 0;
        if (leg.optionType === "CE") intrinsicPerShare = Math.max(0, underlyingSpotPrice - leg.strike);
        else if (leg.optionType === "PE") intrinsicPerShare = Math.max(0, leg.strike - underlyingSpotPrice);
        
        // Net intrinsic value of the position
        totalIntrinsicValueNum += intrinsicPerShare * leg.contracts * (leg.buySell === "Buy" ? 1 : -1);
        
        const timeValuePerShare = currentLTP - intrinsicPerShare;
        // Sum of (absolute) time values of all options held (long or short)
        // A short option still has time value that can decay in your favor.
        // Typically, total time value of a strategy is the sum of time values of long options minus sum of time values of short options.
        // Or, more simply, Market Value - Intrinsic Value of the strategy.
        // Let's calculate sum of absolute time values in all legs for now.
        if (timeValuePerShare > -0.00001) { // Consider positive or very near zero time value
            sumOfLegTimeValuesNum += timeValuePerShare * leg.contracts; // Summing absolute time value from current LTP
        }
      } else {
          totalIntrinsicValueNum = NOT_APPLICABLE;
          sumOfLegTimeValuesNum = NOT_APPLICABLE;
      }
    });
    
    // Total time value for the strategy can also be seen as:
    // Strategy Market Value - Strategy Intrinsic Value
    let totalStrategyTimeValueNum = NOT_APPLICABLE;
    if (typeof currentMarketValueNum === 'number' && typeof totalIntrinsicValueNum === 'number') {
        totalStrategyTimeValueNum = currentMarketValueNum - totalIntrinsicValueNum;
    }


    const unrealizedPnLNum = (canCalculateCurrentMarketValue && typeof currentMarketValueNum === 'number' && typeof netPremiumAtEntryNum === 'number') 
                             ? (currentMarketValueNum + netPremiumAtEntryNum) 
                             : NOT_APPLICABLE;

    // --- Max Profit / Max Loss / Breakeven Calculations ---
    let maxProfitNum = COMPLEX_STRATEGY;
    let maxLossNum = COMPLEX_STRATEGY;
    let breakevenPoints = []; // Will store numerical breakeven points

    const netPremiumAbs = Math.abs(netPremiumAtEntryNum); // Absolute value of net premium per strategy unit (all lots)
    const netPremiumPerContractSet = netPremiumAtEntryNum / (selectedLegs[0]?.contracts || 1); // For BE calc, assumes uniform contracts per distinct leg type in simple spreads

    if (selectedLegs.length === 1) {
        const leg = selectedLegs[0];
        const totalInitialPremium = leg.price * leg.contracts; // Absolute cost/credit for this leg
        if (leg.buySell === "Buy") { // Long Call or Long Put
            maxProfitNum = UNLIMITED;
            maxLossNum = totalInitialPremium; // Net debit paid
            if (leg.optionType === "CE") breakevenPoints.push(leg.strike + leg.price);
            else breakevenPoints.push(leg.strike - leg.price);
        } else { // Short Call or Short Put
            maxProfitNum = totalInitialPremium; // Net credit received
            maxLossNum = UNLIMITED;
            if (leg.optionType === "CE") breakevenPoints.push(leg.strike + leg.price);
            else breakevenPoints.push(leg.strike - leg.price);
        }
    } else if (selectedLegs.length === 2) {
        const leg1 = selectedLegs[0];
        const leg2 = selectedLegs[1];
        const sameExpiry = leg1.expiry === leg2.expiry;
        const sameContracts = leg1.contracts === leg2.contracts;

        if (sameExpiry && sameContracts) {
            // Vertical Spreads (assuming same option type)
            if (leg1.optionType === leg2.optionType) {
                const longLeg = leg1.buySell === "Buy" ? leg1 : (leg2.buySell === "Buy" ? leg2 : null);
                const shortLeg = leg1.buySell === "Sell" ? leg1 : (leg2.buySell === "Sell" ? leg2 : null);

                if (longLeg && shortLeg) {
                    const netPremiumPaidOrReceivedPerShare = longLeg.price - shortLeg.price; // positive if debit, negative if credit
                    
                    if (longLeg.optionType === "CE") { // Call Spread
                        if (longLeg.strike < shortLeg.strike) { // Bull Call Spread (Debit)
                            maxLossNum = netPremiumPaidOrReceivedPerShare * longLeg.contracts;
                            maxProfitNum = (shortLeg.strike - longLeg.strike - netPremiumPaidOrReceivedPerShare) * longLeg.contracts;
                            breakevenPoints.push(longLeg.strike + netPremiumPaidOrReceivedPerShare);
                        } else if (longLeg.strike > shortLeg.strike) { // Bear Call Spread (Credit)
                            maxProfitNum = -netPremiumPaidOrReceivedPerShare * longLeg.contracts; // net credit is positive
                            maxLossNum = (longLeg.strike - shortLeg.strike + netPremiumPaidOrReceivedPerShare) * longLeg.contracts;
                            breakevenPoints.push(shortLeg.strike - netPremiumPaidOrReceivedPerShare);
                        }
                    } else if (longLeg.optionType === "PE") { // Put Spread
                        if (longLeg.strike > shortLeg.strike) { // Bear Put Spread (Debit)
                            maxLossNum = netPremiumPaidOrReceivedPerShare * longLeg.contracts;
                            maxProfitNum = (longLeg.strike - shortLeg.strike - netPremiumPaidOrReceivedPerShare) * longLeg.contracts;
                            breakevenPoints.push(longLeg.strike - netPremiumPaidOrReceivedPerShare);
                        } else if (longLeg.strike < shortLeg.strike) { // Bull Put Spread (Credit)
                            maxProfitNum = -netPremiumPaidOrReceivedPerShare * longLeg.contracts;
                            maxLossNum = (shortLeg.strike - longLeg.strike + netPremiumPaidOrReceivedPerShare) * longLeg.contracts;
                            breakevenPoints.push(shortLeg.strike + netPremiumPaidOrReceivedPerShare);
                        }
                    }
                }
            }
            // Straddle/Strangle (Long)
            else if (leg1.buySell === "Buy" && leg2.buySell === "Buy") {
                const totalDebitPerShare = leg1.price + leg2.price;
                maxLossNum = totalDebitPerShare * leg1.contracts;
                maxProfitNum = UNLIMITED;
                if (leg1.strike === leg2.strike) { // Long Straddle
                    breakevenPoints.push(leg1.strike + totalDebitPerShare);
                    breakevenPoints.push(leg1.strike - totalDebitPerShare);
                } else { // Long Strangle (assuming one CE, one PE)
                    const callLeg = leg1.optionType === "CE" ? leg1 : leg2;
                    const putLeg = leg1.optionType === "PE" ? leg1 : leg2;
                    if (callLeg && putLeg) { // Ensure one of each
                        breakevenPoints.push(callLeg.strike + totalDebitPerShare);
                        breakevenPoints.push(putLeg.strike - totalDebitPerShare);
                    }
                }
            }
            // Straddle/Strangle (Short)
            else if (leg1.buySell === "Sell" && leg2.buySell === "Sell") {
                const totalCreditPerShare = leg1.price + leg2.price;
                maxProfitNum = totalCreditPerShare * leg1.contracts;
                maxLossNum = UNLIMITED;
                 if (leg1.strike === leg2.strike) { // Short Straddle
                    breakevenPoints.push(leg1.strike + totalCreditPerShare);
                    breakevenPoints.push(leg1.strike - totalCreditPerShare);
                } else { // Short Strangle
                    const callLeg = leg1.optionType === "CE" ? leg1 : leg2;
                    const putLeg = leg1.optionType === "PE" ? leg1 : leg2;
                     if (callLeg && putLeg) {
                        breakevenPoints.push(callLeg.strike + totalCreditPerShare);
                        breakevenPoints.push(putLeg.strike - totalCreditPerShare);
                    }
                }
            }
        }
    }
    // Add more specific strategy recognitions for 3 or 4 legs if needed (e.g., butterfly, condor)
    // This becomes exponentially complex.
    // For now, if breakevenPoints array is still empty, it defaults to COMPLEX_STRATEGY for display.

    const formatBreakevenDisplay = (bpArray) => {
        if (bpArray.length === 0) return COMPLEX_STRATEGY;
        return bpArray
            .filter(bp => typeof bp === 'number' && !isNaN(bp)) // Filter out non-numeric BPs
            .map(bp => {
                let diffPercentStr = "";
                if (typeof underlyingSpotPrice === 'number' && !isNaN(underlyingSpotPrice) && underlyingSpotPrice > 0) {
                    const diff = bp - underlyingSpotPrice;
                    const percent = (diff / underlyingSpotPrice) * 100;
                    diffPercentStr = ` (${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%)`;
                }
                return `${bp.toFixed(0)}${diffPercentStr}`;
            }).join(' & ') || COMPLEX_STRATEGY; // If all BPs were invalid, show complex
    };
    
    // Ensure maxProfit/Loss are not negative if unlimited (or based on context)
    if (maxProfitNum !== UNLIMITED && maxProfitNum !== COMPLEX_STRATEGY && typeof maxProfitNum === 'number' && maxProfitNum < 0 && selectedLegs.some(l => l.buySell === 'Buy')) {
        // This might indicate a net debit strategy where max profit is difference in strikes minus debit
        // For display purposes, we usually show the positive potential.
    }
    if (maxLossNum !== UNLIMITED && maxLossNum !== COMPLEX_STRATEGY && typeof maxLossNum === 'number' && maxLossNum < 0) {
        // Max loss is usually represented as a positive number (the amount you can lose)
        maxLossNum = Math.abs(maxLossNum);
    }


    return {
      ...initialReturn,
      netPremiumAtEntry: formatDisplayValue(netPremiumAtEntryNum, "currency", { 
          showSign: false, // Let suffix handle credit/debit
          useAbsolute: true, 
          suffix: netPremiumAtEntryNum !== 0 ? (netPremiumAtEntryNum > 0 ? " Cr" : " Dr") : "" 
      }),
      currentMarketValue: formatDisplayValue(canCalculateCurrentMarketValue ? currentMarketValueNum : NOT_APPLICABLE, "currency", { showSign: true }),
      unrealizedPnL: formatDisplayValue(unrealizedPnLNum, "currency_pnl", { showSign: true }),
      
      portfolioDelta: formatDisplayValue(canCalculateGreeks ? portfolioDeltaNum : NOT_APPLICABLE, "number", { digits: 0, showSign: true }),
      portfolioGamma: formatDisplayValue(canCalculateGreeks ? portfolioGammaNum : NOT_APPLICABLE, "number", { digits: 4, showSign: false }), // Gamma typically shown unsigned
      portfolioTheta: formatDisplayValue(canCalculateGreeks ? portfolioThetaNum : NOT_APPLICABLE, "number", { digits: 0, showSign: true }),
      portfolioVega: formatDisplayValue(canCalculateGreeks ? portfolioVegaNum : NOT_APPLICABLE, "number", { digits: 0, showSign: true }), // Vega is often per 1% IV change; depends on broker data

      totalIntrinsicValue: formatDisplayValue(totalIntrinsicValueNum, "currency", { showSign: true }),
      totalTimeValue: formatDisplayValue(totalStrategyTimeValueNum, "currency", { showSign: true }),
      
      maxProfit: formatDisplayValue(maxProfitNum, maxProfitNum === UNLIMITED || maxProfitNum === COMPLEX_STRATEGY ? "string" : "currency_pnl", { showSign: true }),
      maxLoss: formatDisplayValue(maxLossNum, maxLossNum === UNLIMITED || maxLossNum === COMPLEX_STRATEGY ? "string" : "currency", { useAbsolute: true, digits:0 }),
      breakevenPointsDisplay: formatBreakevenDisplay(breakevenPoints),
    };
  }, [selectedLegs, underlyingSpotPrice, getOptionByToken]);


  const handleRiskRewardMultiplierChange = () => {
    console.log("Risk/Reward multiplier toggle (placeholder)");
  };

  return (
    <section className="sv-summary-metrics-section">
      <div className="metrics-grid">
        {/* Group 1: P&L (Removed in your screenshot, but often present) */}
        {/* <div className="metric-group pnl-details">
            <MetricItem label="Net Premium" value={calculatedMetrics.netPremiumAtEntry} />
            <MetricItem label="Current Value" value={calculatedMetrics.currentMarketValue} />
            <MetricItem label="Unrealized P&L" value={calculatedMetrics.unrealizedPnL} valueClass={...} />
        </div> */}

        {/* Group 2: Max P/L & Breakeven (As per your screenshot structure) */}
        <div className="metric-group payoff-limits">
          <MetricItem label="Max. Profit" value={calculatedMetrics.maxProfit} valueClass={calculatedMetrics.maxProfit !== UNLIMITED && calculatedMetrics.maxProfit !== COMPLEX_STRATEGY && calculatedMetrics.maxProfit !== NOT_APPLICABLE && parseFloat(String(calculatedMetrics.maxProfit).replace(/[^0-9.-]+/g,"")) >= 0 ? 'profit-value' : (calculatedMetrics.maxProfit === UNLIMITED ? 'profit-value' : '')} showInfoIcon/>
          <MetricItem label="Max. Loss" value={calculatedMetrics.maxLoss} valueClass={calculatedMetrics.maxLoss !== UNLIMITED && calculatedMetrics.maxLoss !== COMPLEX_STRATEGY && calculatedMetrics.maxLoss !== NOT_APPLICABLE && parseFloat(String(calculatedMetrics.maxLoss).replace(/[^0-9.-]+/g,"")) > 0 ? 'loss-value' : (calculatedMetrics.maxLoss === UNLIMITED ? 'loss-value' : '')} showInfoIcon/>
          <MetricItem label="Breakeven(s)" value={calculatedMetrics.breakevenPointsDisplay} showInfoIcon/>
        </div>

        {/* Group 3: Greeks (Removed in your screenshot, but good to have if data available) */}
        {/* <div className="metric-group greeks-overview">
            <MetricItem label="Delta" value={calculatedMetrics.portfolioDelta} />
            <MetricItem label="Gamma" value={calculatedMetrics.portfolioGamma} />
            <MetricItem label="Theta" value={calculatedMetrics.portfolioTheta} />
            <MetricItem label="Vega" value={calculatedMetrics.portfolioVega} />
        </div> */}
        
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
