// src/features/StrategyVisualizer/utils/strategyUtils.js (or similar path)

export const getStrikeStep = (instrumentSymbol) => {
  if (!instrumentSymbol) return 50; // Default
  if (instrumentSymbol.toUpperCase().includes('BANKNIFTY')) return 100;
  if (instrumentSymbol.toUpperCase().includes('NIFTY')) return 50;
  if (instrumentSymbol.toUpperCase().includes('FINNIFTY')) return 50;
  // Add more specific underlying symbols if needed
  return 50; // Default Nifty step
};

// Finds the strike closest to the spot (ATM)
export const findATMStrike = (spotPrice, availableStrikes) => {
  if (!availableStrikes || availableStrikes.length === 0) return null;
  return availableStrikes.reduce((prev, curr) => 
    (Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev)
  );
};

// Finds Nth strike away from ATM, considering option type for OTM/ITM direction
// strikeOffsetSteps: 0 for ATM.
// Positive steps mean higher strikes, negative steps mean lower strikes.
export const findStrikeByOffsetSteps = (spotPrice, availableStrikes, strikeOffsetSteps, instrumentSymbol) => {
  if (!availableStrikes || availableStrikes.length === 0 || spotPrice === null || spotPrice === undefined) return null;
  
  const sortedStrikes = [...new Set(availableStrikes.map(s => Number(s)))].sort((a, b) => a - b);
  if (sortedStrikes.length === 0) return null;

  const atmStrike = findATMStrike(spotPrice, sortedStrikes);
  if (atmStrike === null) return null;

  const atmIndex = sortedStrikes.indexOf(atmStrike);
  if (atmIndex === -1) return null; // Should not happen if atmStrike is from sortedStrikes

  const targetIndex = atmIndex + strikeOffsetSteps;

  if (targetIndex >= 0 && targetIndex < sortedStrikes.length) {
    return sortedStrikes[targetIndex];
  }
  // If target index is out of bounds, return closest valid strike (edge or ATM)
  // This part can be refined based on desired behavior for edge cases.
  if (targetIndex < 0) return sortedStrikes[0];
  if (targetIndex >= sortedStrikes.length) return sortedStrikes[sortedStrikes.length - 1];
  
  return null; // Fallback
};
