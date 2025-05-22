// src/features/utils/optionPricingUtils.js

// Using a simple erf approximation for standalone use.
function erf_approx(x) {
  let sign = (x >= 0) ? 1 : -1;
  x = Math.abs(x);
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  let t = 1.0 / (1.0 + p * x);
  let y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

export function normCDF(x) {
  if (typeof Math.erf === 'function') { // ES2025+ feature
    return 0.5 * (1 + Math.erf(x / Math.sqrt(2)));
  }
  return 0.5 * (1 + erf_approx(x / Math.sqrt(2)));
}

export function black76Price(F, K, T, r, sigma, optionType) {
  if (T <= 0) {
    return optionType === 'CE' ? Math.max(0, F - K) : Math.max(0, K - F);
  }
  if (sigma <= 0) {
    const discountedIntrinsic = (optionType === 'CE' ? Math.max(0, F - K) : Math.max(0, K - F)) * Math.exp(-r * T);
    return discountedIntrinsic > 0 ? discountedIntrinsic : 0;
  }

  const d1 = (Math.log(F / K) + (0.5 * sigma ** 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  let price;
  if (optionType === 'CE') {
    price = F * normCDF(d1) - K * normCDF(d2);
  } else { // PE
    price = K * normCDF(-d2) - F * normCDF(-d1);
  }
  return Math.exp(-r * T) * Math.max(0, price); // Ensure price isn't negative due to precision
}

export function black76Greeks(F, K, T, r, sigma, optionType) {
  if (T <= 0 || sigma <= 0) {
    let deltaVal = 0;
    if (T <= 0) { // Expired
      if (optionType === 'CE') deltaVal = F > K ? 1 : (F < K ? 0 : 0.5);
      else deltaVal = F < K ? -1 : (F > K ? 0 : 0.5);
    } else { // Sigma is <= 0 (no volatility)
      if (optionType === 'CE') deltaVal = F >= K ? Math.exp(-r * T) : 0;
      else deltaVal = F <= K ? -Math.exp(-r * T) : 0;
    }
    const intrinsicPrice = optionType === 'CE' ? Math.max(0, F-K) : Math.max(0, K-F);
    const thetaIfSigmaZero = T > 0 ? -r * intrinsicPrice * Math.exp(-r * T) / 365 : 0;


    return { delta: deltaVal, gamma: 0, theta: thetaIfSigmaZero, vega: 0 };
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(F / K) + (0.5 * sigma ** 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const pdfD1 = Math.exp(-0.5 * d1 ** 2) / Math.sqrt(2 * Math.PI);

  const delta = Math.exp(-r * T) * (
    optionType === 'CE' ? normCDF(d1) : normCDF(d1) - 1
  );
  const gamma = (pdfD1 * Math.exp(-r * T)) / (F * sigma * sqrtT);
  const vega_raw = F * Math.exp(-r * T) * pdfD1 * sqrtT; // This is "raw" vega

  let theta_daily;
  if (optionType === 'CE') {
    theta_daily = (-(F * pdfD1 * sigma * Math.exp(-r * T)) / (2 * sqrtT) - r * K * Math.exp(-r * T) * normCDF(d2)) / 365.25;
  } else { // PE
    theta_daily = (-(F * pdfD1 * sigma * Math.exp(-r * T)) / (2 * sqrtT) + r * K * Math.exp(-r * T) * normCDF(-d2)) / 365.25;
  }

  return { delta, gamma, theta: theta_daily, vega: vega_raw };
}

export function timeToExpiry(expiryStr, calculationDate = new Date()) {
  if (!expiryStr) return 0;
  try {
    const day = parseInt(expiryStr.substring(0, 2), 10);
    const monthStr = expiryStr.substring(2, 5).toUpperCase();
    const year = parseInt(expiryStr.substring(5, 9), 10);
    const months = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
    if (months[monthStr] === undefined) {
      console.error("Invalid month in expiry string:", expiryStr); return 0;
    }
    const expiryDateTime = new Date(Date.UTC(year, months[monthStr], day, 10, 0, 0)); // 3:30 PM IST is 10:00 UTC
    const fromDate = new Date(calculationDate);
    if (expiryDateTime <= fromDate) return 0;
    const diffTime = expiryDateTime.getTime() - fromDate.getTime();
    return Math.max(0, diffTime / (1000 * 60 * 60 * 24 * 365.25)); // Using 365.25
  } catch (e) {
    console.error("Error in timeToExpiry (frontend):", expiryStr, e); return 0;
  }
}
