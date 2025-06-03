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
  const niftyOptions = scripData
    .filter(s => s.symbol?.startsWith("NIFTY") && s.instrumenttype === "OPTIDX" && s.exch_seg === "NFO")
    .slice(0, 400).map(s => String(s.token).trim());
  const bankniftyOptions = scripData
    .filter(s => s.symbol?.startsWith("BANKNIFTY") && s.instrumenttype === "OPTIDX" && s.exch_seg === "NFO")
    .slice(0, 400).map(s => String(s.token).trim());
  
  const optionTokens = [...new Set([...niftyOptions, ...bankniftyOptions])];
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
      if (optionTokens.length > 0) {
        ws.fetchData({
            correlationID: "all_options", action: 1, mode: 3,
            exchangeType: 2, // NFO
            tokens: optionTokens,
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

    // Process options (your existing logic)
    // Pass currentTickProcessingTime to processOptionTick for accurate TTM calculation
    const optionsData = rawTicksArray
      .map((rawTick) => {
        
        return processOptionTick(rawTick, currentTokenMetaMap, currentTickProcessingTime)}) // MODIFIED: Pass time
      .filter(Boolean);
   // console.log(`🔄 (Main Feed) Processed ${optionsData.length} options from ${rawTicksArray.length} raw ticks.`);
    if (optionsData.length > 0) {
      // console.log("🔄 (Main Feed) Options data updated (for emit):", optionsData.length);
      io_instance.emit("option_chain", optionsData); // Your existing emission
       console.log(optionsData)
      // --- NEW: Update the storage utility's latest data map with these processed objects ---
      optionsData.forEach(processedOptionObject => {
        // The `processedOptionObject` is the direct output of your `processOptionTick`
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
  function processOptionTick(rawTick, currentTokenMetaMap, currentTickTime) {
    // console.log(rawTick)
    try {
      // SmartAPI uses 'tk' for token in tick data, 'ltp' for last traded price
      const token = String(rawTick.tk || rawTick.token).replace(/"/g, "").trim();
      const meta = currentTokenMetaMap[token];
     
      if (!meta) return null;
     
      // This function only processes options as per its original logic
      // if (!(meta.instrumenttype === "OPTIDX" || meta.instrumenttype === "OPTSTK")) {
      //   return null; 
      // }
     
      let spotPrice = null;
      if (meta.symbol.startsWith("NIFTY")) spotPrice = niftySpotPrice;
      else if (meta.symbol.startsWith("BANKNIFTY")) spotPrice = bankniftySpotPrice;
      
      if (spotPrice === null && (meta.symbol.startsWith("NIFTY") || meta.symbol.startsWith("BANKNIFTY"))) {
        return null; // Spot price for the underlying is not yet available
      }
      //console.log(spotPrice)
      // --- MODIFIED: Use currentTickTime for TTM calculation ---
      const T = timeToExpiry(meta.expiry, currentTickTime); 
      // --- END MODIFIED ---
      if (T <= 0) return null; // Option expired or TTM is zero/negative

      const marketPriceLTP = parseFloat(rawTick.ltp || rawTick.last_traded_price) / 100;
      if (isNaN(marketPriceLTP)) return null; // No valid LTP
      
      // SmartAPI provides 'f` field for individual contract future price (usually for stock futures/options)
      // For index options, calculated F is more common if direct underlying future tick isn't used.
      let F = (rawTick.f && (meta.instrumenttype === "OPTSTK" || meta.instrumenttype === "OPTIDX")) // Use if 'f' is present in tick
        ? parseFloat(rawTick.f) / 100  // Assuming 'f' is already the scaled future price from feed
        : spotPrice * Math.exp(RISK_FREE_RATE * T);

      const bestBidRaw = rawTick.bp || rawTick.best_5_buy_data?.[0]?.price; // SmartAPI uses 'bp' for best bid price
      const bestAskRaw = rawTick.sp || rawTick.best_5_sell_data?.[0]?.price; // SmartAPI uses 'sp' for best sell price
      let marketPriceForIV = marketPriceLTP; // Default to LTP for IV calculation

      if (bestBidRaw && bestAskRaw) {
          const bestBid = parseFloat(bestBidRaw) / 100;
          const bestAsk = parseFloat(bestAskRaw) / 100;
          // Ensure marketPriceForIV (LTP) is positive to avoid division by zero or negative spread issues
          if (bestBid > 0 && bestAsk > 0 && marketPriceForIV > 0 && (bestAsk - bestBid) / marketPriceForIV < 0.10) { // Your 10% spread
              marketPriceForIV = (bestBid + bestAsk) / 2;
          }
      }
      
      const strike = Number(meta.strike);
      const optionType = extractOptionType(meta.symbol);
      
      const iv = impliedVolBisection(marketPriceForIV, F, strike, T, RISK_FREE_RATE, optionType);
      if (isNaN(iv) || !isFinite(iv)) { // Check for invalid IV
        // console.warn(`IV calculation failed for ${token}. IV: ${iv}, MktPriceIV: ${marketPriceForIV}, F: ${F}, S: ${strike}, T: ${T}`);
        return null; // Cannot calculate greeks without valid IV
      }


      const greeks = black76Greeks(F, strike, T, RISK_FREE_RATE, iv, optionType);

      // This is the object structure your frontend expects AND the storage utility will consume
      return {
        underlying: meta.symbol.startsWith("NIFTY") ? "NIFTY" : "BANKNIFTY",
        assetType: "INDEX", // As per your original structure
        symbol: meta.symbol,
        token: token, 
        instrumenttype: meta.instrumenttype, // e.g., "OPTIDX"
        expiry: meta.expiry, // Original string 'DDMONYYYY'
        strike: strike.toFixed(2),
        optionType,
        lastPrice: marketPriceLTP.toFixed(2), // LTP of the option
        iv: (iv * 100).toFixed(2),
        greeks: {
          delta: parseFloat(greeks.delta.toFixed(4)),
          gamma: parseFloat(greeks.gamma.toFixed(6)),
          theta: parseFloat(greeks.theta.toFixed(2)),
          vega: parseFloat((greeks.vega / 100).toFixed(2)), // Consistent with your example output
        },
        marketData: {
          spot: spotPrice ? parseFloat(spotPrice.toFixed(2)) : null,
          futures: parseFloat(F.toFixed(2)), // This is the calculated F for this option
          oi: parseInt(rawTick.oi || rawTick.open_interest || 0), // SmartAPI usually 'oi'
          bidAsk: {
            bestBid: bestBidRaw ? (parseFloat(bestBidRaw)/100).toFixed(2) : "0.00",
            bestAsk: bestAskRaw ? (parseFloat(bestAskRaw)/100).toFixed(2) : "0.00",
            spread: (bestBidRaw && bestAskRaw) ? ((parseFloat(bestAskRaw) - parseFloat(bestBidRaw))/100).toFixed(2) : "0.00",
          },
          depth: { // Using your processDepth
            bids: processDepth(rawTick.best_5_buy_data), 
            asks: processDepth(rawTick.best_5_sell_data), 
          },
        },
        contractInfo: {
          lotSize: parseInt(meta?.lotSize || meta?.lotsize || 50),
          tickSize: parseFloat(meta?.tickSize || meta?.tick_size || 0.05),
          expiryType: getExpiryType(meta.expiry),
        },
        // You can add rawTick.ft (feed timestamp) here if your transform function wants it
        // rawFeedTimestamp: rawTick.ft ? parseInt(rawTick.ft) : null 
      };
    } catch (error) {
    //   console.error(`Error processing option tick for token ${rawTick?.tk || rawTick?.token}:`, error.message);
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
