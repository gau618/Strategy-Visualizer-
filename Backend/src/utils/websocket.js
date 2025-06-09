// backend/optionFeed.js
import { WebSocketV2 } from "smartapi-javascript";
import {
  loadScripData,
  getExpiryType,
  buildTokenMetaMap,
} from "./scripLoader.js"; // Assuming this path is correct relative to optionFeed.js
import {
  black76Greeks,
  impliedVolBisection,
  timeToExpiry,
} from "./optionUtils.js"; // Assuming this path is correct
import dotenv from "dotenv";

// --- NEW: Import functions from the storage utility ---
// Adjust the path './hourlyStorageUtil.js' if it's located elsewhere relative to this file
// e.g., if hourlyStorageUtil.js is in a 'utils' subdirectory: './utils/hourlyStorageUtil.js'
import { initializeHourlyStorageUtil, updateLatestInstrumentDataForStorageUtil } from './hourlyStorageUtil.js'; 

dotenv.config({ path: "../.env" }); // Adjust if .env is in a different relative location

const CLIENT_CODE = process.env.CLIENT_CODE;
const JWT_TOKEN = process.env.JWT_TOKEN?.trim();
const API_KEY = process.env.API_KEY?.trim();
const FEED_TOKEN = process.env.FEED_TOKEN?.trim();
const RISK_FREE_RATE_STR = process.env.RISK_FREE_RATE || "0.07"; // Read as string
const RISK_FREE_RATE = parseFloat(RISK_FREE_RATE_STR);

const NIFTY_SPOT_TOKEN = "26000";
const BANKNIFTY_SPOT_TOKEN = "26009";

// Global spot prices for this module, as in your original code
let niftySpotPrice = null;
let bankniftySpotPrice = null;

if (!CLIENT_CODE || !JWT_TOKEN || !API_KEY || !FEED_TOKEN) {
  console.error("❌ Missing SmartAPI environment variables");
  process.exit(1);
}
if (isNaN(RISK_FREE_RATE)) {
    console.error("❌ Invalid RISK_FREE_RATE in .env. Ensure it's a number.");
    process.exit(1);
}

