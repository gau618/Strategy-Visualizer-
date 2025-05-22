// src/features/StrategyVisualizer/components/MetricItem.jsx
import React from 'react';
import './MetricItem.scss';

const MetricItem = ({ label, value, subValue, valueClass = '', info = false }) => (
  <div className="metric-item">
    <h4>
      {label}
      {info && <span className="info-icon">ⓘ</span>}
    </h4>
    <p className={`metric-value ${valueClass}`}>{value}</p>
    {subValue && <p className="metric-sub-value">{subValue}</p>}
  </div>
);

export default MetricItem;
