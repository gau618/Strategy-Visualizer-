// backend/utils/hourlyStorageUtil.js
import mongoose from 'mongoose';
import InstrumentHourSnapshot from '../models/InstrumentHourSnapshot.js'; // Adjust path if model is elsewhere
import { getExpiryType as getExpiryTypeFromScripLoader } from "./scripLoader.js"; // Adjust path to scripLoader

const {
    MARKET_OPEN_HOUR = 9, MARKET_OPEN_MINUTE = 15,
    MARKET_CLOSE_HOUR = 15, MARKET_CLOSE_MINUTE = 30,
    SNAPSHOT_START_HOUR = 9, SNAPSHOT_END_HOUR = 15,   
} = process.env;

const latestInstrumentDataForStorage = new Map();
let hourlySnapshotSchedulerUtil = null;
let lastStorageAttemptHourUtil = -1;
let lastStorageAttemptDateUtil = -1;
let tokenMetaMapForStorage = null;

function parseRawExpiryToDateUtil(expiryStr) {
    if (!expiryStr || typeof expiryStr !== 'string' || expiryStr.length !== 9) return null;
    const months = { JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11 };
    try {
        const day = parseInt(expiryStr.substring(0,2)), year = parseInt(expiryStr.substring(5,9));
        const monthStr = expiryStr.substring(2,5).toUpperCase();
        if (isNaN(day) || isNaN(year) || !(monthStr in months)) return null;
        return new Date(Date.UTC(year, months[monthStr], day, 0,0,0,0));
    } catch(e){ return null; }
}

function determineInstrumentTypeUtil(instrumentMeta) {
  //  console.log(instrumentMeta)
    if (!instrumentMeta || !instrumentMeta.instrumenttype) return 'Unknown';
    const type = instrumentMeta.instrumenttype.toUpperCase();
    if (type === "OPTIDX" || type === "OPTSTK") return "Option";
    if (type === "FUTIDX" || type === "FUTSTK") return "Future";
    if (type === "INDEX") return "SpotIndex";
    if (type === "EQ") return "Stock";
    return 'Unknown';
}

function transformProcessedDataToSchemaFormat(processedData, currentDataTimestamp) {
    
    if (!processedData || !processedData.token || !tokenMetaMapForStorage) return null;
   // console.log(processedData);
    const meta = tokenMetaMapForStorage[processedData.token];
   // console.log("Meta",meta)
    if (!meta) return null;
    const instrumentType = determineInstrumentTypeUtil(meta);
//    console.log(`\n🕒 (Util) Processing data for token: ${processedData.token} (${instrumentType}) at ${currentDataTimestamp.toISOString()}`);
    const schemaData = {
        token: processedData.token, instrumentType, underlying: processedData.underlying, symbol: processedData.symbol,
        expiryDate: (instrumentType === 'Option' || instrumentType === 'Future') ? parseRawExpiryToDateUtil(processedData.expiry) : null,
        strikePrice: instrumentType === 'Option' ? parseFloat(processedData.strike) : null,
        optionType: instrumentType === 'Option' ? (processedData.optionType || null) : null,
        lastPrice: parseFloat(processedData.lastPrice),
        openInterest: processedData.marketData?.oi ? parseInt(processedData.marketData.oi) : 0,
        volumeTradedToday: processedData.marketData?.volumeTradedToday || 0,
        iv: (instrumentType === 'Option' && processedData.iv) ? parseFloat(processedData.iv) / 100 : null,
        greeks: (instrumentType === 'Option' && processedData.greeks) ? {
            delta: processedData.greeks.delta !== (undefined||null) ? parseFloat(processedData.greeks.delta) : null,
            gamma: processedData.greeks.gamma !== (undefined||null) ? parseFloat(processedData.greeks.gamma) : null,
            theta: processedData.greeks.theta !== (undefined||null) ? parseFloat(processedData.greeks.theta) : null,
            vega: processedData.greeks.vega !== (undefined||null) ? parseFloat(processedData.greeks.vega) : null,
        } : null,
        marketContext: {
            underlyingSpotPrice: processedData.marketData?.spot ? parseFloat(processedData.marketData.spot) : null,
            relevantFuturePrice: processedData.marketData?.futures ? parseFloat(processedData.marketData.futures) : null,
        },
        contractInfo: {
            lotSize: parseInt(processedData.contractInfo?.lotSize || meta.lotsize || 1),
            tickSize: parseFloat(processedData.contractInfo?.tickSize || meta.tick_size || 0.05),
            expiryType: processedData.contractInfo?.expiryType || getExpiryTypeFromScripLoader(meta.expiry),
        },
        _lastUpdatedTimestampInMap: currentDataTimestamp
    };
    if (isNaN(schemaData.lastPrice)) return null;
   // console.log(schemaData)
    return schemaData;
}

function isWithinSnapshotWindowUtil(date = new Date()) {
    const hour = date.getHours();
    if (hour < SNAPSHOT_START_HOUR || hour > SNAPSHOT_END_HOUR) return false;
    if (hour === SNAPSHOT_END_HOUR && date.getMinutes() > 5) return false;

    const marketOpenTimeToday = new Date(date); marketOpenTimeToday.setHours(MARKET_OPEN_HOUR, MARKET_OPEN_MINUTE, 0, 0);
    const marketCloseTimeToday = new Date(date); marketCloseTimeToday.setHours(MARKET_CLOSE_HOUR, MARKET_CLOSE_MINUTE + 1, 0, 0);
  
    return date >= marketOpenTimeToday && date < marketCloseTimeToday;
}

