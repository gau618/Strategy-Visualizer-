// src/features/StrategyVisualizer/components/StrategyLegRow.jsx
import React from 'react';
import Checkbox from '../../../components/Checkbox/Checkbox';
import ToggleButtonGroup from '../../../components/ToggleButtonGroup/ToggleButtonGroup';
import Select from '../../../components/Select/Select';
import Input from '../../../components/Input/Input';
import Button from '../../../components/Button/Button';
import './StrategyLegRow.scss';

const StrategyLegRow = ({
    leg,
    onLegChange,
    onRemoveLeg,
    onAnalyzeLeg,
    onDuplicateLeg,
    allExpiryOptions,
    strikeOptionsForSelectedExpiry,
    typeOptionsForSelectedStrike
}) => {
    const lotOptions = Array.from({ length: 10 }, (_, i) => ({ label: String(i + 1), value: i + 1 }));
    if (leg.lots > 10 && !lotOptions.find(opt => opt.value === leg.lots)) {
        lotOptions.push({ label: String(leg.lots), value: leg.lots });
        lotOptions.sort((a,b) => a.value - b.value);
    }

    const handleNumericInputChange = (id, field, stringValue) => {
        const numericValue = parseFloat(stringValue);
        if (!isNaN(numericValue) || stringValue === '') {
            onLegChange(id, field, stringValue === '' ? '' : numericValue);
        }
    };

    // This is the key for disabling UI elements based on the leg's status
    const isReadOnly = leg.status == 'active_position';

    return (
        <div className={`strategy-leg-row ${leg.selected ? 'is-selected' : ''} ${isReadOnly ? 'is-readonly-position' : ''}`}>
            {/* Checkbox is ALWAYS enabled for selection, regardless of isReadOnly */}
            <Checkbox
                checked={leg.selected || false}
                onChange={val => onLegChange(leg.id, 'selected', typeof val === 'boolean' ? val : val.target.checked)}
                className="leg-checkbox"
            />
            <ToggleButtonGroup
                options={[{ label: 'Buy', value: 'Buy' }, { label: 'Sell', value: 'Sell' }]}
                selected={leg.buySell}
                onSelect={val => onLegChange(leg.id, 'buySell', val)}
                className="leg-buy-sell"
                disabled={isReadOnly} // UI LOCK: Disable if it's an active position
            />
            <Select
                options={allExpiryOptions || []}
                value={leg.expiry}
                onChange={val => onLegChange(leg.id, 'expiry', val)}
                className="leg-select leg-expiry"
                placeholder="Expiry"
                disabled={isReadOnly || !allExpiryOptions || allExpiryOptions.length === 0} // UI LOCK
            />
            <Select
                options={strikeOptionsForSelectedExpiry || []}
                value={leg.strike}
                onChange={val => onLegChange(leg.id, 'strike', Number(val))}
                className="leg-select leg-strike"
                placeholder="Strike"
                disabled={isReadOnly || !leg.expiry || !strikeOptionsForSelectedExpiry || strikeOptionsForSelectedExpiry.length === 0} // UI LOCK
            />
            <Select
                options={typeOptionsForSelectedStrike || []}
                value={leg.optionType}
                onChange={val => onLegChange(leg.id, 'optionType', val)}
                className="leg-select leg-type"
                placeholder="Type"
                disabled={isReadOnly || !leg.strike || !typeOptionsForSelectedStrike || typeOptionsForSelectedStrike.length === 0} // UI LOCK
            />
            <Select
                options={lotOptions}
                value={leg.lots}
                onChange={val => onLegChange(leg.id, 'lots', parseInt(val) || 1)}
                className="leg-select leg-lots"
                disabled={isReadOnly} // UI LOCK
            />
            <Input
                type="number"
                value={leg.price} // This is entryPrice for active, LTP for new
                onChange={e => handleNumericInputChange(leg.id, 'price', e.target.value)}
                className="leg-price-input"
                step="0.05"
                title={`Token: ${leg.token || 'N/A'} | Lot Size: ${leg.lotSize || 'N/A'}${isReadOnly ? ' | Entry Price (Fixed)' : ''}`}
                disabled={isReadOnly} // UI LOCK: Price of an active position is fixed
            />
            <div className="leg-actions">
                <Button variant="icon" onClick={() => onAnalyzeLeg(leg.id)} icon="📈" size="small" title="Analyze Leg" />
                <Button variant="icon" onClick={() => onDuplicateLeg(leg.id)} icon="📋" size="small" title="Duplicate Leg" />
                <Button variant="icon" onClick={() => onRemoveLeg(leg.id)} icon="🗑️" size="small" title="Remove Leg"  // UI LOCK: Disable remove for active positions from builder
                />
            </div>
        </div>
    );
};

export default React.memo(StrategyLegRow);
