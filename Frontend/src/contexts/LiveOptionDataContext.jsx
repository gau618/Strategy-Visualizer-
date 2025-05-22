// src/contexts/LiveOptionDataContext.jsx
import React, { createContext, useContext, useMemo } from 'react';
// Ensure SocketIOReadyState is correctly imported and aliased if needed for clarity
import useOptionChainWebSocket, { SocketIOReadyState as ReadyStateEnum } from '../hooks/useOptionChainWebSocket';

const LiveOptionDataContext = createContext(null);

export const LiveOptionDataProvider = ({ children }) => {
    // 1. Get data from the hook.
    // optionChainMap will be an empty Map initially, then populated.
    // readyState will be CONNECTING initially.
    const { optionChainMap, readyState } = useOptionChainWebSocket();

    // 2. Derive memoized values. These will correctly use 'optionChainMap'
    // which is in scope from the line above.
    const availableUnderlyings = useMemo(() => {
        const underlyings = new Set();
        // Guard against optionChainMap being null/undefined if the hook were to return that initially
        // (though our hook initializes with new Map())
        if (optionChainMap) {
            optionChainMap.forEach(option => underlyings.add(option.underlying));
        }
        return Array.from(underlyings).sort();
    }, [optionChainMap]);

    const getOptionsByUnderlying = useMemo(() => (underlyingSymbol) => {
        const options = [];
        if (optionChainMap && underlyingSymbol) {
            optionChainMap.forEach(option => {
                if (option.underlying && option.underlying.toUpperCase() === underlyingSymbol.toUpperCase()) {
                    options.push(option);
                }
            });
        }
        return options;
    }, [optionChainMap]);

    const getOptionByToken = useMemo(() => (token) => {
        if (optionChainMap && token) {
            return optionChainMap.get(String(token));
        }
        return undefined;
    }, [optionChainMap]);

    const liveOptionChainArray = useMemo(() => {
        if (!optionChainMap) return []; // Guard
        return Array.from(optionChainMap.values());
    }, [optionChainMap]);

    // 3. Construct the value object for the provider.
    // All variables used on the right side here MUST be in scope.
    const value = {
        liveOptionChainMap: optionChainMap,         // Explicitly assigning
        liveOptionChainArray: liveOptionChainArray, // Explicitly assigning
        websocketReadyState: readyState,
        SocketIOReadyState: ReadyStateEnum,         // Using the imported and potentially aliased enum
        availableUnderlyings: availableUnderlyings, // Explicitly assigning
        getOptionsByUnderlying: getOptionsByUnderlying, // Explicitly assigning
        getOptionByToken: getOptionByToken,             // Explicitly assigning
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
