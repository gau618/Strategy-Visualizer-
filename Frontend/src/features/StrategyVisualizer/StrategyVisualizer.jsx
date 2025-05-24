// src/features/StrategyVisualizer/StrategyVisualizer.jsx
import React, { useState, useEffect, useCallback, useMemo, use } from "react";
import "./StrategyVisualizer.scss"; // Ensure path is correct
import HeaderSection from "./sections/HeaderSection";
import TopControlsSection from "./sections/TopControlsSection";
import ReadyMadeStrategiesSection from "./sections/ReadyMadeStrategiesSection";
import NewStrategySection from "./sections/NewStrategySection";
import PayoffChartSection from "./sections/PayoffChartSection";
import SummaryMetricsSection from "./sections/SummaryMetricsSection";
import DetailedDataSection from "./sections/DetailedDataSection";
import { useLiveOptionData } from "../../contexts/LiveOptionDataContext"; // Adjust path
import { RISK_FREE_RATE, DEFAULT_VOLATILITY } from "../../config"; // Adjust path
import { fetchStrategies, saveStrategy } from "../../services/strategyService"; // Adjust path

const HARDCODED_USER_ID = "userTest01"; // For testing; replace with auth context later

const StrategyVisualizer = () => {
  const {
    liveOptionChainMap, websocketReadyState, SocketIOReadyState,
    availableUnderlyings, getOptionsByUnderlying, getOptionByToken,
  } = useLiveOptionData();
//console.log("StrategyVisualizer: liveOptionChainMap", liveOptionChainMap);
  // --- Core UI and Strategy Builder State ---
  const [instrumentType, setInstrumentType] = useState("index");
  const [searchTerm, setSearchTerm] = useState(""); // This is currentUnderlying
  const [strategyLegs, setStrategyLegs] = useState([]); // For the builder
  const [activeChartTab, setActiveChartTab] = useState("greeks");
  const [activeMainTab, setActiveMainTab] = useState("readymade");

  // --- Projection & Scenario State ---
  const [niftyTarget, setNiftyTarget] = useState("");
  const [targetDate, setTargetDate] = useState(() => {
    const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [globalIvOffset, setGlobalIvOffset] = useState(0);
  const [individualIvAdjustments, setIndividualIvAdjustments] = useState({});
  const [multiplyByLotSize, setMultiplyByLotSizeState] = useState(false); // Renamed setter for clarity from your paste
  const [multiplyByNumLots, setMultiplyByNumLotsState] = useState(false);   // Renamed setter

  // --- State for Fetched User-Specific Data ---
  const [userPositions, setUserPositions] = useState([]);
  const [mySavedStrategies, setMySavedStrategies] = useState([]);
  const [draftStrategies, setDraftStrategies] = useState([]);
  console.log(strategyLegs)
  const [isLoadingTabData, setIsLoadingTabData] = useState({
    positions: false, myStrategies: false, drafts: false,
  });
  useEffect(() => {
    if (availableUnderlyings && availableUnderlyings.length > 0 && !searchTerm) {
      setSearchTerm(availableUnderlyings[0]);
    }
  }, [availableUnderlyings, searchTerm]);
  useEffect(() => {
    fetchDataForTabDisplay('active_position', setUserPositions, 'positions');
  }, [searchTerm]); // This ensures the builder clears when underlying changes
  // --- Handlers ---
  const handleInstrumentTypeChange = useCallback((type) => setInstrumentType(type), []);
  const handleSearchTermChange = useCallback((term) => {
    setSearchTerm(term);
    setStrategyLegs([]); // Clear builder when underlying changes
  }, []); // Removed setStrategyLegs from deps, it's stable
  const handleStrategyLegsChange = useCallback((legs) => setStrategyLegs(legs), []);
  const handleChartTabChange = useCallback((tab) => setActiveChartTab(tab), []);
  
const fetchDataForTabDisplay = useCallback(async (status, setter, tabKey) => {
    if (!HARDCODED_USER_ID) {
      console.warn(`Cannot fetch ${tabKey} for display, no user ID.`);
      setter([]); 
      return;
    }
    setIsLoadingTabData(prev => ({ ...prev, [tabKey]: true }));
    try {
      // fetchStrategies now directly returns the array of strategies or throws an error
      const strategiesArray = await fetchStrategies({ status, userId: HARDCODED_USER_ID }); 
      
      // console.log(`StrategyVisualizer: Fetched ${tabKey} data:`, strategiesArray, `Is Array: ${Array.isArray(strategiesArray)}`);
      
      // It's good practice to ensure it's an array, though the service should guarantee it
      setter(Array.isArray(strategiesArray) ? strategiesArray : []); 
      
    } catch (error) {
      setter([]); // Set to empty array on error
      console.error(`StrategyVisualizer: Error fetching ${tabKey} for display:`, error.message);
      // alert(`Failed to load ${tabKey}: ${error.message}`); // Optional user feedback
    } finally {
      setIsLoadingTabData(prev => ({ ...prev, [tabKey]: false }));
    }
  }, []); 

  const handleMainTabChange = useCallback((tabId) => {
    setActiveMainTab(tabId);
    if (tabId === 'positions') {
      fetchDataForTabDisplay('active_position', setUserPositions, 'positions');

    } else if (tabId === 'mystrategies') {
      // "My Strategies" could be active positions or specific templates (e.g., status 'my_strategy_template')
      fetchDataForTabDisplay('active_position', setMySavedStrategies, 'myStrategies'); // Showing active ones for now
    } else if (tabId === 'draftportfolios') {
      fetchDataForTabDisplay('draft', setDraftStrategies, 'drafts');
    }
  }, [fetchDataForTabDisplay]);

  // Fetch data for the initially active tab on component mount
  useEffect(() => {
    handleMainTabChange(activeMainTab);
  }, [activeMainTab, handleMainTabChange]); // Re-run if activeMainTab changes for any reason (e.g., programmatically)

  const handleNiftyTargetChange = useCallback((val) => setNiftyTarget(val), []);
  const handleTargetDateChange = useCallback((val) => setTargetDate(val), []);
  const handleMultiplyLotSizeChange = useCallback((checked) => setMultiplyByLotSizeState(Boolean(checked)), []);
  const handleMultiplyNumLotsChange = useCallback((checked) => setMultiplyByNumLotsState(Boolean(checked)), []);
  const handleGlobalIvOffsetChange = useCallback((updater) => { if (typeof updater === "function") { setGlobalIvOffset(prev => parseFloat(Math.max(-50, Math.min(50, updater(prev))).toFixed(1))); } else { setGlobalIvOffset(parseFloat(Math.max(-50, Math.min(50, updater)).toFixed(1))); } }, []);
  const handleIndividualIvAdjustmentChange = useCallback((legToken, adjustment) => { setIndividualIvAdjustments(prev => ({ ...prev, [legToken]: parseFloat(adjustment) || 0 })); }, []);
  const handleResetAllIvAdjustments = useCallback(() => { setGlobalIvOffset(0); setIndividualIvAdjustments({}); }, []);

  const underlyingSpotPrice = useMemo(() => {
    if (!searchTerm || !liveOptionChainMap || liveOptionChainMap.size === 0) return null;
    const anOption = Array.from(liveOptionChainMap.values()).find(opt => opt.underlying === searchTerm && opt.marketData);
    return anOption?.marketData?.spot ? parseFloat(anOption.marketData.spot) : (anOption?.marketData?.futures ? parseFloat(anOption.marketData.futures) : null);
  }, [searchTerm, liveOptionChainMap]);

  const handleLoadStrategyLegsIntoBuilder = useCallback((legsToLoad) => {
    const newLegs = legsToLoad.map(leg => ({
      ...leg, id: `leg_${Date.now()}_${Math.random().toString(16).slice(2)}`, selected: true,
      lots: leg.lots || 1, price: leg.price !== undefined ? parseFloat(leg.price) : 0, // Ensure price is number
      iv: leg.iv !== undefined ? parseFloat(leg.iv) : DEFAULT_VOLATILITY * 100, // Ensure IV is number
    }));
    setStrategyLegs(newLegs);
    setActiveMainTab('newstrategy'); // Switch to builder tab
  }, [setActiveMainTab]); // Removed setStrategyLegs

  const handleSaveStrategyFromBuilder = useCallback(async (strategyPayloadFromBuilder) => {
    if (!HARDCODED_USER_ID) { alert("User ID not set. Cannot save strategy."); return; }
    try {
      // `saveStrategy` service now expects `userId` to be part of `strategyPayloadFromBuilder` or handles it internally
      // For this setup, strategyPayloadFromBuilder already has userId from NewStrategySection
      const result = await saveStrategy(strategyPayloadFromBuilder);
      alert(result.message || "Strategy action completed!");
      // Re-fetch the relevant list to update the UI
      if (strategyPayloadFromBuilder.status === 'active_position') {
        fetchDataForTabDisplay('active_position', setUserPositions, 'positions');
        fetchDataForTabDisplay('active_position', setMySavedStrategies, 'myStrategies');
      } else if (strategyPayloadFromBuilder.status === 'draft') {
        fetchDataForTabDisplay('draft', setDraftStrategies, 'drafts');
      }
    } catch (error) {
      console.error("Failed to save strategy from builder:", error);
      alert(`Error saving strategy: ${error.message || 'Unknown server error.'}`);
    }
  }, [fetchDataForTabDisplay]); // Removed setStrategyLegs

  const getScenarioIV = useCallback((legToken) => {
    const liveOption = getOptionByToken(legToken);
    if (!liveOption || liveOption.iv === undefined) return DEFAULT_VOLATILITY;
    const baseIV = parseFloat(liveOption.iv); // Assume liveOption.iv is already in percentage points (e.g., 20 for 20%)
    const indAdj = individualIvAdjustments[legToken] || 0;
    const scenarioIV = baseIV + indAdj + globalIvOffset;
    return Math.max(0.001, scenarioIV / 100); // Convert to decimal (0.20 for 20%) for calculations
  }, [getOptionByToken, individualIvAdjustments, globalIvOffset]);

  // This provides the full option chain data for the selected underlying to NewStrategySection
  const optionsForCurrentUnderlying = useMemo(() => {
    if (!searchTerm || !getOptionsByUnderlying) {
        // console.log("StrategyVisualizer: searchTerm or getOptionsByUnderlying not ready for optionsForCurrentUnderlying.");
        return [];
    }
    const options = getOptionsByUnderlying(searchTerm);
    //console.log(options)
    // console.log(`StrategyVisualizer: For ${searchTerm}, found ${options?.length || 0} options.`);
    return options || [];

  }, [searchTerm, getOptionsByUnderlying, liveOptionChainMap]); // liveOptionChainMap ensures re-calc on data update

  // --- Loading/Error States for WebSocket/Market Data ---
  if (!SocketIOReadyState || websocketReadyState === SocketIOReadyState.CONNECTING || websocketReadyState === SocketIOReadyState.RECONNECTING) {
    return <div className="loading-overlay">Connecting to Market Data...</div>;
  }
  if (websocketReadyState === SocketIOReadyState.CLOSED && (!liveOptionChainMap || liveOptionChainMap.size === 0)) {
    return <div className="error-overlay">Market data connection closed. Please refresh.</div>;
  }

  // --- Props for Child Components ---
  const commonScenarioProps = { strategyLegs, getOptionByToken, riskFreeRate: RISK_FREE_RATE, getScenarioIV };
  const payoffChartProps = { ...commonScenarioProps, activeChartTab, onChartTabChange: handleChartTabChange, niftyTarget, onNiftyTargetChange: handleNiftyTargetChange, targetDate, onTargetDateChange: handleTargetDateChange, liveOptionChainMap, currentUnderlying: searchTerm, multiplyByLotSize, onMultiplyByLotSizeChange: handleMultiplyLotSizeChange, multiplyByNumLots, onMultiplyByNumLotsChange: handleMultiplyNumLotsChange };
  const detailedDataProps = { ...commonScenarioProps, currentUnderlying: searchTerm, projectedNiftyTarget: niftyTarget, projectedTargetDate: targetDate, individualIvAdjustments, onIndividualIvAdjustmentChange: handleIndividualIvAdjustmentChange, onResetAllIvAdjustments: handleResetAllIvAdjustments, globalIvOffset, onGlobalIvOffsetChange: handleGlobalIvOffsetChange, multiplyByLotSize, onMultiplyByLotSizeChange: handleMultiplyLotSizeChange, multiplyByNumLots, onMultiplyByNumLotsChange: handleMultiplyNumLotsChange, liveOptionChainMap };
  
  const readyMadeStrategiesProps = {
    activeMainTab, onMainTabChange: handleMainTabChange,
    currentUnderlying: searchTerm, liveOptionChainMap, getOptionsByUnderlying, getOptionByToken, 
    underlyingSpotPrice, 
    onLoadStrategyLegs: handleLoadStrategyLegsIntoBuilder,
    userPositions, mySavedStrategies, draftStrategies, isLoadingTabData,
  };
  
  const newStrategyProps = {
    strategyLegs, onStrategyLegsChange: handleStrategyLegsChange,
    optionsForSelectedUnderlying: optionsForCurrentUnderlying, // CRITICAL: This provides data for dropdowns
    currentUnderlying: searchTerm,
    onSaveStrategy: handleSaveStrategyFromBuilder, // Callback for "Trade All" / "Add to Drafts"
    getOptionByToken, // For summaries if NewStrategySection needs live data per leg
    underlyingSpotPrice, // For ATM strike calculation in NewStrategySection
  };

  return (
    <div className="strategy-visualizer-container">
      <HeaderSection />
      <TopControlsSection instrumentType={instrumentType} onInstrumentTypeChange={handleInstrumentTypeChange} searchTerm={searchTerm} onSearchTermChange={handleSearchTermChange} availableUnderlyings={availableUnderlyings || []} />
      <ReadyMadeStrategiesSection {...readyMadeStrategiesProps} />
      <NewStrategySection {...newStrategyProps} />
      <PayoffChartSection {...payoffChartProps} />
      <SummaryMetricsSection {...commonScenarioProps} projectedNiftyTarget={niftyTarget} projectedTargetDate={targetDate} />
      <DetailedDataSection {...detailedDataProps} />
    </div>
  );
};
export default React.memo(StrategyVisualizer);
