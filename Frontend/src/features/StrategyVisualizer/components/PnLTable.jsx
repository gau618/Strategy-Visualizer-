// src/features/StrategyVisualizer/components/PnLTable.jsx
import React from 'react';
import './PnLTable.scss';

const formatValue = (value, digits = 2, notApplicableString = '-') => {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return notApplicableString;
  }
  // Color P&L values
  if (digits === 2 && value !== 0) { // Assuming P&L values are typically 2 digits
      const numValue = Number(value);
      const className = numValue > 0 ? 'pnl-value-positive' : numValue < 0 ? 'pnl-value-negative' : '';
      return <span className={className}>{numValue.toFixed(digits)}</span>;
  }
  return Number(value).toFixed(digits);
};

const PnLTable = ({ projectedLegsData, totals,multiplier }) => {
  if (!projectedLegsData || projectedLegsData.length === 0) {
    return <div className="pnl-table-container no-data-message">Add strategy legs and set target to view P&L.</div>;
  }

  // Calculate summed prices for the total row if needed (as per UI, though less common)
  const summedPrices = projectedLegsData.reduce((acc, leg) => {
      acc.targetPrice += Number(leg.projectedOptionPrice) || 0;
      acc.entryPrice += Number(leg.entryPrice) || 0;
      acc.ltp += Number(leg.ltp) || 0;
      return acc;
  }, {targetPrice: 0, entryPrice: 0, ltp: 0});


  return (
    <div className="pnl-table-container">
      <table>
        <thead>
          <tr>
            <th>Instrument</th>
            <th>Target P&L</th>
            <th>Target Price</th>
            <th>Entry Price</th>
            <th>LTP</th>
          </tr>
        </thead>
        <tbody>
          {projectedLegsData.map((leg) => (
            <tr key={leg.id}>
              <td>{leg.instrument}</td>
              <td>{formatValue(leg.projectedPnLPerShare*multiplier)}</td> {/* Per-share P&L */}
              <td>{formatValue(leg.projectedOptionPrice*multiplier)}</td>
              <td>{formatValue(leg.entryPrice*multiplier)}</td>
              <td>{formatValue(leg.ltp*multiplier)}</td>
            </tr>
          ))}
          {(projectedLegsData.length > 0 && totals) && (
            <tr className="pnl-total-row">
              <td>Total <span className="projected-label">Projected</span> <span className="info-icon" title="Total P&L based on target spot and date, scaled by lots/lot size if selected.">ⓘ</span></td>
              <td>{formatValue(totals.projectedPnL*multiplier)}</td> {/* This total is already scaled */}
              <td>{formatValue(summedPrices.targetPrice*multiplier)}</td>
              <td>{formatValue(summedPrices.entryPrice*multiplier)}</td>
              <td>{formatValue(summedPrices.ltp*multiplier)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
export default React.memo(PnLTable);
