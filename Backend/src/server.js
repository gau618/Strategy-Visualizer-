import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import { app } from './app.js';


const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
import { setupWebSocket } from './websocket.js';
setupWebSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
