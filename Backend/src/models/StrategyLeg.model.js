// backend/src/models/StrategyLeg.model.js
import mongoose, { Schema } from "mongoose";

const strategyLegSchema = new Schema(
  {
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
    strike: { type: Number, required: [true, "Strike price is required"] },
    optionType: {
      type: String,
      enum: ["CE", "PE"],
      required: [true, "Option type (CE/PE) is required"],
    },
    expiry: {
      type: String,
      required: [true, "Expiry date is required"],
      trim: true,
    }, // Format: DDMMMYYYY
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
    price: { type: Number, required: [true, "Entry price is required"] },
    lotSize: {
      type: Number,
      required: [true, "Lot size is required"],
      min: [1, "Lot size must be at least 1"],
    },
    iv: { type: Number, min: 0 }, // Implied Volatility at time of save (as percentage, e.g., 20 for 20%)
  },
  { _id: false }
); // Subdocument, no separate _id needed by default

export const StrategyLegSchema = strategyLegSchema;
