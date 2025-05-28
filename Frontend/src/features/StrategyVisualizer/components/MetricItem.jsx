// src/features/StrategyVisualizer/components/MetricItem.jsx
import React from 'react';
import './MetricItem.scss';

const InfoIcon = ({ title = "More information" }) => (
  <span className="info-icon" title={title} role="img" aria-label="Information">
    ⓘ
  </span>
);

const MetricItem = ({
  label,
  value,
  subValue,
  valueClass = '',
  showInfoIcon = false,
  infoIconTitle,
  children, 
}) => (
  <div className="metric-item">
    <h4 className="metric-label">
      {label}
      {children && <span className="metric-label-addon">{children}</span>}
      {showInfoIcon && <InfoIcon title={infoIconTitle || (label ? `Details about ${label}` : 'More information')} />}
    </h4>
    <p className={`metric-value ${valueClass}`}>
      {value === null || value === undefined || value === "" ? "N/A" : value}
    </p>
    {subValue && <p className="metric-sub-value">{subValue}</p>}
  </div>
);

export default React.memo(MetricItem);
