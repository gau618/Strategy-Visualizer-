// minimalTest.js - CORRECTED VERSION

import { WebSocketV2 } from "smartapi-javascript";
import dotenv from "dotenv";

// Load environment variables from your .env file

dotenv.config({ path: "../../.env" }); // Adjust if .env is in a different relative location
const { CLIENT_CODE, JWT_TOKEN, API_KEY, FEED_TOKEN } = process.env;

// --- Validation ---
if (!CLIENT_CODE || !JWT_TOKEN || !API_KEY || !FEED_TOKEN) {
  console.error("❌ FATAL: Missing one or more required environment variables in .env file.");
  process.exit(1);
}

console.log("--- Starting Minimal Connection Test (Corrected Logic) ---");
console.log(`Using CLIENT_CODE: ${CLIENT_CODE}`);

const ws = new WebSocketV2({
  jwttoken: JWT_TOKEN.trim(),
  apikey: API_KEY.trim(),
  clientcode: CLIENT_CODE,
  feedtype: FEED_TOKEN.trim(),
});

// --- Step 1: Attach event handlers BEFORE connecting ---
// This ensures you don't miss any data that might arrive immediately.
ws.on('tick', (data) => {
  console.log("✅ TICK RECEIVED:", data);
});

ws.on('error', (err) => {
  console.error("❌ WEBSOCKET ERROR:", err);
});

ws.on('close', (code, reason) => {
  console.log(`❗️ WebSocket Closed. Code: ${code}, Reason: ${reason}`);
});


// --- Step 2: Initiate connection and subscribe inside .then() ---
console.log("Attempting to connect...");
ws.connect()
  .then(() => {
    // THIS is the correct place to confirm the connection and subscribe.
    // The promise resolving means the connection is authenticated and ready.
    console.log("✅ SUCCESS: Connection promise resolved. The feed is now ready.");

    const subscription_list = {
      correlationID: "nifty_test_sub",
      action: 1, // 1 for Subscribe
      mode: 1,   // 1 for LTP (Last Traded Price)
      exchangeType: 1, // 1 for NSE
      tokens: ["26000"], // NIFTY 50 Index token
    };

    console.log("Sending subscription request for NIFTY 50...");
    ws.fetchData(subscription_list);
  })
  .catch(err => {
    // This will catch critical failures like invalid credentials or network issues.
    console.error("❌ CRITICAL: ws.connect() promise was REJECTED. Connection failed.", err);
  });
