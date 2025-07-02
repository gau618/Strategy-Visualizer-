// backend/utils/scripLoader.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadScripData(relativePath = '../../OpenAPIScripMaster.json') {
  try {
    const absolutePath = path.join(__dirname, relativePath);
    const raw = fs.readFileSync(absolutePath, 'utf8');
    console.log("✅ Scrip master data loaded successfully.");
    return JSON.parse(raw);
  } catch (error) {
    console.error('❌ FATAL ERROR: Could not load or parse OpenAPIScripMaster.json.', error);
    process.exit(1);
  }
}

/**
 * Creates a fast lookup map using a COMPOSITE KEY (`token_exchange`)
 * to handle token duplication across segments.
 */
export function buildTokenMetaMap(instrumentMasterList) {
  const map = {};
  if (!Array.isArray(instrumentMasterList)) {
    console.error("buildTokenMetaMap received invalid input.");
    return map;
  }

  instrumentMasterList.forEach(scrip => {
    if (!scrip || !scrip.token || !scrip.symbol || !scrip.exch_seg) {
      return;
    }
    
    const sanitizedToken = String(scrip.token).replace(/\D/g, '');
    if (!sanitizedToken) return;

    const compositeKey = `${sanitizedToken}_${scrip.exch_seg}`;
    const instrumentType = scrip.instrumenttype || "";

    const baseMeta = {
      token: sanitizedToken,
      symbol: scrip.symbol,
      expiry: scrip.expiry,
      instrumenttype: instrumentType,
      lotSize: parseInt(scrip.lotsize),
      tickSize: parseFloat(scrip.tick_size),
      underlying_symbol: scrip.name,
      name: scrip.name,
      exch_seg: scrip.exch_seg
    };

    if (instrumentType.startsWith("OPT")) {
      map[compositeKey] = {
        ...baseMeta,
        strike: scrip.strike !== undefined ? parseFloat(scrip.strike) / 100 : null,
        optionType: scrip.symbol.slice(-2).toUpperCase(),
      };
    } else {
      map[compositeKey] = {
        ...baseMeta,
        strike: null,
        optionType: null,
      };
    }
  });
  console.log(`✅ Token metadata map built with composite keys for ${Object.keys(map).length} instruments.`);
  return map;
}

export function getExpiryType(expiryDate) {
    if (!expiryDate) return 'Unknown';
    try {
        const date = new Date(parseExpiry(expiryDate)); // Use consistent parsing
        return date.getDate() > 24 ? 'MONTHLY' : 'WEEKLY';
    } catch {
        return 'Unknown';
    }
}

const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
function parseExpiry(expiryStr) {
    if (!expiryStr || expiryStr.length < 9) return null;
    const day = parseInt(expiryStr.substring(0, 2));
    const month = months[expiryStr.substring(2, 5).toUpperCase()];
    const year = parseInt(expiryStr.substring(5, 9));
    return new Date(Date.UTC(year, month, day));
}
