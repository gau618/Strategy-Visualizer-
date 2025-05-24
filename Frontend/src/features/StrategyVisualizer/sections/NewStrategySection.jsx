// frontend/src/features/StrategyVisualizer/sections/NewStrategySection.jsx
import React, { useMemo, useCallback } from "react";
import Checkbox from "../../../components/Checkbox/Checkbox"; // Adjust path
import Button from "../../../components/Button/Button"; // Adjust path
import StrategyLegRow from "../components/StrategyLegRow"; // Adjust path
import "./NewStrategySection.scss";
import { DEFAULT_VOLATILITY } from "../../../config"; // Your specified path

const HARDCODED_USER_ID_FOR_SAVE = "userTest01";

const NewStrategySection = ({
  strategyLegs,
  onStrategyLegsChange,
  optionsForSelectedUnderlying,
  currentUnderlying,
  onSaveStrategy,
  getOptionByToken,
  underlyingSpotPrice,
}) => {
  // --- 1. Summary Calculations: MUST be defined FIRST ---
  const {
    totalPremium,
    totalDelta,
    totalGamma,
    totalTheta,
    totalVega,
    priceGetNet,
  } = useMemo(() => {
    let premium = 0,
      delta = 0,
      gamma = 0,
      theta = 0,
      vega = 0,
      netPriceValue = 0;
    if (!Array.isArray(strategyLegs)) {
      return {
        totalPremium: 0,
        totalDelta: 0,
        totalGamma: 0,
        totalTheta: 0,
        totalVega: 0,
        priceGetNet: 0,
      };
    }
    strategyLegs
      .filter((l) => l.selected)
      .forEach((leg) => {
        const liveOpt =
          getOptionByToken && leg.token ? getOptionByToken(leg.token) : null;
        const legPrice =
          typeof leg.price === "number" ? leg.price : liveOpt?.lastPrice || 0;
        const legLots =
          typeof leg.lots === "number" && leg.lots > 0 ? leg.lots : 1;
        let legLotSize =
          typeof leg.lotSize === "number" && leg.lotSize > 0 ? leg.lotSize : 0;
        if (legLotSize === 0 && currentUnderlying) {
          if (currentUnderlying.toUpperCase().includes("BANKNIFTY"))
            legLotSize = 15;
          else if (currentUnderlying.toUpperCase().includes("FINNIFTY"))
            legLotSize = 40;
          else if (currentUnderlying.toUpperCase().includes("NIFTY"))
            legLotSize = 50;
          else legLotSize = 1;
        } else if (legLotSize === 0) {
          legLotSize = 1;
        }
        const direction = leg.buySell === "Buy" ? 1 : -1;
        premium += legPrice * direction * legLots * legLotSize * -1; // Debit is negative, Credit is positive
        netPriceValue += legPrice * direction * -1; // Net price of the strategy per share (sum of option prices)
        if (liveOpt) {
          delta += (liveOpt.delta || 0) * direction * legLots * legLotSize;
          gamma += (liveOpt.gamma || 0) * legLots * legLotSize;
          theta += (liveOpt.theta || 0) * direction * legLots * legLotSize;
          vega += (liveOpt.vega || 0) * legLots * legLotSize;
        }
      });
    return {
      totalPremium: premium,
      totalDelta: delta,
      totalGamma: gamma,
      totalTheta: theta,
      totalVega: vega,
      priceGetNet: netPriceValue,
    };
  }, [strategyLegs, getOptionByToken, currentUnderlying]);

  // --- 2. Data Derivation Functions for Dropdowns ---
  const allExpiryOptions = useMemo(() => {
    if (
      !optionsForSelectedUnderlying ||
      optionsForSelectedUnderlying.length === 0
    )
      return [];
    const expiries = [
      ...new Set(optionsForSelectedUnderlying.map((opt) => opt.expiry)),
    ];
    return expiries
      .sort((a, b) => {
        try {
          const dateA = new Date(
            a.replace(/(\d{2})([A-Z]{3})(\d{4})/, "$2 $1, $3")
          );
          const dateB = new Date(
            b.replace(/(\d{2})([A-Z]{3})(\d{4})/, "$2 $1, $3")
          );
          if (!isNaN(dateA) && !isNaN(dateB))
            return dateA.getTime() - dateB.getTime();
        } catch (e) {
          /* fallback */
        }
        return a.localeCompare(b);
      })
      .map((expiry) => ({ label: expiry, value: expiry }));
  }, [optionsForSelectedUnderlying]);

  const getStrikesForExpiry = useCallback(
    (expiryDate) => {
      if (!optionsForSelectedUnderlying || !expiryDate) return [];
      const strikes = optionsForSelectedUnderlying
        .filter((opt) => opt.expiry === expiryDate)
        .map((opt) => Number(opt.strike));
      return [...new Set(strikes)]
        .sort((a, b) => a - b)
        .map((strike) => ({ label: String(strike), value: strike }));
    },
    [optionsForSelectedUnderlying]
  );

  const getTypesForExpiryStrike = useCallback(
    (expiryDate, strikePrice) => {
      if (
        !optionsForSelectedUnderlying ||
        !expiryDate ||
        strikePrice === undefined ||
        strikePrice === null ||
        strikePrice === ""
      )
        return [];
      const types = optionsForSelectedUnderlying
        .filter(
          (opt) =>
            opt.expiry === expiryDate &&
            Number(opt.strike) === Number(strikePrice)
        )
        .map((opt) => opt.optionType);
      return [...new Set(types)]
        .sort()
        .map((type) => ({ label: type, value: type }));
    },
    [optionsForSelectedUnderlying]
  );

  const findOptionDetails = useCallback(
    (expiry, strike, optionType) => {
      if (
        !optionsForSelectedUnderlying ||
        !expiry ||
        strike === undefined ||
        strike === null ||
        strike === "" ||
        !optionType
      )
        return null;
      return optionsForSelectedUnderlying.find(
        (opt) =>
          opt.expiry === expiry &&
          Number(opt.strike) === Number(strike) &&
          opt.optionType === optionType
      );
    },
    [optionsForSelectedUnderlying]
  );

  // --- 3. Leg Management Handlers ---
  const handleAddLeg = useCallback(() => {
    let newLeg = {
      id: `leg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      selected: true,
      buySell: "Buy",
      lots: 1,
      price: 0,
      optionType: "",
      expiry: "",
      strike: "",
      token: "",
      instrumentSymbol: "",
      lotSize: 50,
      iv: DEFAULT_VOLATILITY * 100,
    };
    if (currentUnderlying?.toUpperCase().includes("BANKNIFTY"))
      newLeg.lotSize = 15;
    else if (currentUnderlying?.toUpperCase().includes("FINNIFTY"))
      newLeg.lotSize = 40;
    else if (currentUnderlying?.toUpperCase().includes("NIFTY"))
      newLeg.lotSize = 50;

    if (allExpiryOptions.length > 0) {
      newLeg.expiry = allExpiryOptions[0].value;
      const strikesForDefaultExpiry = getStrikesForExpiry(newLeg.expiry);
      if (strikesForDefaultExpiry.length > 0) {
        let atmStrikeObj =
          strikesForDefaultExpiry[
            Math.floor(strikesForDefaultExpiry.length / 2)
          ];
        if (underlyingSpotPrice && strikesForDefaultExpiry.length > 1) {
          atmStrikeObj = strikesForDefaultExpiry.reduce((prev, curr) =>
            Math.abs(curr.value - underlyingSpotPrice) <
            Math.abs(prev.value - underlyingSpotPrice)
              ? curr
              : prev
          );
        }
        newLeg.strike = atmStrikeObj.value;
        const typesForDefaultStrike = getTypesForExpiryStrike(
          newLeg.expiry,
          newLeg.strike
        );
        newLeg.optionType =
          typesForDefaultStrike.find((t) => t.value === "CE")?.value ||
          typesForDefaultStrike[0]?.value ||
          "";

        if (newLeg.optionType) {
          const optionDetails = findOptionDetails(
            newLeg.expiry,
            newLeg.strike,
            newLeg.optionType
          );
          if (optionDetails) {
            newLeg.price =
              optionDetails.lastPrice !== undefined
                ? parseFloat(optionDetails.lastPrice)
                : 0;
            newLeg.token = optionDetails.token;
            newLeg.instrumentSymbol =
              optionDetails.instrumentSymbol &&
              optionDetails.instrumentSymbol.trim() !== ""
                ? optionDetails.instrumentSymbol
                : optionDetails.symbol && optionDetails.symbol.trim() !== ""
                ? optionDetails.symbol
                : currentUnderlying &&
                  newLeg.expiry &&
                  newLeg.strike !== "" &&
                  newLeg.optionType
                ? `${currentUnderlying}${newLeg.expiry}${newLeg.strike}${newLeg.optionType}`
                : "";
            newLeg.lotSize = optionDetails.lotSize || newLeg.lotSize;
            newLeg.iv =
              optionDetails.iv !== undefined
                ? parseFloat(optionDetails.iv)
                : newLeg.iv;
          } else {
            newLeg.instrumentSymbol =
              currentUnderlying &&
              newLeg.expiry &&
              newLeg.strike !== "" &&
              newLeg.optionType
                ? `${currentUnderlying}${newLeg.expiry}${newLeg.strike}${newLeg.optionType}`
                : "";
          }
        }
      }
    }
    if (newLeg.instrumentSymbol === undefined) newLeg.instrumentSymbol = "";
    onStrategyLegsChange((prev) => [...prev, newLeg]);
  }, [
    onStrategyLegsChange,
    allExpiryOptions,
    getStrikesForExpiry,
    getTypesForExpiryStrike,
    findOptionDetails,
    currentUnderlying,
    underlyingSpotPrice,
  ]);

  const handleLegChange = useCallback(
    (legId, field, value) => {
      onStrategyLegsChange((prevLegs) =>
        prevLegs.map((leg) => {
          if (leg.id === legId) {
            let updatedLeg = { ...leg, [field]: value };
            if (field === "strike")
              updatedLeg.strike = value !== "" ? Number(value) : "";
            if (field === "lots")
              updatedLeg.lots = Math.max(1, parseInt(value, 10) || 1);
            if (field === "price") updatedLeg.price = parseFloat(value) || 0;
            if (field === "iv") updatedLeg.iv = parseFloat(value) || 0;

            if (field === "expiry") {
              updatedLeg.strike = "";
              updatedLeg.optionType = "";
              const strikesForNewExpiry = getStrikesForExpiry(
                updatedLeg.expiry
              );
              if (strikesForNewExpiry.length > 0) {
                let atmStrikeObj =
                  strikesForNewExpiry[
                    Math.floor(strikesForNewExpiry.length / 2)
                  ];
                if (underlyingSpotPrice && strikesForNewExpiry.length > 1) {
                  atmStrikeObj = strikesForNewExpiry.reduce((prev, curr) =>
                    Math.abs(curr.value - underlyingSpotPrice) <
                    Math.abs(prev.value - underlyingSpotPrice)
                      ? curr
                      : prev
                  );
                }
                updatedLeg.strike = atmStrikeObj.value;
                const typesForNewStrike = getTypesForExpiryStrike(
                  updatedLeg.expiry,
                  updatedLeg.strike
                );
                updatedLeg.optionType =
                  typesForNewStrike.find((t) => t.value === "CE")?.value ||
                  typesForNewStrike[0]?.value ||
                  "";
              }
            } else if (field === "strike" && updatedLeg.expiry) {
              updatedLeg.optionType = "";
              const typesForNewStrike = getTypesForExpiryStrike(
                updatedLeg.expiry,
                updatedLeg.strike
              );
              updatedLeg.optionType =
                typesForNewStrike.find((t) => t.value === "CE")?.value ||
                typesForNewStrike[0]?.value ||
                "";
            }

            if (
              updatedLeg.expiry &&
              updatedLeg.strike !== undefined &&
              updatedLeg.strike !== "" &&
              updatedLeg.optionType
            ) {
              const optionDetails = findOptionDetails(
                updatedLeg.expiry,
                updatedLeg.strike,
                updatedLeg.optionType
              );
              if (optionDetails) {
                updatedLeg.token = optionDetails.token;
                updatedLeg.instrumentSymbol =
                  optionDetails.instrumentSymbol &&
                  optionDetails.instrumentSymbol.trim() !== ""
                    ? optionDetails.instrumentSymbol
                    : optionDetails.symbol && optionDetails.symbol.trim() !== ""
                    ? optionDetails.symbol
                    : currentUnderlying &&
                      updatedLeg.expiry &&
                      updatedLeg.strike !== "" &&
                      updatedLeg.optionType
                    ? `${currentUnderlying}${updatedLeg.expiry}${updatedLeg.strike}${updatedLeg.optionType}`
                    : "";
                updatedLeg.lotSize =
                  optionDetails.lotSize || updatedLeg.lotSize;
                if (field !== "price" && optionDetails.lastPrice !== undefined)
                  updatedLeg.price = parseFloat(optionDetails.lastPrice);
                if (field !== "iv" && optionDetails.iv !== undefined)
                  updatedLeg.iv = parseFloat(optionDetails.iv);
              } else {
                updatedLeg.token = "";
                updatedLeg.instrumentSymbol =
                  currentUnderlying &&
                  updatedLeg.expiry &&
                  updatedLeg.strike !== "" &&
                  updatedLeg.optionType
                    ? `${currentUnderlying}${updatedLeg.expiry}${updatedLeg.strike}${updatedLeg.optionType}`
                    : "";
              }
            } else {
              updatedLeg.token = "";
              updatedLeg.instrumentSymbol = "";
            }
            if (updatedLeg.instrumentSymbol === undefined)
              updatedLeg.instrumentSymbol = "";
            return updatedLeg;
          }
          return leg;
        })
      );
    },
    [
      onStrategyLegsChange,
      findOptionDetails,
      currentUnderlying,
      getStrikesForExpiry,
      getTypesForExpiryStrike,
      underlyingSpotPrice,
    ]
  );

  const handleRemoveLeg = useCallback(
    (legId) =>
      onStrategyLegsChange((prev) => prev.filter((leg) => leg.id !== legId)),
    [onStrategyLegsChange]
  );

  // VVVV COMPLETED VVVV
  const handleDuplicateLeg = useCallback(
    (legId) => {
      const legToDuplicate = strategyLegs.find((l) => l.id === legId);
      if (legToDuplicate) {
        onStrategyLegsChange((prev) => [
          ...prev,
          {
            ...legToDuplicate,
            id: `leg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            selected: true,
          },
        ]);
      }
    },
    [strategyLegs, onStrategyLegsChange]
  );

  // VVVV COMPLETED VVVV
  const handleAnalyzeLeg = useCallback(
    (legId) => {
      const legToAnalyze = strategyLegs.find((l) => l.id === legId);
      console.log("Analyzing Leg (Placeholder):", legToAnalyze);
      // In a real app, this might open a modal with detailed greeks, chart for this leg, etc.
      // Or it might select this leg for a different view in PayoffChartSection or DetailedDataSection.
      if (legToAnalyze) {
        alert(
          `Placeholder for Analyzing Leg: ${
            legToAnalyze.instrumentSymbol || legToAnalyze.id
          }`
        );
      }
    },
    [strategyLegs]
  );

  // VVVV COMPLETED VVVV
  const handleClearTrades = () => {
    onStrategyLegsChange([]);
  };

  // VVVV COMPLETED VVVV
  const handleResetPrices = useCallback(() => {
    onStrategyLegsChange((prevLegs) =>
      prevLegs.map((leg) => {
        const optDetails = findOptionDetails(
          leg.expiry,
          leg.strike,
          leg.optionType
        );
        if (optDetails && optDetails.lastPrice !== undefined) {
          return { ...leg, price: parseFloat(optDetails.lastPrice) };
        }
        return leg;
      })
    );
  }, [onStrategyLegsChange, findOptionDetails]);

  // --- 4. Other UI State derived after summary ---
  // VVVV COMPLETED VVVV
  const selectedTradesCount = useMemo(() => {
    if (!Array.isArray(strategyLegs)) return 0;
    return strategyLegs.filter((l) => l.selected).length;
  }, [strategyLegs]);

  // VVVV COMPLETED VVVV
  const allTradesSelected = useMemo(() => {
    if (!Array.isArray(strategyLegs) || strategyLegs.length === 0) return false;
    return selectedTradesCount === strategyLegs.length;
  }, [strategyLegs, selectedTradesCount]);

  // VVVV COMPLETED VVVV
  const handleSelectAllTrades = (isChecked) => {
    onStrategyLegsChange((prev) =>
      prev.map((leg) => ({ ...leg, selected: isChecked }))
    );
  };

  // VVVV COMPLETED VVVV
  const firstSelectedLegForSummary = useMemo(() => {
    if (!Array.isArray(strategyLegs)) return null;
    return strategyLegs.find(
      (l) => l.selected && typeof l.lotSize === "number" && l.expiry
    );
  }, [strategyLegs]);

  // --- 5. Handlers for "Trade All" and "Add to Drafts" ---
  // VVVV COMPLETED VVVV
  const handleActionClick = (actionStatus, defaultNamePrefix) => {
    if (strategyLegs.length === 0 || !strategyLegs.some((l) => l.selected)) {
      alert("Please add and select at least one leg for the strategy.");
      return;
    }
    if (!currentUnderlying) {
      alert("Please select an underlying instrument first.");
      return;
    }

    const activeLegs = strategyLegs.filter((leg) => leg.selected);
    const legsAreValid = activeLegs.every(
      (leg) =>
        leg.token &&
        typeof leg.instrumentSymbol === "string" &&
        leg.instrumentSymbol.trim() !== "" &&
        leg.expiry &&
        leg.strike !== undefined &&
        leg.strike !== "" &&
        leg.optionType &&
        leg.buySell &&
        typeof leg.lots === "number" &&
        leg.lots >= 1 &&
        typeof leg.price === "number" &&
        typeof leg.lotSize === "number" &&
        leg.lotSize >= 1 &&
        typeof leg.iv === "number"
    );

    if (!legsAreValid) {
      alert(
        "One or more selected legs have incomplete or invalid data. Please ensure all fields (Token, Symbol, Expiry, Strike, Type, B/S, Lots, Price, Lot Size, IV) are correctly set and Symbol is not empty."
      );
      return;
    }

    let strategyName = `${defaultNamePrefix}: ${currentUnderlying} (${new Date().toLocaleDateString(
      "en-CA"
    )})`;
    if (actionStatus === "draft") {
      const promptedName = prompt(
        "Enter a name for this draft strategy:",
        strategyName
      );
      if (!promptedName || promptedName.trim() === "") return;
      strategyName = promptedName.trim();
    }

    const payload = {
      userId: HARDCODED_USER_ID_FOR_SAVE,
      underlying: currentUnderlying,
      legs: activeLegs.map(({ id, selected, ...legData }) => ({
        instrumentSymbol: legData.instrumentSymbol,
        token: legData.token,
        strike: Number(legData.strike),
        optionType: legData.optionType,
        expiry: legData.expiry,
        buySell: legData.buySell,
        lots: Number(legData.lots),
        price: Number(legData.price),
        lotSize: Number(legData.lotSize),
        iv: Number(legData.iv),
      })),
      status: actionStatus,
      name: strategyName,
    };
    onSaveStrategy(payload);
  };

  // --- 6. JSX Return ---
  return (
    <section className="sv-new-strategy-section">
      {/* ... (Full JSX as in the previous "final corrected code" response) ... */}
      <header className="new-strategy-header">
        <h2>
          Strategy Builder {currentUnderlying ? `(${currentUnderlying})` : ""}
        </h2>
        <div className="trade-actions">
          <Checkbox
            label={`${selectedTradesCount} trade${
              selectedTradesCount !== 1 ? "s" : ""
            } selected`}
            checked={allTradesSelected}
            onChange={(e) => handleSelectAllTrades(e.target.checked)}
            className="select-all-trades-checkbox"
            disabled={strategyLegs.length === 0}
          />
          <Button
            variant="link"
            className="clear-trades-btn"
            onClick={handleClearTrades}
            disabled={strategyLegs.length === 0}
          >
            Clear Trades
          </Button>
          <Button
            variant="link"
            onClick={handleResetPrices}
            disabled={
              strategyLegs.length === 0 ||
              !optionsForSelectedUnderlying ||
              optionsForSelectedUnderlying.length === 0
            }
          >
            {" "}
            <span className="reset-prices-icon" role="img" aria-label="reset">
              ↻
            </span>{" "}
            Reset Prices{" "}
          </Button>
        </div>
      </header>
      <div className="strategy-legs-editor">
        <div className="leg-header-row">
          <Checkbox
            checked={allTradesSelected}
            onChange={(e) => handleSelectAllTrades(e.target.checked)}
            className="leg-header-checkbox"
            disabled={strategyLegs.length === 0}
          />
          <span>B/S</span>
          <span>Expiry</span>
          <span>Strike</span>
          <span>Type</span>
          <span>Lots</span>
          <span>
            Price{" "}
            <span
              className="info-icon"
              title="Live option price. Can be manually overridden."
            >
              ⓘ
            </span>
          </span>
          <span>Actions</span>
        </div>
        {Array.isArray(strategyLegs) &&
          strategyLegs.map((leg) => {
            const strikeOptionsForThisLeg = getStrikesForExpiry(leg.expiry);
            const typeOptionsForThisLeg = getTypesForExpiryStrike(
              leg.expiry,
              leg.strike
            );
            return (
              <StrategyLegRow
                key={leg.id}
                leg={leg}
                onLegChange={handleLegChange}
                onRemoveLeg={handleRemoveLeg}
                onDuplicateLeg={handleDuplicateLeg}
                onAnalyzeLeg={handleAnalyzeLeg}
                allExpiryOptions={allExpiryOptions}
                strikeOptionsForSelectedExpiry={strikeOptionsForThisLeg}
                typeOptionsForSelectedStrike={typeOptionsForThisLeg}
              />
            );
          })}
        {(!Array.isArray(strategyLegs) || strategyLegs.length === 0) && (
          <div className="no-legs-placeholder">
            {" "}
            Click "Add/Edit Strategy" or select from "Ready-made" to add trades.{" "}
          </div>
        )}
      </div>
      <div className="strategy-leg-summary">
        <span>
          Multiplier: {firstSelectedLegForSummary?.lotSize || "N/A"}{" "}
          {firstSelectedLegForSummary
            ? `(${firstSelectedLegForSummary.expiry})`
            : ""}
        </span>
        <span>
          Net Price:{" "}
          <span className={priceGetNet >= 0 ? "pnl-positive" : "pnl-negative"}>
            {" "}
            {Math.abs(priceGetNet).toFixed(2)}{" "}
          </span>
        </span>
        <span>
          {totalPremium >= 0 ? "Net Credit: " : "Net Debit: "}{" "}
          <span className={totalPremium >= 0 ? "pnl-positive" : "pnl-negative"}>
            {" "}
            {Math.abs(totalPremium).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
          </span>
          <span
            className="info-icon"
            title="Total cash flow. Positive for credit (received), negative for debit (paid)."
          >
            ⓘ
          </span>
        </span>
      </div>
      <div className="strategy-actions-footer">
        <Button
          variant="primary"
          onClick={handleAddLeg}
          disabled={
            !currentUnderlying ||
            (allExpiryOptions && allExpiryOptions.length === 0)
          }
        >
          Add/Edit Strategy
        </Button>
        <Button
          variant="sell"
          className="sell-btn-footer"
          onClick={() => handleActionClick("active_position", "Trade")}
          disabled={selectedTradesCount === 0}
        >
          Trade All Selected
        </Button>
        <Button
          variant="tertiary"
          icon="💾"
          className="save-strategy-btn"
          title="Save Strategy as Draft"
          onClick={() => handleActionClick("draft", "Draft")}
          disabled={selectedTradesCount === 0}
        >
          Add to Drafts
        </Button>
      </div>
    </section>
  );
};
export default React.memo(NewStrategySection);
