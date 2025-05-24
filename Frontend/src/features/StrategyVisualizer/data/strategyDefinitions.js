// src/features/StrategyVisualizer/data/strategyDefinitions.js

// Helper to define leg strikes relative to ATM
// steps: 0 for ATM, positive for higher strikes, negative for lower strikes
// optionType: 'CE' or 'PE' is needed to determine if higher/lower is OTM/ITM

export const STRATEGY_CATEGORIES = ['Bullish', 'Bearish', 'Neutral', 'Others'];

export const STRATEGY_DEFINITIONS = [
  // --- Bullish Strategies ---
  {
    id: 'buy_call', name: 'Buy Call', category: 'Bullish', chartIcon: '📈',
    legs: [ { id: 'leg1', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 0, lotsRatio: 1 } ]
  },
  {
    id: 'sell_put', name: 'Sell Put', category: 'Bullish', chartIcon: '📉',
    legs: [ { id: 'leg1', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: 0, lotsRatio: 1 } ]
  },
  {
    id: 'bull_call_spread', name: 'Bull Call Spread', category: 'Bullish', chartIcon: '↗️',
    legs: [
      { id: 'leg1', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: -1, lotsRatio: 1 }, // Buy ITM (e.g., ATM-1)
      { id: 'leg2', optionType: 'CE', buySell: 'Sell', strikeOffsetSteps: 1, lotsRatio: 1 }  // Sell OTM (e.g., ATM+1)
    ] // Common: Buy ATM-X, Sell ATM+Y or Buy ATM, Sell OTM
  },
  {
    id: 'bull_put_spread', name: 'Bull Put Spread', category: 'Bullish', chartIcon: '↗️📉',
    legs: [
      { id: 'leg1', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: 1, lotsRatio: 1 }, // Sell OTM (e.g., ATM+1)
      { id: 'leg2', optionType: 'PE', buySell: 'Buy', strikeOffsetSteps: -1, lotsRatio: 1 }  // Buy further OTM (e.g., ATM-1)
    ] // Common: Sell ATM-X, Buy ATM-Y (lower strikes)
  },
  {
    id: 'call_ratio_back_spread', name: 'Call Ratio Back Spread', category: 'Bullish', chartIcon: '📈🐻',
    legs: [
      { id: 'leg1', optionType: 'CE', buySell: 'Sell', strikeOffsetSteps: -1, lotsRatio: 1 }, // Sell ITM
      { id: 'leg2', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 0, lotsRatio: 2 }   // Buy 2x ATM/OTM Calls
    ] // Volatile Bullish
  },
  { // Simplified Calendar: Both legs same expiry for now. True calendar needs different expiries.
    id: 'long_calendar_calls', name: 'Long Calendar with Calls', category: 'Bullish', chartIcon: '📅📞', requiresSameExpiry: false, // Mark for special handling or future
    legs: [
      { id: 'leg1', optionType: 'CE', buySell: 'Sell', strikeOffsetSteps: 0, lotsRatio: 1, expirySelector: 'SELECTED' }, // Sell current month ATM
      { id: 'leg2', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 0, lotsRatio: 1, expirySelector: 'NEXT_AVAILABLE' }  // Buy next month ATM
    ],
    description: "Time decay play. Sells near-term, buys longer-term. (Note: Requires different expiries, simplified for now)"
  },
  // TODO: Bull Condor, Bull Butterfly - these have 4 legs.
  {
    id: 'long_synthetic_future', name: 'Long Synthetic Future', category: 'Bullish', chartIcon: '📈🔗',
    legs: [
        { id: 'leg1', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 0, lotsRatio: 1 },
        { id: 'leg2', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: 0, lotsRatio: 1 }
    ]
  },
  // Example: Range Forward from "Others" in UI but can be directional
  {
    id: 'range_forward_bullish', name: 'Range Forward (Bullish)', category: 'Bullish', chartIcon: '↔️➡️',
    legs: [
        { id: 'leg1', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 1, lotsRatio: 1 }, // Buy OTM Call
        { id: 'leg2', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: -1, lotsRatio: 1 } // Sell OTM Put
    ],
    description: "Buy OTM Call, Sell OTM Put. Similar to synthetic long future but with specific strike choices."
  },

  // --- Bearish Strategies ---
  {
    id: 'buy_put', name: 'Buy Put', category: 'Bearish', chartIcon: '📉',
    legs: [ { id: 'leg1', optionType: 'PE', buySell: 'Buy', strikeOffsetSteps: 0, lotsRatio: 1 } ]
  },
  {
    id: 'sell_call', name: 'Sell Call', category: 'Bearish', chartIcon: '📈🚫',
    legs: [ { id: 'leg1', optionType: 'CE', buySell: 'Sell', strikeOffsetSteps: 0, lotsRatio: 1 } ]
  },
  {
    id: 'bear_put_spread', name: 'Bear Put Spread', category: 'Bearish', chartIcon: '↘️',
    legs: [
      { id: 'leg1', optionType: 'PE', buySell: 'Buy', strikeOffsetSteps: 1, lotsRatio: 1 }, // Buy ITM (e.g., ATM+1)
      { id: 'leg2', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: -1, lotsRatio: 1 }  // Sell OTM (e.g., ATM-1)
    ]
  },
  {
    id: 'bear_call_spread', name: 'Bear Call Spread', category: 'Bearish', chartIcon: '↘️📈',
    legs: [
      { id: 'leg1', optionType: 'CE', buySell: 'Sell', strikeOffsetSteps: -1, lotsRatio: 1 }, // Sell ITM (e.g., ATM-1)
      { id: 'leg2', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 1, lotsRatio: 1 }  // Buy OTM (e.g., ATM+1)
    ]
  },
  // TODO: Add more bearish strategies from your UI (Put Ratio Back Spread etc.)

  // --- Neutral Strategies (from UI Image) ---
  {
    id: 'short_straddle', name: 'Short Straddle', category: 'Neutral', chartIcon: '▼▲',
    legs: [
      { id: 'leg1', optionType: 'CE', buySell: 'Sell', strikeOffsetSteps: 0, lotsRatio: 1 },
      { id: 'leg2', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: 0, lotsRatio: 1 }
    ]
  },
  {
    id: 'short_strangle', name: 'Short Strangle', category: 'Neutral', chartIcon: '╲╱',
    legs: [
      { id: 'leg1', optionType: 'CE', buySell: 'Sell', strikeOffsetSteps: 1, lotsRatio: 1 }, // Sell OTM Call
      { id: 'leg2', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: -1, lotsRatio: 1 } // Sell OTM Put
    ]
  },
  {
    id: 'iron_condor', name: 'Iron Condor', category: 'Neutral', chartIcon: '🦅',
    legs: [ // Classic Iron Condor: Sell OTM Put, Buy further OTM Put, Sell OTM Call, Buy further OTM Call
      { id: 'leg1', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: -1, lotsRatio: 1 }, // Sell OTM Put 1
      { id: 'leg2', optionType: 'PE', buySell: 'Buy', strikeOffsetSteps: -2, lotsRatio: 1 },  // Buy OTM Put 2 (lower strike)
      { id: 'leg3', optionType: 'CE', buySell: 'Sell', strikeOffsetSteps: 1, lotsRatio: 1 },  // Sell OTM Call 1
      { id: 'leg4', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 2, lotsRatio: 1 }   // Buy OTM Call 2 (higher strike)
    ] // UI shows "Call Condor" and "Put Condor" - these might be different constructions
  },
  { // Long Call Butterfly
    id: 'long_call_butterfly', name: 'Long Call Butterfly', category: 'Neutral', chartIcon: '🦋',
    legs: [
      { id: 'leg1', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: -1, lotsRatio: 1 }, // Buy ITM Call
      { id: 'leg2', optionType: 'CE', buySell: 'Sell', strikeOffsetSteps: 0, lotsRatio: 2 },  // Sell 2x ATM Calls
      { id: 'leg3', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 1, lotsRatio: 1 }   // Buy OTM Call
    ]
  },
  // Note: The UI also shows "Put Condor", "Put Butterfly". These would be similar structures using puts.
  // Example: "Bull Condor" / "Bull Butterfly" from your first UI screenshot for "Bullish" might be different.
  // The standard "Condor" and "Butterfly" are typically neutral.
  // For simplicity, I've used standard definitions. Adjust if your "Bull/Bear Condor/Butterfly" are specific directional plays.

  // --- Others (Placeholder, based on your UI's "Range Forward") ---
  {
    id: 'range_forward_other', name: 'Range Forward', category: 'Others', chartIcon: '↔️➡️',
    legs: [ // This is same as bullish one, refine if "Others" means different parameters
        { id: 'leg1', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 1, lotsRatio: 1 },
        { id: 'leg2', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: -1, lotsRatio: 1 }
    ]
  }
];
