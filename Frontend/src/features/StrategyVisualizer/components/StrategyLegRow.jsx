// src/features/StrategyVisualizer/components/StrategyLegRow.jsx
import React from 'react';
import Checkbox from '../../../components/Checkbox/Checkbox';
import ToggleButtonGroup from '../../../components/ToggleButtonGroup/ToggleButtonGroup';
import Select from '../../../components/Select/Select';
import Input from '../../../components/Input/Input';
import Button from '../../../components/Button/Button';
import './StrategyLegRow.scss'; // Ensure this SCSS aligns

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
    // Lots dropdown as per your image (1 to 10, but input might be better for >10)
    const lotOptions = Array.from({ length: 10 }, (_, i) => ({ label: String(i + 1), value: i + 1 }));
    if (leg.lots > 10 && !lotOptions.find(opt => opt.value === leg.lots)) {
        lotOptions.push({ label: String(leg.lots), value: leg.lots }); // Add current lots if > 10
        lotOptions.sort((a,b) => a.value - b.value);
    }


    const handleNumericInputChange = (id, field, stringValue) => {
        const numericValue = parseFloat(stringValue);
        if (!isNaN(numericValue) || stringValue === '') {
            onLegChange(id, field, stringValue === '' ? '' : numericValue);
        }
    };

    return (
        <div className={`strategy-leg-row ${leg.selected ? 'is-selected' : ''}`}>
            <Checkbox
                checked={leg.selected || false}
                onChange={val => onLegChange(leg.id, 'selected', val)}
                className="leg-checkbox" // As per image
            />
            <ToggleButtonGroup // As per image
                options={[{ label: 'Buy', value: 'Buy' }, { label: 'Sell', value: 'Sell' }]}
                selected={leg.buySell}
                onSelect={val => onLegChange(leg.id, 'buySell', val)}
                className="leg-buy-sell"
            />
            <Select // As per image
                options={allExpiryOptions || []}
                value={leg.expiry}
                onChange={val => onLegChange(leg.id, 'expiry', val)}
                className="leg-select leg-expiry"
                placeholder="Expiry"
                disabled={!allExpiryOptions || allExpiryOptions.length === 0}
            />
            <Select // As per image (shows + 3000 with dropdown)
                options={strikeOptionsForSelectedExpiry || []}
                value={leg.strike}
                onChange={val => onLegChange(leg.id, 'strike', Number(val))}
                className="leg-select leg-strike"
                placeholder="Strike"
                // The label in getStrikesForExpiry is already `+ ${strike}`
                disabled={!leg.expiry || !strikeOptionsForSelectedExpiry || strikeOptionsForSelectedExpiry.length === 0}
            />
            <Select // As per image
                options={typeOptionsForSelectedStrike || []}
                value={leg.optionType} // Using optionType from our data model
                onChange={val => onLegChange(leg.id, 'optionType', val)}
                className="leg-select leg-type"
                placeholder="Type"
                disabled={!leg.strike || !typeOptionsForSelectedStrike || typeOptionsForSelectedStrike.length === 0}
            />
            <Select // As per image (dropdown for lots)
                options={lotOptions}
                value={leg.lots}
                onChange={val => onLegChange(leg.id, 'lots', parseInt(val) || 1)}
                className="leg-select leg-lots"
            />
            <Input // As per image
                type="number"
                value={leg.price}
                onChange={e => handleNumericInputChange(leg.id, 'price', e.target.value)}
                className="leg-price-input"
                step="0.05"
                title={`Token: ${leg.token || 'N/A'} | Lot Size: ${leg.lotSize || 'N/A'}`}
                // readOnly={!!leg.token} // Price is auto-updated when other fields change if valid, but allow manual override
            />
            <div className="leg-actions"> {/* Icons from image */}
                <Button variant="icon" onClick={() => onAnalyzeLeg(leg.id)} icon="📈" size="small" title="Analyze Leg" />
                <Button variant="icon" onClick={() => onDuplicateLeg(leg.id)} icon="📋" size="small" title="Duplicate Leg" />
                <Button variant="icon" onClick={() => onRemoveLeg(leg.id)} icon="🗑️" size="small" title="Remove Leg" />
            </div>
        </div>
    );
};

export default StrategyLegRow;
