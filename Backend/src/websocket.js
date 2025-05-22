// backend/optionFeed.js
import { WebSocketV2 } from 'smartapi-javascript';
import {
  loadScripData,
  getExpiryType,
  buildTokenMetaMap,
} from './scripLoader.js';
import { black76Greeks, impliedVolBisection, timeToExpiry } from './optionUtils.js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const CLIENT_CODE = process.env.CLIENT_CODE;
const JWT_TOKEN = process.env.JWT_TOKEN?.trim();
const API_KEY = process.env.API_KEY?.trim();
const FEED_TOKEN = process.env.FEED_TOKEN?.trim();
const RISK_FREE_RATE = 0.07; // Use latest 91-day T-bill yield or as per your policy

const NIFTY_SPOT_TOKEN = '26000';
const BANKNIFTY_SPOT_TOKEN = '26009';

if (!CLIENT_CODE || !JWT_TOKEN || !API_KEY || !FEED_TOKEN) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

export function setupWebSocket(io) {
  const scripData = loadScripData();

// Get 200 NIFTY and 200 BANKNIFTY options
const niftyOptions = scripData.filter(s =>
typeof s.symbol === 'string' &&
s.symbol.startsWith('NIFTY') &&
s.instrumenttype === 'OPTIDX' &&
s.exch_seg === 'NFO'
).slice(0, 400);

const bankniftyOptions = scripData.filter(s =>
typeof s.symbol === 'string' &&
s.symbol.startsWith('BANKNIFTY') &&
s.instrumenttype === 'OPTIDX' &&
s.exch_seg === 'NFO'
).slice(0, 400);

  const optionChain = [...niftyOptions, ...bankniftyOptions];
  const tokenMetaMap = buildTokenMetaMap(optionChain);
  const optionTokens = optionChain.map(scrip => String(scrip.token).trim());

  let niftySpotPrice = null;
  let bankniftySpotPrice = null;

  const ws = new WebSocketV2({
    jwttoken: JWT_TOKEN,
    apikey: API_KEY,
    clientcode: CLIENT_CODE,
    feedtype: FEED_TOKEN
  });

  ws.connect().then(() => {
    console.log("🔌 WebSocket Connected");

    ws.fetchData({
      correlationID: 'spot_indices',
      action: 1,
      mode: 3,
      exchangeType: 1,
      tokens: [NIFTY_SPOT_TOKEN, BANKNIFTY_SPOT_TOKEN]
    });

    ws.fetchData({
      correlationID: 'all_options',
      action: 1,
      mode: 3,
      exchangeType: 2,
      tokens: optionTokens
    });

    ws.on('tick', data => handleTick(data, tokenMetaMap, io));
  }).catch(err => {
    console.error("Connection failed:", err);
    setTimeout(() => setupWebSocket(io), 5000);
  });

  function handleTick(data, tokenMetaMap, io) {
    if (data === 'pong') return;
    const ticks = Array.isArray(data) ? data : [data];
    console.log(data)
    // Update spot prices
    ticks.forEach(tick => {
      const token = String(tick.token).replace(/"/g, '').trim();
      if (token === NIFTY_SPOT_TOKEN) {
        niftySpotPrice = parseFloat(tick.last_traded_price) / 100;
      }
      if (token === BANKNIFTY_SPOT_TOKEN) {
        bankniftySpotPrice = parseFloat(tick.last_traded_price) / 100;
      }
    });

    // Process options
    const optionsData = ticks
      .map(tick => processOptionTick(tick, tokenMetaMap))
      .filter(Boolean);

    if (optionsData.length > 0) {
      console.log("🔄 Options data updated:", optionsData);
      io.emit('option_chain', optionsData);
    }
  }

  function processDepth(entries) {
    return (entries || []).map(e => ({
      price: e?.price ? parseFloat(e.price) / 100 : 0,
      quantity: e?.quantity ? parseInt(e.quantity) : 0
    }));
  }

  function extractOptionType(symbol) {
    if (!symbol || typeof symbol !== "string") return "";
    return symbol.slice(-2).toUpperCase();
  }

  function processOptionTick(tick, tokenMetaMap) {
    try {
      const token = String(tick.token).replace(/"/g, '').trim();
      const meta = tokenMetaMap[token];
      if (!meta) return null;
     
      // Pick correct spot price
      let spotPrice = null;
      if (meta.symbol.startsWith('NIFTY')) spotPrice = niftySpotPrice;
      else if (meta.symbol.startsWith('BANKNIFTY')) spotPrice = bankniftySpotPrice;
      if (!spotPrice) return null;

      const T = timeToExpiry(meta.expiry);
      if (T <= 0) return null;
   
      // Use actual futures price if available from tick, else calculate
      let F = tick.futures_price
        ? parseFloat(tick.futures_price) / 100
        : spotPrice * Math.exp(RISK_FREE_RATE * T);

      // Use mid-price if both bid and ask are available and spread is reasonable, else LTP
      const bestBid = tick.best_5_buy_data?.[0]?.price ? parseFloat(tick.best_5_buy_data[0].price) / 100 : 0;
      const bestAsk = tick.best_5_sell_data?.[0]?.price ? parseFloat(tick.best_5_sell_data[0].price) / 100 : 0;
      let marketPrice = parseFloat(tick.last_traded_price) / 100;
      if (bestBid > 0 && bestAsk > 0 && (bestAsk - bestBid) / marketPrice < 0.10) { // 10% spread threshold
        marketPrice = (bestBid + bestAsk) / 2;
      }

      const strike = Number(meta.strike);
      const optionType = extractOptionType(meta.symbol);
     // console.log("Option Type:", optionType);
      // Calculate IV with intrinsic value check
      const iv = impliedVolBisection(
        marketPrice, F, strike, T, RISK_FREE_RATE, optionType
      );

      const greeks = black76Greeks(F, strike, T, RISK_FREE_RATE, iv, optionType);

      return {
        underlying: meta.symbol.startsWith('NIFTY') ? "NIFTY" : "BANKNIFTY",
        assetType: "INDEX",
        symbol: meta.symbol,
        token: meta.token,
        expiry: meta.expiry,
        strike: strike.toFixed(2),
        optionType,
        lastPrice: marketPrice.toFixed(2),
        iv: (iv * 100).toFixed(2),
        greeks: {
          delta: parseFloat(greeks.delta.toFixed(4)),
          gamma: parseFloat(greeks.gamma.toFixed(6)),
          theta: parseFloat(greeks.theta.toFixed(2)),
          vega: parseFloat((greeks.vega / 100).toFixed(2))
        },
        marketData: {
          spot: parseFloat(spotPrice.toFixed(2)),
          futures: parseFloat(F.toFixed(2)),
          oi: parseInt(tick.open_interest) || 0,
          bidAsk: {
            bestBid: parseFloat(bestBid.toFixed(2)),
            bestAsk: parseFloat(bestAsk.toFixed(2)),
            spread: parseFloat((bestAsk - bestBid).toFixed(2))
          },
          depth: {
            bids: processDepth(tick.best_5_buy_data),
            asks: processDepth(tick.best_5_sell_data)
          }
        },
        contractInfo: {
          lotSize: meta?.lotSize || meta?.lotsize || 50,
          tickSize: meta?.tickSize || meta?.tick_size || 0.05,
          expiryType: getExpiryType(meta.expiry)
        }
      };
    } catch (error) {
      console.error('Error processing option:', error);
      return null;
    }
  }

  // Socket.IO setup
  io.on('connection', socket => {
    console.log("Client connected:", socket.id);
    socket.on('disconnect', () => console.log("Client disconnected:", socket.id));
  });
}