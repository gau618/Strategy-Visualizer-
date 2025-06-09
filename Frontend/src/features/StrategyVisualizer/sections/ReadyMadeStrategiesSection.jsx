// src/features/StrategyVisualizer/sections/ReadyMadeStrategiesSection.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import StrategyTabs from "../components/StrategyTabs";
import Button from "../../../components/Button/Button";
import Select from "../../../components/Select/Select";
import ToggleButtonGroup from "../../../components/ToggleButtonGroup/ToggleButtonGroup";

// MODIFIED: Import new definitions
import {
  OPTION_STRATEGY_DEFINITIONS,
  OPTION_STRATEGY_CATEGORIES,
  FUTURE_STRATEGY_DEFINITIONS,
  FUTURE_STRATEGY_CATEGORIES,
} from "../data/strategyDefinitions";
import { findStrikeByOffsetSteps } from "../../utils/strategyUtils";
import "./ReadyMadeStrategiesSection.scss";
import { DEFAULT_VOLATILITY } from "../../../config";

// Helper to format expiry display
const formatDisplayExpiry = (expiryDDMMMYYYY) => {
  if (
    !expiryDDMMMYYYY ||
    typeof expiryDDMMMYYYY !== "string" ||
    expiryDDMMMYYYY.length < 7
  )
    return expiryDDMMMYYYY;
  try {
    const day = expiryDDMMMYYYY.substring(0, 2);
    const monthStr = expiryDDMMMYYYY.substring(2, 5).toUpperCase();
    const yearSubstring = expiryDDMMMYYYY.substring(5);
    const year =
      yearSubstring.length === 2 ? `20${yearSubstring}` : yearSubstring;
    if (day && monthStr && year && year.length === 4)
      return `${day} ${monthStr} ${year}`;
  } catch (e) {}
  return expiryDDMMMYYYY;
};

// Helper to get leg summary display, handles both option and future legs
const getLegSummaryDisplay = (leg) => {
  if (!leg) return "N/A";
  const action =
    leg.buySell === "Buy" ? "B" : leg.buySell === "Sell" ? "S" : leg.buySell;
  const price = typeof leg.price === "number" ? leg.price.toFixed(2) : "-";
  if (leg.legType === "option") {
    return `${action} ${leg.lots || 1}x ${leg.strike || "STK"}${
      leg.optionType || "OPT"
    } @ ${price}`;
  } else if (leg.legType === "future") {
    return `${action} ${leg.lots || 1}x ${
      leg.instrumentSymbol || "Future"
    } @ ${price}`;
  }
  return "N/A";
};

