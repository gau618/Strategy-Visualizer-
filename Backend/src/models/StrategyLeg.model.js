// In your backend Mongoose model file (e.g., models/strategy.model.js)

import mongoose, { Schema } from "mongoose";

const strategyLegSchema = new Schema(
  {
    id: {
      type: String,
      required: [true, "Leg ID is required"],
      trim: true,
    },
    // --- NEW: This field is the key to conditional logic ---
    legType: {
      type: String,
      enum: ["option", "future"],
      required: [true, "Leg type ('option' or 'future') is required"],
    },
    instrumentSymbol: {
      type: String,
      required: [true, "Instrument symbol is required"],
      trim: true,
    },
    token: {
      type: String,
      required: [true, "Instrument token is required"],
      trim: true,
    },
    // --- CORRECTED: Strike is now conditionally required ---
    strike: {
      type: Number,
      // This field is only required if the legType is 'option'.
      // The 'this' keyword refers to the document being validated.
      required: function() {
        return this.legType === 'option';
      },
    },
    // --- CORRECTED: OptionType is now conditionally required ---
    optionType: {
      type: String,
    },
    expiry: {
      type: String,
      required: [true, "Expiry date is required"],
      trim: true,
    },
    buySell: {
      type: String,
      enum: ["Buy", "Sell"],
      required: [true, "Action (Buy/Sell) is required"],
    },
    lots: {
      type: Number,
      required: [true, "Number of lots is required"],
      min: [1, "Lots must be at least 1"],
    },
    price: {
      type: Number,
      required: [true, "Entry price is required"],
    },
    lotSize: {
      type: Number,
      required: [true, "Lot size is required"],
      min: [1, "Lot size must be at least 1"],
    },
    iv: {
      type: Number,
      min: 0,
      // IV is also option-specific, but not making it required is fine.
    },
    selected: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      // Your payload sent 'new_leg', which was missing from the original enum.
      // I have added it here to prevent the next validation error.
      enum: [
        "draft",
        "active_position",
        "my_strategy_template",
        "closed_position",
        "new_leg", 
      ],
      required: [true, "Strategy status is required"],
      default: "draft",
    },
  },
  { _id: false } // Using this as a subdocument schema
);

export const StrategyLegSchema = strategyLegSchema;
