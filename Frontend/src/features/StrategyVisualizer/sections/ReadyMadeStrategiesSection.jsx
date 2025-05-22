// src/features/StrategyVisualizer/sections/ReadyMadeStrategiesSection.jsx
import React, { useState, useEffect } from 'react';
import StrategyTabs from '../components/StrategyTabs';
import Button from '../../../components/Button/Button';
import Select from '../../../components/Select/Select';
// import { fetchReadyMadeStrategies } from '../../../services/strategyApi'; // Example API call
import './ReadyMadeStrategiesSection.scss';

const ReadyMadeStrategiesSection = ({ activeMainTab, onMainTabChange }) => {
  const [strategies, setStrategies] = useState([]);
  const [activeFilter, setActiveFilter] = useState('Bullish'); // Default filter
  const [selectedExpiry, setSelectedExpiry] = useState('30MAR'); // Default expiry

  const mainTabs = [
    { id: 'readymade', label: 'Ready-made' },
    { id: 'positions', label: 'Positions' },
    { id: 'mystrategies', label: 'My Strategies' },
    { id: 'draftportfolios', label: 'Draft Portfolios' },
  ];

  useEffect(() => {
    // fetchReadyMadeStrategies({ filter: activeFilter, expiry: selectedExpiry })
    //   .then(data => setStrategies(data.strategies || []))
    //   .catch(err => console.error('Error fetching ready-made strategies:', err));

    // Dummy data simulation
    const dummyStrategies = [
        { id: 1, name: 'Buy Call', chartIcon: '📈' }, { id: 2, name: 'Sell Put', chartIcon: '📉' },
        { id: 3, name: 'Bull Call Spread', chartIcon: '↗️' }, { id: 4, name: 'Bull Put Spread', chartIcon: '↗️📉' },
        { id: 5, name: 'Call Ratio Back Spread', chartIcon: '📈🐻' }, { id: 6, name: 'Long Calendar with Calls', chartIcon: '📅📞' },
        { id: 7, name: 'Bull Condor', chartIcon: '🦅🐂' }, { id: 8, name: 'Bull Butterfly', chartIcon: '🦋🐂' },
        { id: 9, name: 'Range Forward', chartIcon: '↔️➡️' },
      ];
    setStrategies(dummyStrategies);
  }, [activeFilter, selectedExpiry]);

  const strategyFilters = ['Bullish', 'Bearish', 'Neutral', 'Others'];
  const expiryOptions = [{ label: '30 MAR', value: '30MAR' }, { label: '27 APR', value: '27APR' }]; // Populate dynamically

  return (
    <section className="sv-ready-made-section">
      <StrategyTabs
        tabs={mainTabs}
        activeTab={activeMainTab}
        onTabChange={onMainTabChange}
      />
      {activeMainTab === 'readymade' && (
        <div className="strategy-selection-content">
          <p className="selection-prompt">Select any ready-made strategy to load it</p>
          <div className="strategy-filters-bar">
            {strategyFilters.map(filter => (
              <Button
                key={filter}
                variant="filter" // Uses .btn-filter from Button.scss
                className={activeFilter === filter ? 'active' : ''}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </Button>
            ))}
            <Select
              options={expiryOptions}
              value={selectedExpiry}
              onChange={setSelectedExpiry}
              className="expiry-select"
            />
          </div>
          <div className="strategy-grid">
            {strategies.map(strategy => (
              <div key={strategy.id} className="strategy-preview-card" onClick={() => console.log('Load Strategy:', strategy.name)}>
                <div className="strategy-chart-placeholder">{strategy.chartIcon}</div>
                <p>{strategy.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Placeholder for other tabs like Positions, My Strategies etc. */}
      {activeMainTab === 'positions' && <p>Positions Content Placeholder</p>}
    </section>
  );
};

export default ReadyMadeStrategiesSection;
