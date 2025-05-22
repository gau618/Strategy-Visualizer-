// src/features/StrategyVisualizer/sections/NewStrategySection.jsx
import React, { useMemo, useCallback } from 'react';
import Checkbox from '../../../components/Checkbox/Checkbox'; // Adjust path
import Button from '../../../components/Button/Button';       // Adjust path
import StrategyLegRow from '../components/StrategyLegRow';
import './NewStrategySection.scss'; // Make sure this SCSS aligns with the visual

const NewStrategySection = ({
    strategyLegs,
    onStrategyLegsChange,
    optionsForSelectedUnderlying, // Array of all option objects for the current underlying
    currentUnderlying
}) => {

    // --- Data Derivation Functions ---
    const allExpiryOptions = useMemo(() => {
        if (!optionsForSelectedUnderlying || optionsForSelectedUnderlying.length === 0) return [];
        const expiries = [...new Set(optionsForSelectedUnderlying.map(opt => opt.expiry))];
        expiries.sort((a, b) => {
            try {
                const dateA = new Date(a.replace(/(\d{2})([A-Z]{3})(\d{4})/, '$2 $1, $3'));
                const dateB = new Date(b.replace(/(\d{2})([A-Z]{3})(\d{4})/, '$2 $1, $3'));
                if (!isNaN(dateA) && !isNaN(dateB)) return dateA - dateB;
            } catch (e) { /* fallback to string sort */ }
            return a.localeCompare(b);
        });
        return expiries.map(expiry => ({ label: expiry, value: expiry }));
    }, [optionsForSelectedUnderlying]);

    const getStrikesForExpiry = useCallback((expiryDate) => {
        if (!optionsForSelectedUnderlying || !expiryDate) return [];
        const strikes = optionsForSelectedUnderlying
            .filter(opt => opt.expiry === expiryDate)
            .map(opt => Number(opt.strike));
        const uniqueStrikes = [...new Set(strikes)].sort((a, b) => a - b);
        return uniqueStrikes.map(strike => ({
            label: `+ ${strike.toFixed(0)}`, // Format for display like "+ 23000"
            value: strike
        }));
    }, [optionsForSelectedUnderlying]);

    const getTypesForExpiryStrike = useCallback((expiryDate, strikePrice) => {
        if (!optionsForSelectedUnderlying || !expiryDate || strikePrice === undefined || strikePrice === null) return [];
        const types = optionsForSelectedUnderlying
            .filter(opt => opt.expiry === expiryDate && Number(opt.strike) === Number(strikePrice))
            .map(opt => opt.optionType);
        const uniqueTypes = [...new Set(types)].sort(); // Should be ['CE', 'PE'] or just one
        return uniqueTypes.map(type => ({ label: type, value: type }));
    }, [optionsForSelectedUnderlying]);

    const findOptionDetails = useCallback((expiry, strike, optionType) => {
        if (!optionsForSelectedUnderlying || !expiry || strike === undefined || strike === null || !optionType) return null;
        return optionsForSelectedUnderlying.find(
            opt => opt.expiry === expiry &&
                   Number(opt.strike) === Number(strike) &&
                   opt.optionType === optionType
        );
    }, [optionsForSelectedUnderlying]);

    // --- Leg Management Handlers ---
    const handleAddLeg = () => {
        let defaultExpiry = '';
        let defaultStrike = '';
        let defaultOptionType = 'CE';
        let defaultPrice = 0;
        let defaultToken = '';
        let defaultLotSize = currentUnderlying?.toUpperCase() === 'BANKNIFTY' ? 15 : (currentUnderlying?.toUpperCase() === 'NIFTY' ? 50 : 25); // Default

        if (allExpiryOptions.length > 0) {
            defaultExpiry = allExpiryOptions[0].value;
            const strikesForDefaultExpiry = getStrikesForExpiry(defaultExpiry);
            if (strikesForDefaultExpiry.length > 0) {
                const spotPrice = (optionsForSelectedUnderlying.length > 0 && optionsForSelectedUnderlying[0].marketData)
                                  ? parseFloat(optionsForSelectedUnderlying[0].marketData.spot) : 0;
                let atmStrikeObj = strikesForDefaultExpiry[0];
                if (spotPrice > 0 && strikesForDefaultExpiry.length > 1) {
                    atmStrikeObj = strikesForDefaultExpiry.reduce((prev, curr) =>
                        Math.abs(curr.value - spotPrice) < Math.abs(prev.value - spotPrice) ? curr : prev
                    );
                }
                defaultStrike = atmStrikeObj.value;

                const typesForDefault = getTypesForExpiryStrike(defaultExpiry, defaultStrike);
                // Prefer CE if available for ATM, else first available type
                defaultOptionType = typesForDefault.find(t => t.value === 'CE')?.value || (typesForDefault.length > 0 ? typesForDefault[0].value : 'CE');

                const defaultOption = findOptionDetails(defaultExpiry, defaultStrike, defaultOptionType);
                if (defaultOption) {
                    defaultPrice = parseFloat(defaultOption.lastPrice);
                    defaultToken = defaultOption.token;
                    defaultLotSize = defaultOption.contractInfo.lotSize;
                }
            }
        }

        const newLeg = {
            id: Date.now(), selected: true, buySell: 'Buy',
            underlying: currentUnderlying,
            expiry: defaultExpiry,
            strike: defaultStrike,
            optionType: defaultOptionType,
            lots: 1,
            price: defaultPrice,
            token: defaultToken,
            lotSize: defaultLotSize,
        };
        onStrategyLegsChange([...strategyLegs, newLeg]);
    };

    const handleLegChange = (id, field, value) => {
        onStrategyLegsChange(
            strategyLegs.map(leg => {
                if (leg.id === id) {
                    let updatedLeg = { ...leg, [field]: value };

                    // Cascading logic for dependent fields
                    if (field === 'expiry') {
                        const newStrikes = getStrikesForExpiry(updatedLeg.expiry);
                        updatedLeg.strike = newStrikes.length > 0 ? newStrikes[0].value : ''; // Auto-select first strike
                        const newTypes = getTypesForExpiryStrike(updatedLeg.expiry, updatedLeg.strike);
                        // Try to keep the same optionType if available, else default
                        updatedLeg.optionType = newTypes.find(t => t.value === leg.optionType)?.value || (newTypes.length > 0 ? newTypes[0].value : '');
                    } else if (field === 'strike') {
                        updatedLeg.strike = Number(value); // Ensure strike is a number
                        const newTypes = getTypesForExpiryStrike(updatedLeg.expiry, updatedLeg.strike);
                        updatedLeg.optionType = newTypes.find(t => t.value === leg.optionType)?.value || (newTypes.length > 0 ? newTypes[0].value : '');
                    } else if (field === 'optionType') {
                        updatedLeg.optionType = value; // Directly set by user
                    }

                    // After primary fields (expiry, strike, optionType) change, update dependent details
                    if (['expiry', 'strike', 'optionType'].includes(field)) {
                        const matchingOption = findOptionDetails(updatedLeg.expiry, updatedLeg.strike, updatedLeg.optionType);
                        if (matchingOption) {
                            updatedLeg.token = matchingOption.token;
                            updatedLeg.price = parseFloat(matchingOption.lastPrice);
                            updatedLeg.lotSize = matchingOption.contractInfo.lotSize;
                        } else {
                            // If no exact match for the combination, clear token and price
                            updatedLeg.token = '';
                            updatedLeg.price = 0;
                            // Lot size could persist from last valid option or reset to a default.
                            // For simplicity, let's assume it persists unless explicitly changed by a new valid option.
                        }
                    }

                    // Handle direct changes to lots or price
                    if (field === 'lots') updatedLeg.lots = parseInt(value) || 1;
                    if (field === 'price') updatedLeg.price = parseFloat(value) || 0; // Allow manual price override

                    return updatedLeg;
                }
                return leg;
            })
        );
    };

    const handleRemoveLeg = (id) => onStrategyLegsChange(strategyLegs.filter(leg => leg.id !== id));
    const handleDuplicateLeg = (id) => {
        const legToDuplicate = strategyLegs.find(leg => leg.id === id);
        if (legToDuplicate) {
            onStrategyLegsChange([...strategyLegs, { ...legToDuplicate, id: Date.now(), selected: true }]);
        }
    };
    const handleAnalyzeLeg = (id) => {
        const legToAnalyze = strategyLegs.find(l => l.id === id);
        console.log("Analyze leg (NewStrategySection):", legToAnalyze);
        // Implement actual analysis logic or pass to parent
    };
    const handleClearTrades = () => onStrategyLegsChange([]);
    const handleResetPrices = () => {
        onStrategyLegsChange(
            strategyLegs.map(leg => {
                const matchingOption = findOptionDetails(leg.expiry, leg.strike, leg.optionType);
                if (matchingOption) {
                    return { ...leg, price: parseFloat(matchingOption.lastPrice) };
                }
                return leg;
            })
        );
    };

    // --- UI State & Calculations ---
    const selectedTradesCount = strategyLegs.filter(l => l.selected).length;
    const allTradesSelected = strategyLegs.length > 0 && selectedTradesCount === strategyLegs.length;
    const handleSelectAllTrades = (isChecked) => {
        onStrategyLegsChange(strategyLegs.map(leg => ({ ...leg, selected: isChecked })));
    };

    const totalPremium = useMemo(() => {
        return strategyLegs.reduce((sum, leg) => {
            if (leg.selected && leg.price !== undefined && leg.lots && leg.lotSize) {
                const legPremium = leg.lots * leg.price * leg.lotSize * (leg.buySell === 'Buy' ? -1 : 1);
                return sum + legPremium;
            }
            return sum;
        }, 0);
    }, [strategyLegs]);

    const priceGet = useMemo(() => {
        return strategyLegs.reduce((sum, leg) => {
            if (leg.selected && leg.price !== undefined) {
                return sum + (leg.buySell === 'Buy' ? -leg.price : leg.price);
            }
            return sum;
        }, 0);
    }, [strategyLegs]);

    const firstSelectedLegForSummary = useMemo(() => {
        return strategyLegs.find(l => l.selected && l.lotSize !== undefined && l.expiry);
    }, [strategyLegs]);

    return (
        <section className="sv-new-strategy-section">
            <header className="new-strategy-header">
                <h2>New Strategy {currentUnderlying ? `(${currentUnderlying})` : ''}</h2>
                <div className="trade-actions">
                    <Checkbox
                        label={`${selectedTradesCount} trade${selectedTradesCount !== 1 ? 's' : ''} selected`}
                        checked={allTradesSelected}
                        onChange={handleSelectAllTrades}
                        className="select-all-trades-checkbox"
                        disabled={strategyLegs.length === 0}
                    />
                    <Button
                        variant="link"
                        className="clear-trades-btn"
                        onClick={handleClearTrades}
                        disabled={strategyLegs.length === 0}
                    >
                        Clear New Trades
                    </Button>
                    <Button
                        variant="link"
                        onClick={handleResetPrices}
                        disabled={strategyLegs.length === 0 || !optionsForSelectedUnderlying || optionsForSelectedUnderlying.length === 0}
                    >
                        <span className="reset-prices-icon" role="img" aria-label="reset">↻</span> Reset Prices
                    </Button>
                </div>
            </header>

            <div className="strategy-legs-editor">
                <div className="leg-header-row">
                    <Checkbox
                        checked={allTradesSelected}
                        onChange={handleSelectAllTrades}
                        className="leg-header-checkbox"
                        disabled={strategyLegs.length === 0}
                    />
                    <span>B/S</span>
                    <span>Expiry</span>
                    <span>Strike</span>
                    <span>Type</span>
                    <span>Lots</span>
                    <span>Price <span className="info-icon" title="Live option price. Can be manually overridden.">ⓘ</span></span>
                    <span>Actions</span>
                </div>
                {strategyLegs.map(leg => {
                    const strikesForThisLeg = getStrikesForExpiry(leg.expiry);
                    const typesForThisLeg = getTypesForExpiryStrike(leg.expiry, leg.strike);
                    return (
                        <StrategyLegRow
                            key={leg.id}
                            leg={leg}
                            onLegChange={handleLegChange}
                            onRemoveLeg={handleRemoveLeg}
                            onDuplicateLeg={handleDuplicateLeg}
                            onAnalyzeLeg={handleAnalyzeLeg} // Pass the handler
                            allExpiryOptions={allExpiryOptions}
                            strikeOptionsForSelectedExpiry={strikesForThisLeg}
                            typeOptionsForSelectedStrike={typesForThisLeg}
                        />
                    );
                })}
                {strategyLegs.length === 0 && (
                    <div className="no-legs-placeholder">
                        Click "Add/Edit Strategy" or select from "Ready-made" to add trades.
                    </div>
                )}
            </div>

            <div className="strategy-leg-summary">
                <span>
                    Multiplier: {firstSelectedLegForSummary?.lotSize || 'N/A'}
                    {firstSelectedLegForSummary ? ` (${firstSelectedLegForSummary.expiry})` : ''}
                </span>
                <span>
                    {priceGet >= 0 ? 'Price Receive: ' : 'Price Pay: '}
                    <span className={priceGet >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                        {Math.abs(priceGet).toFixed(2)}
                    </span>
                </span>
                <span>
                    {totalPremium >= 0 ? 'Premium Received: ' : 'Premium Paid: '}
                    <span className={totalPremium >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                        {Math.abs(totalPremium).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="info-icon" title="Total cash flow when establishing the strategy.">ⓘ</span>
                </span>
                <Button variant="link" className="charges-btn">Charges</Button>
            </div>

            <div className="strategy-actions-footer">
                <Button
                    variant="primary"
                    onClick={handleAddLeg}
                    disabled={!currentUnderlying || !optionsForSelectedUnderlying || optionsForSelectedUnderlying.length === 0}
                >
                    Add/Edit Strategy
                </Button>
                <Button variant="sell" className="sell-btn-footer">Sell</Button>
                <Button variant="tertiary" icon="💾" className="save-strategy-btn" title="Save Strategy (placeholder)"></Button>
                <Checkbox label="Manual P/L" className="manual-pl-checkbox" />
                <span className="info-icon footer-info-icon" title="Enable manual profit/loss entry.">ⓘ</span>
            </div>
        </section>
    );
};

export default NewStrategySection;
