// src/features/StrategyVisualizer/StrategyVisualizer.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./StrategyVisualizer.scss";
import HeaderSection from "./sections/HeaderSection";
import TopControlsSection from "./sections/TopControlsSection";
import ReadyMadeStrategiesSection from "./sections/ReadyMadeStrategiesSection";
import NewStrategySection from "./sections/NewStrategySection";
import PayoffChartSection from "./sections/PayoffChartSection";
import SummaryMetricsSection from "./sections/SummaryMetricsSection";
import DetailedDataSection from "./sections/DetailedDataSection";
import { useLiveOptionData } from "../../contexts/LiveOptionDataContext";
import { RISK_FREE_RATE, DEFAULT_VOLATILITY } from "../../config";
import { fetchStrategies, saveStrategy } from "../../services/strategyService";

const HARDCODED_USER_ID = "userTest01";

const StrategyVisualizer = () => {
  const {
    liveOptionChainMap,
    websocketReadyState,
    SocketIOReadyState,
    availableUnderlyings,
    getOptionsByUnderlying,
    getOptionByToken,
  } = useLiveOptionData();

  const [instrumentType, setInstrumentType] = useState("index");
  const [searchTerm, setSearchTerm] = useState("");
  const [strategyLegs, setStrategyLegs] = useState([]);
  const [activeChartTab, setActiveChartTab] = useState("payoffgraph");
  const [activeMainTab, setActiveMainTab] = useState("readymade");
  const [multiplier, setMultiplier] = useState(1);
  const [niftyTarget, setNiftyTarget] = useState("");
  const [isNiftyTargetManuallySet, setIsNiftyTargetManuallySet] =
    useState(false);

  const [targetDate, setTargetDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [globalIvOffset, setGlobalIvOffset] = useState(0);
  const [individualIvAdjustments, setIndividualIvAdjustments] = useState({});
  const [multiplyByLotSize, setMultiplyByLotSizeState] = useState(true);
  const [multiplyByNumLots, setMultiplyByNumLotsState] = useState(true);
  
  const [userPositions, setUserPositions] = useState([]);
  const [mySavedStrategies, setMySavedStrategies] = useState([]);
  const [draftStrategies, setDraftStrategies] = useState([]);
  const [isLoadingTabData, setIsLoadingTabData] = useState({
    positions: false,
    myStrategies: false,
    drafts: false,
  });
  const [sdDays, setSdDays] = useState(7);

  const underlyingSpotPrice = useMemo(() => {
    if (!searchTerm || !liveOptionChainMap || liveOptionChainMap.size === 0)
      return null;
    const anOption = Array.from(liveOptionChainMap.values()).find(
      (opt) => opt.underlying === searchTerm && opt.marketData
    );
    const spot = anOption?.marketData?.spot
      ? parseFloat(anOption.marketData.spot)
      : anOption?.marketData?.futures
      ? parseFloat(anOption.marketData.futures)
      : null;
    return !isNaN(spot) && spot > 0 ? spot : null;
  }, [searchTerm, liveOptionChainMap]);

  useEffect(() => {
    if (
      availableUnderlyings &&
      availableUnderlyings.length > 0 &&
      !searchTerm
    ) {
      setSearchTerm(availableUnderlyings[0]);
      setIsNiftyTargetManuallySet(false);
    } else if (!searchTerm) {
      setIsNiftyTargetManuallySet(false);
    }
  }, [availableUnderlyings, searchTerm]);

  useEffect(() => {
    if (!isNiftyTargetManuallySet && underlyingSpotPrice !== null) {
      setNiftyTarget(underlyingSpotPrice.toFixed(2));
    } else if (
      underlyingSpotPrice === null &&
      !isNiftyTargetManuallySet &&
      niftyTarget !== ""
    ) {
    }
  }, [underlyingSpotPrice, isNiftyTargetManuallySet, niftyTarget]);
console.log(sdDays);
  // useEffect(() => {
  //   const loadActivePositionsForBuilder = async () => {
  //     if (searchTerm && HARDCODED_USER_ID) {
  //       try {
  //         const activeStrategies = await fetchStrategies({
  //           userId: HARDCODED_USER_ID,
  //           status: "active_position",
  //         });
  //         const activeLegsForCurrentUnderlying = activeStrategies
  //           .filter((strategy) => strategy.underlying === searchTerm)
  //           .flatMap((strategy) => strategy.legs || [])
  //           .map((leg) => ({
  //             ...leg,
  //             id:
  //               leg.id ||
  //               `leg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
  //             price: parseFloat(leg.price) || 0,
  //             iv:
  //               leg.iv !== undefined
  //                 ? parseFloat(leg.iv)
  //                 : DEFAULT_VOLATILITY * 100,
  //             lots: parseInt(leg.lots, 10) || 1,
  //             selected: leg.selected !== undefined ? leg.selected : true,
  //           }));
  //         setStrategyLegs(activeLegsForCurrentUnderlying);
  //       } catch (error) {
  //         console.error(
  //           `StrategyVisualizer: Error fetching active positions for builder (underlying: ${searchTerm}):`,
  //           error
  //         );
  //         setStrategyLegs([]);
  //       }
  //     } else if (!searchTerm) {
  //       setStrategyLegs([]);
  //     }
  //   };
  //   loadActivePositionsForBuilder();
  // }, [searchTerm]);

  const handleInstrumentTypeChange = useCallback(
    (type) => setInstrumentType(type),
    []
  );
  const handleSdDaysChange = useCallback((days) => setSdDays(days), []);
  const handleSearchTermChange = useCallback((term) => {
    setSearchTerm(term);
    setIsNiftyTargetManuallySet(false);
  }, []);
  const handleStrategyLegsChange = useCallback((legsUpdater) => {
    if (typeof legsUpdater === "function") setStrategyLegs(legsUpdater);
    else setStrategyLegs(legsUpdater);
  }, []);
  const handleChartTabChange = useCallback((tab) => setActiveChartTab(tab), []);

  const fetchDataForTabDisplay = useCallback(async (status, setter, tabKey) => {
    if (!HARDCODED_USER_ID) {
      setter([]);
      return;
    }
    setIsLoadingTabData((prev) => ({ ...prev, [tabKey]: true }));
    try {
      const strategiesArray = await fetchStrategies({
        status,
        userId: HARDCODED_USER_ID,
      });
      setter(Array.isArray(strategiesArray) ? strategiesArray : []);
    } catch (error) {
      setter([]);
      console.error(
        `StrategyVisualizer: Error fetching ${tabKey} for display:`,
        error.message
      );
    } finally {
      setIsLoadingTabData((prev) => ({ ...prev, [tabKey]: false }));
    }
  }, []);

  const handleMainTabChange = useCallback(
    (tabId) => {
      setActiveMainTab(tabId);
      if (tabId === "positions")
        fetchDataForTabDisplay(
          "active_position",
          setUserPositions,
          "positions"
        );
      else if (tabId === "mystrategies")
        fetchDataForTabDisplay(
          "active_position",
          setMySavedStrategies,
          "myStrategies"
        );
      else if (tabId === "draftportfolios")
        fetchDataForTabDisplay("draft", setDraftStrategies, "drafts");
    },
    [fetchDataForTabDisplay]
  );

  const handleNiftyTargetChange = useCallback((valStr) => {
    const numVal = parseFloat(valStr);
    if (!isNaN(numVal) && numVal >= 0) {
      setNiftyTarget(numVal.toFixed(2));
    } else if (valStr === "") {
      setNiftyTarget("");
    }
    setIsNiftyTargetManuallySet(true);
  }, []);

  const handleResetNiftyTargetToLive = useCallback(() => {
    setIsNiftyTargetManuallySet(false);
    if (underlyingSpotPrice !== null) {
      setNiftyTarget(underlyingSpotPrice.toFixed(2));
    } else {
    }
  }, [underlyingSpotPrice]);

  const handleTargetDateChange = useCallback((val) => setTargetDate(val), []);
  const handleMultiplyLotSizeChange = useCallback(
    (checked) => setMultiplyByLotSizeState(Boolean(checked)),
    []
  );
  const handleMultiplyNumLotsChange = useCallback(
    (checked) => setMultiplyByNumLotsState(Boolean(checked)),
    []
  );
  const handleGlobalIvOffsetChange = useCallback((updater) => {
    const applyUpdate = (prev) =>
      parseFloat(
        Math.max(
          -50,
          Math.min(50, typeof updater === "function" ? updater(prev) : updater)
        ).toFixed(1)
      );
    setGlobalIvOffset(applyUpdate);
  }, []);
  const handleIndividualIvAdjustmentChange = useCallback(
    (legToken, adjustment) => {
      setIndividualIvAdjustments((prev) => ({
        ...prev,
        [legToken]: parseFloat(adjustment) || 0,
      }));
    },
    []
  );
  const handleResetAllIvAdjustments = useCallback(() => {
    setGlobalIvOffset(0);
    setIndividualIvAdjustments({});
  }, []);

  const handleLoadStrategyLegsIntoBuilder = useCallback(
    (legsToLoad, itemStatus) => {
      console.log(legsToLoad)
      const newLegs = legsToLoad.map((leg) => ({
        ...leg,
        id:
          leg.id || `leg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        selected: leg.selected !== undefined ? leg.selected : true,
        price: leg.price !== undefined ? parseFloat(leg.price) : 0,
        iv:
          leg.iv !== undefined ? parseFloat(leg.iv) : DEFAULT_VOLATILITY * 100,
        status: leg.status || itemStatus,
      }));
      setStrategyLegs(newLegs);
      setActiveMainTab("newstrategy");
      setIsNiftyTargetManuallySet(false);
    },
    [setActiveMainTab]
  );

  const handleSaveStrategyFromBuilder = useCallback(
    async (strategyPayloadFromBuilder) => {
      if (!HARDCODED_USER_ID) {
        alert("User ID not set. Cannot save strategy.");
        return;
      }
      try {
        const result = await saveStrategy(strategyPayloadFromBuilder);
        alert(result.message || "Strategy action completed!");
        if (strategyPayloadFromBuilder.status === "active_position") {
          fetchDataForTabDisplay(
            "active_position",
            setUserPositions,
            "positions"
          );
          fetchDataForTabDisplay(
            "active_position",
            setMySavedStrategies,
            "myStrategies"
          );
        } else if (strategyPayloadFromBuilder.status === "draft") {
          fetchDataForTabDisplay("draft", setDraftStrategies, "drafts");
        }
      } catch (error) {
        console.error("Failed to save strategy from builder:", error);
        alert(
          `Error saving strategy: ${error.message || "Unknown server error."}`
        );
      }
    },
    [fetchDataForTabDisplay]
  );

  const getScenarioIV = useCallback(
    (legToken) => {
      const liveOption = getOptionByToken(legToken);
      if (!liveOption || liveOption.iv === undefined) return DEFAULT_VOLATILITY;
      const baseIV = parseFloat(liveOption.iv);
      const indAdj = individualIvAdjustments[legToken] || 0;
      const scenarioIV = baseIV + indAdj + globalIvOffset;
      return Math.max(0.001, scenarioIV / 100);
    },
    [getOptionByToken, individualIvAdjustments, globalIvOffset]
  );

  const optionsForCurrentUnderlying = useMemo(() => {
    if (!searchTerm || !getOptionsByUnderlying) return [];
    const options = getOptionsByUnderlying(searchTerm);
   // console.log(options);
    return options || [];
  }, [searchTerm, getOptionsByUnderlying, liveOptionChainMap]);
 //console.log(strategyLegs)
  if (
    !SocketIOReadyState ||
    websocketReadyState === SocketIOReadyState.CONNECTING ||
    websocketReadyState === SocketIOReadyState.RECONNECTING
  ) {
    return <div className="loading-overlay">Connecting to Market Data...</div>;
  }
  if (
    websocketReadyState === SocketIOReadyState.CLOSED &&
    (!liveOptionChainMap || liveOptionChainMap.size === 0)
  ) {
    return (
      <div className="error-overlay">
        Market data connection closed. Please refresh.
      </div>
    );
  }

  const commonScenarioProps = {
    strategyLegs,
    getOptionByToken,
    riskFreeRate: RISK_FREE_RATE,
    getScenarioIV,
  };
const payoffChartProps = {
    ...commonScenarioProps, // Spreads strategyLegs, getOptionByToken, riskFreeRate, getScenarioIV
    activeChartTab,
    onChartTabChange: handleChartTabChange,
    niftyTarget, // The actual scenario target spot (string)
    onNiftyTargetChange: handleNiftyTargetChange, // Renamed from handleUserSetNiftyTarget for clarity
    onResetNiftyTarget: handleResetNiftyTargetToLive,
    targetDate,
    onTargetDateChange: handleTargetDateChange,
    liveOptionChainMap, 
    currentUnderlying: searchTerm,
    underlyingSpotPrice: underlyingSpotPrice, // Pass the live spot
    multiplyByLotSize,
    onMultiplyByLotSizeChange: handleMultiplyLotSizeChange,
    multiplyByNumLots,
    onMultiplyByNumLotsChange: handleMultiplyNumLotsChange,
    handleSdDaysChange: handleSdDaysChange,
    sdDays, // Pass the SD days for SD bands
    // getScenarioIV is already in commonScenarioProps
     multiplier,
     underlyingSpotPrice
  };
  

  const detailedDataProps = {
    ...commonScenarioProps,
    currentUnderlying: searchTerm,
    projectedNiftyTarget: niftyTarget,
    projectedTargetDate: targetDate,
    individualIvAdjustments,
    onIndividualIvAdjustmentChange: handleIndividualIvAdjustmentChange,
    onResetAllIvAdjustments: handleResetAllIvAdjustments,
    globalIvOffset,
    onGlobalIvOffsetChange: handleGlobalIvOffsetChange,
    multiplyByLotSize,
    onMultiplyByLotSizeChange: handleMultiplyLotSizeChange,
    multiplyByNumLots,
    onMultiplyByNumLotsChange: handleMultiplyNumLotsChange,
    liveOptionChainMap,
    underlyingSpotPrice, // Pass live spot for consistency if needed
    sdDays,
    multiplier
  };
  const readyMadeStrategiesProps = {
    activeMainTab,
    onMainTabChange: handleMainTabChange,
    currentUnderlying: searchTerm,
    liveOptionChainMap,
    getOptionsByUnderlying,
    getOptionByToken,
    underlyingSpotPrice,
    onLoadStrategyLegs: handleLoadStrategyLegsIntoBuilder,
    userPositions,
    mySavedStrategies,
    draftStrategies,
    isLoadingTabData,
  };
  const newStrategyProps = {
    strategyLegs,
    onStrategyLegsChange: handleStrategyLegsChange,
    optionsForSelectedUnderlying: optionsForCurrentUnderlying,
    currentUnderlying: searchTerm,
    onSaveStrategy: handleSaveStrategyFromBuilder,
    getOptionByToken,
    underlyingSpotPrice,
    multiplier,
    setMultiplier,
  };
  console.log(multiplier);
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
      <ReadyMadeStrategiesSection {...readyMadeStrategiesProps} />
      {activeMainTab === "newstrategy" && (
        <NewStrategySection {...newStrategyProps} />
      )}
      <PayoffChartSection {...payoffChartProps} />
      <SummaryMetricsSection
        {...commonScenarioProps}
        projectedNiftyTarget={niftyTarget}
        projectedTargetDate={targetDate}
      />
      <DetailedDataSection {...detailedDataProps} />
    </div>
  );
};
export default React.memo(StrategyVisualizer);
