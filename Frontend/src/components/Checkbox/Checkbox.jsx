import React from 'react';
import './Checkbox.scss';

const Checkbox = ({ checked, onChange, label, className = '', disabled = false }) => (
  <label className={`checkbox-label ${className} ${disabled ? 'disabled' : ''}`}>
    <input
      type="checkbox"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      disabled={disabled}
    />
    {label && <span className="checkbox-text">{label}</span>}
  </label>
);

export default Checkbox;
