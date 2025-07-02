// backend/utils/websocket.js
import { WebSocketV2 } from "smartapi-javascript";
import dotenv from "dotenv";
import {
  loadScripData,
  buildTokenMetaMap,
  getExpiryType,
} from "./scripLoader.js";
import {
  black76Greeks,
  impliedVolBisection,
  timeToExpiry,
} from "./optionUtils.js";
import { AppConfig } from "./configLoader.js";
import { selectInstrumentsFromConfig } from "./instrumentSelector.js";
import {
  initializeHourlyStorageUtil,
  updateLatestInstrumentDataForStorageUtil,
} from "./hourlyStorageUtil.js";

dotenv.config({ path: "../.env" }); // Adjust if .env is in a different relative location

const {
  CLIENT_CODE,
  JWT_TOKEN,
  API_KEY,
  FEED_TOKEN,
  RISK_FREE_RATE = "0.07",
} = process.env;
if (!CLIENT_CODE || !JWT_TOKEN || !API_KEY || !FEED_TOKEN) {
  console.error("❌ FATAL: Missing required SmartAPI environment variables.");
  process.exit(1);
}
const RFR = parseFloat(RISK_FREE_RATE);
const exchangeTypeMap = { NSE: 1, NFO: 2, BSE: 3, BFO: 4, MCX: 5, CDS: 7 };
const reverseExchangeMap = {
  1: "NSE",
  2: "NFO",
  3: "BSE",
  4: "BFO",
  5: "MCX",
  7: "CDS",
};

let spotPrices = new Map();
let tokenMetaMap = {};
let scripMasterList = [];
let activeConnections = [];

export function setupWebSocket(io) {
  console.log("🚀 Initializing WebSocket feed setup...");
  activeConnections = [];
  scripMasterList = loadScripData();
  tokenMetaMap = buildTokenMetaMap(scripMasterList);
  initializeHourlyStorageUtil();
  createAndConnectWebSocketInstance(1, io);
}

export function shutdownWebSocket() {
  if (activeConnections.length === 0) return;
  console.log(
    `Gearing Down... Shutting down ${activeConnections.length} connection(s)...`
  );
  activeConnections.forEach((ws) => {
    try {
      if (ws && typeof ws.close === "function") ws.close();
    } catch (e) {
      console.error("Error closing WebSocket:", e.message);
    }
  });
  activeConnections = [];
  console.log("Data feed successfully shut down.");
}

function createAndConnectWebSocketInstance(instanceIndex, io) {
  const ws = new WebSocketV2({
    jwttoken: JWT_TOKEN.trim(),
    apikey: API_KEY.trim(),
    clientcode: CLIENT_CODE,
    feedtype: FEED_TOKEN.trim(),
  });
  activeConnections.push(ws);

  const masterTickHandler = createMasterTickHandler(ws, instanceIndex, io);
  ws.on("tick", masterTickHandler);
  ws.on("error", (err) => console.error(`[WS-${instanceIndex}] Error:`, err));
  ws.on("close", (code, reason) =>
    console.log(
      `[WS-${instanceIndex}] Closed. Code: ${code}, Reason: ${reason}`
    )
  );

  console.log(`[WS-${instanceIndex}] Attempting to connect...`);
  ws.connect()
    .then(() =>
      console.log(
        `✅ [WS-${instanceIndex}] Connection established. Awaiting initial spot prices...`
      )
    )
    .catch((err) =>
      console.error(`❌ [WS-${instanceIndex}] Initial connection FAILED:`, err)
    );
}

function createMasterTickHandler(ws, instanceIndex, io) {
  let state = "AWAITING_SPOT_PRICES";
  const underlyings = { ...AppConfig.indices, ...AppConfig.equities };
  const requiredSpotTokens = Object.values(underlyings)
    .filter((config) => config.options?.enabled || config.futures?.enabled)
    .map((config) => config.spotToken);

  if (requiredSpotTokens.length > 0) {
    console.log(
      `[WS-${instanceIndex}] Step 1: Subscribing to ${requiredSpotTokens.length} spot tokens...`
    );
    ws.fetchData({
      correlationID: `spot_sub_${instanceIndex}`,
      action: 1,
      mode: 1,
      exchangeType: 1,
      tokens: requiredSpotTokens,
    });
  } else {
    state = "PROCESSING_ALL";
  }

  return (data) => {
    if (data === "pong") return;
    const rawTicks = Array.isArray(data) ? data : [data];

    if (state === "AWAITING_SPOT_PRICES") {
      rawTicks.forEach((tick) => {
        const sanitizedToken = String(tick.tk || tick.token).replace(/\D/g, "");
        if (requiredSpotTokens.includes(sanitizedToken)) {
          const compositeKey = `${sanitizedToken}_${
            reverseExchangeMap[String(tick.e || tick.exchange_type)]
          }`;
          const meta = tokenMetaMap[compositeKey];
          if (meta) {
            let price = parseFloat(tick.ltp || tick.last_traded_price)/100;
            spotPrices.set(meta.underlying_symbol, price);
            console.log(
              `   -> Received spot price for ${
                meta.underlying_symbol
              }: ${price.toFixed(2)}`
            );
          }
        }
      });

      if (spotPrices.size >= requiredSpotTokens.length) {
        console.log(`[WS-${instanceIndex}] All spot prices received.`);
        state = "PROCESSING_ALL";
        console.log(`[WS-${instanceIndex}] State changed to '${state}'.`);
        subscribeToDerivatives(ws, instanceIndex);
      }
    } else if (state === "PROCESSING_ALL") {
      processAllTicks(rawTicks, io);
    }
  };
}

