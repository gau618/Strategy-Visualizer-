// src/features/StrategyVisualizer/data/strategyDefinitions.js

// MODIFIED: Categories for options
export const OPTION_STRATEGY_CATEGORIES = ['Bullish', 'Bearish', 'Neutral', 'Volatile', 'Others'];

// MODIFIED: All existing definitions are now explicitly options and have legType: 'option'
export const OPTION_STRATEGY_DEFINITIONS = [
  // --- Bullish Strategies ---
  {
    id: 'buy_call', name: 'Buy Call', category: 'Bullish', chartIcon: '📈',
    legs: [ { id: 'leg1', legType: 'option', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 0, lotsRatio: 1 } ]
  },
  {
    id: 'sell_put', name: 'Sell Put', category: 'Bullish', chartIcon: '📉',
    legs: [ { id: 'leg1', legType: 'option', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: 0, lotsRatio: 1 } ]
  },
  {
    id: 'bull_call_spread', name: 'Bull Call Spread', category: 'Bullish', chartIcon: '↗️',
    legs: [
      { id: 'leg1', legType: 'option', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: -1, lotsRatio: 1 },
      { id: 'leg2', legType: 'option', optionType: 'CE', buySell: 'Sell', strikeOffsetSteps: 1, lotsRatio: 1 }
    ]
  },
  {
    id: 'bull_put_spread', name: 'Bull Put Spread', category: 'Bullish', chartIcon: '↗️📉',
    legs: [
      { id: 'leg1', legType: 'option', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: 1, lotsRatio: 1 },
      { id: 'leg2', legType: 'option', optionType: 'PE', buySell: 'Buy', strikeOffsetSteps: -1, lotsRatio: 1 }
    ]
  },
  {
    id: 'call_ratio_back_spread', name: 'Call Ratio Back Spread', category: 'Volatile', chartIcon: '📈🐻',
    legs: [
      { id: 'leg1', legType: 'option', optionType: 'CE', buySell: 'Sell', strikeOffsetSteps: -1, lotsRatio: 1 },
      { id: 'leg2', legType: 'option', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 0, lotsRatio: 2 }
    ]
  },
  {
    id: 'long_calendar_calls', name: 'Long Calendar (Calls)', category: 'Neutral', chartIcon: '📅📞', requiresDifferentExpiries: true,
    legs: [
      { id: 'leg1', legType: 'option', optionType: 'CE', buySell: 'Sell', strikeOffsetSteps: 0, lotsRatio: 1, expirySelector: 'SELECTED' },
      { id: 'leg2', legType: 'option', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 0, lotsRatio: 1, expirySelector: 'NEXT_AVAILABLE' }
    ],
    description: "Sells near-term ATM call, buys longer-term ATM call. (Requires different expiries)"
  },
  {
    id: 'long_synthetic_future_options', name: 'Long Synthetic (Options)', category: 'Bullish', chartIcon: '📈🔗',
    legs: [
        { id: 'leg1', legType: 'option', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 0, lotsRatio: 1 },
        { id: 'leg2', legType: 'option', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: 0, lotsRatio: 1 }
    ]
  },
  {
    id: 'range_forward_bullish', name: 'Range Forward (Bullish)', category: 'Bullish', chartIcon: '↔️➡️',
    legs: [
        { id: 'leg1', legType: 'option', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 1, lotsRatio: 1 },
        { id: 'leg2', legType: 'option', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: -1, lotsRatio: 1 }
    ],
    description: "Buy OTM Call, Sell OTM Put."
  },

  // --- Bearish Strategies ---
  {
    id: 'buy_put', name: 'Buy Put', category: 'Bearish', chartIcon: '📉',
    legs: [ { id: 'leg1', legType: 'option', optionType: 'PE', buySell: 'Buy', strikeOffsetSteps: 0, lotsRatio: 1 } ]
  },
  {
    id: 'sell_call', name: 'Sell Call', category: 'Bearish', chartIcon: '📈🚫',
    legs: [ { id: 'leg1', legType: 'option', optionType: 'CE', buySell: 'Sell', strikeOffsetSteps: 0, lotsRatio: 1 } ]
  },
  {
    id: 'bear_put_spread', name: 'Bear Put Spread', category: 'Bearish', chartIcon: '↘️',
    legs: [
      { id: 'leg1', legType: 'option', optionType: 'PE', buySell: 'Buy', strikeOffsetSteps: 1, lotsRatio: 1 },
      { id: 'leg2', legType: 'option', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: -1, lotsRatio: 1 }
    ]
  },
  {
    id: 'bear_call_spread', name: 'Bear Call Spread', category: 'Bearish', chartIcon: '↘️📈',
    legs: [
      { id: 'leg1', legType: 'option', optionType: 'CE', buySell: 'Sell', strikeOffsetSteps: -1, lotsRatio: 1 },
      { id: 'leg2', legType: 'option', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 1, lotsRatio: 1 }
    ]
  },
   {
    id: 'put_ratio_back_spread', name: 'Put Ratio Back Spread', category: 'Volatile', chartIcon: '📉🐻',
    legs: [
      { id: 'leg1', legType: 'option', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: 1, lotsRatio: 1 },
      { id: 'leg2', legType: 'option', optionType: 'PE', buySell: 'Buy', strikeOffsetSteps: 0, lotsRatio: 2 }
    ]
  },
  {
    id: 'short_synthetic_future_options', name: 'Short Synthetic (Options)', category: 'Bearish', chartIcon: '📉🔗',
    legs: [
        { id: 'leg1', legType: 'option', optionType: 'CE', buySell: 'Sell', strikeOffsetSteps: 0, lotsRatio: 1 },
        { id: 'leg2', legType: 'option', optionType: 'PE', buySell: 'Buy', strikeOffsetSteps: 0, lotsRatio: 1 }
    ]
  },

  // --- Neutral Strategies ---
  {
    id: 'short_straddle', name: 'Short Straddle', category: 'Neutral', chartIcon: '▼▲',
    legs: [
      { id: 'leg1', legType: 'option', optionType: 'CE', buySell: 'Sell', strikeOffsetSteps: 0, lotsRatio: 1 },
      { id: 'leg2', legType: 'option', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: 0, lotsRatio: 1 }
    ]
  },
  {
    id: 'short_strangle', name: 'Short Strangle', category: 'Neutral', chartIcon: '╲╱',
    legs: [
      { id: 'leg1', legType: 'option', optionType: 'CE', buySell: 'Sell', strikeOffsetSteps: 1, lotsRatio: 1 },
      { id: 'leg2', legType: 'option', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: -1, lotsRatio: 1 }
    ]
  },
  {
    id: 'iron_condor', name: 'Iron Condor', category: 'Neutral', chartIcon: '🦅',
    legs: [
      { id: 'leg1', legType: 'option', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: -1, lotsRatio: 1 },
      { id: 'leg2', legType: 'option', optionType: 'PE', buySell: 'Buy', strikeOffsetSteps: -2, lotsRatio: 1 },
      { id: 'leg3', legType: 'option', optionType: 'CE', buySell: 'Sell', strikeOffsetSteps: 1, lotsRatio: 1 },
      { id: 'leg4', legType: 'option', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 2, lotsRatio: 1 }
    ]
  },
  {
    id: 'long_call_butterfly', name: 'Long Call Butterfly', category: 'Neutral', chartIcon: '🦋',
    legs: [
      { id: 'leg1', legType: 'option', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: -1, lotsRatio: 1 },
      { id: 'leg2', legType: 'option', optionType: 'CE', buySell: 'Sell', strikeOffsetSteps: 0, lotsRatio: 2 },
      { id: 'leg3', legType: 'option', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 1, lotsRatio: 1 }
    ]
  },
  {
    id: 'long_put_butterfly', name: 'Long Put Butterfly', category: 'Neutral', chartIcon: '🦋📉',
    legs: [
      { id: 'leg1', legType: 'option', optionType: 'PE', buySell: 'Buy', strikeOffsetSteps: 1, lotsRatio: 1 },
      { id: 'leg2', legType: 'option', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: 0, lotsRatio: 2 },
      { id: 'leg3', legType: 'option', optionType: 'PE', buySell: 'Buy', strikeOffsetSteps: -1, lotsRatio: 1 }
    ]
  },
  // --- Volatile Strategies ---
  {
    id: 'long_straddle', name: 'Long Straddle', category: 'Volatile', chartIcon: '▲▼',
    legs: [
      { id: 'leg1', legType: 'option', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 0, lotsRatio: 1 },
      { id: 'leg2', legType: 'option', optionType: 'PE', buySell: 'Buy', strikeOffsetSteps: 0, lotsRatio: 1 }
    ]
  },
  {
    id: 'long_strangle', name: 'Long Strangle', category: 'Volatile', chartIcon: '╱╲',
    legs: [
      { id: 'leg1', legType: 'option', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 1, lotsRatio: 1 },
      { id: 'leg2', legType: 'option', optionType: 'PE', buySell: 'Buy', strikeOffsetSteps: -1, lotsRatio: 1 }
    ]
  },
  // --- Others ---
  {
    id: 'range_forward_other', name: 'Range Forward', category: 'Others', chartIcon: '↔️➡️',
    legs: [
        { id: 'leg1', legType: 'option', optionType: 'CE', buySell: 'Buy', strikeOffsetSteps: 1, lotsRatio: 1 },
        { id: 'leg2', legType: 'option', optionType: 'PE', buySell: 'Sell', strikeOffsetSteps: -1, lotsRatio: 1 }
    ]
  }
];

