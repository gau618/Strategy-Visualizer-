// backend/src/controllers/strategy.controller.js
import { SavedStrategy } from "../models/SavedStrategy.model.js";
import mongoose from "mongoose";

// Helper to validate leg data
const validateLegs = (legs) => {
  if (!Array.isArray(legs) || legs.length === 0) {
    return "Strategy must have at least one leg.";
  }
  for (const leg of legs) {
    if (
      !leg.token ||
      typeof leg.strike !== "number" ||
      !["CE", "PE"," "].includes(leg.optionType) ||
      !leg.expiry ||
      !["Buy", "Sell"].includes(leg.buySell) ||
      typeof leg.lots !== "number" ||
      leg.lots < 1 ||
      typeof leg.price !== "number" ||
      typeof leg.lotSize !== "number" ||
      leg.lotSize < 1
    ) {
      return "Each leg has missing or invalid data. Required: token, strike (number), optionType, expiry, buySell, lots (number >=1), price (number), lotSize (number >=1).";
    }
  }
  return null; // No validation errors
};

// Controller for saving a new strategy
export const createStrategy = async (req, res) => {
  try {
    const { userId, name, underlying, legs, status, notes } = req.body;

    if (!userId || !underlying || !status) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Missing required fields: userId, underlying, status.",
        });
    }

    const legValidationError = validateLegs(legs);
    if (legValidationError) {
      return res
        .status(400)
        .json({ success: false, message: legValidationError });
    }

    const strategyData = {
      userId,
      name: name || `Strategy-${Date.now()}`, // Auto-generate name if not provided
      underlying,
      legs,
      status, // 'draft' or 'active_position'
      notes: notes || "",
    };

    // If "Trade All" (status: 'active_position'), set entryDate
    if (status === "active_position") {
      strategyData.entryDate = new Date();
      // Calculate and store total initial premium if desired
      strategyData.totalInitialPremium = legs.reduce((sum, leg) => {
        const direction = leg.buySell === "Buy" ? -1 : 1; // Premium received for sell, paid for buy
        return sum + leg.price * leg.lots * leg.lotSize * direction;
      }, 0);
    }

    const newStrategy = await SavedStrategy.create(strategyData);
   console.log("New strategy created:", newStrategy);
    res.status(201).json({
      success: true,
      message: `Strategy successfully saved as ${status}!`,
      strategy: newStrategy,
    });
  } catch (error) {
    console.error("Error creating strategy:", error);
    if (error.name === "ValidationError") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Validation Error",
          errors: error.errors,
        });
    }
    res
      .status(500)
      .json({
        success: false,
        message: "Server error while saving strategy.",
        error: error.message,
      });
  }
};

// Controller for fetching strategies based on criteria
export const getStrategies = async (req, res) => {
  try {
    const { userId, status, underlying, name } = req.query;

    if (!userId) {
      return res
        .status(400)
        .json({
          success: false,
          message: "User ID is required to fetch strategies.",
        });
    }

    const query = { userId };
    if (status) query.status = status;
    if (underlying) query.underlying = { $regex: underlying, $options: "i" }; // Case-insensitive search
    if (name) query.name = { $regex: name, $options: "i" };

    const strategies = await SavedStrategy.find(query).sort({ updatedAt: -1 }); // Show most recently updated/created first

    res.status(200).json({ success: true, strategies });
  } catch (error) {
    console.error("Error fetching strategies:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Server error while fetching strategies.",
        error: error.message,
      });
  }
};

// TODO: Add controllers for updating and deleting strategies if needed later
// export const updateStrategy = async (req, res) => { ... };
// export const deleteStrategy = async (req, res) => { ... };