function subscribeToDerivatives(ws, instanceIndex) {
  console.log(
    `[WS-${instanceIndex}] Step 2: Selecting all derivative instruments...`
  );
  const tokensByExchange = selectInstrumentsFromConfig(
    scripMasterList,
    spotPrices
  );
  const spotTokens = new Set(
    Object.values({ ...AppConfig.indices, ...AppConfig.equities }).map(
      (c) => c.spotToken
    )
  );

  for (const [exchange, tokens] of tokensByExchange.entries()) {
    const derivativeTokens = tokens.filter((t) => !spotTokens.has(t));
    if (derivativeTokens.length === 0) continue;

    const exchangeType = exchangeTypeMap[exchange];
    if (exchangeType) {
      console.log(
        `[WS-${instanceIndex}] Subscribing to ${derivativeTokens.length} derivative tokens on ${exchange}.`
      );
      ws.fetchData({
        correlationID: `deriv_sub_${instanceIndex}_${exchange}`,
        action: 1,
        mode: 2,
        exchangeType: exchangeType,
        tokens: derivativeTokens,
      });
    }
  }
}

function processAllTicks(rawTicks, io) {
  const tickProcessingTime = new Date();
  const processedData = [];

  for (const rawTick of rawTicks) {
    const sanitizedToken = String(rawTick.tk || rawTick.token).replace(
      /\D/g,
      ""
    );
    const exchangeSegment =
      reverseExchangeMap[String(rawTick.e || rawTick.exchange_type)];
    if (!exchangeSegment) continue;
    const compositeKey = `${sanitizedToken}_${exchangeSegment}`;
    const meta = tokenMetaMap[compositeKey];
    if (!meta) continue;

    let price = parseFloat(rawTick.ltp || rawTick.last_traded_price);
    if (isNaN(price)) continue;

    if (meta.instrumenttype === "INDEX" || meta.instrumenttype === "AMXIDX") {
      price /= 100;
    } else if (
      meta.instrumenttype.startsWith("OPT") ||
      meta.instrumenttype.startsWith("FUT")
    ) {
      price /= 100; // Derivative prices are often in paisa
    }

    if (
      meta.instrumenttype === "INDEX" ||
      meta.instrumenttype === "EQ" ||
      meta.instrumenttype === "AMXIDX"
    ) {
      spotPrices.set(meta.underlying_symbol, price);
    }

    const processed = processInstrumentTick(
      rawTick,
      meta,
      price,
      tickProcessingTime
    );
    if (processed) {
      processedData.push(processed);
      updateLatestInstrumentDataForStorageUtil(processed);
    }
  }

  if (processedData.length > 0) {
    io.emit("option_and_future_Chain", processedData);
    console.log(processedData)
  }
}

function processInstrumentTick(rawTick, meta, marketPrice, currentTickTime) {
  try {
    const isOption = meta.instrumenttype.startsWith("OPT");
    const isFuture = meta.instrumenttype.startsWith("FUT");

    let greeks = { delta: null, gamma: null, theta: null, vega: null };
    let iv = null;
    let T = timeToExpiry(meta.expiry, currentTickTime);

    if (isOption) {
      const spotPrice = spotPrices.get(meta.underlying_symbol);
      if (!spotPrice || T <= 0) return null;

      const forwardPrice = spotPrice * Math.exp(RFR * T);
      const strikePrice = meta.strike;

      iv = impliedVolBisection(
        marketPrice,
        forwardPrice,
        strikePrice,
        T,
        RFR,
        meta.optionType
      );
      if (iv > 0.0001) {
        const calculatedGreeks = black76Greeks(
          forwardPrice,
          strikePrice,
          T,
          RFR,
          iv,
          meta.optionType
        );
        greeks = {
          delta: parseFloat(calculatedGreeks.delta.toFixed(4)) /* ... */,
          gamma: parseFloat(calculatedGreeks.gamma.toFixed(4)),
          theta: parseFloat(calculatedGreeks.theta.toFixed(4)),
          vega: parseFloat(calculatedGreeks.vega.toFixed(4)),
        };
      }
    } else if (isFuture) {
      greeks = { delta: 1.0, gamma: 0.0, theta: 0.0, vega: 0.0 };
    } else if (!isOption && !isFuture) {
      // This is a spot instrument. We still want to send its data.
    } else {
      return null;
    }

    return {
      token: meta.token,
      symbol: meta.symbol,
      underlying: meta.underlying_symbol,
      instrumenttype: meta.instrumenttype,
      expiry: meta.expiry,
      strike: meta.strike,
      optionType: meta.optionType,
      lastPrice: marketPrice.toFixed(2),
      iv: iv !== null ? (iv * 100).toFixed(2) : null,
      greeks: greeks,
      marketData: {
        spot: spotPrices.get(meta.underlying_symbol)?.toFixed(2) || null,
        oi: parseInt(rawTick.oi || 0),
        volume: parseInt(rawTick.v || 0),
      },
      contractInfo: {
        lotSize: meta.lotSize,
        tickSize: meta.tickSize,
        expiryType: getExpiryType(meta.expiry),
      },
      timeToExpiryDays: (T * 365).toFixed(1),
    };
  } catch (error) {
    console.error(`Error processing tick for ${meta.symbol}:`, error);
    return null;
  }
}
