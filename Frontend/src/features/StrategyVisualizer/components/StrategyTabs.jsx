// src/features/StrategyVisualizer/components/StrategyTabs.jsx
import React from 'react';
import Button from '../../../components/Button/Button';
import './StrategyTabs.scss';

const StrategyTabs = ({ tabs, activeTab, onTabChange, className = '' }) => (
  <nav className={`sv-strategy-tabs ${className}`}>
    {tabs.map(tab => (
      <Button
        key={tab.id}
        variant="tab"
        className={activeTab === tab.id ? 'active' : ''}
        onClick={() => onTabChange(tab.id)}
      >
        {tab.label}
      </Button>
    ))}
  </nav>
);

export default StrategyTabs;
