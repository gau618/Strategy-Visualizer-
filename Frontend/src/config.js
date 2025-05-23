// src/config.js
export const RISK_FREE_RATE = 0.07; // Annualized, e.g., 7%
export const DEFAULT_VOLATILITY = 0.15; // Default IV if live IV is not available (15% decimal)

// UI Behavior for PayoffChartSection sliders
export const SPOT_SLIDER_RANGE_PERCENT = 0.20; // e.g., Spot +/- 20% for slider
export const SPOT_SLIDER_STEP = 50; // Step for NIFTY/BANKNIFTY spot slider
export const MAX_DAYS_FOR_DATE_SLIDER = 90; // Default max future days for date slider if no legs
export const IV_ADJUSTMENT_STEP = 0.1; // Percentage points for individual IV adjustment buttons
export const GLOBAL_IV_OFFSET_STEP = 0.1; // Percentage points for global IV offset buttons
