import React, { createContext, useContext, useMemo } from 'react';
// Ensure SocketIOReadyState is correctly imported and aliased if needed for clarity
import useOptionChainWebSocket, { SocketIOReadyState as ReadyStateEnum } from '../hooks/useOptionChainWebSocket';

const LiveOptionDataContext = createContext(null);

export const LiveOptionDataProvider = ({ children }) => {
    // 1. Get data from the hook.
    // optionChainMap will be an empty Map initially, then populated.
    // readyState will be CONNECTING initially.
    
    const { optionChainMap, readyState } = useOptionChainWebSocket();

    // NEW: Helper function to identify if an instrument from the WebSocket data is a FUTURE
    // Check for absence of strike and optionType AND presence of lotSize (contract multiplier)
    // This assumes that your backend provides a way to differentiate futures from options.
    // Adjust the condition based on your actual data structure.
    const isFutureInstrument = (instrument) => {
        return (instrument.instrumenttype==="FUTIDX" || instrument.instrumenttype==="FUTSTK")
    };

    // 2. Derive memoized values. These will correctly use 'optionChainMap'
    // which is in scope from the line above.
    // MODIFIED: availableUnderlyings now considers both options and futures.
    const availableUnderlyings = useMemo(() => {
        const underlyings = new Set();
        // Guard against optionChainMap being null/undefined if the hook were to return that initially
        // (though our hook initializes with new Map())
        if (optionChainMap) {
            // MODIFIED: Iterate through all instruments, not just options
            optionChainMap.forEach(instrument => underlyings.add(instrument.underlying));
        }
        return Array.from(underlyings).sort();
    }, [optionChainMap]);

    // NEW: Provides options and futures grouped by underlying
    const getTradableInstrumentsByUnderlying = useMemo(() => (underlyingSymbol) => {
        const instruments = { options: [], futures: [] };
        if (optionChainMap && underlyingSymbol) {
            optionChainMap.forEach(instrument => {
                if (instrument.underlying && instrument.underlying.toUpperCase() === underlyingSymbol.toUpperCase()) {
                    if (isFutureInstrument(instrument)) {
                        instruments.futures.push({
                            ...instrument,
                            legTypeDb: 'future' // Explicitly add legType for easier identification if not already present in the data
                        });
                    } else if (instrument.strike !== undefined && instrument.optionType) {
                        instruments.options.push({
                            ...instrument,
                            legTypeDb: 'option' // Same as above.
                        });
                    }
                }
            });
        }
        // Optional: Sort futures by expiry if needed
        instruments.futures.sort((a, b) => {
            try { // Sort is tricky, ensure it does not explode on missing values
                const dateA = new Date(a.expiryDate || a.expiry);
                const dateB = new Date(b.expiryDate || b.expiry);
                if (!isNaN(dateA) && !isNaN(dateB)) return dateA.getTime() - dateB.getTime();
            } catch(e) { /* Fallback for bad dates */ }
            return (a.expiry || "").localeCompare(b.expiry || ""); // String compare as fallback
        });
        return instruments;
    }, [optionChainMap]);

    // NEW: Generic instrument getter function that returns either an option or a future based on token
    const getInstrumentByToken = useMemo(() => (token) => {
        if (optionChainMap && token) {
            const instrument = optionChainMap.get(String(token));
            if (instrument) {
                // Also ensure 'legTypeDb' is defined for clarity
                if (isFutureInstrument(instrument) && !instrument.legTypeDb) {
                    return { ...instrument, legTypeDb: 'future' };
                } else if ((instrument.strike !== undefined && instrument.optionType) && !instrument.legTypeDb) {
                    return { ...instrument, legTypeDb: 'option' };
                }
                return instrument;
            }
        }
        return undefined;
    }, [optionChainMap]);

    // MODIFIED: Create a new array that includes futures, and has a 'legTypeDb' field for every instrument.
    const liveInstrumentChainArray = useMemo(() => {
        if (!optionChainMap) return [];
        return Array.from(optionChainMap.values()).map(instrument => {
            if (isFutureInstrument(instrument) && !instrument.legTypeDb) {
                return { ...instrument, legTypeDb: 'future' };
            } else if ((instrument.strike !== undefined && instrument.optionType) && !instrument.legTypeDb) {
                return { ...instrument, legTypeDb: 'option' };
            }
            return instrument;
        });
    }, [optionChainMap]);
    console.log("LiveOptionDataProvider: liveInstrumentChainArray length:", liveInstrumentChainArray.length);

    // 3. Construct the value object for the provider.
    // All variables used on the right side here MUST be in scope.
    const value = {
        liveOptionChainMap: optionChainMap,         // Explicitly assigning. Keep the raw option chain map for other parts of the app.
        liveInstrumentChainArray: liveInstrumentChainArray, // MODIFIED: Use the processed array that includes futures.
        websocketReadyState: readyState,
        SocketIOReadyState: ReadyStateEnum,         // Using the imported and potentially aliased enum
        availableUnderlyings: availableUnderlyings, // Explicitly assigning
        getTradableInstrumentsByUnderlying: getTradableInstrumentsByUnderlying, // NEW:  Getter for grouped instruments.
        getInstrumentByToken: getInstrumentByToken,             // NEW: Generic getter by token.
        //Consider deprecating this
        getOptionsByUnderlying: undefined, //Getters should not be used for this.
        getOptionByToken: undefined, //See above.
    };

    return (
        <LiveOptionDataContext.Provider value={value}>
            {children}
        </LiveOptionDataContext.Provider>
    );
};

export const useLiveOptionData = () => {
    const context = useContext(LiveOptionDataContext);
    if (!context) {
        throw new Error('useLiveOptionData must be used within a LiveOptionDataProvider');
    }
    return context;
};
