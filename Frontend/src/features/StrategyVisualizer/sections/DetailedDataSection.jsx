// src/features/StrategyVisualizer/sections/DetailedDataSection.jsx
import React, { useEffect, useState, useMemo } from 'react';
import Button from '../../../components/Button/Button';
import Checkbox from '../../../components/Checkbox/Checkbox';
import { useLiveOptionData } from '../../../contexts/LiveOptionDataContext';
// VVVV IMPORT FRONTEND UTILS VVVV
import { black76Greeks, timeToExpiry } from '../../utils/optionPricingUtils';
import { DEFAULT_VOLATILITY } from '../../../config'; // Assuming default IV if live not present

import './DetailedDataSection.scss';

const DetailedDataSection = ({
  strategyLegs,
  currentUnderlying,
  getOptionByToken, // For live IVs and fallback live Greeks
  riskFreeRate,     // For projected Greeks calculation
  
  projectedNiftyTarget, // Projected underlying price from sliders
  projectedTargetDate,  // Projected date from sliders

  // Assuming DetailedDataSection will have its own instances of these checkboxes
  // If they are to be synced with PayoffChartSection, these props should come from StrategyVisualizer
  multiplyByLotSize: initialMultiplyLotSize = false, // Default if not passed
  onMultiplyByLotSizeChange,
  multiplyByNumLots: initialMultiplyNumLots = false, // Default if not passed
  onMultiplyByNumLotsChange
}) => {
  // If multiplier state is managed by StrategyVisualizer and passed as props:
  const isMultiplyLotSizeControlled = onMultiplyByLotSizeChange !== undefined;
  const isMultiplyNumLotsControlled = onMultiplyByNumLotsChange !== undefined;

  const [
    currentMultiplyLotSize, 
    setCurrentMultiplyLotSizeInternal
  ] = useState(initialMultiplyLotSize);
  const [
    currentMultiplyNumLots, 
    setCurrentMultiplyNumLotsInternal
  ] = useState(initialMultiplyNumLots);

  // Use prop if controlled, else internal state
  const multiplyGreeksByLotSize = isMultiplyLotSizeControlled ? initialMultiplyLotSize : currentMultiplyLotSize;
  const multiplyGreeksByNumLots = isMultiplyNumLotsControlled ? initialMultiplyNumLots : currentMultiplyNumLots;

  const handleSetMultiplyLotSize = (checked) => {
    if (isMultiplyLotSizeControlled) {
      onMultiplyByLotSizeChange(checked);
    } else {
      setCurrentMultiplyLotSizeInternal(checked);
    }
  };
  const handleSetMultiplyNumLots = (checked) => {
    if (isMultiplyNumLotsControlled) {
      onMultiplyByNumLotsChange(checked);
    } else {
      setCurrentMultiplyNumLotsInternal(checked);
    }
  };
  
  // Strikewise IVs (remains based on live data + offset)
  const [ivOffset, setIvOffset] = useState(0);
  const strikewiseIVsData = useMemo(() => { /* ... existing logic ... */ 
    return strategyLegs
      .filter(leg => leg.selected && leg.token)
      .map(leg => {
        const liveOption = getOptionByToken(leg.token);
        if (!liveOption || liveOption.iv === undefined) {
          return { id: leg.id, strike: leg.strike, expiry: leg.expiry, ivDisplay: 'N/A', originalIV: 0, chg: 'N/A' };
        }
        const originalIV = parseFloat(liveOption.iv);
        const displayedIV = (originalIV + ivOffset).toFixed(2);
        return {
          id: leg.id, strike: liveOption.strike,
          expiry: liveOption.expiry.substring(0,9).replace(/(\d{2})([A-Z]{3})(\d{2})/, '$1-$2-$3'),
          ivDisplay: displayedIV, originalIV: originalIV,
          chg: `(${ (parseFloat(displayedIV) - originalIV).toFixed(1) })`,
        };
      });
  }, [strategyLegs, getOptionByToken, ivOffset]);


  const greeksSource = useMemo(() => {
    const numericProjectedTarget = parseFloat(projectedNiftyTarget);
    if (projectedTargetDate && !isNaN(numericProjectedTarget)) {
      return "Projected";
    }
    return "Live";
  }, [projectedNiftyTarget, projectedTargetDate]);

  // Greeks Summary - Now dynamic based on projected targets or live data
  const greeksSummary = useMemo(() => {
    let aggDelta = 0, aggGamma = 0, aggTheta = 0, aggVega = 0;
    const numericProjectedTarget = parseFloat(projectedNiftyTarget);
    const useProjected = projectedTargetDate && !isNaN(numericProjectedTarget);
    const projectionDate = useProjected ? new Date(projectedTargetDate) : null;

    strategyLegs.forEach(leg => {
      if (leg.selected && leg.token) {
        const liveOption = getOptionByToken(leg.token);
        if (!liveOption || !liveOption.strike || !liveOption.expiry || liveOption.optionType === undefined) return;

        let legGreeks = { delta: 0, gamma: 0, theta: 0, vega: 0 }; // Default

        if (useProjected && projectionDate) {
          // Calculate PROJECTED Greeks
          const T_to_expiry = timeToExpiry(liveOption.expiry, projectionDate);
          const currentIV = liveOption.iv !== undefined ? (parseFloat(liveOption.iv) / 100) + (ivOffset / 100) : DEFAULT_VOLATILITY;

          if (T_to_expiry > 0 && currentIV > 0) {
            const F_projected = numericProjectedTarget * Math.exp(riskFreeRate * T_to_expiry);
            legGreeks = black76Greeks(
              F_projected, Number(liveOption.strike), T_to_expiry,
              riskFreeRate, currentIV, liveOption.optionType
            );
          } else { // Expired or zero vol scenario for projection
             legGreeks = black76Greeks(numericProjectedTarget, Number(liveOption.strike), T_to_expiry, riskFreeRate, currentIV, liveOption.optionType);
          }
        } else {
          // Use LIVE Greeks from backend
          if (liveOption.greeks) {
            legGreeks = {
                delta: liveOption.greeks.delta || 0,
                gamma: liveOption.greeks.gamma || 0,
                theta: liveOption.greeks.theta || 0,
                vega: liveOption.greeks.vega || 0, // Assuming liveOption.greeks.vega is raw
            };
          }
        }
        
        const direction = leg.buySell === 'Buy' ? 1 : -1;
        let scale = 1;
        if (multiplyGreeksByLotSize) scale *= (leg.lotSize || 1);
        if (multiplyGreeksByNumLots) scale *= (leg.lots || 1);

        aggDelta += legGreeks.delta * direction * scale;
        aggGamma += legGreeks.gamma * scale; // Typically sums positively for strategy
        aggTheta += legGreeks.theta * direction * scale;
        aggVega += legGreeks.vega * scale;   // Typically sums positively for strategy (raw vega)
      }
    });
    // For display, Vega needs to be scaled (per 1%)
    return { delta: aggDelta, gamma: aggGamma, theta: aggTheta, vega: aggVega / 100 };
  }, [
    strategyLegs, getOptionByToken, 
    projectedNiftyTarget, projectedTargetDate, riskFreeRate, ivOffset, // Add ivOffset if it affects projected IV
    multiplyGreeksByLotSize, multiplyGreeksByNumLots
  ]);

  // Target Day Futures & SD (remains mostly based on live/default for now)
  const [targetDayFuturesInfo, setTargetDayFuturesInfo] = useState({ /* ... */ });
  useEffect(() => { /* ... existing logic from your paste.txt for targetDayFuturesInfo ... */ }, [strategyLegs, getOptionByToken]);

  const handleResetIVs = () => setIvOffset(0);

  return (
    <section className="sv-detailed-data-section">
      {/* Strikewise IVs Column (remains based on live data + offset) */}
      <div className="data-column strikewise-ivs-column">
        <h4>Strikewise IVs <Button variant="link" size="small" onClick={handleResetIVs}>Reset IVs</Button></h4>
        <div className="offset-control">
          <span>offset</span>
          <Button variant="tertiary" size="small" onClick={() => setIvOffset(prev => parseFloat((prev - 0.5).toFixed(1)))}>-</Button>
          <span className="offset-value">{ivOffset.toFixed(1)}</span>
          <Button variant="tertiary" size="small" onClick={() => setIvOffset(prev => parseFloat((prev + 0.5).toFixed(1)))}>+</Button>
        </div>
        <table>
          <thead><tr><th>Strike</th><th>Expiry</th><th>IV</th><th>Chg</th></tr></thead>
          <tbody>
            {strikewiseIVsData.length > 0 ? strikewiseIVsData.map((item) => (
              <tr key={item.id || `${item.strike}-${item.expiry}`}>
                <td>{item.strike} <span className="info-icon">ⓘ</span></td>
                <td>{item.expiry}</td>
                <td className="iv-control-cell">
                  <Button variant="tertiary" size="small" className="iv-btn" disabled>-</Button>
                  <span className="iv-display-value">{item.ivDisplay}</span>
                  <Button variant="tertiary" size="small" className="iv-btn" disabled>+</Button>
                </td>
                <td>{item.chg}</td>
              </tr>
            )) : (<tr><td colSpan={4} className="no-data-row">No legs selected.</td></tr>)}
          </tbody>
        </table>
      </div>

      {/* Greeks Summary Column */}
      <div className="data-column greeks-summary-column">
        <h4>Greeks <span className="greeks-source-label">({greeksSource})</span></h4>
        <Checkbox
            label="Multiply by Lot Size"
            checked={multiplyGreeksByLotSize}
            onChange={handleSetMultiplyLotSize}
            className="greeks-checkbox"
        />
        <Checkbox
            label="Multiply by Number of Lots"
            checked={multiplyGreeksByNumLots}
            onChange={handleSetMultiplyNumLots}
            className="greeks-checkbox"
        />
        <table>
          <tbody>
            <tr><td>Delta</td><td>{greeksSummary.delta?.toFixed(2) || '0.00'}</td></tr>
            <tr><td>Gamma</td><td>{greeksSummary.gamma?.toFixed(4) || '0.0000'}</td></tr>
            <tr><td>Theta</td><td>{greeksSummary.theta?.toFixed(2) || '0.00'}</td></tr>
            <tr><td>Vega</td><td>{greeksSummary.vega?.toFixed(2) || '0.00'}</td></tr> {/* Already scaled to per 1% */}
          </tbody>
        </table>
      </div>

      {/* Target Day Futures Column (remains as is) */}
      <div className="data-column target-day-futures-column">
         {/* ... existing JSX from your paste.txt ... */}
         <h4>Target Day Futures Prices</h4>
        {targetDayFuturesInfo.price !== 'N/A' && (
            <p className="futures-price-display">
                {targetDayFuturesInfo.date} <span className="price-value">{targetDayFuturesInfo.price}</span>
            </p>
        )}
        <h4>Standard Deviation</h4>
        <table>
          <thead><tr><th>SD</th><th>Points</th><th>Price</th></tr></thead>
          <tbody>
            {targetDayFuturesInfo.sd?.length > 0 ? targetDayFuturesInfo.sd.map((item, index) => (
              <tr key={index}>
                <td>{item.level}</td><td>{item.points}</td><td>{item.priceLow}<br/>{item.priceHigh}</td>
              </tr>
            )) : (<tr><td colSpan={3} className="no-data-row">SD data unavailable.</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
};
export default React.memo(DetailedDataSection);
