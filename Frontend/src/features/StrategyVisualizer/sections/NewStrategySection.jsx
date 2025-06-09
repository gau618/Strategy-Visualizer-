// src/features/StrategyVisualizer/sections/NewStrategySection.jsx
import React, { useMemo, useCallback } from "react"; // Existing
import Checkbox from "../../../components/Checkbox/Checkbox"; // Existing
import Button from "../../../components/Button/Button"; // Existing
import StrategyLegRow from "../components/StrategyLegRow"; // Existing
import "./NewStrategySection.scss"; // Existing
import { DEFAULT_VOLATILITY } from "../../../config"; // Existing

const HARDCODED_USER_ID_FOR_SAVE = "userTest01"; // Existing

const NewStrategySection = ({
  // Existing
  strategyLegs, // Existing
  onStrategyLegsChange, // Existing
  tradableInstrumentsForSelectedUnderlying, // MODIFIED: Was optionsForSelectedUnderlying, now { options: [], futures: [] }
  currentUnderlying, // Existing
  onSaveStrategy, // Existing
  getInstrumentByToken, // MODIFIED: Was getOptionByToken
  underlyingSpotPrice, // Existing
  multiplier, // Existing
  setMultiplier, // Existing
}) => {
  // MODIFIED: Total premium calculation now considers legType and uses leg.lotSize for both.
  const { totalPremium, priceGetNet } = useMemo(() => {
    let premium = 0;
    let netPriceValue = 0;
    if (!Array.isArray(strategyLegs))
      return { totalPremium: 0, priceGetNet: 0 };

    strategyLegs
      .filter((l) => l.selected && l.legType)
      .forEach((leg) => {
        // Ensure legType exists
        const legPrice = typeof leg.price === "number" ? leg.price : 0;
        const legLots =
          typeof leg.lots === "number" && leg.lots > 0 ? leg.lots : 1;
        // MODIFIED: Use leg.lotSize for both options and futures, assuming it holds contract size/multiplier
        const legContractSize =
          typeof leg.lotSize === "number" && leg.lotSize > 0 ? leg.lotSize : 1;
        const direction = leg.buySell === "Buy" ? 1 : -1;
        premium += legPrice * direction * legLots * legContractSize * -1; // Standard P&L convention (credit positive)
        netPriceValue += legPrice * direction * -1; // Net price of combined legs (buy positive, sell negative)
      });
    return { totalPremium: premium, priceGetNet: netPriceValue };
  }, [strategyLegs]);

  // MODIFIED: Extract option expiries from the new data structure
  const allOptionExpiries = useMemo(() => {
    if (
      !tradableInstrumentsForSelectedUnderlying?.options ||
      tradableInstrumentsForSelectedUnderlying.options.length === 0
    )
      return [];
    const expiries = [
      ...new Set(
        tradableInstrumentsForSelectedUnderlying.options.map(
          (opt) => opt.expiry
        )
      ),
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
  }, [tradableInstrumentsForSelectedUnderlying]);

  // NEW: Extract future expiries (which are actually contract identifiers/tokens)
  const allFutureExpiries = useMemo(() => {
    if (
      !tradableInstrumentsForSelectedUnderlying?.futures ||
      tradableInstrumentsForSelectedUnderlying.futures.length === 0
    )
      return [];
    // Futures data in tradableInstrumentsForSelectedUnderlying.futures is expected to have:
    // { label: "NIFTY JUL FUT", value: "FUTURE_TOKEN_XYZ", expiryDate: "2024-07-25" (or similar parseable date string) }
    return tradableInstrumentsForSelectedUnderlying.futures
      .map((fut) => ({
        label:
          fut.instrumentSymbol ||
          `${currentUnderlying} ${fut.expiry || "Future"}`, // Display name
        value: fut.token, // The value used for selection will be the future's unique token
        expiryDate: fut.expiryDate || fut.expiry, // For sorting
      }))
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  }, [tradableInstrumentsForSelectedUnderlying, currentUnderlying]);

  // Existing: Get strikes for selected option expiry
  const getStrikesForOptionExpiry = useCallback(
    (expiryDate) => {
      if (!tradableInstrumentsForSelectedUnderlying?.options || !expiryDate)
        return [];
      const strikes = tradableInstrumentsForSelectedUnderlying.options
        .filter((opt) => opt.expiry === expiryDate)
        .map((opt) => Number(opt.strike));
      return [...new Set(strikes)]
        .sort((a, b) => a - b)
        .map((strike) => ({ label: String(strike), value: strike }));
    },
    [tradableInstrumentsForSelectedUnderlying]
  );

  // Existing: Get option types for selected option expiry and strike
  const getTypesForOptionExpiryStrike = useCallback(
    (expiryDate, strikePrice) => {
      if (
        !tradableInstrumentsForSelectedUnderlying?.options ||
        !expiryDate ||
        strikePrice === undefined ||
        strikePrice === null ||
        strikePrice === ""
      )
        return [];
      const types = tradableInstrumentsForSelectedUnderlying.options
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
    [tradableInstrumentsForSelectedUnderlying]
  );

  // Existing: Find specific option details
  const findOptionDetails = useCallback(
    (expiry, strike, optionType) => {
      if (
        !tradableInstrumentsForSelectedUnderlying?.options ||
        !expiry ||
        strike === undefined ||
        strike === null ||
        strike === "" ||
        !optionType
      )
        return null;
      return tradableInstrumentsForSelectedUnderlying.options.find(
        (opt) =>
          opt.expiry === expiry &&
          Number(opt.strike) === Number(strike) &&
          opt.optionType === optionType
      );
    },
    [tradableInstrumentsForSelectedUnderlying]
  );

  // NEW: Find specific future details by its token (which is stored in the 'value' of allFutureExpiries select)
  const findFutureInstrumentDetails = useCallback(
    (futureToken) => {
      if (!tradableInstrumentsForSelectedUnderlying?.futures || !futureToken)
        return null;
      // The `tradableInstrumentsForSelectedUnderlying.futures` array contains the full future objects
      return tradableInstrumentsForSelectedUnderlying.futures.find(
        (fut) => fut.token === futureToken
      );
    },
    [tradableInstrumentsForSelectedUnderlying]
  );

  // MODIFIED: handleAddLeg now accepts a legType parameter
  const handleAddLeg = useCallback(
    (legTypeToAdd = "option") => {
      let newLegBase = {
        id: `leg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        selected: true,
        buySell: "Buy",
        lots: 1,
        price: 0, // Entry Price
        token: "",
        instrumentSymbol: "",
        status: "new_leg",
        legType: legTypeToAdd, // NEW: Set legType based on parameter
        lotSize: 1, // NEW: Initialize lotSize (will be contract size)
      };

      let newLegSpecifics = {};

      if (legTypeToAdd === "option") {
        newLegSpecifics = {
          optionType: "",
          expiry: "",
          strike: "",
          // MODIFIED: Default lotSize for options (can be updated from instrument details)
          lotSize: currentUnderlying?.toUpperCase().includes("BANKNIFTY")
            ? 15
            : currentUnderlying?.toUpperCase().includes("FINNIFTY")
            ? 40
            : 50, // Example defaults
          iv: DEFAULT_VOLATILITY * 100,
        };
        if (allOptionExpiries.length > 0) {
          newLegSpecifics.expiry = allOptionExpiries[0].value;
          const strikesForDefaultExpiry = getStrikesForOptionExpiry(
            newLegSpecifics.expiry
          );
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
            newLegSpecifics.strike = atmStrikeObj.value;
            const typesForDefaultStrike = getTypesForOptionExpiryStrike(
              newLegSpecifics.expiry,
              newLegSpecifics.strike
            );
            newLegSpecifics.optionType =
              typesForDefaultStrike.find((t) => t.value === "CE")?.value ||
              typesForDefaultStrike[0]?.value ||
              "";

            if (newLegSpecifics.optionType) {
              const optionDetails = findOptionDetails(
                newLegSpecifics.expiry,
                newLegSpecifics.strike,
                newLegSpecifics.optionType
              );
              if (optionDetails) {
                newLegBase.price =
                  optionDetails.lastPrice !== undefined
                    ? parseFloat(optionDetails.lastPrice)
                    : 0;
                newLegBase.token = optionDetails.token;
                newLegBase.instrumentSymbol =
                  optionDetails.instrumentSymbol ||
                  optionDetails.symbol ||
                  `${currentUnderlying}${newLegSpecifics.expiry}${newLegSpecifics.strike}${newLegSpecifics.optionType}`;
                // MODIFIED: Use lotSize from optionDetails if available
                newLegSpecifics.lotSize =
                  optionDetails.lotSize ||
                  optionDetails.contractInfo?.lotSize ||
                  newLegSpecifics.lotSize;
                newLegSpecifics.iv =
                  optionDetails.iv !== undefined
                    ? parseFloat(optionDetails.iv)
                    : newLegSpecifics.iv;
              } else {
                newLegBase.instrumentSymbol = `${currentUnderlying}${newLegSpecifics.expiry}${newLegSpecifics.strike}${newLegSpecifics.optionType}`;
              }
            }
          }
        }
      } else if (legTypeToAdd === "future") {
        // NEW: Logic for adding a future leg
        newLegSpecifics = {
          strike: -1,
          expiry: "",
          optionType: " ",
          iv:NaN,
          // MODIFIED: Default lotSize for futures (can be updated from instrument details)
          lotSize: currentUnderlying?.toUpperCase().includes("BANKNIFTY")
            ? 15
            : currentUnderlying?.toUpperCase().includes("FINNIFTY")
            ? 40
            : 50, // Example defaults
        };
        if (allFutureExpiries.length > 0) {
          const defaultFutureToken = allFutureExpiries[0].value; // 'value' is the future's token
    
          const futureDetails = findFutureInstrumentDetails(defaultFutureToken);
        //  console.log("Future Details for default token:", futureDetails);
          if (futureDetails) {
            newLegSpecifics.expiry = futureDetails.expiryDate; // Store the token in the 'expiry' field for selection
            newLegBase.price =
              futureDetails.lastPrice !== undefined
                ? parseFloat(futureDetails.lastPrice)
                : 0;
            newLegBase.token = futureDetails.token; // Same as expiry for futures for simplicity here
            newLegBase.instrumentSymbol =
              futureDetails.instrumentSymbol ||
              futureDetails.symbol ||
              `${currentUnderlying} Future`; // Use a descriptive symbol
            // MODIFIED: Use lotSize from futureDetails if available
            newLegSpecifics.lotSize =
              futureDetails.lotSize || newLegSpecifics.lotSize;
          }
        }
      }
      onStrategyLegsChange((prev) => [
        ...prev,
        { ...newLegBase, ...newLegSpecifics },
      ]);
    },
    [
      onStrategyLegsChange,
      allOptionExpiries,
      getStrikesForOptionExpiry,
      getTypesForOptionExpiryStrike,
      findOptionDetails,
      allFutureExpiries,
      findFutureInstrumentDetails,
      currentUnderlying,
      underlyingSpotPrice, // NEW: Added future related dependencies
    ]
  );

  // MODIFIED: handleLegChange needs to handle updates for future legs as well
  const handleLegChange = useCallback(
    (legId, field, value) => {
      onStrategyLegsChange((prevLegs) =>
        prevLegs.map((originalLeg) => {
          if (originalLeg.id === legId) {
            const isOriginalLegActivePosition =
              originalLeg.status === "active_position";
            if (isOriginalLegActivePosition && field !== "selected") {
              return originalLeg; // No changes to active positions other than 'selected'
            }

            let updatedLeg = { ...originalLeg, [field]: value };

            // Type conversions and common field updates
            if (field === "lots")
              updatedLeg.lots = Math.max(1, parseInt(value, 10) || 1);
            if (field === "price" && !isOriginalLegActivePosition)
              updatedLeg.price = parseFloat(value) || 0;

            // Option-specific updates
            if (updatedLeg.legType === "option") {
              if (field === "strike")
                updatedLeg.strike = value !== "" ? Number(value) : "";
              if (field === "iv" && !isOriginalLegActivePosition)
                updatedLeg.iv = parseFloat(value) || 0;

              // Cascading updates for NEW, EDITABLE OPTION legs
              if (
                !isOriginalLegActivePosition &&
                (field === "expiry" ||
                  field === "strike" ||
                  field === "optionType")
              ) {
                if (field === "expiry") {
                  // Option expiry changed
                  updatedLeg.strike = "";
                  updatedLeg.optionType = ""; // Reset strike and type
                  const strikesForNewExpiry = getStrikesForOptionExpiry(
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
                    const typesForNewStrike = getTypesForOptionExpiryStrike(
                      updatedLeg.expiry,
                      updatedLeg.strike
                    );
                    updatedLeg.optionType =
                      typesForNewStrike.find((t) => t.value === "CE")?.value ||
                      typesForNewStrike[0]?.value ||
                      "";
                  }
                } else if (field === "strike" && updatedLeg.expiry) {
                  // Option strike changed
                  updatedLeg.optionType = ""; // Reset type
                  const typesForNewStrike = getTypesForOptionExpiryStrike(
                    updatedLeg.expiry,
                    updatedLeg.strike
                  );
                  updatedLeg.optionType =
                    typesForNewStrike.find((t) => t.value === "CE")?.value ||
                    typesForNewStrike[0]?.value ||
                    "";
                }
                // Re-fetch option details
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
                      optionDetails.lotSize ||
                      optionDetails.contractInfo?.lotSize ||
                      updatedLeg.lotSize;
                    if (
                      field !== "price" &&
                      optionDetails.lastPrice !== undefined
                    )
                      updatedLeg.price = parseFloat(optionDetails.lastPrice);
                    if (field !== "iv" && optionDetails.iv !== undefined)
                      updatedLeg.iv = parseFloat(optionDetails.iv);
                  } else {
                    /* Reset if no details */ updatedLeg.token = "";
                    updatedLeg.instrumentSymbol = `${currentUnderlying}${updatedLeg.expiry}${updatedLeg.strike}${updatedLeg.optionType}`;
                  }
                } else {
                  updatedLeg.token = "";
                  updatedLeg.instrumentSymbol = "";
                }
              }
            } else if (updatedLeg.legType === "future") {
              // NEW: Logic for future leg updates
              // For futures, 'expiry' field holds the selected future contract's TOKEN
              if (field === "expiry" && !isOriginalLegActivePosition) {
                // Future contract changed
                const futureDetails = findFutureInstrumentDetails(value); // 'value' is the future's token
                console.log("Future Details for selected token:", futureDetails);
                if (futureDetails) {
                  updatedLeg.token = futureDetails.token; // Redundant if expiry is token, but good for clarity
                  updatedLeg.expiry=futureDetails.expiry
                  updatedLeg.instrumentSymbol =
                    futureDetails.instrumentSymbol ||
                    futureDetails.symbol ||
                    `${currentUnderlying} Future`;
                  updatedLeg.lotSize =
                    futureDetails.lotSize || updatedLeg.lotSize; // Update lot size
                  if (
                    field !== "price" &&
                    futureDetails.lastPrice !== undefined
                  )
                    updatedLeg.price = parseFloat(futureDetails.lastPrice);
                } else {
                  updatedLeg.token = "";
                  updatedLeg.instrumentSymbol = "";
                }
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
      findFutureInstrumentDetails, // NEW: findFutureInstrumentDetails
      currentUnderlying,
      getStrikesForOptionExpiry,
      getTypesForOptionExpiryStrike,
      underlyingSpotPrice,
    ]
  );
console.log(strategyLegs)
  // Existing: handleRemoveLeg (no changes needed specific to legType beyond UI restrictions)
  const handleRemoveLeg = useCallback(
    (legId) => {
      onStrategyLegsChange((prev) =>
        prev.filter((leg) => {
          if (leg.id === legId && leg.status === "active_position") {
            alert(
              "Active positions cannot be removed directly from the builder. Manage them through your positions list."
            );
            return true; // Keep active position
          }
          return leg.id !== legId; // Remove other legs
        })
      );
    },
    [onStrategyLegsChange]
  );

  // MODIFIED: handleDuplicateLeg needs to handle legType
  const handleDuplicateLeg = useCallback(
    (legId) => {
      const legToDuplicate = strategyLegs.find((l) => l.id === legId);
      if (legToDuplicate) {
        let newPrice = parseFloat(legToDuplicate.price);
        let newIv = undefined; // Only for options

        if (legToDuplicate.legType === "option") {
          const optionDetails = findOptionDetails(
            legToDuplicate.expiry,
            legToDuplicate.strike,
            legToDuplicate.optionType
          );
          if (optionDetails) {
            newPrice =
              optionDetails.lastPrice !== undefined
                ? parseFloat(optionDetails.lastPrice)
                : newPrice;
            newIv =
              optionDetails.iv !== undefined
                ? parseFloat(optionDetails.iv)
                : parseFloat(legToDuplicate.iv);
          } else {
            newIv = parseFloat(legToDuplicate.iv); // Keep original if no live details
          }
        } else if (legToDuplicate.legType === "future") {
          // For futures, expiry field holds the token
          const futureDetails = findFutureInstrumentDetails(
            legToDuplicate.expiry
          );
          if (futureDetails) {
            newPrice =
              futureDetails.lastPrice !== undefined
                ? parseFloat(futureDetails.lastPrice)
                : newPrice;
          }
          // IV is not applicable to futures in this context
        }

        onStrategyLegsChange((prev) => [
          ...prev,
          {
            ...legToDuplicate, // Spread all properties including legType, lotSize etc.
            id: `leg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            selected: true,
            status: "new_leg", // Duplicated leg is always a new, editable leg
            price: newPrice,
            iv: newIv, // This will be undefined for futures, which is correct
          },
        ]);
      }
    },
    [
      strategyLegs,
      onStrategyLegsChange,
      findOptionDetails,
      findFutureInstrumentDetails,
    ]
  ); // NEW: findFutureInstrumentDetails

  // Existing: handleAnalyzeLeg (no direct change, alert is generic)
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

  // Existing: handleClearTrades (no changes needed)
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

  // MODIFIED: handleResetPrices needs to handle legType
  const handleResetPrices = useCallback(() => {
    onStrategyLegsChange((prevLegs) =>
      prevLegs.map((leg) => {
        if (leg.status === "active_position") {
          return leg; // Don't change active positions
        }
        // For new/editable legs, try to fetch current market price
        if (leg.legType === "option") {
          const optDetails = findOptionDetails(
            leg.expiry,
            leg.strike,
            leg.optionType
          );
          if (optDetails && optDetails.lastPrice !== undefined) {
            return { ...leg, price: parseFloat(optDetails.lastPrice) };
          }
        } else if (leg.legType === "future") {
          // For futures, 'expiry' holds the token
          const futDetails = findFutureInstrumentDetails(leg.expiry);
          if (futDetails && futDetails.lastPrice !== undefined) {
            return { ...leg, price: parseFloat(futDetails.lastPrice) };
          }
        }
        return leg; // Return leg unchanged if no details found or not applicable
      })
    );
  }, [onStrategyLegsChange, findOptionDetails, findFutureInstrumentDetails]); // NEW: findFutureInstrumentDetails

  // Existing: selectedTradesCount (no changes needed)
  const selectedTradesCount = useMemo(() => {
    if (!Array.isArray(strategyLegs)) return 0;
    return strategyLegs.filter((l) => l.selected).length;
  }, [strategyLegs]);

  // Existing: allTradesSelected (no changes needed)
  const allTradesSelected = useMemo(() => {
    if (!Array.isArray(strategyLegs) || strategyLegs.length === 0) return false;
    return selectedTradesCount === strategyLegs.length;
  }, [strategyLegs, selectedTradesCount]);

  // Existing: handleSelectAllTrades (no changes needed)
  const handleSelectAllTrades = (isChecked) => {
    onStrategyLegsChange((prev) =>
      prev.map((leg) => ({ ...leg, selected: isChecked }))
    );
  };

  // MODIFIED: handleActionClick for saving strategy, now validates based on legType
  const handleActionClick = (actionStatus, defaultNamePrefix) => {
    // Filter for selected NEW legs (not active positions) that have a legType
    const legsForAction = strategyLegs.filter(
      (leg) => leg.selected && leg.legType
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

    // NEW: Validate legs based on their type
    const legsAreValid = legsForAction.every((leg) => {
      console.log("Validating leg:", leg); // Debugging log
      if (leg.legType === "option") {
        return (
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
      } else if (leg.legType === "future") {
        // For futures, 'expiry' field holds the token/identifier
        return (
          leg.token &&
          leg.instrumentSymbol?.trim() &&
          leg.expiry &&
          leg.buySell &&
          leg.lots >= 1 &&
          typeof leg.price === "number" &&
          leg.lotSize >= 1
        ); // lotSize is contract multiplier
      }
      return false; // Should not happen if legType is defined
    });

    if (!legsAreValid) {
      alert(
        "One or more selected new legs have incomplete or invalid data. Please check all fields (like token, symbol, expiry, strike/type for options, price, lotSize etc.)."
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
      if (!promptedName?.trim()) return; // User cancelled or entered empty name
      strategyName = promptedName.trim();
    }

    const legsToSaveWithStatus = legsForAction.map((leg) => ({
      ...leg,
      status: actionStatus,
    }));

    const payload = {
      userId: HARDCODED_USER_ID_FOR_SAVE,
      underlying: currentUnderlying,
      legs: legsToSaveWithStatus, // These legs now include legType and appropriate fields
      status: actionStatus,
      multiplier: multiplier || 1, // Strategy-level display/analysis multiplier
      name: strategyName,
    };
       console.log(payload)
    onSaveStrategy(payload);
  };

  // NEW: Determine if option/future legs can be added based on available data
  const canAddOptionLeg =
    currentUnderlying &&
    tradableInstrumentsForSelectedUnderlying?.options &&
    tradableInstrumentsForSelectedUnderlying.options.length > 0;
  const canAddFutureLeg =
    currentUnderlying &&
    tradableInstrumentsForSelectedUnderlying?.futures &&
    tradableInstrumentsForSelectedUnderlying.futures.length > 0;

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
              (!tradableInstrumentsForSelectedUnderlying?.options?.length &&
                !tradableInstrumentsForSelectedUnderlying?.futures?.length)
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
          {" "}
          {/* This header row might need adjustment if columns change significantly */}
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
          <span>Expiry / Contract</span> {/* MODIFIED: Generic Header */}
          <span>Strike / Details</span> {/* MODIFIED: Generic Header */}
          <span>Type</span> {/* Primarily for Options, Futures will show '-' */}
          <span>Lots</span>
          <span>Entry Price</span>
          <span>Actions</span>
        </div>
        {Array.isArray(strategyLegs) &&
          strategyLegs.map((leg) => {
            // Pass the correct props to StrategyLegRow
            return (
              <StrategyLegRow
                key={leg.id}
                leg={leg} // leg now has legType
                onLegChange={handleLegChange}
                onRemoveLeg={handleRemoveLeg}
                onDuplicateLeg={handleDuplicateLeg}
                onAnalyzeLeg={handleAnalyzeLeg}
                allOptionExpiries={allOptionExpiries} // Pass option expiries
                allFutureExpiries={allFutureExpiries} // NEW: Pass future expiries/contracts
                getStrikesForOptionExpiry={getStrikesForOptionExpiry} // Pass getter for option strikes
                getTypesForOptionExpiryStrike={getTypesForOptionExpiryStrike} // Pass getter for option types
              />
            );
          })}
        {(!Array.isArray(strategyLegs) || strategyLegs.length === 0) && (
          <div className="no-legs-placeholder">
            Click "Add Option Leg" / "Add Future Leg" or select from lists.
          </div>
        )}
      </div>
      <div className="strategy-leg-summary">
        <label htmlFor="strategyMultiplierInput" style={{ marginRight: "8px" }}>
          Strat Multiplier:
        </label>
        <input
          type="number"
          id="strategyMultiplierInput"
          style={{ width: "60px", marginRight: "16px" }}
          value={multiplier}
          onChange={(e) =>
            setMultiplier(e.target.value ? parseFloat(e.target.value) : 1)
          }
          min="1"
          step="1"
        />
        <span>
          Net Price:{" "}
          <span className={priceGetNet >= 0 ? "pnl-positive" : "pnl-negative"}>
            {" "}
            {Math.abs(priceGetNet).toFixed(2)}{" "}
          </span>{" "}
        </span>
        <span>
          {totalPremium >= 0 ? "Net Credit: " : "Net Debit: "}
          <span className={totalPremium >= 0 ? "pnl-positive" : "pnl-negative"}>
            {Math.abs(totalPremium).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
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
        {/* NEW: Separate buttons for adding Option and Future legs */}
        <Button
          variant="primary"
          onClick={() => handleAddLeg("option")}
          disabled={!canAddOptionLeg}
        >
          {" "}
          Add Option Leg{" "}
        </Button>
        <Button
          variant="primary"
          onClick={() => handleAddLeg("future")}
          disabled={!canAddFutureLeg}
          style={{ marginLeft: "10px" }}
        >
          {" "}
          Add Future Leg{" "}
        </Button>

        <Button
          variant="sell"
          className="sell-btn-footer"
          onClick={() => handleActionClick("active_position", "Trade")}
          disabled={
            strategyLegs.filter(
              (l) => l.selected && l.status !== "active_position" && l.legType
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
              (l) => l.selected && l.status !== "active_position" && l.legType
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
