import React from 'react';
import './Button.scss';

const Button = ({ children, variant = 'primary', onClick, icon, className = '', size = 'normal', disabled = false }) => (
  <button
    className={`btn btn-${variant} btn-size-${size} ${className}`}
    onClick={onClick}
    disabled={disabled}
  >
    {icon && <span className="btn-icon">{icon}</span>}
    {children}
  </button>
);

export default Button;