function getHourlySnapshotTimestampUtil(date = new Date()) {
    const snapshotTime = new Date(date); snapshotTime.setMinutes(0, 0, 0);
    return snapshotTime;
}

async function storeHourlySnapshotsFromUtil() {
    const now = new Date();
   if (!isWithinSnapshotWindowUtil(now)) return;
    console.log('inside storeHourlySnapshotsFromUtil', now.toISOString());
    const currentSnapshotHourTimestamp = getHourlySnapshotTimestampUtil(now);
    const currentHourForCheck = currentSnapshotHourTimestamp.getHours();
    const currentDateForCheck = currentSnapshotHourTimestamp.getDate();

    if (currentHourForCheck === lastStorageAttemptHourUtil && currentDateForCheck === lastStorageAttemptDateUtil) return;
    
    console.log(`\n🕒 (Util) Attempting hourly snapshot for: ${currentSnapshotHourTimestamp.toISOString()}`);
    lastStorageAttemptHourUtil = currentHourForCheck; lastStorageAttemptDateUtil = currentDateForCheck;
    
    const snapshotsToStore = Array.from(latestInstrumentDataForStorage.values()).map(data => ({
        ...data, timestamp: currentSnapshotHourTimestamp, _id: undefined,
    }));
    if (snapshotsToStore.length > 0) {
        try {
            const result = await InstrumentHourSnapshot.insertMany(snapshotsToStore, { ordered: false });
           console.log(result)
        } catch (error) {
            if (error.name === 'MongoBulkWriteError' && error.code === 11000) {
                console.warn(`(Util) DB Write Warning: ${error.result.nInserted} inserted. Duplicates skipped for ${currentSnapshotHourTimestamp.toISOString()}.`);
            } else {
                console.error(`(Util) DB Write Error for ${currentSnapshotHourTimestamp.toISOString()}:`, error.message);
            }
        }
    } else {
        console.log(`(Util) No data to snapshot for ${currentSnapshotHourTimestamp.toISOString()}.`);
    }
}

 async function scheduleNextHourlySnapshotUtil() {
    if (hourlySnapshotSchedulerUtil) clearTimeout(hourlySnapshotSchedulerUtil);
    const now = new Date();
    let nextSnapshotTime = new Date(now);
    nextSnapshotTime.setHours(now.getHours() + 1, 0, 0, 0);

    if (now.getHours() < SNAPSHOT_START_HOUR) nextSnapshotTime.setHours(SNAPSHOT_START_HOUR, 0, 0, 0);
    else if (now.getHours() >= SNAPSHOT_END_HOUR) {
        nextSnapshotTime.setDate(nextSnapshotTime.getDate() + 1);
        nextSnapshotTime.setHours(SNAPSHOT_START_HOUR, 0, 0, 0);
    }
    
    let delay = nextSnapshotTime.getTime() - now.getTime();
    if (delay < 0) delay += 24 * 60 * 60 * 1000; 

    console.log(`🕒 (Util) Next hourly snapshot: ${nextSnapshotTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (in ~${Math.round(delay/1000/60)}m)`);
    hourlySnapshotSchedulerUtil = setTimeout(async () => {
        console.log('clcked')
        await storeHourlySnapshotsFromUtil();
        scheduleNextHourlySnapshotUtil();
    }, delay);
}

// --- NAMED EXPORTS ---
export function initializeHourlyStorageUtil(initialTokenMetaMap) { // Correctly exported
    if (mongoose.connection.readyState !== 1) {
        console.error("❌ (Util) MongoDB not connected. Hourly storage cannot start.");
        return;
    }
    tokenMetaMapForStorage = initialTokenMetaMap;
    console.log("🕒 (Util) Hourly storage utility initialized.");
    scheduleNextHourlySnapshotUtil();
    storeHourlySnapshotsFromUtil();
}

export function updateLatestInstrumentDataForStorageUtil(processedEmitDataObject) { // Correctly exported
    if (!processedEmitDataObject || !processedEmitDataObject.token) return;
    const schemaFormattedData = transformProcessedDataToSchemaFormat(processedEmitDataObject, new Date());
    if (schemaFormattedData) latestInstrumentDataForStorage.set(schemaFormattedData.token, schemaFormattedData);
}

export async function forceStoreSnapshotsUtil() { // Correctly exported
    if (mongoose.connection.readyState !== 1) { console.warn("(Util) Cannot force store: MongoDB not connected."); return; }
    console.log("🕒 (Util) Force storing snapshots...");
    await storeHourlySnapshotsFromUtil();
    console.log("🕒 (Util) Force store attempt complete.");
}

export function cleanupHourlyStorageScheduler() { // Correctly exported
    if (hourlySnapshotSchedulerUtil) {
        clearTimeout(hourlySnapshotSchedulerUtil);
        hourlySnapshotSchedulerUtil = null;
        console.log("🕒 (Util) Hourly snapshot scheduler stopped.");
    }
}
