// src/features/StrategyVisualizer/components/StrategyLegRow.jsx
import React, { useCallback, useMemo } from 'react'; // Existing
import Checkbox from '../../../components/Checkbox/Checkbox'; // Existing
import ToggleButtonGroup from '../../../components/ToggleButtonGroup/ToggleButtonGroup'; // Existing
import Select from '../../../components/Select/Select'; // Existing
import Input from '../../../components/Input/Input'; // Existing
import Button from '../../../components/Button/Button'; // Existing
import './StrategyLegRow.scss'; // Existing

const StrategyLegRow = ({ // Existing
    leg, // Existing
    onLegChange, // Existing
    onRemoveLeg, // Existing
    onAnalyzeLeg, // Existing
    onDuplicateLeg, // Existing
    allOptionExpiries, // MODIFIED: Renamed from allExpiryOptions for clarity
    allFutureExpiries, // NEW: Prop for future contract expiries/identifiers
    getStrikesForOptionExpiry, // MODIFIED: Renamed for clarity
    getTypesForOptionExpiryStrike // MODIFIED: Renamed for clarity
}) => {
    // Existing: Generate lot options
    const lotOptions = useMemo(() => { // NEW: useMemo for performance
        const options = Array.from({ length: 10 }, (_, i) => ({ label: String(i + 1), value: i + 1 }));
        if (leg.lots > 10 && !options.find(opt => opt.value === leg.lots)) {
            options.push({ label: String(leg.lots), value: leg.lots });
            options.sort((a,b) => a.value - b.value);
        }
        return options;
    }, [leg.lots]);


    // Existing: Handle numeric input changes
    const handleNumericInputChange = useCallback((id, field, stringValue) => { // Existing
        const numericValue = parseFloat(stringValue); // Existing
        if (!isNaN(numericValue) || stringValue === '') { // Existing
            onLegChange(id, field, stringValue === '' ? '' : numericValue); // Existing
        }
    }, [onLegChange]); // MODIFIED: Add onLegChange to dependency array

    // This is the key for disabling UI elements based on the leg's status
    const isReadOnly = leg.status === 'active_position'; // Existing

    // NEW: Memoized function to handle field changes consistently
    const handleFieldChange = useCallback((field, value) => {
        onLegChange(leg.id, field, value);
    }, [leg.id, onLegChange]);

    // NEW: Get available strikes for the selected option expiry
    const strikeOptionsForSelectedOptionExpiry = useMemo(() => {
        if (leg.legType === 'option' && leg.expiry && getStrikesForOptionExpiry) {
            return getStrikesForOptionExpiry(leg.expiry);
        }
        return [];
    }, [leg.legType, leg.expiry, getStrikesForOptionExpiry]);

    // NEW: Get available option types for the selected option expiry and strike
    const typeOptionsForSelectedOptionStrike = useMemo(() => {
        if (leg.legType === 'option' && leg.expiry && leg.strike && getTypesForOptionExpiryStrike) {
            return getTypesForOptionExpiryStrike(leg.expiry, leg.strike);
        }
        return [];
    }, [leg.legType, leg.expiry, leg.strike, getTypesForOptionExpiryStrike]);


    return (
        <div className={`strategy-leg-row ${leg.selected ? 'is-selected' : ''} ${isReadOnly ? 'is-readonly-position' : ''}`}>
            {/* Checkbox is ALWAYS enabled for selection, regardless of isReadOnly */}
            <Checkbox
                checked={leg.selected || false}
                onChange={val => handleFieldChange('selected', typeof val === 'boolean' ? val : val.target.checked)}
                className="leg-checkbox"
            />
            <ToggleButtonGroup
                options={[{ label: 'Buy', value: 'Buy' }, { label: 'Sell', value: 'Sell' }]}
                selected={leg.buySell}
                onSelect={val => handleFieldChange('buySell', val)}
                className="leg-buy-sell"
                disabled={isReadOnly} // UI LOCK: Disable if it's an active position
            />

            {/* MODIFIED: Conditional rendering for Expiry/Contract based on legType */}
            {leg.legType === 'option' && (
                <Select
                    options={allOptionExpiries || []}
                    value={leg.expiry}
                    onChange={val => handleFieldChange('expiry', val)}
                    className="leg-select leg-expiry"
                    placeholder="Expiry"
                    disabled={isReadOnly || !allOptionExpiries || allOptionExpiries.length === 0} // UI LOCK
                />
            )}
            {leg.legType === 'future' && (
                <Select /* NEW: Select for Future Contracts */
                    options={allFutureExpiries || []} // Uses new prop
                    value={leg.expiry} // For futures, 'expiry' field stores the future contract's token/identifier
                    onChange={val => handleFieldChange('expiry', val)}
                    className="leg-select leg-future-contract"
                    placeholder="Contract"
                    disabled={isReadOnly || !allFutureExpiries || allFutureExpiries.length === 0} // UI LOCK
                />
            )}

            {/* MODIFIED: Conditional rendering for Strike based on legType */}
            {leg.legType === 'option' && (
                <Select
                    options={strikeOptionsForSelectedOptionExpiry || []} // MODIFIED: Use memoized strikes
                    value={leg.strike}
                    onChange={val => handleFieldChange('strike', Number(val))}
                    className="leg-select leg-strike"
                    placeholder="Strike"
                    disabled={isReadOnly || !leg.expiry || !strikeOptionsForSelectedOptionExpiry || strikeOptionsForSelectedOptionExpiry.length === 0} // UI LOCK
                />
            )}
            {leg.legType === 'future' && (
                <Input /* NEW: Placeholder or display for future details if needed */
                    type="text"
                    value={leg.instrumentSymbol || 'Future Details'} // Display symbol or a generic placeholder
                    className="leg-future-details-display"
                    readOnly // Typically, future details other than contract selection aren't directly edited here
                    disabled={isReadOnly}
                    title={`Future: ${leg.instrumentSymbol || leg.token || 'N/A'}`}
                />
            )}
            

            {/* MODIFIED: Conditional rendering for Option Type (CE/PE) */}
            {leg.legType === 'option' && (
                 <Select
                    options={typeOptionsForSelectedOptionStrike || []} // MODIFIED: Use memoized types
                    value={leg.optionType}
                    onChange={val => handleFieldChange('optionType', val)}
                    className="leg-select leg-type"
                    placeholder="Type"
                    disabled={isReadOnly || !leg.strike || !typeOptionsForSelectedOptionStrike || typeOptionsForSelectedOptionStrike.length === 0} // UI LOCK
                />
            )}
            {leg.legType === 'future' && (
                <span className="leg-type-placeholder">-</span> // Placeholder for "Type" column for futures
            )}

            <Select
                options={lotOptions}
                value={leg.lots}
                onChange={val => handleFieldChange('lots', parseInt(val) || 1)}
                className="leg-select leg-lots"
                disabled={isReadOnly} // UI LOCK
            />
            <Input
                type="number"
                value={leg.price} // This is entryPrice for active, LTP for new
                onChange={e => handleNumericInputChange(leg.id, 'price', e.target.value)} // Existing logic
                className="leg-price-input"
                step="0.05"
                // MODIFIED: Title includes legType
                title={`Token: ${leg.token || 'N/A'} | Leg Type: ${leg.legType || 'N/A'} | Lot Size: ${leg.lotSize || 'N/A'}${isReadOnly ? ' | Entry Price (Fixed)' : ''}`}
                disabled={isReadOnly} // UI LOCK: Price of an active position is fixed
            />
            <div className="leg-actions">
                <Button variant="icon" onClick={() => onAnalyzeLeg(leg.id)} icon="📈" size="small" title="Analyze Leg" />
                {/* MODIFIED: Duplicate button is not disabled for active positions, it creates a NEW leg */}
                <Button variant="icon" onClick={() => onDuplicateLeg(leg.id)} icon="📋" size="small" title="Duplicate Leg" />
                <Button variant="icon" onClick={() => onRemoveLeg(leg.id)} icon="🗑️" size="small" title="Remove Leg" disabled={isReadOnly} // UI LOCK: Disable remove for active positions
                />
            </div>
        </div>
    );
};

export default React.memo(StrategyLegRow);
