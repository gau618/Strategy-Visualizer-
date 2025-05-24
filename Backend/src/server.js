import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import { app } from "./app.js";
import { connectDB } from "./db/db.js";

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
import { setupWebSocket } from "./utils/websocket.js";


const PORT = process.env.PORT || 5000;
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
