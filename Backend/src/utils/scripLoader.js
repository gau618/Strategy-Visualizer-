import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadScripData(relativePath = '../../OpenAPIScripMaster.json') {
  try {
    const absolutePath = path.join(__dirname, relativePath);
    const raw = fs.readFileSync(absolutePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('❌ Error loading scrip data:', error);
    return [];
  }
}


export function filterOptionChain(scripData) {
  return scripData.filter(scrip =>
    scrip.instrumenttype === 'OPTIDX' &&
    scrip.exch_seg === 'NFO' &&
    (

      scrip.symbol.startsWith('BANKNIFTY')
    )
  );
}
function extractOptionType(symbol) {
  if (!symbol || typeof symbol !== "string") return "";
  const match = symbol.match(/(CE|PE)$/i);
  return match ? match[1].toUpperCase() : "";
}
export function normalizeExpiry(expiryStr) {
  const months = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04',
    MAY: '05', JUN: '06', JUL: '07', AUG: '08',
    SEP: '09', OCT: '10', NOV: '11', DEC: '12'
  };
  
  const match = expiryStr.match(/(\d{2})([A-Z]{3})(\d{4})/i) || 
                expiryStr.match(/(\d{2})([A-Z]{3})(\d{2})/i);
  if (!match) return 'Invalid';
  
  let [, day, month, year] = match;
  if (year.length === 2) year = `20${year}`;
  
  return `${year}-${months[month.toUpperCase()]}-${day.padStart(2, '0')}`;
}
// Helper function to extract CE/PE from symbol (if not directly available in scrip object)
// This is a simplified version; complex symbols might need more robust parsing.
function extractOptionTypeFromSymbol(symbol) {
  if (!symbol || typeof symbol !== "string") return null;
  const lastTwo = symbol.slice(-2).toUpperCase();
  if (lastTwo === "CE" || lastTwo === "PE") {
    return lastTwo;
  }
  // Add more sophisticated regex if your option symbols don't end with CE/PE directly
  // e.g., if it's embedded like NIFTY2460322500CE
  const matchCE = symbol.match(/CE$/i);
  if (matchCE) return "CE";
  const matchPE = symbol.match(/PE$/i);
  if (matchPE) return "PE";
  return null;
}

