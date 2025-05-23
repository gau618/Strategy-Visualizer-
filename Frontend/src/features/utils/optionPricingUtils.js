// src/features/utils/optionPricingUtils.js

//Option 1: If you install mathjs (npm install mathjs)
import { erf } from 'mathjs';
export function normCDF(x) {
  if (x === Infinity) return 1;
  if (x === -Infinity) return 0;
  if (isNaN(x)) return NaN;
  return (1 + erf(x / Math.sqrt(2))) / 2;
}

// // Option 2: Keep frontend's erf approximation if mathjs is not available/desired
// // (This will be a known difference from backend if backend uses mathjs.erf)
// function erf_approx(x) {
//   let sign = (x >= 0) ? 1 : -1; x = Math.abs(x);
//   const a1=0.254829592; const a2=-0.284496736; const a3=1.421413741; const a4=-1.453152027; const a5=1.061405429; const p=0.3275911;
//   let t = 1.0/(1.0 + p*x);
//   let y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-x*x);
//   return sign*y;
// }
// export function normCDF(x) {
//   if (x === Infinity) return 1;
//   if (x === -Infinity) return 0;
//   if (isNaN(x)) return NaN; // Handle NaN input
//   // Prefer native Math.erf if available (ES2025+)
//   if (typeof Math.erf === 'function') return 0.5 * (1 + Math.erf(x / Math.sqrt(2)));
//   return 0.5 * (1 + erf_approx(x / Math.sqrt(2)));
// }


// Black-76 model for options on futures - Aligned with Backend logic for price,
// but retaining frontend's safety for sigma <= 0.
export function black76Price(F, K, T, r, sigma, optionType) {
  if (T <= 0) { // Backend's simple intrinsic for T<=0
    return Math.max(optionType === 'CE' ? F - K : K - F, 0);
  }
  // Frontend's safety for sigma <= 0 (backend might give NaN or error)
  if (sigma <= 0) { 
    const discountedIntrinsic = (optionType === 'CE' ? Math.max(0, F - K) : Math.max(0, K - F)) * Math.exp(-r * T);
    return discountedIntrinsic > 0 ? discountedIntrinsic : 0; // Ensure non-negative
  }

  const d1 = (Math.log(F / K) + (0.5 * sigma ** 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  let price;
  if (optionType === 'CE') {
    price = F * normCDF(d1) - K * normCDF(d2);
  } else { // PE
    price = K * normCDF(-d2) - F * normCDF(-d1);
  }
  // Backend doesn't Math.max(0, ...) here, but it's safer for precision.
  // To match backend strictly on this, remove Math.max(0, ...)
  return Math.exp(-r * T) * price; // Potentially keep Math.max(0, Math.exp(-r * T) * price) for safety
}


export function black76Greeks(F, K, T, r, sigma, optionType) {
  // Aligning with backend's T <= 0 handling for Greeks
  if (T <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0 };
  }
  // If sigma is effectively zero (after T<=0 check), backend might struggle.
  // For strict backend match, remove this. For safety, one might add handling.
  // For now, let's assume sigma will be > 0 if T > 0 for backend compatibility.
  // If sigma can be 0 when T > 0, backend's d1 calc will div by zero.
  if (sigma <= 0) { // Add this minimal safety, similar to frontend's original.
      let deltaVal = 0;
      if (optionType === 'CE') deltaVal = F >= K ? Math.exp(-r * T) : 0;
      else deltaVal = F <= K ? -Math.exp(-r * T) : 0;
      // Theta for zero sigma, T > 0 would be decay of discounted intrinsic.
      const intrinsicPrice = optionType === 'CE' ? Math.max(0, F - K) : Math.max(0, K - F);
      const thetaVal = -r * intrinsicPrice * Math.exp(-r * T) / 365; // Using 365 like backend
      return { delta: deltaVal, gamma: 0, theta: thetaVal, vega: 0 };
  }


  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(F / K) + (0.5 * sigma ** 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT; // d2 needed if theta formula changes back to textbook
  const pdfD1 = Math.exp(-0.5 * d1 ** 2) / Math.sqrt(2 * Math.PI);

  const delta = Math.exp(-r * T) * (
    optionType === 'CE' ? normCDF(d1) : normCDF(d1) - 1
  );
  const gamma = (Math.exp(-r * T) * pdfD1) / (F * sigma * sqrtT);
  const vega_raw = F * Math.exp(-r * T) * pdfD1 * sqrtT; // Backend calls this 'vega'

  // Theta calculation aligned with backend's formula
  const optionPriceForTheta = black76Price(F, K, T, r, sigma, optionType); // Recalculate price as per backend's theta
  const theta_daily = (
    - (F * sigma * Math.exp(-r * T) * pdfD1) / (2 * sqrtT)
    - r * optionPriceForTheta // Use the calculated option price
  ) / 365; // Backend uses 365 for daily theta

  return { delta, gamma, theta: theta_daily, vega: vega_raw };
}


// Time to expiry in years - Aligned with backend parsing and day count
// Takes an optional calculationDate for frontend flexibility
export function timeToExpiry(expiryStr, calculationDate = new Date()) {
  if (!expiryStr || typeof expiryStr !== 'string') {
    // console.warn("timeToExpiry (frontend): Invalid expiryStr provided", expiryStr);
    return 0;
  }
  
  // Backend format: "30MAY2024" -> DDMMMYYYY
  // Frontend original format was also "DDMMMYYYY" e.g. "02AUG2024" or "30MAY2024"
  // Let's make it robust for both DDMMMYYYY and DMMMYYYY
  const match = expiryStr.match(/(\d{1,2})([A-Z]{3})(\d{4})/i); 
  if (!match) {
    // console.warn("timeToExpiry (frontend): Could not parse expiryStr", expiryStr);
    return 0;
  }

  const [, dayStr, monthToken, yearStr] = match;
  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);
  const months = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
  const month = months[monthToken.toUpperCase()];

  if (month === undefined || isNaN(day) || isNaN(year)) {
    // console.warn("timeToExpiry (frontend): Invalid date components in expiryStr", expiryStr);
    return 0;
  }

  // Backend assumes 3:30 PM expiry (local to server). Let's assume server is IST for this.
  // 3:30 PM IST is 10:00 UTC.
  const expiryDateTime = new Date(Date.UTC(year, month, day, 10, 0, 0)); 
  
  const fromDate = new Date(calculationDate); // calculationDate is already a Date object

  if (isNaN(expiryDateTime.getTime()) || isNaN(fromDate.getTime())) {
    // console.warn("timeToExpiry (frontend): Invalid date object created.", expiryStr, calculationDate);
    return 0;
  }

  if (expiryDateTime.getTime() <= fromDate.getTime()) {
    return 0; // Option expired or at expiry
  }

  const diffTime = expiryDateTime.getTime() - fromDate.getTime();
  // Backend uses 365 days for year
  return Math.max(0, diffTime / (1000 * 60 * 60 * 24 * 365)); 
}
