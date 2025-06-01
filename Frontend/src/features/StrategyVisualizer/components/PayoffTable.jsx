// src/features/StrategyVisualizer/components/PayoffTable.jsx
import React from 'react';
import { formatDisplayValue } from '../../utils/formatters';
import './PayoffTable.scss';

const PayoffTable = ({ payoffData, targetDate,multiplier=1 }) => {
  if (!payoffData || payoffData.length === 0) {
    return <div className="payoff-table-placeholder">No payoff data to display for the current selection.</div>;
  }
  const targetDateLabel = targetDate ? new Date(targetDate).toLocaleDateString("en-GB", {day:'2-digit', month:'short', year:'numeric'}) : "Target Date";
  return (
    <div className="payoff-table-container">
      <table>
        <thead>
          <tr>
            <th>Target Price (Underlying)</th>
            <th>P&L @ {targetDateLabel}</th>
            <th>P&L @ Expiry</th>
          </tr>
        </thead>
        <tbody>
          {payoffData.map((row, index) => (
            <tr key={index} className={row.isCurrentTarget ? 'highlighted-row' : ''}>
              <td>
                {formatDisplayValue(Number(row.targetPrice), "currency", {digits:0, prefix:""})} 
              </td>
              <td className={row.pnlAtTargetDate >= 0 ? 'profit-value' : 'loss-value'}>
                {formatDisplayValue(row.pnlAtTargetDate*multiplier, "currency_pnl", {prefix:"₹", showSign: true})}
              </td>
              <td className={row.pnlAtExpiry >= 0 ? 'profit-value' : 'loss-value'}>
                {formatDisplayValue(row.pnlAtExpiry*multiplier, "currency_pnl", {prefix:"₹", showSign: true})}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
export default React.memo(PayoffTable);