export function buildTokenMetaMap(instrumentMasterList) { // Renamed parameter for clarity
  const map = {};
  // This regex is specific to certain NFO option symbol formats.
  // Example: NIFTY27JUN2423000CE (DayMonthYearStrikeOptType)
  // It might not be universally applicable to all symbol formats or brokers.
  // Prefer direct fields from scripData if available (scrip.strike, scrip.optionType).
  const optionSymbolPattern = /^(NIFTY|BANKNIFTY|FINNIFTY|MIDCPNIFTY|[A-Z&+-]+)(\d{2})([A-Z]{3})(\d{2})(\d+)([CP]E)$/i;
  // For NIFTY, BANKNIFTY, etc. The first group ([A-Z&+-]+) is made more generic for other underlyings.

  if (!Array.isArray(instrumentMasterList)) {
    console.error("buildTokenMetaMap: Expected instrumentMasterList to be an array, received:", typeof instrumentMasterList);
    return map;
  }

  instrumentMasterList.forEach(scrip => {
    // Basic validation for essential scrip fields
    if (!scrip || !scrip.token || !scrip.symbol || !scrip.instrumenttype || !scrip.expiry || scrip.lotsize === undefined || scrip.tick_size === undefined) {
      // console.warn("Skipping scrip due to missing essential fields:", scrip?.symbol || scrip?.token || "Unknown scrip");
      return;
    }

    const tokenKey = String(scrip.token).replace(/"/g, '').trim();
    
    // Attempt to determine underlying symbol (this depends heavily on your scripData structure)
    // For NIFTY/BANKNIFTY options/futures, scrip.name might be 'NIFTY', 'BANKNIFTY'.
    // Or, it might be the full symbol, requiring parsing.
    let underlyingSymbol = scrip.name; // Assume scrip.name is the underlying (e.g., "NIFTY", "RELIANCE")
    if (scrip.symbol.startsWith("NIFTY")) underlyingSymbol = "NIFTY";
    else if (scrip.symbol.startsWith("BANKNIFTY")) underlyingSymbol = "BANKNIFTY";
    else if (scrip.symbol.startsWith("FINNIFTY")) underlyingSymbol = "FINNIFTY";
    else if (scrip.symbol.startsWith("MIDCPNIFTY")) underlyingSymbol = "MIDCPNIFTY";
    // For stock derivatives, scrip.name might be the stock code.

    const baseMeta = {
      token: tokenKey,
      symbol: scrip.symbol,
      expiry: scrip.expiry, // Expiry date string from scrip data
      instrumenttype: scrip.instrumenttype,
      lotSize: parseInt(scrip.lotsize),
      tickSize: parseFloat(scrip.tick_size),
      underlying_symbol: underlyingSymbol, // Name of the base underlying index/stock
      name: scrip.name // Original name field from scrip
    };

    if (isNaN(baseMeta.lotSize)) {
      console.warn(`Invalid lotSize for ${scrip.symbol}: ${scrip.lotsize}. Using fallback.`);
      baseMeta.lotSize = scrip.symbol?.includes("BANKNIFTY") ? 15 : (scrip.symbol?.includes("FINNIFTY") ? 40 : (scrip.symbol?.includes("NIFTY") ? 50 : 1) );
    }
    if (isNaN(baseMeta.tickSize)) {
      console.warn(`Invalid tickSize for ${scrip.symbol}: ${scrip.tick_size}. Using fallback.`);
      baseMeta.tickSize = 0.05;
    }


    if (scrip.instrumenttype === "OPTIDX" || scrip.instrumenttype === "OPTSTK") {
      // It's an Option
      let strikePrice = scrip.strike !== undefined ? parseFloat(scrip.strike) / 100 : NaN; // Assuming strike is in paisa
      let optionType = scrip.optionType || extractOptionTypeFromSymbol(scrip.symbol);

      // If strike or optionType couldn't be determined from direct fields, try parsing symbol
      if (isNaN(strikePrice) || !optionType) {
        const match = scrip.symbol.match(optionSymbolPattern);
        if (match) {
          if (isNaN(strikePrice) && match[5]) { // 5th group is strike in your example regex
            strikePrice = parseInt(match[5]); // Assuming strike in symbol is absolute value
          }
          if (!optionType && match[6]) { // 6th group is option type
            optionType = match[6].toUpperCase();
          }
        }
      }
      
      map[tokenKey] = {
        ...baseMeta,
        strike: !isNaN(strikePrice) ? strikePrice : null,
        optionType: optionType || null,
      };

    } else if (scrip.instrumenttype === "FUTIDX" || scrip.instrumenttype === "FUTSTK") {
      // It's a Future
      map[tokenKey] = {
        ...baseMeta,
        strike: null,     // Futures don't have a strike price
        optionType: null, // Futures don't have an option type (CE/PE)
      };
    } else {
      // console.warn(`Unknown or unhandled instrument type '${scrip.instrumenttype}' for symbol '${scrip.symbol}'. Skipping.`);
    }
  });
  return map;
}

// Add utility function
export function getExpiryType(expiryDate) {
  const date = new Date(expiryDate);
  const day = date.getDate();
  return day > 25 ? 'MONTHLY' : 'WEEKLY'; // Simple heuristic
}

export function getNiftySpotToken(scripData) {
  const niftySpot = scripData.find(s => 
    s.symbol === 'NIFTY' && 
    s.exch_seg === 'NSE' && 
    s.instrumenttype === 'INDEX'
  );
  console.log("Nifty Spot Token:", niftySpot);
  return niftySpot ? String(26000).trim() : null;
}
