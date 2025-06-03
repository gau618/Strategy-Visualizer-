// backend/models/InstrumentHourSnapshot.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

// Sub-schema for Greeks
const GreeksSchema = new Schema({
    delta: { type: Number, required: false },
    gamma: { type: Number, required: false },
    theta: { type: Number, required: false },
    vega: { type: Number, required: false },
}, { _id: false });

// Sub-schema for Market Context
const MarketContextSchema = new Schema({
    underlyingSpotPrice: { type: Number, required: false },
    relevantFuturePrice: { type: Number, required: false },
}, { _id: false });

// Main Schema for storing an hourly snapshot
const InstrumentHourSnapshotSchema = new Schema({
    timestamp: { type: Date, required: true }, // Represents the START of the hour (e.g., 2024-06-03T09:00:00.000Z)
    token: { type: String, required: true },   // Instrument Token
    
    instrumentType: { 
        type: String, 
        required: true, 
        enum: ['Option', 'Future', 'SpotIndex', 'Stock', 'Unknown'] // Define known types
    },
    underlying: { type: String, required: true }, 
    symbol: { type: String, required: true },      
    
    expiryDate: { type: Date, required: false }, 
    strikePrice: { type: Number, required: false }, 
    optionType: { type: String, enum: ['CE', 'PE', null], default: null },

    lastPrice: { type: Number, required: true },
    openInterest: { type: Number, default: 0 },
    volumeTradedToday: { type: Number, default: 0 }, // If your feed provides cumulative daily volume

    iv: { type: Number, required: false }, // Implied Volatility as decimal
    greeks: { type: GreeksSchema, required: false },

    marketContext: { type: MarketContextSchema, required: true },

    contractInfo: {
        lotSize: { type: Number, required: true },
        tickSize: { type: Number, required: true },
        expiryType: { type: String, required: false }, // e.g., 'WEEKLY', 'MONTHLY'
    },
}, {
    timeseries: {
        timeField: 'timestamp',       
        metaField: 'token',         
        granularity: 'hours'      
    },
    versionKey: false, // Disable __v field from Mongoose
    timestamps: { createdAt: 'dbSystemCreatedAt', updatedAt: 'dbSystemUpdatedAt' } // Mongoose managed timestamps
});

// --- Indexes ---
// MongoDB Time Series collections automatically create a clustered index on (metaField, timeField).
// For regular collections (if not using Time Series feature or older MongoDB version):
// InstrumentHourSnapshotSchema.index({ token: 1, timestamp: -1 });
// InstrumentHourSnapshotSchema.index({ timestamp: -1 });

const InstrumentHourSnapshot = mongoose.model('InstrumentHourSnapshot', InstrumentHourSnapshotSchema);

export default InstrumentHourSnapshot;