// NEW: Definitions for Future Strategies
export const FUTURE_STRATEGY_CATEGORIES = ['Directional', 'Spreads'];

export const FUTURE_STRATEGY_DEFINITIONS = [
  {
    id: 'long_future', name: 'Long Future', category: 'Directional', chartIcon: '⬆️F',
    legs: [
      { id: 'leg1', legType: 'future', buySell: 'Buy', contractSelector: 'SELECTED_FROM_DROPDOWN', lotsRatio: 1 }
    ],
    description: "Buy the selected futures contract."
  },
  {
    id: 'short_future', name: 'Short Future', category: 'Directional', chartIcon: '⬇️F',
    legs: [
      { id: 'leg1', legType: 'future', buySell: 'Sell', contractSelector: 'SELECTED_FROM_DROPDOWN', lotsRatio: 1 }
    ],
    description: "Sell the selected futures contract."
  },
  {
    id: 'futures_calendar_spread_long', name: 'Long Calendar Spread (Futures)', category: 'Spreads', chartIcon: '📅F', requiresDifferentExpiries: true,
    legs: [
      { id: 'leg1', legType: 'future', buySell: 'Sell', contractSelector: 'NEAREST', lotsRatio: 1 }, // Sell Near Month
      { id: 'leg2', legType: 'future', buySell: 'Buy', contractSelector: 'NEXT', lotsRatio: 1 }    // Buy Next Month
    ],
    description: "Sell near-month future, buy next-month future."
  },
  {
    id: 'futures_calendar_spread_short', name: 'Short Calendar Spread (Futures)', category: 'Spreads', chartIcon: '📅F🚫', requiresDifferentExpiries: true,
    legs: [
      { id: 'leg1', legType: 'future', buySell: 'Buy', contractSelector: 'NEAREST', lotsRatio: 1 },  // Buy Near Month
      { id: 'leg2', legType: 'future', buySell: 'Sell', contractSelector: 'NEXT', lotsRatio: 1 }     // Sell Next Month
    ],
    description: "Buy near-month future, sell next-month future."
  }
];

// For backward compatibility or if other parts of your app use these general names
// If you have no other parts of the app using these, you can remove these two lines
// and directly import OPTION_STRATEGY_DEFINITIONS etc. where needed.
export const STRATEGY_CATEGORIES = OPTION_STRATEGY_CATEGORIES;
export const STRATEGY_DEFINITIONS = OPTION_STRATEGY_DEFINITIONS;