// Icon components
const IconLoadToBuilder = () => (
  <span className="action-icon icon-load" title="Load to Builder">
    ↗️
  </span>
);
const IconSearch = () => <span className="icon-search-input">🔍</span>;
const IconEmptyBox = ({ className = "empty-state-icon" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20 2H4C2.9 2 2 2.9 2 4V20C2 21.1 2.9 22 4 22H20C21.1 22 22 21.1 22 20V4C22 2.9 21.1 2 20 2ZM20 20H4V4H20V20Z" />
    <path d="M12 6L9 9H11V13H13V9H15L12 6Z" opacity="0.3" />
  </svg>
);

const ReadyMadeStrategiesSection = ({
  activeMainTab,
  onMainTabChange,
  currentUnderlying,
  getTradableInstrumentsByUnderlying,
  getInstrumentByToken,
  underlyingSpotPrice,
  onLoadStrategyLegs,
  userPositions,
  mySavedStrategies,
  draftStrategies,
  isLoadingTabData,
}) => {
  // State to toggle between "Options" and "Futures" for ready-made strategies
  const [readyMadeType, setReadyMadeType] = useState("options");

  // State for the active category filter (e.g., 'Bullish', 'Directional')
  const [activeStrategyCategoryFilter, setActiveStrategyCategoryFilter] =
    useState(
      OPTION_STRATEGY_CATEGORIES[0] // Initialize with the first option category
    );

  // State for option expiry selection
  const [selectedOptionExpiry, setSelectedOptionExpiry] = useState("");
  const [availableOptionExpiries, setAvailableOptionExpiries] = useState([]);

  // NEW: State for selecting future contract series from a dropdown
  const [selectedFutureContractToken, setSelectedFutureContractToken] =
    useState("");
  const [availableFutureContracts, setAvailableFutureContracts] = useState([]);

  // State for searching saved items
  const [searchTermSaved, setSearchTermSaved] = useState("");

  // Main tabs definition
  const mainTabs = useMemo(
    () => [
      { id: "readymade", label: "Ready-made" },
      { id: "positions", label: "Positions" },
      { id: "mystrategies", label: "My Strategies" },
      { id: "draftportfolios", label: "Draft Portfolios" },
      { id: "newstrategy", label: "Builder" },
    ],
    []
  );

  // useEffect to populate EITHER option expiries OR future contracts based on readyMadeType
  useEffect(() => {
    // Guard: Only proceed if in "readymade" tab and underlying/data functions are available
    if (
      activeMainTab !== "readymade" ||
      !currentUnderlying ||
      !getTradableInstrumentsByUnderlying
    ) {
      setAvailableOptionExpiries([]);
      setSelectedOptionExpiry("");
      setAvailableFutureContracts([]);
      setSelectedFutureContractToken("");
      return;
    }

    const instruments = getTradableInstrumentsByUnderlying(currentUnderlying);

    if (readyMadeType === "options") {
      const options = instruments?.options || [];
      if (!options.length) {
        setAvailableOptionExpiries([]);
        setSelectedOptionExpiry("");
        return;
      }
      // Sort and map option expiries for the dropdown
      const uniqueExpiries = [...new Set(options.map((o) => o.expiry))].sort(
        (a, b) => {
          try {
            const dA = new Date(
              a.replace(/(\d{2})([A-Z]{3})(\d{4})/, "$2 $1, $3")
            );
            const dB = new Date(
              b.replace(/(\d{2})([A-Z]{3})(\d{4})/, "$2 $1, $3")
            );
            if (!isNaN(dA) && !isNaN(dB)) return dA.getTime() - dB.getTime();
          } catch (e) {
            /* no-op */
          }
          return a.localeCompare(b);
        }
      );
      const expiryOpts = uniqueExpiries.map((exp) => ({
        label: formatDisplayExpiry(exp),
        value: exp,
      }));
      setAvailableOptionExpiries(expiryOpts);
      // Set default selected option expiry
      if (
        expiryOpts.length > 0 &&
        (!selectedOptionExpiry ||
          !expiryOpts.find((o) => o.value === selectedOptionExpiry))
      ) {
        setSelectedOptionExpiry(expiryOpts[0].value);
      } else if (expiryOpts.length === 0) {
        setSelectedOptionExpiry("");
      }
      // Clear future selection when switching to options
      setAvailableFutureContracts([]);
      setSelectedFutureContractToken("");
    } else if (readyMadeType === "futures") {
      const futures = instruments?.futures || []; // Futures should be pre-sorted by expiry from context
      if (!futures.length) {
        setAvailableFutureContracts([]);
        setSelectedFutureContractToken("");
        return;
      }
      // Map future contracts for the dropdown
      const futureOpts = futures.map((fut) => ({
        label:
          fut.instrumentSymbol ||
          `${currentUnderlying} ${formatDisplayExpiry(
            fut.expiryDate || fut.expiry
          )} FUT`,
        value: fut.token, // The value of the select option is the future's token
      }));
      setAvailableFutureContracts(futureOpts);
      // Set default selected future contract (e.g., the nearest month)
      if (
        futureOpts.length > 0 &&
        (!selectedFutureContractToken ||
          !futureOpts.find((f) => f.value === selectedFutureContractToken))
      ) {
        setSelectedFutureContractToken(futureOpts[0].value);
      } else if (futureOpts.length === 0) {
        setSelectedFutureContractToken("");
      }
      // Clear option selection when switching to futures
      setAvailableOptionExpiries([]);
      setSelectedOptionExpiry("");
    }
  }, [
    activeMainTab,
    currentUnderlying,
    getTradableInstrumentsByUnderlying,
    readyMadeType,
    selectedOptionExpiry,
    selectedFutureContractToken,
  ]);

  // Dynamically get strategy definitions and categories based on readyMadeType
  const currentStrategyDefinitions = useMemo(
    () =>
      readyMadeType === "options"
        ? OPTION_STRATEGY_DEFINITIONS
        : FUTURE_STRATEGY_DEFINITIONS,
    [readyMadeType]
  );
  const currentStrategyCategories = useMemo(
    () =>
      readyMadeType === "options"
        ? OPTION_STRATEGY_CATEGORIES
        : FUTURE_STRATEGY_CATEGORIES,
    [readyMadeType]
  );

  // Reset active category filter when the type of strategies (Options/Futures) changes
  useEffect(() => {
    if (currentStrategyCategories && currentStrategyCategories.length > 0) {
      setActiveStrategyCategoryFilter(currentStrategyCategories[0]);
    } else {
      setActiveStrategyCategoryFilter(""); // Handle cases where categories might be empty
    }
  }, [currentStrategyCategories]); // This effect runs when currentStrategyCategories changes

  // Filter strategies based on the active category
  const filteredReadyMadeStrategies = useMemo(
    () =>
      activeMainTab === "readymade" && activeStrategyCategoryFilter
        ? currentStrategyDefinitions.filter(
            (s) => s.category === activeStrategyCategoryFilter
          )
        : [],
    [activeMainTab, currentStrategyDefinitions, activeStrategyCategoryFilter]
  );

  // Callback to handle selection of a ready-made strategy template
  const handleSelectReadyMadeStrategy = useCallback(
    async (strategyTemplate) => {
      if (!currentUnderlying || !getTradableInstrumentsByUnderlying) {
        alert("Underlying not set or market data access unavailable.");
        return;
      }

      const instruments = getTradableInstrumentsByUnderlying(currentUnderlying);
      const newLegs = [];
      let errorOccurred = false;

      for (const legDef of strategyTemplate.legs) {
        if (legDef.legType === "option") {
          // --- Option Leg Construction ---
          if (
            !selectedOptionExpiry ||
            underlyingSpotPrice === null ||
            underlyingSpotPrice === undefined
          ) {
            alert(
              "Option expiry or spot price missing for constructing option leg."
            );
            errorOccurred = true;
            break;
          }

          // Simplified handling for multi-expiry option strategies like calendars
          let legExpiry = selectedOptionExpiry; // Default to selected expiry
          if (
            strategyTemplate.requiresDifferentExpiries &&
            legDef.expirySelector
          ) {
            if (legDef.expirySelector === "NEXT_AVAILABLE") {
              const optionExpiries = (instruments?.options || [])
                .map((o) => o.expiry)
                .sort(
                  (a, b) =>
                    new Date(
                      a.replace(/(\d{2})([A-Z]{3})(\d{4})/, "$2 $1, $3")
                    ) -
                    new Date(b.replace(/(\d{2})([A-Z]{3})(\d{4})/, "$2 $1, $3"))
                );
              const currentIdx = optionExpiries.indexOf(selectedOptionExpiry);
              if (currentIdx !== -1 && currentIdx + 1 < optionExpiries.length) {
                legExpiry = optionExpiries[currentIdx + 1];
              } else {
                alert(
                  `Cannot find "NEXT_AVAILABLE" expiry for leg in "${strategyTemplate.name}". Using selected expiry.`
                );
                // Fallback to selectedOptionExpiry or handle error
              }
            }
            // 'SELECTED' case uses selectedOptionExpiry by default
          }

          const optionsForLegExpiry = (instruments?.options || []).filter(
            (o) => o.expiry === legExpiry
          );
          if (!optionsForLegExpiry.length) {
            alert(
              `No options for ${currentUnderlying} on ${formatDisplayExpiry(
                legExpiry
              )}.`
            );
            errorOccurred = true;
            break;
          }
          const availableStrikes = [
            ...new Set(optionsForLegExpiry.map((o) => Number(o.strike))),
          ].sort((a, b) => a - b);
          if (!availableStrikes.length) {
            alert(
              `No strikes for ${currentUnderlying} on ${formatDisplayExpiry(
                legExpiry
              )}.`
            );
            errorOccurred = true;
            break;
          }

          const targetStrike = findStrikeByOffsetSteps(
            underlyingSpotPrice,
            availableStrikes,
            legDef.strikeOffsetSteps,
            currentUnderlying
          );
          if (targetStrike === null) {
            alert(
              `Could not determine strike for an option leg in "${strategyTemplate.name}".`
            );
            errorOccurred = true;
            break;
          }
          const optionData = optionsForLegExpiry.find(
            (o) =>
              Number(o.strike) === targetStrike &&
              o.optionType === legDef.optionType
          );
          if (!optionData) {
            alert(
              `Option leg ${targetStrike}${
                legDef.optionType
              } on ${formatDisplayExpiry(legExpiry)} not found for "${
                strategyTemplate.name
              }".`
            );
            errorOccurred = true;
            break;
          }

          let legLotSize =
            optionData.lotSize ||
            optionData.contractInfo?.lotSize ||
            (currentUnderlying.toUpperCase().includes("BANKNIFTY")
              ? 15
              : currentUnderlying.toUpperCase().includes("FINNIFTY")
              ? 40
              : 50);

          newLegs.push({
            id: `leg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            legType: "option",
            token: optionData.token,
            instrumentSymbol:
              optionData.instrumentSymbol ||
              optionData.symbol ||
              `${currentUnderlying} ${legExpiry} ${targetStrike}${legDef.optionType}`,
            strike: String(targetStrike),
            optionType: legDef.optionType,
            expiry: legExpiry,
            buySell: legDef.buySell,
            lots: legDef.lotsRatio || 1,
            price: parseFloat(optionData.lastPrice) || 0,
            lotSize: legLotSize,
            iv: parseFloat(optionData.iv) || DEFAULT_VOLATILITY * 100,
            status: "new_leg",
          });
        } else if (legDef.legType === "future") {
          // --- Future Leg Construction ---
          const availableFutures = instruments?.futures || []; // Assumed sorted by expiry
          if (availableFutures.length === 0) {
            alert(`No futures contracts found for ${currentUnderlying}.`);
            errorOccurred = true;
            break;
          }

          let selectedFutureInstance = null;

          if (legDef.contractSelector === "SELECTED_FROM_DROPDOWN") {
            if (!selectedFutureContractToken) {
              alert(
                "Please select a future contract from the dropdown for this strategy."
              );
              errorOccurred = true;
              break;
            }
            selectedFutureInstance = availableFutures.find(
              (f) => f.token === selectedFutureContractToken
            );
          } else if (legDef.contractSelector === "NEAREST") {
            selectedFutureInstance = availableFutures[0];
          } else if (legDef.contractSelector === "NEXT") {
            if (availableFutures.length > 1)
              selectedFutureInstance = availableFutures[1];
            else {
              alert(
                `Not enough future contracts for 'NEXT' in "${strategyTemplate.name}". Using NEAREST instead.`
              );
              selectedFutureInstance = availableFutures[0];
            }
          } else {
            // Fallback: if no specific selector, use the one selected in dropdown, or nearest if dropdown not used/empty
            selectedFutureInstance = selectedFutureContractToken
              ? availableFutures.find(
                  (f) => f.token === selectedFutureContractToken
                )
              : availableFutures[0];
            if (!selectedFutureInstance && availableFutures.length > 0)
              selectedFutureInstance = availableFutures[0]; // Ensure one is picked
          }

          if (!selectedFutureInstance) {
            alert(
              `Could not select/find future contract for leg in "${strategyTemplate.name}".`
            );
            errorOccurred = true;
            break;
          }

          let legLotSize =
            selectedFutureInstance.lotSize ||
            (currentUnderlying.toUpperCase().includes("BANKNIFTY")
              ? 15
              : currentUnderlying.toUpperCase().includes("FINNIFTY")
              ? 40
              : 50);

          newLegs.push({
            id: `leg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            legType: "future",
            token: selectedFutureInstance.token,
            instrumentSymbol:
              selectedFutureInstance.instrumentSymbol ||
              selectedFutureInstance.symbol ||
              `${currentUnderlying} Future`,
            expiry: selectedFutureInstance.token, // Store TOKEN in expiry field for StrategyLegRow compatibility
            expiryDateDisplay:
              selectedFutureInstance.expiryDate ||
              selectedFutureInstance.expiry, // For display purposes
            buySell: legDef.buySell,
            lots: legDef.lotsRatio || 1,
            price: parseFloat(selectedFutureInstance.lastPrice) || 0,
            lotSize: legLotSize,
            status: "new_leg",
          });
        }
      }

      if (!errorOccurred && newLegs.length > 0)
        onLoadStrategyLegs(newLegs, "new_leg");
      else if (!errorOccurred && strategyTemplate.legs.length > 0)
        alert(
          `Could not construct all legs for "${strategyTemplate.name}". Check data availability.`
        );
      // Error messages handled within the loop
    },
    [
      selectedOptionExpiry,
      underlyingSpotPrice,
      currentUnderlying,
      getTradableInstrumentsByUnderlying,
      onLoadStrategyLegs,
      selectedFutureContractToken, // NEW dependency
    ]
  );

  // Callback to load saved items (strategies, positions, drafts) into the builder
  const handleLoadSavedItemToBuilder = useCallback(
    (savedItem) => {
      if (
        savedItem &&
        Array.isArray(savedItem.legs) &&
        savedItem.legs.length > 0
      ) {
        const legsToLoad = savedItem.legs.map((leg) => {
          let loadedLeg = {
            ...leg,
            price: leg.price !== undefined ? parseFloat(leg.price) : 0,
          };
          if (leg.legType === "option") {
            loadedLeg.strike = Number(leg.strike);
            loadedLeg.iv =
              leg.iv !== undefined
                ? parseFloat(leg.iv)
                : DEFAULT_VOLATILITY * 100;
          }
          loadedLeg.lotSize = Number(leg.lotSize) || 1; // Ensure lotSize is number
          return loadedLeg;
        });
        onLoadStrategyLegs(legsToLoad, savedItem.status);
      } else {
        alert("Cannot load item: Leg data is missing or invalid.");
      }
    },
    [onLoadStrategyLegs]
  );

  // Callback to render the list of saved items (strategies, positions, drafts)
  const renderSavedItemsList = useCallback(
    (items, itemTypeLabel, isLoading, emptyMessage, showSearch = false) => {
      if (isLoading)
        return (
          <div className="tab-content-placeholder loading-state">
            <p>Loading {itemTypeLabel.toLowerCase()}...</p>
          </div>
        );
      const itemsToDisplay =
        showSearch && searchTermSaved
          ? items.filter(
              (item) =>
                item.name
                  ?.toLowerCase()
                  .includes(searchTermSaved.toLowerCase()) ||
                item.underlying
                  ?.toLowerCase()
                  .includes(searchTermSaved.toLowerCase())
            )
          : items;
      if (!Array.isArray(itemsToDisplay) || itemsToDisplay.length === 0)
        return (
          <div className="tab-content-placeholder empty-state">
            {itemTypeLabel === "My Strategies" ? <IconEmptyBox /> : null}{" "}
            <p>
              {searchTermSaved && showSearch
                ? `No results for "${searchTermSaved}".`
                : emptyMessage}
            </p>
          </div>
        );

      return (
        <div
          className={`saved-items-container ${itemTypeLabel
            .toLowerCase()
            .replace(/\s+/g, "-")}-list`}
        >
          {showSearch && (
            <div className="saved-items-search-bar">
              <IconSearch />{" "}
              <input
                type="text"
                placeholder={`Search ${itemTypeLabel.toLowerCase()}...`}
                value={searchTermSaved}
                onChange={(e) => setSearchTermSaved(e.target.value)}
              />
            </div>
          )}
          <div className="saved-items-grid">
            {itemsToDisplay.map((item) => {
              let pnlAbsoluteDisplay = "N/A",
                pnlPercentageDisplay = "",
                pnlClass = "pnl-neutral",
                initialNetValueDisplay = "₹0",
                cardExpiryDisplay = "N/A";
              if (Array.isArray(item.legs) && item.legs.length > 0) {
                const uniqueExpiries = [
                  ...new Set(
                    item.legs
                      .map((leg) => {
                        if (leg.legType === "future") {
                          const instrument = getInstrumentByToken(leg.token);
                          return (
                            instrument?.expiryDate ||
                            instrument?.expiry ||
                            leg.expiryDateDisplay ||
                            leg.expiry
                          );
                        }
                        return leg.expiry;
                      })
                      .filter(Boolean)
                  ),
                ];
                if (uniqueExpiries.length === 1)
                  cardExpiryDisplay = formatDisplayExpiry(uniqueExpiries[0]);
                else if (uniqueExpiries.length > 1)
                  cardExpiryDisplay = "Multi-Expiry";
              }

              if (
                item.status === "active_position" &&
                Array.isArray(item.legs) &&
                item.legs.length > 0
              ) {
                let unrealizedPnl = 0,
                  initialNetDebitCredit = 0;
                item.legs.forEach((leg) => {
                  const instrumentDetails = getInstrumentByToken(leg.token);
                  const entryPrice = parseFloat(leg.price);
                  const currentLtp =
                    instrumentDetails?.lastPrice !== undefined
                      ? parseFloat(instrumentDetails.lastPrice)
                      : entryPrice;
                  const lots = Number(leg.lots) || 1;
                  const legContractSize = Number(leg.lotSize) || 1;
                  const positionMultiplier = lots * legContractSize;
                  let pnlForLegPerUnit = 0;
                  if (leg.buySell === "Buy") {
                    pnlForLegPerUnit = currentLtp - entryPrice;
                    initialNetDebitCredit += entryPrice * positionMultiplier;
                  } else if (leg.buySell === "Sell") {
                    pnlForLegPerUnit = entryPrice - currentLtp;
                    initialNetDebitCredit -= entryPrice * positionMultiplier;
                  }
                  unrealizedPnl += pnlForLegPerUnit * positionMultiplier;
                });
                initialNetValueDisplay = `${
                  initialNetDebitCredit > 0
                    ? "Debit "
                    : initialNetDebitCredit < 0
                    ? "Credit "
                    : ""
                }${Math.abs(initialNetDebitCredit).toLocaleString(undefined, {
                  style: "currency",
                  currency: "INR",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}`;
                const isPnlEffectivelyZero = Math.abs(unrealizedPnl) < 0.01;
                if (isPnlEffectivelyZero) {
                  pnlAbsoluteDisplay = "₹0";
                  pnlPercentageDisplay = "(0.0%)";
                  pnlClass = "pnl-neutral";
                } else {
                  pnlAbsoluteDisplay = `${
                    unrealizedPnl > 0 ? "+" : ""
                  }${unrealizedPnl.toLocaleString(undefined, {
                    style: "currency",
                    currency: "INR",
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}`;
                  if (Math.abs(initialNetDebitCredit) > 0.01) {
                    const pnlPercentage =
                      (unrealizedPnl / Math.abs(initialNetDebitCredit)) * 100;
                    pnlPercentageDisplay = `(${
                      pnlPercentage > 0 ? "+" : ""
                    }${pnlPercentage.toFixed(1)}%)`;
                  } else if (unrealizedPnl !== 0) {
                    pnlPercentageDisplay = `(Abs: ₹${unrealizedPnl.toFixed(
                      0
                    )})`;
                  } else {
                    pnlPercentageDisplay = "(0.0%)";
                  }
                  pnlClass =
                    unrealizedPnl > 0 ? "pnl-positive" : "pnl-negative";
                }
              }
              return (
                <div
                  key={item._id || item.id}
                  className="saved-item-card"
                  onClick={() => handleLoadSavedItemToBuilder(item)}
                  title={`Load "${item.name || "Unnamed Item"}"`}
                >
                  <div className="card-main-content">
                    <div className="card-header">
                      <h3 className="card-title">
                        {item.name || `Unnamed ${itemTypeLabel.slice(0, -1)}`}
                      </h3>
                      {item.status === "active_position" && (
                        <div className={`card-pnl ${pnlClass}`}>
                          <span className="pnl-absolute">
                            {pnlAbsoluteDisplay}
                          </span>
                          {pnlPercentageDisplay && (
                            <span className="pnl-percentage">
                              {pnlPercentageDisplay}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="card-body">
                      <div className="card-detail-row">
                        <span className="card-detail">
                          <span className="detail-label">Underlying:</span>{" "}
                          {item.underlying || "N/A"}
                        </span>{" "}
                        <span className="card-detail">
                          <span className="detail-label">Expiry:</span>{" "}
                          {cardExpiryDisplay}
                        </span>
                      </div>
                      <div className="card-detail-row">
                        <span className="card-detail">
                          <span className="detail-label">Legs:</span>{" "}
                          {Array.isArray(item.legs) ? item.legs.length : 0}
                        </span>{" "}
                        {item.status === "active_position" && (
                          <span className="card-detail card-net-value">
                            <span className="detail-label">Net Value:</span>{" "}
                            {initialNetValueDisplay}
                          </span>
                        )}
                      </div>
                      {Array.isArray(item.legs) && item.legs.length > 0 && (
                        <div className="card-legs-preview">
                          {item.legs.slice(0, 3).map((leg, idx) => (
                            <span key={leg.id || idx} className="leg-chip">
                              {getLegSummaryDisplay(leg)}
                            </span>
                          ))}{" "}
                          {item.legs.length > 3 && (
                            <span className="leg-chip more-legs">
                              +{item.legs.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="card-footer">
                    <span className="card-date">
                      {item.status === "active_position"
                        ? "Traded"
                        : item.status === "draft"
                        ? "Drafted"
                        : "Saved"}
                      :{" "}
                      {new Date(
                        item.entryDate ||
                          item.updatedAt ||
                          item.createdAt ||
                          Date.now()
                      ).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>{" "}
                    <Button
                      variant="icon-only"
                      className="card-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoadSavedItemToBuilder(item);
                      }}
                    >
                      <IconLoadToBuilder />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    },
    [searchTermSaved, getInstrumentByToken, handleLoadSavedItemToBuilder]
  );

  return (
    <section className="sv-ready-made-section">
      <StrategyTabs
        tabs={mainTabs}
        activeTab={activeMainTab}
        onTabChange={onMainTabChange}
      />
      {activeMainTab === "readymade" && (
        <div className="strategy-selection-content">
          {/* Toggle button for Options/Futures */}
          <div className="ready-made-type-toggle-container">
            <ToggleButtonGroup
              options={[
                { label: "Option Strategies", value: "options" },
                { label: "Future Strategies", value: "futures" },
              ]}
              selected={readyMadeType}
              onSelect={(type) => setReadyMadeType(type)}
              className="ready-made-type-toggle"
            />
          </div>

          <p className="selection-prompt">
            Select a ready-made{" "}
            {readyMadeType === "options" ? "OPTION" : "FUTURE"} strategy
          </p>
          <div className="strategy-filters-bar">
            {/* Use dynamic categories based on readyMadeType */}
            {currentStrategyCategories.map((filter) => (
              <Button
                key={filter}
                variant={
                  activeStrategyCategoryFilter === filter
                    ? "primary"
                    : "tertiary"
                }
                className={`filter-button ${
                  activeStrategyCategoryFilter === filter ? "active" : ""
                }`}
                onClick={() => setActiveStrategyCategoryFilter(filter)}
              >
                {filter}
              </Button>
            ))}

            {/* Conditionally render Option Expiry or Future Contract Select */}
            {readyMadeType === "options" && (
              <Select
                options={availableOptionExpiries}
                value={selectedOptionExpiry}
                onChange={setSelectedOptionExpiry}
                className="expiry-select"
                placeholder="Select Option Expiry"
                disabled={
                  availableOptionExpiries.length === 0 || !currentUnderlying
                }
              />
            )}
            {readyMadeType === "futures" && ( // NEW: Dropdown for future contracts
              <Select
                options={availableFutureContracts}
                value={selectedFutureContractToken}
                onChange={setSelectedFutureContractToken}
                className="expiry-select future-contract-select"
                placeholder="Select Future Contract"
                disabled={
                  availableFutureContracts.length === 0 || !currentUnderlying
                }
              />
            )}
          </div>
          <div className="strategy-grid">
            {/* Use dynamic strategy definitions */}
            {filteredReadyMadeStrategies.map((strategy) => (
              <div
                key={strategy.id}
                className="strategy-preview-card"
                onClick={() => handleSelectReadyMadeStrategy(strategy)}
                title={strategy.description || `Load ${strategy.name}`}
              >
                <div className="strategy-chart-placeholder">
                  {strategy.chartIcon ||
                    (readyMadeType === "options" ? "♟️O" : "♟️F")}
                </div>
                <p>{strategy.name}</p>
              </div>
            ))}
            {filteredReadyMadeStrategies.length === 0 &&
              currentUnderlying &&
              activeStrategyCategoryFilter && (
                <p className="no-strategies-message">
                  No "{activeStrategyCategoryFilter}"{" "}
                  {readyMadeType.slice(0, -1)} strategies for{" "}
                  {currentUnderlying}.
                </p>
              )}
            {!currentUnderlying && (
              <p className="no-strategies-message">
                Select an underlying to see strategies.
              </p>
            )}
          </div>
        </div>
      )}
      {/* Render other tabs: positions, mystrategies, drafts */}
      {activeMainTab === "positions" &&
        renderSavedItemsList(
          userPositions,
          "Positions",
          isLoadingTabData.positions,
          "No open positions."
        )}
      {activeMainTab === "mystrategies" &&
        renderSavedItemsList(
          mySavedStrategies,
          "My Strategies",
          isLoadingTabData.myStrategies,
          "No strategies found.",
          true
        )}
      {activeMainTab === "draftportfolios" &&
        renderSavedItemsList(
          draftStrategies,
          "Draft Portfolios",
          isLoadingTabData.drafts,
          "No drafts saved.",
          true
        )}
    </section>
  );
};
export default React.memo(ReadyMadeStrategiesSection);
