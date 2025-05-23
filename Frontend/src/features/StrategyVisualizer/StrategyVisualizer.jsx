// src/features/StrategyVisualizer/StrategyVisualizer.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./StrategyVisualizer.scss"; // Ensure this SCSS file exists and is linked

import HeaderSection from "./sections/HeaderSection"; // Assuming these components exist
import TopControlsSection from "./sections/TopControlsSection";
import ReadyMadeStrategiesSection from "./sections/ReadyMadeStrategiesSection";
import NewStrategySection from "./sections/NewStrategySection";
import PayoffChartSection from "./sections/PayoffChartSection";
import SummaryMetricsSection from "./sections/SummaryMetricsSection";
import DetailedDataSection from "./sections/DetailedDataSection";

import { useLiveOptionData } from "../../contexts/LiveOptionDataContext"; // Ensure path is correct
import { RISK_FREE_RATE, DEFAULT_VOLATILITY } from "../../config"; // Ensure path is correct

const StrategyVisualizer = () => {
  const {
    liveOptionChainMap,
    websocketReadyState,
    SocketIOReadyState, // SocketIOReadyState should be from context or imported
    availableUnderlyings,
    getOptionsByUnderlying,
    getOptionByToken,
  } = useLiveOptionData();

  // --- Core States ---
  const [instrumentType, setInstrumentType] = useState("index");
  const [searchTerm, setSearchTerm] = useState("");
  const [strategyLegs, setStrategyLegs] = useState([]);

  // --- Tab States ---
  const [activeChartTab, setActiveChartTab] = useState("greeks");
  const [activeMainTab, setActiveMainTab] = useState("readymade");

  // --- Global Projection Input States ---
  const [niftyTarget, setNiftyTarget] = useState("");
  const [targetDate, setTargetDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  // --- Global IV Adjustment States ---
  const [globalIvOffset, setGlobalIvOffset] = useState(0);
  const [individualIvAdjustments, setIndividualIvAdjustments] = useState({});

  // --- Global Multiplier States ---
  const [multiplyByLotSize, setMultiplyGreeksByLotSize] = useState(false);
  const [multiplyByNumLots, setMultiplyGreeksByNumLots] = useState(false);
  // --- useEffects ---
  useEffect(() => {
    if (
      availableUnderlyings &&
      availableUnderlyings.length > 0 &&
      !searchTerm
    ) {
      setSearchTerm(availableUnderlyings[0]);
    }
  }, [availableUnderlyings, searchTerm]);

  // --- Handlers ---
  const handleInstrumentTypeChange = useCallback(
    (type) => setInstrumentType(type),
    []
  );
  const handleSearchTermChange = useCallback((term) => setSearchTerm(term), []);
  const handleStrategyLegsChange = useCallback(
    (legs) => setStrategyLegs(legs),
    []
  );
  const handleChartTabChange = useCallback((tab) => setActiveChartTab(tab), []);
  const handleMainTabChange = useCallback((tab) => setActiveMainTab(tab), []);
  const handleNiftyTargetChange = useCallback((val) => setNiftyTarget(val), []);
  const handleTargetDateChange = useCallback((val) => setTargetDate(val), []);
  const handleMultiplyLotSizeChange = useCallback(
    (checked) => setMultiplyGreeksByLotSize(checked),
    []
  );
  const handleMultiplyNumLotsChange = useCallback(
    (checked) => setMultiplyGreeksByNumLots(checked),
    []
  );

  // IV Adjustment Handlers
  const handleGlobalIvOffsetChange = useCallback((updater) => { // DEFINED
    if (typeof updater === "function") {
      setGlobalIvOffset((prev) =>
        parseFloat(Math.max(-50, Math.min(50, updater(prev))).toFixed(1))
      );
    } else {
      setGlobalIvOffset(
        parseFloat(Math.max(-50, Math.min(50, updater)).toFixed(1))
      );
    }
  }, []);
  const handleIndividualIvAdjustmentChange = useCallback( // DEFINED
    (legToken, adjustment) => {
      setIndividualIvAdjustments((prev) => ({
        ...prev,
        [legToken]: parseFloat(adjustment) || 0,
      }));
    },
    []
  );
  const handleResetAllIvAdjustments = useCallback(() => { // DEFINED
    setGlobalIvOffset(0);
    setIndividualIvAdjustments({});
  }, []);

  // Central function to get scenario IV (returns decimal for calculation)
  const getScenarioIV = useCallback(
    (legToken) => {
      const liveOption = getOptionByToken(legToken);
      if (!liveOption || liveOption.iv === undefined) return DEFAULT_VOLATILITY;
      const baseIVPercentage = parseFloat(liveOption.iv);
      const individualAdjustmentPercentage =
        individualIvAdjustments[legToken] || 0;
      const scenarioIVPercentage =
        baseIVPercentage + individualAdjustmentPercentage + globalIvOffset;
      return Math.max(0.001, scenarioIVPercentage / 100);
    },
    [
      getOptionByToken,
      individualIvAdjustments,
      globalIvOffset,
      DEFAULT_VOLATILITY,
    ]
  );

  const optionsForCurrentUnderlying = useMemo(() => {
    if (!searchTerm || !getOptionsByUnderlying) return [];
    return getOptionsByUnderlying(searchTerm);
  }, [searchTerm, getOptionsByUnderlying]);

  if (
    !SocketIOReadyState ||
    websocketReadyState === SocketIOReadyState.CONNECTING ||
    websocketReadyState === SocketIOReadyState.RECONNECTING
  )
    return <div className="loading-overlay">Connecting...</div>;
  if (
    websocketReadyState === SocketIOReadyState.CLOSED &&
    (!liveOptionChainMap || liveOptionChainMap.size === 0)
  )
    return <div className="error-overlay">Market data connection closed.</div>;

  const commonScenarioProps = {
    strategyLegs,
    getOptionByToken,
    riskFreeRate: RISK_FREE_RATE,
    getScenarioIV,
  };

  const payoffChartProps = {
    ...commonScenarioProps,
    activeChartTab,
    onChartTabChange: handleChartTabChange,
    niftyTarget,
    onNiftyTargetChange: handleNiftyTargetChange,
    targetDate,
    onTargetDateChange: handleTargetDateChange,
    liveOptionChainMap,
    currentUnderlying: searchTerm,
   multiplyByLotSize,
    onMultiplyByLotSizeChange: handleMultiplyLotSizeChange,
    multiplyByNumLots,
    onMultiplyByNumLotsChange: handleMultiplyNumLotsChange,
  };
  
  // VVVV CORRECTED THIS OBJECT VVVV
  const detailedDataProps = {
    ...commonScenarioProps,
    currentUnderlying: searchTerm,
    projectedNiftyTarget: niftyTarget,
    projectedTargetDate: targetDate,
    individualIvAdjustments,
    onIndividualIvAdjustmentChange: handleIndividualIvAdjustmentChange, // Use defined handler
    onResetAllIvAdjustments: handleResetAllIvAdjustments,
    globalIvOffset,
    onGlobalIvOffsetChange: handleGlobalIvOffsetChange, // Use defined handler
    multiplyByLotSize,
    onMultiplyByLotSizeChange: handleMultiplyLotSizeChange,
    multiplyByNumLots,
    onMultiplyByNumLotsChange: handleMultiplyNumLotsChange,
    liveOptionChainMap,
  };

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
      <PayoffChartSection {...payoffChartProps} />
      <SummaryMetricsSection
        {...commonScenarioProps}
        projectedNiftyTarget={niftyTarget}
        projectedTargetDate={targetDate}
      />
      <DetailedDataSection {...detailedDataProps} /> {/* This is where line 181 was causing error */}
    </div>
  );
};
export default React.memo(StrategyVisualizer);