// Your original setupWebSocket function signature and core logic are unchanged.
// It's made 'async' to accommodate the initialization of the utility, which might be async in the future,
// though the current utility's init is synchronous after DB connection.
export async function setupWebSocket(io) {
  const scripData = loadScripData();
  // This tokenMetaMap is local to the setupWebSocket scope, as in your original code.
  const tokenMetaMap = buildTokenMetaMap(scripData); 

  // --- NEW: Initialize the hourly storage utility ---
  // This is called once. It passes the tokenMetaMap for the utility's internal use.
  // The utility assumes MongoDB is already connected by your main application (server.js).
  try {
    initializeHourlyStorageUtil(tokenMetaMap); // Pass the tokenMetaMap
  } catch (error) {
    console.error("Error initializing hourly storage utility from optionFeed.js:", error.message);
    // Decide if this is critical. For now, the feed will continue.
  }
  // --- END NEW ---

  // Your existing logic for selecting options and tokens for subscription
const niftyTokens = scripData
    .filter(s => s.symbol?.startsWith("NIFTY") && (s.instrumenttype==="OPTSTK"||s.instrumenttype==="OPTIDX"|| s.instrumenttype === "FUTIDX"|| s.instrumenttype==="FUTSTK") && s.exch_seg === "NFO")
    .slice(0, 400).map(s => String(s.token).trim());

const bankniftyTokens = scripData
    .filter(s => s.symbol?.startsWith("BANKNIFTY") && (s.instrumenttype==="OPTSTK"||s.instrumenttype==="OPTIDX"||s.instrumenttype === "FUTIDX"|| s.instrumenttype==="FUTSTK") && s.exch_seg === "NFO")
    .slice(0, 400).map(s => String(s.token).trim());

  
  const optionsAnsFuturesTokens = [...new Set([...niftyTokens, ...bankniftyTokens])];
  const spotTokensForSubscription = [NIFTY_SPOT_TOKEN, BANKNIFTY_SPOT_TOKEN].filter(Boolean); // Ensure no null/undefined

  // Your existing WebSocket connection logic
  const ws = new WebSocketV2({
    jwttoken: JWT_TOKEN,
    apikey: API_KEY,
    clientcode: CLIENT_CODE,
    feedtype: FEED_TOKEN,
  });

  ws.connect()
    .then(() => {
      console.log("🔌 (Main Feed) SmartAPI WebSocket Connected");

      // Your existing fetchData calls for spot indices
      if (spotTokensForSubscription.length > 0) {
        ws.fetchData({
            correlationID: "spot_indices", action: 1, mode: 3, // Or mode 1 if only LTP needed
            exchangeType: 1, // CHECK THIS: Exchange type for spot indices (e.g., NSE=1)
            tokens: spotTokensForSubscription,
        });
      }

      // Your existing fetchData calls for options
      if (optionsAnsFuturesTokens.length > 0) {
        ws.fetchData({
            correlationID: "all_options", action: 1, mode: 3,
            exchangeType: 2, // NFO
            tokens: optionsAnsFuturesTokens,
        });
      }
      
      // Your original tick handler is called
      ws.on("tick", (data) => handleTick(data, tokenMetaMap, io)); // Pass local tokenMetaMap

    })
    .catch((err) => {
      console.error("(Main Feed) SmartAPI Connection failed:", err.message);
      setTimeout(() => setupWebSocket(io), 5000); // Your existing retry
    });

  // Your original handleTick function
  // The ONLY CHANGE here is the loop to call updateLatestInstrumentDataForStorageUtil
  function handleTick(data, currentTokenMetaMap, io_instance) { // params renamed for clarity
   // console.log("(Main Feed) Received tick data:", data);
    if (data === "pong") return;
    const rawTicksArray = Array.isArray(data) ? data : [data]; // SmartAPI may send single object or array
    
    // --- NEW: Get current time for processing this batch of ticks ---
    const currentTickProcessingTime = new Date(); 
    // --- END NEW ---

    // Update spot prices (your existing logic)
    rawTicksArray.forEach((rawTick) => {
      // SmartAPI uses 'tk' for token in tick data, 'ltp' for last traded price
      const token = String(rawTick.tk || rawTick.token).replace(/"/g, "").trim(); 
      const ltpRaw = rawTick.ltp || rawTick.last_traded_price; 
     
      if (ltpRaw) {
        const ltp = parseFloat(ltpRaw) / 100;
        if(!isNaN(ltp)) { // Ensure ltp is a valid number
           
            if (token === NIFTY_SPOT_TOKEN){
                //console.log(ltpRaw, token);
                niftySpotPrice = ltp;
                
              }
            if (token === BANKNIFTY_SPOT_TOKEN) bankniftySpotPrice = ltp;
        }
      }
    });
 // console.log(rawTicksArray, "raw ticks received")
    // Process options (your existing logic)
    // Pass currentTickProcessingTime to processInstrumentTick for accurate TTM calculation
    const optionsAndFuturesData = rawTicksArray
      .map((rawTick) => {
        return processInstrumentTick(rawTick, currentTokenMetaMap, currentTickProcessingTime)}) // MODIFIED: Pass time
      .filter(Boolean);
   // console.log(`🔄 (Main Feed) Processed ${optionsAndFuturesData.length} options from ${rawTicksArray.length} raw ticks.`);
    if (optionsAndFuturesData.length > 0) {
      // console.log("🔄 (Main Feed) Options data updated (for emit):", optionsAndFuturesData.length);
      io_instance.emit("option_and_future_Chain", optionsAndFuturesData); // Your existing emission
      console.log(optionsAndFuturesData)
      // --- NEW: Update the storage utility's latest data map with these processed objects ---
      optionsAndFuturesData.forEach(processedOptionObject => {
        // The `processedOptionObject` is the direct output of your processInstrumentTick
        updateLatestInstrumentDataForStorageUtil(processedOptionObject);
      });
      // --- END NEW ---
    }
  }

  // Your original processDepth function (UNCHANGED)
  function processDepth(entries) {
    return (entries || []).map((e) => ({
      price: e?.price ? parseFloat(e.price) / 100 : 0,
      quantity: e?.quantity ? parseInt(e.quantity) : 0,
    }));
  }

  // Your original extractOptionType function (UNCHANGED)
  function extractOptionType(symbol) {
    if (!symbol || typeof symbol !== "string") return "";
    return symbol.slice(-2).toUpperCase();
  }
  
  // Your original processOptionTick function
  // MODIFIED: It now accepts `currentTickTime` as an argument
// MODIFIED: Renamed function and added futures logic
function processInstrumentTick(rawTick, currentTokenMetaMap, currentTickTime) {
    try {
      const token = String(rawTick.tk || rawTick.token).replace(/"/g, "").trim();
      const meta = currentTokenMetaMap[token];
      //console.log("Processing tick for token:", token, "with meta:", meta);
      if (!meta || !meta.instrumenttype) { // Ensure instrumenttype exists
        // console.warn(`Skipping tick for token ${token}: Meta information or instrumenttype missing.`);
        return null;
      }

      let spotPriceForCalc = null;
      // Determine underlying based on meta or symbol convention
      let underlyingName = meta.underlying_symbol || meta.name; // Prefer meta.underlying_symbol
      if (!underlyingName) {
          if (meta.symbol.startsWith("NIFTY")) underlyingName = "NIFTY";
          else if (meta.symbol.startsWith("BANKNIFTY")) underlyingName = "BANKNIFTY";
          else if (meta.symbol.startsWith("FINNIFTY")) underlyingName = "FINNIFTY";
          else if (meta.symbol.startsWith("MIDCPNIFTY")) underlyingName = "MIDCPNIFTY";
          // Add more specific underlying detections if needed
      }

      if (underlyingName === "NIFTY") spotPriceForCalc = niftySpotPrice;
      else if (underlyingName === "BANKNIFTY") spotPriceForCalc = bankniftySpotPrice;
      // For stock derivatives, you'd need to fetch their respective spot prices.

      const marketPriceLTP = parseFloat(rawTick.ltp || rawTick.last_traded_price) / 100;
      if (isNaN(marketPriceLTP)) {
        // console.warn(`Skipping tick for token ${token}: Invalid LTP.`);
        return null;
      }

      let T_to_expiry_years = null;
      let strike = null;
      let optionType = null;
      let iv = null;
      let greeks = { delta: null, gamma: null, theta: null, vega: null };
      let forwardOrFuturePrice = null; // Will hold F for options, or LTP for futures

      const isOption = meta.instrumenttype === "OPTIDX" || meta.instrumenttype === "OPTSTK";
      const isFuture = meta.instrumenttype === "FUTIDX" || meta.instrumenttype === "FUTSTK";

      if (isOption) {
        if (spotPriceForCalc === null) {
          // console.warn(`Skipping option tick for ${token}: Spot price for ${underlyingName} not available.`);
          return null; // Spot price is essential for option IV & Greeks
        }
        T_to_expiry_years = timeToExpiry(meta.expiry, currentTickTime);
        if (T_to_expiry_years <= 0) {
          // console.warn(`Skipping option tick for ${token}: Expired (TTE <= 0).`);
          return null; // Option expired
        }

        // For options, 'F' is the forward price of the underlying.
        // SmartAPI 'f' field might provide this for stock options, or it can be calculated.
        forwardOrFuturePrice = (rawTick.f && (meta.instrumenttype === "OPTSTK" || meta.instrumenttype === "OPTIDX"))
          ? parseFloat(rawTick.f) / 100
          : spotPriceForCalc * Math.exp(RISK_FREE_RATE * T_to_expiry_years);

        strike = Number(meta.strike); // Assuming meta.strike is already in correct units (not paisa)
        optionType = meta.optionType || extractOptionType(meta.symbol); // Prefer meta.optionType

        if (isNaN(strike) || !optionType) {
            console.warn(`Skipping option ${token}: Invalid strike or optionType.`);
            return null;
        }
        
        // Use mid-price of best bid/ask for IV calculation if spread is reasonable
        const bestBidRaw = rawTick.bp || rawTick.best_5_buy_data?.[0]?.price;
        const bestAskRaw = rawTick.sp || rawTick.best_5_sell_data?.[0]?.price;
        let marketPriceForIV = marketPriceLTP;

        if (bestBidRaw && bestAskRaw) {
            const bestBid = parseFloat(bestBidRaw) / 100;
            const bestAsk = parseFloat(bestAskRaw) / 100;
            if (bestBid > 0 && bestAsk > 0 && marketPriceForIV > 0 && (bestAsk - bestBid) / marketPriceForIV < 0.10) { // 10% spread check
                marketPriceForIV = (bestBid + bestAsk) / 2;
            }
        }
        
        const calculatedIv = impliedVolBisection(marketPriceForIV, forwardOrFuturePrice, strike, T_to_expiry_years, RISK_FREE_RATE, optionType);
        
        if (!isNaN(calculatedIv) && isFinite(calculatedIv) && calculatedIv > 0.0001) { // Ensure IV is positive and valid
          iv = calculatedIv; // Store as decimal
          const calculatedGreeks = black76Greeks(forwardOrFuturePrice, strike, T_to_expiry_years, RISK_FREE_RATE, iv, optionType);
          greeks = {
            delta: parseFloat(calculatedGreeks.delta.toFixed(4)),
            gamma: parseFloat(calculatedGreeks.gamma.toFixed(6)),
            theta: parseFloat(calculatedGreeks.theta.toFixed(2)),
            vega: parseFloat((calculatedGreeks.vega).toFixed(4)), // vega is often per 1% or 1 vol point
                                                                  // if black76Greeks gives vega per 100% IV change, divide by 100 here.
                                                                  // Assuming your black76Greeks.vega is for 1 unit of IV (e.g. 0.01 change)
          };
        } else {
          // If IV calc fails, greeks remain null or default. IV remains null.
        }

      } else if (isFuture) {
        forwardOrFuturePrice = marketPriceLTP; // For futures, its LTP is its current price (F)
        T_to_expiry_years = timeToExpiry(meta.expiry, currentTickTime); // TTM for future
        
        // Simplified Greeks for Futures
        greeks.delta = 1.0000; // Delta of a future is 1 per unit of underlying
        greeks.gamma = 0.000000;
        greeks.theta = 0.00;   // Simplified; can be non-zero due to cost of carry
        greeks.vega = 0.00;    // Not sensitive to IV

        // Fields not applicable to futures
        strike = undefined;
        optionType = undefined;
        iv = undefined;
      } else {
        // console.warn(`Skipping tick for token ${token}: Unknown instrumenttype '${meta.instrumenttype}'.`);
        return null; // Neither an option nor a future type we are explicitly handling
      }

      const bestBidRaw = rawTick.bp || rawTick.best_5_buy_data?.[0]?.price;
      const bestAskRaw = rawTick.sp || rawTick.best_5_sell_data?.[0]?.price;

      return {
        underlying: underlyingName || meta.symbol, // Best guess for underlying
        assetType: (meta.instrumenttype === "OPTIDX" || meta.instrumenttype === "FUTIDX") ? "INDEX" : "EQUITY", // Heuristic
        symbol: meta.symbol,
        token: token, 
        instrumenttype: meta.instrumenttype,
        expiry: meta.expiry,
        expiryDate: meta.expiryDate || meta.expiry, // Prefer standardized expiryDate if available in meta
        strike: strike !== undefined ? strike.toFixed(2) : null, // Corrected: assuming strike in meta is already absolute
        optionType: optionType,
        lastPrice: marketPriceLTP.toFixed(2),
        iv: iv !== null ? (iv * 100).toFixed(2) : null, // IV in percentage
        greeks: greeks,
        marketData: {
          spot: spotPriceForCalc ? parseFloat(spotPriceForCalc.toFixed(2)) : null,
          // For options, forwardOrFuturePrice is F. For futures, it's their LTP.
          futures: forwardOrFuturePrice ? parseFloat(forwardOrFuturePrice.toFixed(2)) : null, 
          oi: parseInt(rawTick.oi || rawTick.open_interest || 0),
          bidAsk: {
            bestBid: bestBidRaw ? (parseFloat(bestBidRaw)/100).toFixed(2) : "0.00",
            bestAsk: bestAskRaw ? (parseFloat(bestAskRaw)/100).toFixed(2) : "0.00",
            spread: (bestBidRaw && bestAskRaw && parseFloat(bestAskRaw) > 0 && parseFloat(bestBidRaw) > 0) ? ((parseFloat(bestAskRaw) - parseFloat(bestBidRaw))/100).toFixed(2) : "0.00",
          },
          depth: {
            bids: processDepth(rawTick.best_5_buy_data), 
            asks: processDepth(rawTick.best_5_sell_data), 
          },
        },
        contractInfo: {
          lotSize: parseInt(meta?.lotSize || meta?.lotsize || (meta.symbol.startsWith("NIFTY") ? 50 : meta.symbol.startsWith("BANKNIFTY") ? 15 : 1)),
          tickSize: parseFloat(meta?.tickSize || meta?.tick_size || 0.05),
          expiryType: getExpiryType(meta.expiry),
        },
        timeToExpiryDays: T_to_expiry_years !== null && !isNaN(T_to_expiry_years) ? (T_to_expiry_years * 365).toFixed(1) : null,
        // rawFeedTimestamp: rawTick.ft ? parseInt(rawTick.ft) : null 
      };
    } catch (error) {
      console.error(`Error in processInstrumentTick for token ${rawTick?.tk || rawTick?.token}:`, error.message, error.stack);
      return null;
    }
}

  // Socket.IO setup (UNCHANGED)
  io.on("connection", (socket) => {
    console.log("(Main Feed) Client connected:", socket.id);
    socket.on("disconnect", () =>
      console.log("(Main Feed) Client disconnected:", socket.id)
    );
  });
}
