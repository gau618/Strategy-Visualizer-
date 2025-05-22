import React from 'react';
import './Select.scss';

const Select = ({ options, value, onChange, className = '', placeholder, disabled = false }) => (
  <select
    className={`select-input ${className}`}
    value={value}
    onChange={e => onChange(e.target.value)}
    disabled={disabled}
  >
    {placeholder && <option value="" disabled={value !== ""}>{placeholder}</option>}
    {options.map(opt => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
);

export default Select;
