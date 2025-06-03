// server.js
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose'; 
import dotenv from 'dotenv';
import { app } from './app.js'; // Assuming your Express app is exported from app.js
// THIS IMPORT PATH IS CRITICAL - MATCH IT TO YOUR FILE STRUCTURE
// If your optionFeed.js is at 'src/utils/websocket.js' as per your error:
import { setupWebSocket } from './utils/websocket.js'; 
// If it's at 'src/backend/optionFeed.js':
import { connectDB } from './db/db.js'; // Adjust path to your DB connection file
// import { setupWebSocket } from './backend/optionFeed.js';

import { cleanupHourlyStorageScheduler, forceStoreSnapshotsUtil } from './utils/hourlyStorageUtil.js'; // Assuming hourlyStorageUtil is also in utils

dotenv.config({ path: "../.env" }); // Adjust if .env is in project root (not src/)


const server = http.createServer(app);
const io = new SocketIOServer(server, {
    cors: { origin: process.env.CORS_ORIGIN || "*" },
});

const PORT = process.env.PORT || 5000; // Changed from APP_PORT to PORT to match your server.js
connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      setupWebSocket(io);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

async function gracefulShutdown(signal) {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    try {
        await forceStoreSnapshotsUtil(); 
        cleanupHourlyStorageScheduler(); 
    } catch (e) { console.error("Error during storage utility cleanup:", e.message); }

    io.close(err => { console.log("Socket.IO server closed."); });
    server.close(async () => {
        console.log("HTTP server closed.");
        if (mongoose.connection.readyState === 1) {
            try { await mongoose.disconnect(); console.log("MongoDB connection disconnected."); }
            catch (dbError) { console.error("Error disconnecting MongoDB:", dbError.message); }
        }
        console.log("Graceful shutdown complete. Exiting.");
        process.exit(0);
    });
    setTimeout(() => { console.error("Graceful shutdown timed out. Forcing exit."); process.exit(1); }, 10000);
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
