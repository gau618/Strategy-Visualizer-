// src/features/StrategyVisualizer/StrategyVisualizer.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './StrategyVisualizer.scss';

import HeaderSection from './sections/HeaderSection';
import TopControlsSection from './sections/TopControlsSection';
import ReadyMadeStrategiesSection from './sections/ReadyMadeStrategiesSection';
import NewStrategySection from './sections/NewStrategySection';
import PayoffChartSection from './sections/PayoffChartSection';
import SummaryMetricsSection from './sections/SummaryMetricsSection';
import DetailedDataSection from './sections/DetailedDataSection';

import { useLiveOptionData } from '../../contexts/LiveOptionDataContext';
import { RISK_FREE_RATE } from '../../config'; // Import global config

const StrategyVisualizer = () => {
  const {
    liveOptionChainMap,
    websocketReadyState,
    SocketIOReadyState,
    availableUnderlyings,
    getOptionsByUnderlying,
    getOptionByToken,
  } = useLiveOptionData();

  const [instrumentType, setInstrumentType] = useState('index');
  const [searchTerm, setSearchTerm] = useState('');
  const [strategyLegs, setStrategyLegs] = useState([]);
  const [activeChartTab, setActiveChartTab] = useState('greeks'); // Default to Greeks
  const [activeMainTab, setActiveMainTab] = useState('readymade');

  // State for GLOBAL target inputs (Nifty Target & Target Date)
  const [niftyTarget, setNiftyTarget] = useState(''); // Will be set by PayoffChartSection's default
  const [targetDate, setTargetDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // Adjust for local timezone for datetime-local input
    return now.toISOString().slice(0, 16); // Format for datetime-local
  });

  // State for Greeks multiplier checkboxes
  const [multiplyGreeksByLotSize, setMultiplyGreeksByLotSize] = useState(false);
  const [multiplyGreeksByNumLots, setMultiplyGreeksByNumLots] = useState(false);

  useEffect(() => {
    if (availableUnderlyings && availableUnderlyings.length > 0 && !searchTerm) {
      setSearchTerm(availableUnderlyings[0]);
    }
  }, [availableUnderlyings, searchTerm]);

  const handleInstrumentTypeChange = useCallback(type => setInstrumentType(type), []);
  const handleSearchTermChange = useCallback(term => setSearchTerm(term), []);
  const handleStrategyLegsChange = useCallback(legs => setStrategyLegs(legs), []);
  const handleChartTabChange = useCallback(tab => setActiveChartTab(tab), []);
  const handleMainTabChange = useCallback(tab => setActiveMainTab(tab), []);
  
  // These handlers will be passed to PayoffChartSection for its global controls
  const handleNiftyTargetChange = useCallback(val => setNiftyTarget(val), []);
  const handleTargetDateChange = useCallback(val => setTargetDate(val), []);

  const handleMultiplyLotSizeChange = useCallback(checked => setMultiplyGreeksByLotSize(checked), []);
  const handleMultiplyNumLotsChange = useCallback(checked => setMultiplyGreeksByNumLots(checked), []);

  const optionsForCurrentUnderlying = useMemo(() => {
    if (!searchTerm || !getOptionsByUnderlying) return [];
    return getOptionsByUnderlying(searchTerm);
  }, [searchTerm, getOptionsByUnderlying]);

  if (!SocketIOReadyState || websocketReadyState === SocketIOReadyState.CONNECTING || websocketReadyState === SocketIOReadyState.RECONNECTING) {
    return <div className="loading-overlay">Connecting to live market data...</div>;
  }
  if (websocketReadyState === SocketIOReadyState.CLOSED && (!liveOptionChainMap || liveOptionChainMap.size === 0)) {
    return <div className="error-overlay">Market data connection closed. Please refresh or check connection.</div>;
  }

  return (
    <div className="strategy-visualizer-container">
      <HeaderSection />
      <TopControlsSection
        instrumentType={instrumentType}
        onInstrumentTypeChange={handleInstrumentTypeChange}
        searchTerm={searchTerm}
        onSearchTermChange={handleSearchTermChange}
        availableUnderlyings={availableUnderlyings || []}
      />
      <ReadyMadeStrategiesSection
        activeMainTab={activeMainTab}
        onMainTabChange={handleMainTabChange}
      />
      <NewStrategySection
        strategyLegs={strategyLegs}
        onStrategyLegsChange={handleStrategyLegsChange}
        optionsForSelectedUnderlying={optionsForCurrentUnderlying}
        currentUnderlying={searchTerm}
      />
      <PayoffChartSection
        activeChartTab={activeChartTab}
        onChartTabChange={handleChartTabChange}
        
        niftyTarget={niftyTarget} // Pass state for global controls
        onNiftyTargetChange={handleNiftyTargetChange} // Pass handler
        targetDate={targetDate} // Pass state
        onTargetDateChange={handleTargetDateChange} // Pass handler
        
        strategyLegs={strategyLegs}
        getOptionByToken={getOptionByToken}
        liveOptionChainMap={liveOptionChainMap} // For current spot/IV lookup initially
        currentUnderlying={searchTerm}
        riskFreeRate={RISK_FREE_RATE} // Pass global RFR

        multiplyByLotSize={multiplyGreeksByLotSize}
        onMultiplyByLotSizeChange={handleMultiplyLotSizeChange}
        multiplyByNumLots={multiplyGreeksByNumLots}
        onMultiplyByNumLotsChange={handleMultiplyNumLotsChange}
      />
      <SummaryMetricsSection
        strategyLegs={strategyLegs}
        getOptionByToken={getOptionByToken} // Summary might also need live data
      />
            <DetailedDataSection 
        strategyLegs={strategyLegs}
        currentUnderlying={searchTerm}
        getOptionByToken={getOptionByToken} // For live IVs and fallback live Greeks
        riskFreeRate={RISK_FREE_RATE}   // Needed for projected Greeks calculation
        
        // VVVV NEW PROPS FOR PROJECTED GREEKS VVVV
        projectedNiftyTarget={niftyTarget} 
        projectedTargetDate={targetDate}

        // Pass multiplier states if DetailedDataSection's Greeks also use them
        multiplyByLotSize={multiplyGreeksByLotSize}
        onMultiplyByLotSizeChange={handleMultiplyLotSizeChange} // If checkboxes are also in DetailedDataSection
        multiplyByNumLots={multiplyGreeksByNumLots}
        onMultiplyByNumLotsChange={handleMultiplyNumLotsChange} // If checkboxes are also in DetailedDataSection
      />
    </div>
  );
};
export default React.memo(StrategyVisualizer);
