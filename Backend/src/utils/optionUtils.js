
import { erf } from 'mathjs';

// Standard normal CDF
export function normCDF(x) {
  return (1 + erf(x / Math.sqrt(2))) / 2;
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
  const pdfD1 = Math.exp(-0.5 * d1 ** 2) / Math.sqrt(2 * Math.PI);

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

// Robust IV calculation with intrinsic value check
export function impliedVolBisection(
  marketPrice, F, K, T, r,
  optionType, tolerance = 1e-4, maxIter = 100
) {
  if (T <= 0) return 0.0001;

  // Intrinsic value check
  let intrinsic = optionType === 'CE'
    ? Math.max(0, F - K)
    : Math.max(0, K - F);
  let pvIntrinsic = intrinsic * Math.exp(-r * T);
  if (marketPrice < pvIntrinsic - tolerance) return 0.0001;

  let lower = 0.0001, upper = 5.0, sigma = (lower + upper) / 2;
  for (let i = 0; i < maxIter; i++) {
    const price = black76Price(F, K, T, r, sigma, optionType);
    if (Math.abs(price - marketPrice) < tolerance) break;
    if (price > marketPrice) upper = sigma;
    else lower = sigma;
    sigma = (lower + upper) / 2;
    if (upper - lower < tolerance / 10) break;
  }
  return Math.max(0.0001, Math.min(sigma, 5.0));
}

// Time to expiry in years (precise)
export function timeToExpiry(expiryStr) {
  // expiryStr: "30MAY2024"
  const [day, month, year] = expiryStr.match(/(\d{2})([A-Z]+)(\d{4})/).slice(1);
  const months = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
  };
  const expiryDate = new Date(year, months[month], day, 15, 30, 0); // 3:30pm expiry
  const now = new Date();
  return Math.max(0, (expiryDate - now) / (1000 * 3600 * 24 * 365));
}