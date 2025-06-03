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
export function buildTokenMetaMap(optionChain) {
  const map = {};
  const pattern = /^(NIFTY|BANKNIFTY)(\d{2})([A-Z]+)(\d{2})(\d+)([CP]E)$/i;

  optionChain.forEach(scrip => {
    const match = scrip.symbol.match(pattern);
    if (!match) return;
    const [, day, month, year, strike, optionType] = match;
    const tokenKey = String(scrip.token).replace(/"/g, '').trim();
    map[tokenKey] = {
      token: tokenKey,
      symbol: scrip.symbol,
      expiry: scrip.expiry,
      strike: parseInt(scrip.strike/100),
      optionType: extractOptionType(scrip.symbol),
      instrumenttype: scrip.instrumenttype,
      lotSize: parseInt(scrip.lotsize),
      tickSize: parseFloat(scrip.tick_size)
    };
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
