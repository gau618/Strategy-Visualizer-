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
import { generatePayoffGraphData } from "../utils/payoffChartUtils";
import { PAYOFF_GRAPH_POINTS, PAYOFF_GRAPH_INTERVAL_STEP } from "../../config";

const HARDCODED_USER_ID = "userTest01";

const StrategyVisualizer = () => {
  // 1. Get data and functions from the LiveOptionDataContext
  const {
    liveInstrumentChainArray, //All instruments
    websocketReadyState,
    SocketIOReadyState,
    availableUnderlyings,
    getTradableInstrumentsByUnderlying, //To group both options and futures by the underlying.
    getInstrumentByToken, //To find an instrument by token whether it is a future or option
  } = useLiveOptionData();

  // 2. Define the state variables for the strategy visualizer
  const [instrumentType, setInstrumentType] = useState("index"); //To make sure the strategy visualizer can handle both Equity/Index
  const [searchTerm, setSearchTerm] = useState(""); //To ensure that the Search Term can be modified by the underlying
  const [strategyLegs, setStrategyLegs] = useState([]); //Stores all the legs of the strategy(has details for both futures and options)
  const [activeChartTab, setActiveChartTab] = useState("payoffgraph"); //To define which tab is active on the chart.
  const [activeMainTab, setActiveMainTab] = useState("readymade"); //To define what the Active Main Tab is.
  const [multiplier, setMultiplier] = useState(1); // To manage the multiplier for the strategy (lot size etc.)
  const [niftyTarget, setNiftyTarget] = useState(""); // To create a  local nifty target.
  const [isNiftyTargetManuallySet, setIsNiftyTargetManuallySet] =
    useState(false); //To ensure that the nifty target is manually set by the use or the price.
  const [targetDate, setTargetDate] = useState(() => {
    //Local Store for the date.
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [globalIvOffset, setGlobalIvOffset] = useState(0); // Local store for IV offset.
  const [individualIvAdjustments, setIndividualIvAdjustments] = useState({}); //Used to adjust IV.
  const [multiplyByLotSize, setMultiplyByLotSizeState] = useState(true); //Localstate to determine the final P&L w.r.t the lotsize
  const [multiplyByNumLots, setMultiplyByNumLotsState] = useState(true); //Local state to multiply the num of Lots.
  //Loading different tabs.
  const [userPositions, setUserPositions] = useState([]); // Used to load user positions
  const [mySavedStrategies, setMySavedStrategies] = useState([]); // Load saved strategies.
  const [draftStrategies, setDraftStrategies] = useState([]); // Used for drafts.
  const [isLoadingTabData, setIsLoadingTabData] = useState({
    positions: false,
    myStrategies: false,
    drafts: false,
  });
  //console.log(strategyLegs)
  const [sdDays, setSdDays] = useState(7); // Set Standard deviation days to 7 as default.

  const underlyingSpotPrice = useMemo(() => {
    //Get spot price.

    if (
      !searchTerm ||
      !liveInstrumentChainArray ||
      liveInstrumentChainArray.length === 0
    )
      return null;
    //Find instrument by underlying
    const instrument = liveInstrumentChainArray.find(
      (instr) => instr.underlying === searchTerm && instr.marketData
    );
    //Extract data
    const spot = instrument?.marketData?.spot
      ? parseFloat(instrument.marketData.spot)
      : instrument?.marketData?.futures
      ? parseFloat(instrument.marketData.futures)
      : null;
    return !isNaN(spot) && spot > 0 ? spot : null;
  }, [searchTerm, liveInstrumentChainArray]);
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
      const liveOption = getInstrumentByToken(legToken);
      if (!liveOption || liveOption.iv === undefined) return DEFAULT_VOLATILITY;
      const baseIV = parseFloat(liveOption.iv);
      const indAdj = individualIvAdjustments[legToken] || 0;
      const scenarioIV = baseIV + indAdj + globalIvOffset;
      return Math.max(0.001, scenarioIV / 100);
    },
    [getInstrumentByToken, individualIvAdjustments, globalIvOffset]
  );

const tradableInstrumentsForSelectedUnderlying = useMemo(() => {
    if (!searchTerm || !getTradableInstrumentsByUnderlying) return { options: [], futures: [] }; // Default structure
    // This function from context now returns { options: [...], futures: [...] }
    return getTradableInstrumentsByUnderlying(searchTerm);
  }, [searchTerm, getTradableInstrumentsByUnderlying, liveInstrumentChainArray]);
  //console.log(strategyLegs)
  // if (
  //   !SocketIOReadyState ||
  //   websocketReadyState === SocketIOReadyState.CONNECTING ||
  //   websocketReadyState === SocketIOReadyState.RECONNECTING
  // ) {
  //   return <div className="loading-overlay">Connecting to Market Data...</div>;
  // }
  // if (
  //   websocketReadyState === SocketIOReadyState.CLOSED &&
  //   (!liveInstrumentChainArray || liveInstrumentChainArray.length === 0)
  // ) {
  //   return (
  //     <div className="error-overlay">
  //       Market data connection closed. Please refresh.
  //     </div>
  //   );
  // }
  let optionChainArray = [];
  if (liveInstrumentChainArray instanceof Map) {
    optionChainArray = Array.from(liveInstrumentChainArray.values());
  } else if (Array.isArray(liveInstrumentChainArray)) {
    optionChainArray = liveInstrumentChainArray;
    if (optionChainArray.length > 0) {
      const firstElement = optionChainArray[0];
      if (
        Array.isArray(firstElement) &&
        firstElement.length === 2 &&
        firstElement[1] &&
        typeof firstElement[1] === "object" &&
        "strike" in firstElement[1]
      ) {
        optionChainArray = optionChainArray.map((entry) => entry[1]);
      } else if (
        !(
          typeof firstElement === "object" &&
          firstElement !== null &&
          "strike" in firstElement
        )
      ) {
        console.warn(
          "PayoffChart: liveOptionChainMap is an array, but elements don't look like option objects."
        );
        optionChainArray = []; // Clear if format is wrong
      }
    }
  } else if (liveInstrumentChainArray) {
    console.warn(
      "PayoffChart: liveOptionChainMap received is neither a Map nor an Array. OI data will be missing.",
      typeof liveOptionChainMap
    );
  }

  const payoffGraphData = generatePayoffGraphData({
    strategyLegs,
    niftyTarget: niftyTarget.toString(),
    displaySpotForSlider: underlyingSpotPrice,
    targetDateISO: targetDate,
    riskFreeRate: RISK_FREE_RATE,
    getScenarioIV,
    getInstrumentByToken,
    targetInterval: 1000,
    PAYOFF_GRAPH_POINTS,
    PAYOFF_GRAPH_INTERVAL_STEP,
    underlyingSpotPrice, // Pass the actual market spot if needed for specific P&L % base elsewhere
    showPercentage: true,
    sdDays,
    fullOptionChainData: optionChainArray,
  });

  const commonScenarioProps = {
    strategyLegs,
    getInstrumentByToken,
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
    liveOptionChainMap: liveInstrumentChainArray,
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
    underlyingSpotPrice,
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
    liveOptionChainMap: liveInstrumentChainArray,
    underlyingSpotPrice, // Pass live spot for consistency if needed
    sdDays,
    multiplier,
  };
  const readyMadeStrategiesProps = {
    activeMainTab,
    onMainTabChange: handleMainTabChange,
    currentUnderlying: searchTerm,
   liveInstrumentChainArray,
   getTradableInstrumentsByUnderlying, //To group both options and futures by the underlying.
   getInstrumentByToken,
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
    tradableInstrumentsForSelectedUnderlying: tradableInstrumentsForSelectedUnderlying, // MODIFIED: Was optionsForSelectedUnderlying
    currentUnderlying: searchTerm,
    onSaveStrategy: handleSaveStrategyFromBuilder,
    getInstrumentByToken, // MODIFIED
    underlyingSpotPrice,
    multiplier, // Overall strategy multiplier
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
        payoffGraphData={payoffGraphData}
        underlyingSpotPrice={underlyingSpotPrice}
      />
      <DetailedDataSection {...detailedDataProps} />
    </div>
  );
};
export default React.memo(StrategyVisualizer);
