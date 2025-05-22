// src/features/StrategyVisualizer/sections/SummaryMetricsSection.jsx
import React, { useEffect, useState } from 'react';
import MetricItem from '../components/MetricItem';
import Button from '../../../components/Button/Button';
// import { calculateStrategySummary } from '../../../services/strategyApi'; // Example
import './SummaryMetricsSection.scss';

const SummaryMetricsSection = ({ strategyLegs }) => {
  const [summaryMetrics, setSummaryMetrics] = useState({
    maxProfit: "N/A", maxLoss: "N/A", breakeven: "N/A",
    pop: "N/A", timeValue: "N/A", intrinsicValue: "N/A",
    fundsRequired: "N/A", standaloneFunds: "N/A", standaloneMargin: "N/A", marginAvailable: "N/A"
  });

  useEffect(() => {
    if (strategyLegs && strategyLegs.length > 0) {
      // calculateStrategySummary(strategyLegs)
      //   .then(data => setSummaryMetrics(data))
      //   .catch(err => console.error("Error calculating summary metrics:", err));

      // Dummy data simulation based on image
      setSummaryMetrics({
        maxProfit: "+5,781 (+3%)", // Example
        maxLoss: "Unlimited",
        breakeven: "23717 (+0.2%)",
        pop: "NA", // Often requires complex calc or API
        timeValue: "1.59L",
        intrinsicValue: "1.59L", // Or calculate based on current spot vs strike
        fundsRequired: "NA",
        standaloneFunds: "1.39L",
        standaloneMargin: "1.31L",
        marginAvailable: "D" // This looks like an account specific indicator
      });
    } else {
      // Reset to N/A if no legs
      setSummaryMetrics({
        maxProfit: "N/A", maxLoss: "N/A", breakeven: "N/A",
        pop: "N/A", timeValue: "N/A", intrinsicValue: "N/A",
        fundsRequired: "N/A", standaloneFunds: "N/A", standaloneMargin: "N/A", marginAvailable: "N/A"
      });
    }
  }, [strategyLegs]);


  return (
    <section className="sv-summary-metrics-section">
      <div className="metric-group">
        <MetricItem label="Max. Profit" value={summaryMetrics.maxProfit} valueClass="profit-value" />
        <MetricItem label="Breakeven" value={summaryMetrics.breakeven} />
      </div>
      <div className="metric-group">
        <MetricItem label="Max. Loss" value={summaryMetrics.maxLoss} valueClass="loss-value" />
      </div>
      <div className="metric-group">
        <h4>Risk/Reward <Button variant="tertiary" size="small" className="risk-reward-btn">1X</Button></h4>
        <MetricItem label="POP" value={summaryMetrics.pop} info />
        <MetricItem label="Time Value" value={summaryMetrics.timeValue} info />
        <MetricItem label="Intrinsic Value" value={summaryMetrics.intrinsicValue} info />
      </div>
      <div className="metric-group">
        <h4>Funds & Margin</h4>
        <MetricItem label="" value={summaryMetrics.fundsRequired} /> {/* Assuming first value is Funds Required */}
        <MetricItem label="Standalone Funds" value={summaryMetrics.standaloneFunds} info />
        <MetricItem label="Standalone Margin" value={summaryMetrics.standaloneMargin} info />
        <MetricItem label="Margin Available" value={summaryMetrics.marginAvailable} info />
      </div>
    </section>
  );
};

export default SummaryMetricsSection;
