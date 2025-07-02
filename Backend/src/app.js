import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'https://strategy-visualizer-sigma.vercel.app',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: true, limit: '20kb' }));
app.use(express.static('public'));
app.use(cookieParser());

// Import Routes
import strategyRouter from './routes/strategy.routes.js';
// import userRouter from './routes/user.routes.js'; // Uncomment if needed

// API Routes
app.use('/api/v1/strategies', strategyRouter);
// app.use('/api/v1/users', userRouter);

// Health Check
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'Backend is healthy!',
    timestamp: new Date().toISOString(),
  });
});

// Swagger UI Setup
const swaggerDocument = yaml.load(
  fs.readFileSync(path.join(__dirname, 'swagger.yaml'), 'utf8')
);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// AsyncAPI static docs if you have it
app.use('/asyncapi', express.static(path.join(__dirname, 'public/asyncapi')));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

export { app };
