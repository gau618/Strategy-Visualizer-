// src/features/StrategyVisualizer/sections/NewStrategySection.jsx
import React, { useMemo, useCallback } from "react";
import Checkbox from "../../../components/Checkbox/Checkbox";
import Button from "../../../components/Button/Button";
import StrategyLegRow from "../components/StrategyLegRow";
import "./NewStrategySection.scss";
import { DEFAULT_VOLATILITY } from "../../../config";

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
  const { totalPremium, priceGetNet } = useMemo(() => {
    let premium = 0,
      netPriceValue = 0;
    if (!Array.isArray(strategyLegs))
      return { totalPremium: 0, priceGetNet: 0 };

    strategyLegs
      .filter((l) => l.selected)
      .forEach((leg) => {
        const legPrice = typeof leg.price === "number" ? leg.price : 0; // This is entry for active, LTP for new
        const legLots =
          typeof leg.lots === "number" && leg.lots > 0 ? leg.lots : 1;
        let legLotSize =
          typeof leg.lotSize === "number" && leg.lotSize > 0 ? leg.lotSize : 1;
        if (currentUnderlying) {
          if (currentUnderlying.toUpperCase().includes("BANKNIFTY"))
            legLotSize = 15;
          else if (currentUnderlying.toUpperCase().includes("FINNIFTY"))
            legLotSize = 40;
          else if (currentUnderlying.toUpperCase().includes("NIFTY"))
            legLotSize = 50;
        }
        const direction = leg.buySell === "Buy" ? 1 : -1;
        premium += legPrice * direction * legLots * legLotSize * -1;
        netPriceValue += legPrice * direction * -1;
      });
    return { totalPremium: premium, priceGetNet: netPriceValue };
  }, [strategyLegs, currentUnderlying]);

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
      lotSize: 50, // NIFTY default
      iv: DEFAULT_VOLATILITY * 100,
      status: "new_leg", // Mark as a new, editable leg
    };
    if (currentUnderlying?.toUpperCase().includes("BANKNIFTY"))
      newLeg.lotSize = 15;
    else if (currentUnderlying?.toUpperCase().includes("FINNIFTY"))
      newLeg.lotSize = 40;

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
                : 0; // LTP for new leg
            newLeg.token = optionDetails.token;
            newLeg.instrumentSymbol =
              optionDetails.instrumentSymbol ||
              optionDetails.symbol ||
              `${currentUnderlying}${newLeg.expiry}${newLeg.strike}${newLeg.optionType}`;
            newLeg.lotSize = optionDetails.lotSize || newLeg.lotSize;
            newLeg.iv =
              optionDetails.iv !== undefined
                ? parseFloat(optionDetails.iv)
                : newLeg.iv;
          } else {
            newLeg.instrumentSymbol = `${currentUnderlying}${newLeg.expiry}${newLeg.strike}${newLeg.optionType}`;
          }
        }
      }
    }
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
        prevLegs.map((originalLeg) => {
          if (originalLeg.id === legId) {
            const isOriginalLegActivePosition =
              originalLeg.status === "active_position";

            // GUARD: If it's an active position and the field being changed is NOT 'selected',
            // then NO modification should occur to any field other than 'selected'.
            if (isOriginalLegActivePosition && field !== "selected") {
              // console.log(`Blocked change to '${field}' for active position leg:`, originalLeg.instrumentSymbol);
              return originalLeg; // Return the leg unchanged
            }

            let updatedLeg = { ...originalLeg, [field]: value };

            // Standardize certain field types for all legs (even if it's just 'selected' for active ones)
            if (field === "strike")
              updatedLeg.strike = value !== "" ? Number(value) : "";
            if (field === "lots")
              updatedLeg.lots = Math.max(1, parseInt(value, 10) || 1);

            // For price and IV:
            // - If it's an active position, these fields are immutable (originalLeg.price is entry price).
            // - If it's a new leg, allow direct manual change.
            if (field === "price") {
              updatedLeg.price = isOriginalLegActivePosition
                ? originalLeg.price
                : parseFloat(value) || 0;
            }
            if (field === "iv") {
              updatedLeg.iv = isOriginalLegActivePosition
                ? originalLeg.iv
                : parseFloat(value) || 0;
            }

            // This block ONLY runs for NEW, EDITABLE legs.
            // It handles cascading updates when Expiry, Strike, or Type change for a NEW leg.
            if (
              !isOriginalLegActivePosition &&
              (field === "expiry" ||
                field === "strike" ||
                field === "optionType")
            ) {
              if (field === "expiry") {
                updatedLeg.strike = "";
                updatedLeg.optionType = ""; // Reset strike and type when expiry changes
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
                // Strike changed, expiry already set
                updatedLeg.optionType = ""; // Reset type when strike changes
                const typesForNewStrike = getTypesForExpiryStrike(
                  updatedLeg.expiry,
                  updatedLeg.strike
                );
                updatedLeg.optionType =
                  typesForNewStrike.find((t) => t.value === "CE")?.value ||
                  typesForNewStrike[0]?.value ||
                  "";
              }
              // No specific action if only optionType changes, assuming strike/expiry are valid

              // Re-fetch option details based on potentially updated expiry/strike/type for the NEW leg
              if (
                updatedLeg.expiry &&
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
                    optionDetails.instrumentSymbol ||
                    optionDetails.symbol ||
                    `${currentUnderlying}${updatedLeg.expiry}${updatedLeg.strike}${updatedLeg.optionType}`;
                  updatedLeg.lotSize =
                    optionDetails.lotSize || updatedLeg.lotSize; // Use existing if optionDetails doesn't have it

                  // For NEW legs, update price/IV from optionDetails UNLESS the user was MANUALLY editing price/IV.
                  if (
                    field !== "price" &&
                    optionDetails.lastPrice !== undefined
                  ) {
                    updatedLeg.price = parseFloat(optionDetails.lastPrice);
                  }
                  if (field !== "iv" && optionDetails.iv !== undefined) {
                    updatedLeg.iv = parseFloat(optionDetails.iv);
                  }
                } else {
                  // No option details found for the new combination
                  updatedLeg.token = "";
                  updatedLeg.instrumentSymbol = `${currentUnderlying}${updatedLeg.expiry}${updatedLeg.strike}${updatedLeg.optionType}`;
                  if (field !== "price")
                    updatedLeg.price = updatedLeg.price || 0;
                  if (field !== "iv")
                    updatedLeg.iv = updatedLeg.iv || DEFAULT_VOLATILITY * 100;
                }
              } else {
                // Incomplete selection for option details
                updatedLeg.token = "";
                updatedLeg.instrumentSymbol = "";
              }
            }
            return updatedLeg;
          }
          return originalLeg;
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
    (legId) => {
      onStrategyLegsChange((prev) =>
        prev.filter((leg) => {
          if (leg.id === legId && leg.status === "active_position") {
            alert(
              "Active positions cannot be removed directly from the builder. Manage them through your positions list."
            );
            return true;
          }
          return leg.id !== legId;
        })
      );
    },
    [onStrategyLegsChange]
  );

  const handleDuplicateLeg = useCallback(
    (legId) => {
      const legToDuplicate = strategyLegs.find((l) => l.id === legId);
      if (legToDuplicate) {
        const optionDetails = findOptionDetails(
          legToDuplicate.expiry,
          legToDuplicate.strike,
          legToDuplicate.optionType
        );
        onStrategyLegsChange((prev) => [
          ...prev,
          {
            ...legToDuplicate,
            id: `leg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            selected: true,
            status: "new_leg",
            price:
              optionDetails?.lastPrice !== undefined
                ? parseFloat(optionDetails.lastPrice)
                : parseFloat(legToDuplicate.price),
            iv:
              optionDetails?.iv !== undefined
                ? parseFloat(optionDetails.iv)
                : parseFloat(legToDuplicate.iv),
          },
        ]);
      }
    },
    [strategyLegs, onStrategyLegsChange, findOptionDetails]
  );

  const handleAnalyzeLeg = useCallback(
    (legId) => {
      const legToAnalyze = strategyLegs.find((l) => l.id === legId);
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

  const handleClearTrades = () => {
    onStrategyLegsChange((prevLegs) =>
      prevLegs.filter((leg) => leg.status === "active_position")
    );
    if (
      strategyLegs.every((leg) => leg.status === "active_position") &&
      strategyLegs.length > 0
    ) {
      alert(
        "Cannot clear active positions. To start fresh with no legs, please change the underlying instrument."
      );
    }
  };

  const handleResetPrices = useCallback(() => {
    onStrategyLegsChange((prevLegs) =>
      prevLegs.map((leg) => {
        if (leg.status === "active_position") {
          return leg;
        }
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

  const selectedTradesCount = useMemo(() => {
    if (!Array.isArray(strategyLegs)) return 0;
    return strategyLegs.filter((l) => l.selected).length;
  }, [strategyLegs]);

  const allTradesSelected = useMemo(() => {
    if (!Array.isArray(strategyLegs) || strategyLegs.length === 0) return false;
    return selectedTradesCount === strategyLegs.length;
  }, [strategyLegs, selectedTradesCount]);

  const handleSelectAllTrades = (isChecked) => {
    onStrategyLegsChange((prev) =>
      prev.map((leg) => ({ ...leg, selected: isChecked }))
    );
  };

  const firstSelectedLegForSummary = useMemo(() => {
    if (!Array.isArray(strategyLegs)) return null;
    return strategyLegs.find(
      (l) => l.selected && typeof l.lotSize === "number" && l.expiry
    );
  }, [strategyLegs]);

  const handleActionClick = (actionStatus, defaultNamePrefix) => {
    const legsForAction = strategyLegs.filter(
      (leg) => leg.selected && leg.status !== "active_position"
    );

    if (legsForAction.length === 0) {
      alert(
        `Please add and select at least one new leg to ${defaultNamePrefix.toLowerCase()}. Active positions are not re-saved/re-traded from here.`
      );
      return;
    }
    if (!currentUnderlying) {
      alert("Please select an underlying instrument first.");
      return;
    }

    const legsAreValid = legsForAction.every(
      (leg) =>
        leg.token &&
        leg.instrumentSymbol?.trim() &&
        leg.expiry &&
        leg.strike !== "" &&
        leg.optionType &&
        leg.buySell &&
        leg.lots >= 1 &&
        typeof leg.price === "number" &&
        leg.lotSize >= 1 &&
        typeof leg.iv === "number"
    );
    if (!legsAreValid) {
      alert("One or more selected new legs have incomplete or invalid data.");
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
      if (!promptedName?.trim()) return;
      strategyName = promptedName.trim();
    }
        // **MODIFICATION START: Add/Update status for each leg being saved**
    const legsToSaveWithStatus = legsForAction.map(leg => ({
        ...leg, // Spread all existing leg properties
        status: actionStatus // Set/overwrite the status of each leg to the overall actionStatus
                          // e.g., if actionStatus is 'active_position', each leg will also get status: 'active_position'
    }));
    console.log("Saving strategy with legs:", legsToSaveWithStatus);
    const payload = {
      userId: HARDCODED_USER_ID_FOR_SAVE,
      underlying: currentUnderlying,
      legs: legsToSaveWithStatus,
      status: actionStatus,
      name: strategyName,
    };
    onSaveStrategy(payload);
  };

  return (
    <section className="sv-new-strategy-section">
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
            onChange={(e) =>
              handleSelectAllTrades(
                typeof e === "boolean" ? e : e.target.checked
              )
            }
            className="select-all-trades-checkbox"
            disabled={strategyLegs.length === 0}
          />
          <Button
            variant="link"
            className="clear-trades-btn"
            onClick={handleClearTrades}
            disabled={
              strategyLegs.filter((l) => l.status !== "active_position")
                .length === 0
            }
          >
            Clear New Trades
          </Button>
          <Button
            variant="link"
            onClick={handleResetPrices}
            disabled={
              strategyLegs.filter((l) => l.status !== "active_position")
                .length === 0 ||
              !optionsForSelectedUnderlying ||
              optionsForSelectedUnderlying.length === 0
            }
          >
            <span className="reset-prices-icon" role="img" aria-label="reset">
              ↻
            </span>{" "}
            Reset Prices
          </Button>
        </div>
      </header>
      <div className="strategy-legs-editor">
        <div className="leg-header-row">
          <Checkbox
            checked={allTradesSelected}
            onChange={(e) =>
              handleSelectAllTrades(
                typeof e === "boolean" ? e : e.target.checked
              )
            }
            className="leg-header-checkbox"
            disabled={strategyLegs.length === 0}
          />
          <span>B/S</span>
          <span>Expiry</span>
          <span>Strike</span>
          <span>Type</span>
          <span>Lots</span>
          <span>Entry Price</span>
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
            Click "Add New Leg" or select from "Ready-made" / "Positions" to add
            trades. Active positions for the selected underlying will load here.
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
            title="Total cash flow for selected legs. Positive for credit, negative for debit."
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
          Add New Leg
        </Button>
        <Button
          variant="sell"
          className="sell-btn-footer"
          onClick={() => handleActionClick("active_position", "Trade")}
          disabled={
            strategyLegs.filter(
              (l) => l.selected && l.status !== "active_position"
            ).length === 0
          }
        >
          Trade New Selected
        </Button>
        <Button
          variant="tertiary"
          icon="💾"
          className="save-strategy-btn"
          title="Save New Legs as Draft"
          onClick={() => handleActionClick("draft", "Draft")}
          disabled={
            strategyLegs.filter(
              (l) => l.selected && l.status !== "active_position"
            ).length === 0
          }
        >
          Draft New Selected
        </Button>
      </div>
    </section>
  );
};
export default React.memo(NewStrategySection);
