// src/features/utils/optionPricingUtils.js

// Option 1: If you install mathjs (npm install mathjs)
import { erf } from 'mathjs'; // Make sure mathjs is in your package.json and installed

/**
 * Normal Cumulative Distribution Function (CDF) using math.js erf.
 * @param {number} x - The value.
 * @returns {number} - The CDF at x.
 */
export function normCDF(x) {
  if (x === Infinity) return 1;
  if (x === -Infinity) return 0;
  if (isNaN(x)) return NaN; // Propagate NaN
  return (1 + erf(x / Math.sqrt(2))) / 2;
}

// -- Alternative normCDF if mathjs is not used (keep for reference or if you remove mathjs) --
// function erf_approx(x) {
//   let sign = (x >= 0) ? 1 : -1; x = Math.abs(x);
//   const a1=0.254829592; const a2=-0.284496736; const a3=1.421413741; const a4=-1.453152027; const a5=1.061405429; const p=0.3275911;
//   let t = 1.0/(1.0 + p*x);
//   let y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-x*x);
//   return sign*y;
// }
// export function normCDF_alternative(x) {
//   if (x === Infinity) return 1;
//   if (x === -Infinity) return 0;
//   if (isNaN(x)) return NaN;
//   if (typeof Math.erf === 'function') return 0.5 * (1 + Math.erf(x / Math.sqrt(2))); // ES2025+
//   return 0.5 * (1 + erf_approx(x / Math.sqrt(2)));
// }
// -- End Alternative --


/**
 * Black-76 model for European options on futures (or spot if F is spot).
 * @param {number} F - Forward/Futures price (or Spot price).
 * @param {number} K - Strike price.
 * @param {number} T - Time to expiry in years.
 * @param {number} r - Risk-free interest rate (annualized decimal).
 * @param {number} sigma - Implied volatility (annualized decimal, e.g., 0.2 for 20%).
 * @param {string} optionType - "CE" for Call, "PE" for Put.
 * @returns {number} - Theoretical option price.
 */
