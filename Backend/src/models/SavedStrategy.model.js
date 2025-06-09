// backend/src/models/SavedStrategy.model.js
import mongoose, { Schema } from "mongoose";
import { StrategyLegSchema } from "./StrategyLeg.model.js";

const savedStrategySchema = new Schema(
  {
    userId: {
      type: String,
      required: [true, "User ID is required"],
      index: true,
      trim: true,
    }, // Store as string for now if hardcoded from frontend
    name: {
      type: String,
      required: true,
      trim: true,
      default: () => `Strategy-${Date.now()}`,
    },
    underlying: {
      type: String,
      required: [true, "Underlying instrument is required"],
      trim: true,
    },
    legs: {
      type: [StrategyLegSchema],
      required: true,
      validate: [
        (v) => Array.isArray(v) && v.length > 0,
        "Strategy must have at least one leg.",
      ],
    },
    multiplier: {
      type: Number,
      required: [true, "Multiplier is required"],
      default: 1, // Default multiplier for NIFTY/BANKNIFTY
    },
    status: {
      type: String,
      enum: [
        "draft",
        "active_position",
        "my_strategy_template",
        "closed_position",
      ],
      required: [true, "Strategy status is required"],
      default: "draft",
    },
    entryDate: { type: Date }, // For 'active_position'
    exitDate: { type: Date }, // For 'closed_position'
    notes: { type: String, trim: true, maxlength: 1000 },
    // Optional: Store total premium paid/received at the time of "Trade All"
    totalInitialPremium: { type: Number },
  },
  { timestamps: true }
); // Adds createdAt and updatedAt

// To ensure a user doesn't save multiple drafts with the exact same name (optional)
// savedStrategySchema.index({ userId: 1, name: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'draft' } });

export const SavedStrategy = mongoose.model(
  "SavedStrategy",
  savedStrategySchema
);
