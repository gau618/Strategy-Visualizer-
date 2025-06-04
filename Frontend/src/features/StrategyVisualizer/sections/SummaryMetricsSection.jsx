// src/features/StrategyVisualizer/sections/SummaryMetricsSection.jsx
import React, { useMemo, useState } from 'react';
import MetricItem from '../components/MetricItem';
import Button from '../../../components/Button/Button';
import './SummaryMetricsSection.scss';

const NOT_APPLICABLE = "N/A";
const UNLIMITED = "Unlimited";

const formatDisplayValue = (value, type = "number", options = {}) => {
  const { digits = 2, prefix = "₹", suffix = "", showSign = false, useAbsolute = false } = options;
  
  if (value === UNLIMITED) return value;
  if (value === null || value === undefined || (typeof value === 'number' && isNaN(value))) return NOT_APPLICABLE;
  
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g,"")) : value;
  if (typeof numValue !== 'number' || isNaN(numValue)) return NOT_APPLICABLE;

  const absValue = useAbsolute ? Math.abs(numValue) : numValue;
  const sign = showSign ? (numValue >= 0 ? '+' : '-') : '';
  return `${sign}${prefix}${absValue.toFixed(digits)}${suffix}`;
};

const SummaryMetricsSection = ({
  strategyLegs,
  underlyingSpotPrice,
  getOptionByToken,
  payoffGraphData,
}) => {
  const [showRewardRisk, setShowRewardRisk] = useState(false);

  // 1. Filter and validate selected legs
  const selectedLegs = useMemo(() => {
    if (!Array.isArray(strategyLegs)) return [];
    return strategyLegs.filter(leg => 
      leg?.selected &&
      typeof leg.price === 'number' &&
      !isNaN(leg.strike) &&
      ['CE', 'PE'].includes(leg.optionType) &&
      ['Buy', 'Sell'].includes(leg.buySell) &&
      leg.lots > 0 &&
      leg.lotSize > 0
    ).map(leg => ({
      ...leg,
      strike: Number(leg.strike),
      contracts: leg.lots * leg.lotSize
    }));
  }, [strategyLegs]);

  // 2. Calculate core metrics
  const { intrinsicValue, timeValue, maxProfit, maxLoss, breakevenPoints, riskRewardRatio } = useMemo(() => {
    let totalIntrinsic = 0;
    let totalTimeValue = 0;
    let rawMaxProfit = NOT_APPLICABLE;
    let rawMaxLoss = NOT_APPLICABLE;
    const breakevens = [];

    // A. Calculate Intrinsic & Time Value
    if (selectedLegs.length > 0) {
    
      selectedLegs.forEach(leg => {
        const intrinsic = leg.optionType === 'CE' 
          ? Math.max(0, Number(underlyingSpotPrice) - leg.strike)
          : Math.max(0, leg.strike - Number(underlyingSpotPrice));
         console.log(underlyingSpotPrice)
        const liveOpt = getOptionByToken?.(leg.token);
        const marketPrice = liveOpt?.lastPrice ?? leg.price;
        const timeVal = marketPrice - intrinsic;
        totalIntrinsic += intrinsic * leg.contracts * (leg.buySell === 'Buy' ? 1 : -1);
        totalTimeValue += timeVal * leg.contracts * (leg.buySell === 'Buy' ? 1 : -1);
      });
    }

    // B. Calculate Max Profit/Loss from payoff data
    if (payoffGraphData?.points?.length > 0) {
      const pnlValues = payoffGraphData.points.map(p => p.pnlAtExpiry);
      rawMaxProfit = Math.max(...pnlValues);
      rawMaxLoss = Math.min(...pnlValues);

      // Detect unlimited profit/loss
      const lastIndex = pnlValues.length - 1;
      if (pnlValues[lastIndex] > pnlValues[lastIndex - 1]) rawMaxProfit = UNLIMITED;
      if (pnlValues[0] < pnlValues[1]) rawMaxLoss = UNLIMITED;

      // Calculate breakeven points
      payoffGraphData.points.forEach((point, index) => {
        if (index === 0) return;
        const prev = payoffGraphData.points[index - 1];
        if (prev.pnlAtExpiry * point.pnlAtExpiry <= 0) {
          const breakeven = prev.spot - 
            prev.pnlAtExpiry * (point.spot - prev.spot) / (point.pnlAtExpiry - prev.pnlAtExpiry);
          breakevens.push(breakeven.toFixed(0));
        }
      });
    }

    // C. Calculate Risk/Reward Ratio
    let ratio = NOT_APPLICABLE;
    if (typeof rawMaxProfit === 'number' && typeof rawMaxLoss === 'number') {
      const risk = Math.abs(rawMaxLoss);
      const reward = rawMaxProfit;
      ratio = showRewardRisk 
        ? reward !== 0 ? (risk / reward).toFixed(2) + "X" : "∞" 
        : reward !== 0 ? (reward / risk).toFixed(2) + "X" : "0X";
    }

    return {
      intrinsicValue: formatDisplayValue(totalIntrinsic, 'currency', { showSign: true }),
      timeValue: formatDisplayValue(totalTimeValue, 'currency', { showSign: true }),
      maxProfit: rawMaxProfit === UNLIMITED ? UNLIMITED : formatDisplayValue(rawMaxProfit, 'currency'),
      maxLoss: rawMaxLoss === UNLIMITED ? UNLIMITED : formatDisplayValue(Math.abs(rawMaxLoss), 'currency'),
      breakevenPoints: breakevens.length > 0 ? breakevens.join(' & ') : NOT_APPLICABLE,
      riskRewardRatio: ratio
    };
  }, [selectedLegs, underlyingSpotPrice, getOptionByToken, payoffGraphData, showRewardRisk]);

  return (
    <section className="sv-summary-metrics-section">
      <div className="metrics-grid">
        {/* Row 1 */}
        <div className="metric-row">
          <MetricItem 
            label="Max. Profit" 
            value={maxProfit}
            valueClass={maxProfit === UNLIMITED ? 'unlimited-value' : 'profit-value'}
          />
          <Button onClick={() => setShowRewardRisk(!showRewardRisk)}>{!showRewardRisk ? "Reward/Risk" : "Risk/Reward"}</Button>
          <MetricItem
            value={riskRewardRatio}
          />      
          <MetricItem 
            label="Funds & Margin" 
            value="API Req."
          />
        </div>

        {/* Row 2 */}
        <div className="metric-row">
          <MetricItem 
            label="Max. Loss" 
            value={maxLoss}
            valueClass={maxLoss === UNLIMITED ? 'unlimited-value' : 'loss-value'}
          />
          <MetricItem 
            label="Intrinsic Value" 
            value={intrinsicValue}
            infoIconTitle="Current intrinsic value of positions"
          />
          <MetricItem 
            label="Funds Required" 
            value="API Req."
          />
        </div>

        {/* Row 3 */}
        <div className="metric-row">
          <MetricItem 
            label="Breakeven(s)" 
            value={breakevenPoints}
            infoIconTitle="Price points where strategy breaks even"
          />
          <MetricItem 
            label="Time Value" 
            value={timeValue}
            infoIconTitle="Remaining time value in positions"
          />
          <MetricItem 
            label="Standalone Margin" 
            value="API Req."
          />
        </div>

        {/* Row 4 */}
        <div className="metric-row single-metric">
          <MetricItem 
            label="POP" 
            value="API Req."
            infoIconTitle="Probability of Profit"
          />
        </div>
      </div>
    </section>
  );
};

export default React.memo(SummaryMetricsSection);