export function black76Price(F, K, T, r, sigma, optionType) {
  if (T <= 0.000001) { // Option expired or at expiry (using small epsilon for float comparisons)
    return Math.max(0, optionType === 'CE' ? F - K : K - F);
  }
  // If sigma is effectively zero, model is unstable.
  // Return discounted intrinsic for safety if sigma is non-positive.
  if (sigma <= 0.000001) { 
    const intrinsic = optionType === 'CE' ? Math.max(0, F - K) : Math.max(0, K - F);
    return Math.max(0, intrinsic * Math.exp(-r * T));
  }

  const d1 = (Math.log(F / K) + (0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  let price;
  if (optionType === 'CE') {
    price = F * normCDF(d1) - K * normCDF(d2);
  } else { // PE
    price = K * normCDF(-d2) - F * normCDF(-d1);
  }
  // Final price is discounted. Math.max ensures non-negativity due to potential float precision issues.
  return Math.max(0, Math.exp(-r * T) * price);
}

/**
 * Black-76 Greeks.
 * @returns {object} - { delta, gamma, theta (daily), vega (for 1% IV change) }
 */
export function black76Greeks(F, K, T, r, sigma, optionType) {
  if (T <= 0.000001) { // At expiry
    let deltaVal = 0;
    if (optionType === 'CE') deltaVal = F > K ? 1 : (F === K ? 0.5 : 0);
    else deltaVal = F < K ? -1 : (F === K ? -0.5 : 0);
    // At expiry, delta is effectively discounted by exp(-r*T) which is 1 if T=0.
    // If T is truly 0, exp(-r*T) is 1. If T is small positive, it's slightly less than 1.
    // For simplicity and common interpretation at T=0, undiscouned delta is often used.
    // Let's return discounted delta for consistency with the model if T is tiny positive.
    return { delta: deltaVal * Math.exp(-r*T) , gamma: 0, theta: 0, vega: 0 };
  }

  // If sigma is effectively zero with T > 0, model assumptions break down.
  if (sigma <= 0.000001) {
      let deltaVal = 0;
      // Delta for zero vol option is its probability of being ITM, discounted.
      if (optionType === 'CE') deltaVal = F >= K ? Math.exp(-r * T) : 0;
      else deltaVal = F <= K ? -Math.exp(-r * T) : 0; // Put delta negative
      
      // Theta would be the decay of the (discounted) intrinsic value.
      const intrinsicPrice = optionType === 'CE' ? Math.max(0, F - K) : Math.max(0, K - F);
      const thetaVal = (r * intrinsicPrice * Math.exp(-r * T)) / 365; // Decay makes it positive for holder, negative for seller
      // This theta is often represented as negative for long positions (value lost per day).
      // If option price is just discounted intrinsic, theta = - (d/dT (Intrinsic * exp(-rT)))
      // = - (-r * Intrinsic * exp(-rT)) = r * Intrinsic * exp(-rT).
      // For daily, divide by 365. Sign depends on convention (value change vs. P&L change).
      // Let's use the convention: theta is negative for long option holder.
      return { delta: deltaVal, gamma: 0, theta: -thetaVal, vega: 0 };
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(F / K) + (0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const pdfD1 = Math.exp(-0.5 * d1 * d1) / Math.sqrt(2 * Math.PI); // N'(d1)

  const delta = Math.exp(-r * T) * (optionType === 'CE' ? normCDF(d1) : normCDF(d1) - 1);
  const gamma = (Math.exp(-r * T) * pdfD1) / (F * sigma * sqrtT);
  
  // Vega: change in option price for a 1 absolute change in sigma (e.g. 0.20 to 1.20).
  // To get vega per 1% change in IV (e.g. 20% to 21%), divide by 100.
  const vega_per_one_percent_iv = (F * Math.exp(-r * T) * pdfD1 * sqrtT) / 100;

  // Theta: Based on standard Black-Scholes/Black-76 theta formulation
  // Theta is typically negative for long options.
  const theta_part1 = -(F * Math.exp(-r * T) * pdfD1 * sigma) / (2 * sqrtT);
  let theta_part2;
  if (optionType === 'CE') {
    theta_part2 = -r * K * Math.exp(-r * T) * normCDF(d2) + r * F * Math.exp(-r * T) * normCDF(d1);
  } else { // PE
    theta_part2 = +r * K * Math.exp(-r * T) * normCDF(-d2) - r * F * Math.exp(-r * T) * normCDF(-d1);
  }
  const theta_annual = theta_part1 + theta_part2;
  const theta_daily = theta_annual / 365; // Per calendar day

  return { delta, gamma, theta: theta_daily, vega: vega_per_one_percent_iv };
}

// Parses "DDMMMYYYY" or "DMMMYYYY" (e.g., "30MAY2024", "2AUG2024")
const parseExpiryString = (expiryStr) => {
  if (!expiryStr || typeof expiryStr !== 'string') return null;
  const match = expiryStr.match(/(\d{1,2})([A-Z]{3})(\d{4})/i);
  if (!match) return null;
  const [, dayStr, monthToken, yearStr] = match;
  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);
  const months = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
  const month = months[monthToken.toUpperCase()];
  if (month === undefined || isNaN(day) || isNaN(year) || day < 1 || day > 31) return null;
  // Standardize to UTC 10:00 AM (3:30 PM IST typical expiry time)
  return new Date(Date.UTC(year, month, day, 10, 0, 0, 0));
};

/**
 * Calculates time to expiry in years.
 * @param {string|Date} expiryInput - Expiry date string (e.g., "30MAY2024") or Date object.
 * @param {Date} [calculationDate=new Date()] - The date from which to calculate TTE.
 * @returns {number} Time to expiry in years.
 */
export function timeToExpiry(expiryInput, calculationDate = new Date()) {
  const expiryDateTime = expiryInput instanceof Date ? expiryInput : parseExpiryString(expiryInput);
  const fromDate = calculationDate instanceof Date ? calculationDate : new Date(calculationDate);

  if (!expiryDateTime || isNaN(expiryDateTime.getTime()) || !fromDate || isNaN(fromDate.getTime())) return 0;
  if (expiryDateTime.getTime() <= fromDate.getTime()) return 0;

  const diffTime = expiryDateTime.getTime() - fromDate.getTime();
  return diffTime / (1000 * 60 * 60 * 24 * 365.25); // Using 365.25 for average year length
}

/**
 * Calculates time to expiry in calendar days.
 */
export function timeToExpiryDays(expiryInput, calculationDate = new Date()) {
    const expiryDateTime = expiryInput instanceof Date ? expiryInput : parseExpiryString(expiryInput);
    const fromDate = calculationDate instanceof Date ? calculationDate : new Date(calculationDate);

    if (!expiryDateTime || isNaN(expiryDateTime.getTime()) || !fromDate || isNaN(fromDate.getTime())) return 0;

    // Normalize to compare dates only by setting time to start of UTC day
    const fromStartOfDay = Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate());
    const expiryStartOfDay = Date.UTC(expiryDateTime.getUTCFullYear(), expiryDateTime.getUTCMonth(), expiryDateTime.getUTCDate());

    if (expiryStartOfDay < fromStartOfDay) return 0; // Expiry is in the past or today but before fromDate's start

    const diffTime = expiryStartOfDay - fromStartOfDay;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}


/**
 * Calculates the intrinsic payoff of an option at a given spot price.
 * @param {number} spotPrice - Current price of the underlying asset.
 * @param {number} strikePrice - Strike price of the option.
 * @param {string} optionType - "CE" for Call, "PE" for Put.
 * @returns {number} Payoff value (intrinsic value).
 */
export function calculatePayoff(spotPrice, strikePrice, optionType) {
  if (optionType === 'CE') {
    return Math.max(0, spotPrice - strikePrice);
  } else if (optionType === 'PE') {
    return Math.max(0, strikePrice - spotPrice);
  }
  console.warn("calculatePayoff: Invalid optionType provided", optionType);
  return 0;
}
