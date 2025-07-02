// backend/utils/instrumentSelector.js
import { AppConfig } from './configLoader.js';

const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
function parseExpiry(expiryStr) {
    if (!expiryStr || expiryStr.length < 9) return null;
    try {
        const day = parseInt(expiryStr.substring(0, 2));
        const month = months[expiryStr.substring(2, 5).toUpperCase()];
        const year = parseInt(expiryStr.substring(5, 9));
        return new Date(Date.UTC(year, month, day));
    } catch {
        return null;
    }
}

function findATMStrike(spotPrice, allStrikes) {
  if (!allStrikes || allStrikes.length === 0) return null;
  return allStrikes.reduce((prev, curr) => 
    Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev
  );
}

export function selectInstrumentsFromConfig(instrumentMasterList, spotPricesMap) {
  const selectedTokensByExchange = new Map();
  const allUnderlyings = { ...AppConfig.indices, ...AppConfig.equities };
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const addToken = (scrip) => {
    if (!scrip || !scrip.token || !scrip.exch_seg) return;
    const exchange = scrip.exch_seg;
    if (!selectedTokensByExchange.has(exchange)) selectedTokensByExchange.set(exchange, new Set());
    selectedTokensByExchange.get(exchange).add(String(scrip.token));
  };
  
  const enabledUnderlyings = Object.entries(allUnderlyings)
    .filter(([, config]) => (config.options?.enabled || config.futures?.enabled));
  
  const spotScrips = instrumentMasterList.filter(s => enabledUnderlyings.some(([, config]) => s.token === config.spotToken && s.instrumenttype === (config.exchangeSegment === 'NFO' || config.exchangeSegment === 'BFO' ? 'AMXIDX' : 'EQ')));
  spotScrips.forEach(addToken);

  for (const [symbol, config] of enabledUnderlyings) {
    const spotPrice = spotPricesMap.get(symbol);
    const derivativeExchange = config.exchangeSegment;

    if (config.futures && config.futures.enabled) {
      const futuresForSymbol = instrumentMasterList
        .filter(s => s.name === symbol && s.instrumenttype.startsWith('FUT') && s.exch_seg === derivativeExchange)
        .filter(s => parseExpiry(s.expiry) >= today)
        .sort((a, b) => parseExpiry(a.expiry) - parseExpiry(b.expiry));
      
      futuresForSymbol.slice(0, config.futures.expiryCount).forEach(addToken);
    }
    
    if (config.options && config.options.enabled && spotPrice) {
      const optionsForSymbol = instrumentMasterList.filter(s => s.name === symbol && s.instrumenttype.startsWith('OPT') && s.exch_seg === derivativeExchange);

      const uniqueFutureExpiries = [...new Set(optionsForSymbol.map(s => s.expiry))]
        .filter(e => parseExpiry(e) >= today)
        .sort((a,b) => parseExpiry(a) - parseExpiry(b));
      
      const expiriesToTrack = uniqueFutureExpiries.slice(0, config.options.expiryCount);
      
      for (const expiry of expiriesToTrack) {
        const optionsForExpiry = optionsForSymbol.filter(s => s.expiry === expiry);
        const allStrikes = [...new Set(optionsForExpiry.map(s => parseFloat(s.strike) / 100.0))].sort((a, b) => a - b);
        const atmStrike = findATMStrike(spotPrice, allStrikes);
        if (atmStrike === null) continue;
        const atmIndex = allStrikes.indexOf(atmStrike);
        const lowerBound = Math.max(0, atmIndex - config.options.strikeRangeATM.lower);
        const upperBound = Math.min(allStrikes.length - 1, atmIndex + config.options.strikeRangeATM.upper);
        const selectedStrikes = new Set(allStrikes.slice(lowerBound, upperBound + 1));
        optionsForExpiry.forEach(opt => {
          if (selectedStrikes.has(parseFloat(opt.strike) / 100.0)) addToken(opt);
        });
      }
    }
  }

  const finalTokenMap = new Map();
  for (const [exchange, tokenSet] of selectedTokensByExchange.entries()) {
    finalTokenMap.set(exchange, [...tokenSet]);
  }
  return finalTokenMap;
}
