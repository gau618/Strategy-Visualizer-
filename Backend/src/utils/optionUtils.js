// backend/utils/optionUtils.js
import { erf } from 'mathjs';

// Standard normal CDF
export function normCDF(x) {
  return (1 + erf(x / Math.sqrt(2))) / 2;
}

// PDF of standard normal distribution
function normPDF(x) {
  return Math.exp(-0.5 * x ** 2) / Math.sqrt(2 * Math.PI);
}

// Black-76 model for options on futures
export function black76Price(F, K, T, r, sigma, optionType) {
  if (T <= 0) return Math.max(optionType === 'CE' ? F - K : K - F, 0);
  const d1 = (Math.log(F / K) + 0.5 * sigma ** 2 * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  if (optionType === 'CE') {
    return Math.exp(-r * T) * (F * normCDF(d1) - K * normCDF(d2));
  } else {
    return Math.exp(-r * T) * (K * normCDF(-d2) - F * normCDF(-d1));
  }
}

export function black76Greeks(F, K, T, r, sigma, optionType) {
  if (T <= 0) return { delta: 0, gamma: 0, theta: 0, vega: 0 };
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(F / K) + 0.5 * sigma ** 2 * T) / (sigma * sqrtT);
  const pdfD1 = normPDF(d1);

  const delta = Math.exp(-r * T) * (
    optionType === 'CE' ? normCDF(d1) : normCDF(d1) - 1
  );
  const gamma = (Math.exp(-r * T) * pdfD1) / (F * sigma * sqrtT);
  const vega = F * Math.exp(-r * T) * pdfD1 * sqrtT;
  const theta = (
    - (F * sigma * Math.exp(-r * T) * pdfD1) / (2 * sqrtT)
    - r * black76Price(F, K, T, r, sigma, optionType)
  ) / 365;

  return { delta, gamma, theta, vega };
}

// Black-Scholes model for equity options
export function blackScholesPrice(S, K, T, r, sigma, optionType) {
  if (T <= 0) return Math.max(optionType === 'CE' ? S - K : K - S, 0);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  if (optionType === 'CE') {
    return S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
  } else {
    return K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1);
  }
}

export function blackScholesGreeks(S, K, T, r, sigma, optionType) {
  if (T <= 0) return { delta: 0, gamma: 0, theta: 0, vega: 0 };
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * sqrtT);
  const pdfD1 = normPDF(d1);

  const delta = optionType === 'CE' ? normCDF(d1) : normCDF(d1) - 1;
  const gamma = pdfD1 / (S * sigma * sqrtT);
  const vega = S * pdfD1 * sqrtT;
  const theta = (
    - (S * sigma * pdfD1) / (2 * sqrtT)
    - (optionType === 'CE'
      ? r * K * Math.exp(-r * T) * normCDF(d1 - sigma * sqrtT)
      : -r * K * Math.exp(-r * T) * normCDF(-d1 + sigma * sqrtT))
  ) / 365;

  return { delta, gamma, theta, vega };
}

// Robust IV calculation (Black-76 based)
export function impliedVolBisection(marketPrice, F, K, T, r, optionType, tolerance = 1e-4, maxIter = 100) {
  if (T <= 0) return 0.0001;
  const intrinsic = optionType === 'CE' ? Math.max(0, F - K) : Math.max(0, K - F);
  const pvIntrinsic = intrinsic * Math.exp(-r * T);
  if (marketPrice < pvIntrinsic - tolerance) return 0.0001;

  let lower = 0.0001, upper = 5.0;
  for (let i = 0; i < maxIter; i++) {
    const sigma = (lower + upper) / 2;
    const price = black76Price(F, K, T, r, sigma, optionType);
    if (Math.abs(price - marketPrice) < tolerance) return sigma;
    if (price > marketPrice) upper = sigma;
    else lower = sigma;
  }
  return (lower + upper) / 2;
}

// Precise expiry calculation
export function timeToExpiry(expiryStr, calculationDate) {
  try {
    const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
    const day = parseInt(expiryStr.substring(0, 2));
    const month = months[expiryStr.substring(2, 5).toUpperCase()];
    const year = parseInt(expiryStr.substring(5, 9));
    const expiryDate = new Date(Date.UTC(year, month, day, 15, 30, 0));
    const now = calculationDate.getTime();
    return Math.max(0, (expiryDate.getTime() - now) / (1000 * 3600 * 24 * 365));
  } catch (error) {
    console.error(`Error parsing expiry string: ${expiryStr}`, error);
    return 0;
  }
}
