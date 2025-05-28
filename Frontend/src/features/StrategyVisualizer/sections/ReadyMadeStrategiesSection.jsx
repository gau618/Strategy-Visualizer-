// src/features/StrategyVisualizer/sections/ReadyMadeStrategiesSection.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import StrategyTabs from "../components/StrategyTabs";
import Button from "../../../components/Button/Button";
import Select from "../../../components/Select/Select";
import {
  STRATEGY_DEFINITIONS,
  STRATEGY_CATEGORIES,
} from "../data/strategyDefinitions";
import { findStrikeByOffsetSteps } from "../../utils/strategyUtils";
import "./ReadyMadeStrategiesSection.scss";
import { DEFAULT_VOLATILITY } from "../../../config";

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
    const year = expiryDDMMMYYYY.substring(5, 9);
    if (day && monthStr && year && year.length === 4)
      return `${day} ${monthStr} ${year}`;
  } catch (e) {
    /* fallback */
  }
  return expiryDDMMMYYYY;
};
const getLegSummaryDisplay = (leg) => {
  if (!leg) return "N/A";
  const action =
    leg.buySell === "Buy" ? "B" : leg.buySell === "Sell" ? "S" : leg.buySell;
  const price = typeof leg.price === "number" ? leg.price.toFixed(2) : "-";
  return `${action} ${leg.lots || 1}x ${leg.strike || "STK"}${
    leg.optionType || "OPT"
  } @ ${price}`;
};
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
  liveOptionChainMap,
  getOptionsByUnderlying,
  getOptionByToken,
  underlyingSpotPrice,
  onLoadStrategyLegs,
  userPositions,
  mySavedStrategies,
  draftStrategies,
  isLoadingTabData,
}) => {
  const [activeFilter, setActiveFilter] = useState(STRATEGY_CATEGORIES[0]);
  const [selectedExpiry, setSelectedExpiry] = useState("");
  const [availableExpiries, setAvailableExpiries] = useState([]);
  const [searchTermSaved, setSearchTermSaved] = useState("");

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

  useEffect(() => {
    if (
      activeMainTab === "readymade" &&
      currentUnderlying &&
      getOptionsByUnderlying
    ) {
      const options = getOptionsByUnderlying(currentUnderlying);
      if (!options || options.length === 0) {
        setAvailableExpiries([]);
        setSelectedExpiry("");
        return;
      }
      const uniqueExpiries = [...new Set(options.map((o) => o.expiry))].sort(
        (a, b) => {
          try {
            const dA = new Date(
                a.replace(/(\d{2})([A-Z]{3})(\d{4})/, "$2 $1, $3")
              ),
              dB = new Date(b.replace(/(\d{2})([A-Z]{3})(\d{4})/, "$2 $1, $3"));
            if (!isNaN(dA) && !isNaN(dB)) return dA.getTime() - dB.getTime();
          } catch (e) {}
          return a.localeCompare(b);
        }
      );
      const expiryOpts = uniqueExpiries.map((exp) => ({
        label: formatDisplayExpiry(exp),
        value: exp,
      }));
      setAvailableExpiries(expiryOpts);
      if (
        expiryOpts.length > 0 &&
        (!selectedExpiry || !expiryOpts.find((o) => o.value === selectedExpiry))
      ) {
        setSelectedExpiry(expiryOpts[0].value);
      } else if (expiryOpts.length === 0) {
        setSelectedExpiry("");
      }
    }
  }, [
    activeMainTab,
    currentUnderlying,
    getOptionsByUnderlying,
    liveOptionChainMap,
    selectedExpiry,
  ]);

  const filteredReadyMadeStrategies = useMemo(
    () =>
      activeMainTab === "readymade"
        ? STRATEGY_DEFINITIONS.filter((s) => s.category === activeFilter)
        : [],
    [activeMainTab, activeFilter]
  );

  const handleSelectReadyMadeStrategy = useCallback(
    async (strategyTemplate) => {
      if (
        !selectedExpiry ||
        underlyingSpotPrice === null ||
        underlyingSpotPrice === undefined ||
        !liveOptionChainMap ||
        !currentUnderlying
      ) {
        alert("Market data (expiry/spot) missing.");
        return;
      }
      if (strategyTemplate.requiresDifferentExpiries) {
        alert(
          `"${strategyTemplate.name}" requires manual setup for different expiries.`
        );
        return;
      }
      const optionsForSelectedExpiry = Array.from(
        liveOptionChainMap.values()
      ).filter(
        (o) => o.underlying === currentUnderlying && o.expiry === selectedExpiry
      );
      if (!optionsForSelectedExpiry.length) {
        alert(
          `No options for ${currentUnderlying} on ${formatDisplayExpiry(
            selectedExpiry
          )}.`
        );
        return;
      }
      const availableStrikes = [
        ...new Set(optionsForSelectedExpiry.map((o) => Number(o.strike))),
      ].sort((a, b) => a - b);
      if (!availableStrikes.length) {
        alert(
          `No strikes for ${currentUnderlying} on ${formatDisplayExpiry(
            selectedExpiry
          )}.`
        );
        return;
      }

      const newLegs = [];
      let errorOccurred = false;
      for (const legDef of strategyTemplate.legs) {
        const targetStrike = findStrikeByOffsetSteps(
          underlyingSpotPrice,
          availableStrikes,
          legDef.strikeOffsetSteps,
          currentUnderlying
        );
        if (targetStrike === null) {
          alert(
            `Could not determine strike for a leg in "${strategyTemplate.name}".`
          );
          errorOccurred = true;
          break;
        }
        const optionData = optionsForSelectedExpiry.find(
          (o) =>
            Number(o.strike) === targetStrike &&
            o.optionType === legDef.optionType
        );
        if (!optionData) {
          alert(
            `Option leg ${targetStrike}${legDef.optionType} not found for "${strategyTemplate.name}".`
          );
          errorOccurred = true;
          break;
        }
        let legLotSize =
          optionData.lotSize ||
          (currentUnderlying.toUpperCase().includes("BANKNIFTY")
            ? 15
            : currentUnderlying.toUpperCase().includes("FINNIFTY")
            ? 40
            : currentUnderlying.toUpperCase().includes("NIFTY")
            ? 50
            : 1);
        newLegs.push({
          id: `leg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          token: optionData.token,
          instrumentSymbol:
            optionData.instrumentSymbol ||
            optionData.symbol ||
            `${currentUnderlying}${selectedExpiry}${targetStrike}${legDef.optionType}`,
          strike: String(targetStrike),
          optionType: legDef.optionType,
          expiry: selectedExpiry,
          buySell: legDef.buySell,
          lots: legDef.lotsRatio || 1,
          price: parseFloat(optionData.lastPrice) || 0,
          lotSize: legLotSize,
          iv: parseFloat(optionData.iv) || DEFAULT_VOLATILITY * 100,
          status: "new_leg",
        });
      }
      if (!errorOccurred && newLegs.length > 0) {
        onLoadStrategyLegs(newLegs, "new_leg");
      } else if (!errorOccurred && strategyTemplate.legs.length > 0) {
        alert(`Could not construct all legs for "${strategyTemplate.name}".`);
      }
    },
    [
      selectedExpiry,
      underlyingSpotPrice,
      liveOptionChainMap,
      currentUnderlying,
      onLoadStrategyLegs,
    ]
  );

  const handleLoadSavedItemToBuilder = useCallback(
    (savedItem) => {
      if (
        savedItem &&
        Array.isArray(savedItem.legs) &&
        savedItem.legs.length > 0
      ) {
        const legsToLoad = savedItem.legs.map((leg) => ({
          ...leg,
          strike: String(leg.strike),
          price: leg.price !== undefined ? parseFloat(leg.price) : 0,
          iv:
            leg.iv !== undefined
              ? parseFloat(leg.iv)
              : DEFAULT_VOLATILITY * 100,
        }));
        onLoadStrategyLegs(legsToLoad, savedItem.status);
      } else {
        alert("Cannot load item: Leg data is missing or invalid.");
      }
    },
    [onLoadStrategyLegs]
  );

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

      if (!Array.isArray(itemsToDisplay) || itemsToDisplay.length === 0) {
        return (
          <div className="tab-content-placeholder empty-state">
            {" "}
            {itemTypeLabel === "My Strategies" ? <IconEmptyBox /> : null}{" "}
            <p>
              {searchTermSaved && showSearch
                ? `No results for "${searchTermSaved}".`
                : emptyMessage}
            </p>{" "}
          </div>
        );
      }

      return (
        <div
          className={`saved-items-container ${itemTypeLabel
            .toLowerCase()
            .replace(/\s+/g, "-")}-list`}
        >
          {showSearch && (
            <div className="saved-items-search-bar">
              {" "}
              <IconSearch />{" "}
              <input
                type="text"
                placeholder={`Search ${itemTypeLabel.toLowerCase()}...`}
                value={searchTermSaved}
                onChange={(e) => setSearchTermSaved(e.target.value)}
              />{" "}
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
                    item.legs.map((leg) => leg.expiry).filter(Boolean)
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
                  initialNetDebitCredit = 0,
                  pnlDenominator = 0;
                item.legs.forEach((leg) => {
                  const liveOptData = getOptionByToken(leg.token);
                  const entryPrice = parseFloat(leg.price);
                  const currentLtp =
                    liveOptData?.lastPrice !== undefined
                      ? parseFloat(liveOptData.lastPrice)
                      : entryPrice;
                  const lots = Number(leg.lots) || 1;
                  const lotSize = Number(leg.lotSize) || 1;
                  const multiplier = lots * lotSize;
                  if (leg.buySell === "Buy") {
                    unrealizedPnl += (currentLtp - entryPrice) * multiplier;
                    initialNetDebitCredit += entryPrice * multiplier;
                  } else if (leg.buySell === "Sell") {
                    unrealizedPnl += (entryPrice - currentLtp) * multiplier;
                    initialNetDebitCredit -= entryPrice * multiplier;
                  }
                  pnlDenominator += entryPrice * multiplier;
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
                  if (pnlDenominator !== 0) {
                    const pnlPercentage =
                      (unrealizedPnl / Math.abs(pnlDenominator)) * 100;
                    pnlPercentageDisplay = `(${
                      pnlPercentage > 0 ? "+" : ""
                    }${pnlPercentage.toFixed(1)}%)`;
                  } else if (unrealizedPnl !== 0) {
                    pnlPercentageDisplay = `(₹${unrealizedPnl.toFixed(0)})`;
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
                      {" "}
                      <h3 className="card-title">
                        {item.name || `Unnamed ${itemTypeLabel.slice(0, -1)}`}
                      </h3>{" "}
                      {item.status === "active_position" && (
                        <div className={`card-pnl ${pnlClass}`}>
                          {" "}
                          <span className="pnl-absolute">
                            {pnlAbsoluteDisplay}
                          </span>{" "}
                          {pnlPercentageDisplay && (
                            <span className="pnl-percentage">
                              {pnlPercentageDisplay}
                            </span>
                          )}{" "}
                        </div>
                      )}{" "}
                    </div>
                    <div className="card-body">
                      <div className="card-detail-row">
                        {" "}
                        <span className="card-detail">
                          <span className="detail-label">Underlying:</span>{" "}
                          {item.underlying || "N/A"}
                        </span>{" "}
                        <span className="card-detail">
                          <span className="detail-label">Expiry:</span>{" "}
                          {cardExpiryDisplay}
                        </span>{" "}
                      </div>
                      <div className="card-detail-row">
                        {" "}
                        <span className="card-detail">
                          <span className="detail-label">Legs:</span>{" "}
                          {Array.isArray(item.legs) ? item.legs.length : 0}
                        </span>{" "}
                        {item.status === "active_position" && (
                          <span className="card-detail card-net-value">
                            <span className="detail-label">Net Value:</span>{" "}
                            {initialNetValueDisplay}
                          </span>
                        )}{" "}
                      </div>
                      {Array.isArray(item.legs) && item.legs.length > 0 && (
                        <div className="card-legs-preview">
                          {" "}
                          {item.legs.slice(0, 3).map((leg, idx) => (
                            <span key={leg.id || idx} className="leg-chip">
                              {getLegSummaryDisplay(leg)}
                            </span>
                          ))}{" "}
                          {item.legs.length > 3 && (
                            <span className="leg-chip more-legs">
                              +{item.legs.length - 3} more
                            </span>
                          )}{" "}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="card-footer">
                    {" "}
                    <span className="card-date">
                      {" "}
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
                      })}{" "}
                    </span>{" "}
                    <Button
                      variant="icon-only"
                      className="card-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoadSavedItemToBuilder(item);
                      }}
                    >
                      {" "}
                      <IconLoadToBuilder />{" "}
                    </Button>{" "}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    },
    [searchTermSaved, getOptionByToken, handleLoadSavedItemToBuilder]
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
          {" "}
          <p className="selection-prompt">Select a ready-made strategy</p>{" "}
          <div className="strategy-filters-bar">
            {" "}
            {STRATEGY_CATEGORIES.map((filter) => (
              <Button
                key={filter}
                variant={activeFilter === filter ? "primary" : "tertiary"}
                className={`filter-button ${
                  activeFilter === filter ? "active" : ""
                }`}
                onClick={() => setActiveFilter(filter)}
              >
                {" "}
                {filter}{" "}
              </Button>
            ))}{" "}
            <Select
              options={availableExpiries}
              value={selectedExpiry}
              onChange={setSelectedExpiry}
              className="expiry-select"
              placeholder="Select Expiry"
              disabled={availableExpiries.length === 0 || !currentUnderlying}
            />{" "}
          </div>{" "}
          <div className="strategy-grid">
            {" "}
            {filteredReadyMadeStrategies.map((strategy) => (
              <div
                key={strategy.id}
                className="strategy-preview-card"
                onClick={() => handleSelectReadyMadeStrategy(strategy)}
                title={strategy.description || `Load ${strategy.name}`}
              >
                {" "}
                <div className="strategy-chart-placeholder">
                  {strategy.chartIcon || "♟️"}
                </div>{" "}
                <p>{strategy.name}</p>{" "}
              </div>
            ))}{" "}
            {filteredReadyMadeStrategies.length === 0 &&
              currentUnderlying &&
              activeFilter && (
                <p className="no-strategies-message">
                  No "{activeFilter}" strategies for {currentUnderlying}.
                </p>
              )}{" "}
            {!currentUnderlying && (
              <p className="no-strategies-message">Select an underlying.</p>
            )}{" "}
          </div>{" "}
        </div>
      )}
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
