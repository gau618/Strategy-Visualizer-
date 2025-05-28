// src/hooks/useOptionChainWebSocket.js
import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

// Configuration
const SOCKET_IO_SERVER_URL = 'http://localhost:5000'; // Adjust to your backend URL
const OPTION_CHAIN_EVENT_NAME = 'option_chain'; // Event name from your backend

// Simplified ReadyState for Socket.IO
export const SocketIOReadyState = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2, // More of a conceptual state for explicit disconnects
    CLOSED: 3,
    RECONNECTING: 4,
};

const useOptionChainWebSocket = () => {
    // optionChainMap will store the data as { token: optionObject }
    const [optionChainMap, setOptionChainMap] = useState(new Map());
    const [readyState, setReadyState] = useState(SocketIOReadyState.CONNECTING);
    const socketRef = useRef(null);
 //   console.log(optionChainMap)
    useEffect(() => {
        console.log('[Socket.IO Hook] Initializing connection to:', SOCKET_IO_SERVER_URL);
        setReadyState(SocketIOReadyState.CONNECTING);
        setOptionChainMap(new Map()); // Clear map on new connection attempt


        socketRef.current = io(SOCKET_IO_SERVER_URL, {
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5,
            transports: ['websocket'], // Prefer WebSocket transport
        });

        const socket = socketRef.current;

        socket.on('connect', () => {
            console.log('[Socket.IO Hook] Connected to server. Socket ID:', socket.id);
            setReadyState(SocketIOReadyState.OPEN);
            // If your backend requires an initial message after connection (e.g., to join a room):
            // socket.emit('join_feed', { feedType: 'all_options' });
        });

        socket.on('disconnect', (reason) => {
            console.log('[Socket.IO Hook] Disconnected from server. Reason:', reason);
            setReadyState(SocketIOReadyState.CLOSED);
            // Decide if you want to clear data or show it as stale
            // setOptionChainMap(new Map());
        });

        socket.on('connect_error', (error) => {
            console.error('[Socket.IO Hook] Connection Error:', error.message, error.data || '');
            // The readyState might remain what it was, or you could explicitly set it.
            // If reconnection attempts are happening, 'reconnecting' state will be set.
        });

        socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`[Socket.IO Hook] Reconnect attempt #${attemptNumber}`);
            setReadyState(SocketIOReadyState.RECONNECTING);
        });

        socket.on('reconnect', (attemptNumber) => {
            console.log(`[Socket.IO Hook] Reconnected after ${attemptNumber} attempts. Socket ID:`, socket.id);
            setReadyState(SocketIOReadyState.OPEN);
        });

        socket.on('reconnect_failed', () => {
            console.error('[Socket.IO Hook] Failed to reconnect after multiple attempts.');
            setReadyState(SocketIOReadyState.CLOSED);
        });

        // Listen for the 'option_chain' event from your backend
        socket.on(OPTION_CHAIN_EVENT_NAME, (incomingDataArray) => {
            // incomingDataArray is an array of one or more updated option objects.
            if (Array.isArray(incomingDataArray) && incomingDataArray.length > 0) {
                // console.log(`[Socket.IO Hook] Received '${OPTION_CHAIN_EVENT_NAME}' with ${incomingDataArray.length} items.`);
                setOptionChainMap(prevMap => {
                    const newMap = new Map(prevMap);
                    incomingDataArray.forEach(option => {
                        if (option && option.token) {
                            newMap.set(String(option.token), option);
                        } else {
                            console.warn('[Socket.IO Hook] Received option without token in array:', option);
                        }
                    });
                    // console.log('[Socket.IO Hook] Updated optionChainMap size:', newMap.size);
                    return newMap;
                });
            } else if (Array.isArray(incomingDataArray) && incomingDataArray.length === 0) {
                // console.log(`[Socket.IO Hook] Received empty '${OPTION_CHAIN_EVENT_NAME}' array.`);
            } else {
                console.warn(`[Socket.IO Hook] Received '${OPTION_CHAIN_EVENT_NAME}' but data is not a non-empty array:`, incomingDataArray);
            }
        });

        // Cleanup on component unmount
        return () => {
            if (socket) {
                console.log('[Socket.IO Hook] Disconnecting socket...');
                socket.off(OPTION_CHAIN_EVENT_NAME); // Remove specific listener
                socket.disconnect();
                setReadyState(SocketIOReadyState.CLOSED);
            }
        };
    }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount

    return { optionChainMap, readyState };
};

export default useOptionChainWebSocket;
