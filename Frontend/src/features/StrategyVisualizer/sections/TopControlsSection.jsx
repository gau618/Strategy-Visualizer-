// src/features/StrategyVisualizer/sections/TopControlsSection.jsx
import React from 'react';
import ToggleButtonGroup from '../../../components/ToggleButtonGroup/ToggleButtonGroup';
import Input from '../../../components/Input/Input'; // Your custom Input component
import Button from '../../../components/Button/Button';
import './TopControlsSection.scss';

const TopControlsSection = ({
  instrumentType,
  onInstrumentTypeChange,
  searchTerm,
  onSearchTermChange
}) => (
  <section className="sv-top-controls-section">
    <ToggleButtonGroup
      options={[{ label: 'Index', value: 'index' }, { label: 'Equity', value: 'equity' }]}
      selected={instrumentType}
      onSelect={onInstrumentTypeChange}
      className="instrument-type-toggle"
    />
    <Input
      placeholder="Search NIFTY, BANKNIFTY..." // More descriptive placeholder
      value={searchTerm}
      onChange={inputValue => onSearchTermChange(inputValue)} // This was already corrected
      icon="🔍"
      className="search-input"
      name="mainStrategySearch" // Example: Providing a specific name
      // autoComplete="off" // This is now handled by default in Input.jsx,
                           // but you can be explicit here if you prefer.
                           // No change needed here if Input.jsx defaults to "off".
    />
    <div className="top-actions">
      <Button variant="tertiary" icon="📊" size="normal">Info</Button>
      <Button variant="tertiary" icon="⚙️" size="normal">Settings</Button>
    </div>
  </section>
);

export default TopControlsSection;
