import express from 'express'
import cors from "cors"
import cookieParser from "cookie-parser";

const app=express();

const allowedOrigins = [
  'http://localhost:5173',
  'https://strategy-visualizer-sigma.vercel.app'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // if you need to allow cookies/auth
}));

app.use(express.json({limit:"20kb"}))
app.use(express.urlencoded({extended:true,limit:"20kb"}))
app.use(express.static('public'))
app.use(cookieParser())
// Import Routers
import strategyRouter from './routes/strategy.routes.js';
// import userRouter from './routes/user.routes.js'; // If you had user auth routes

// Define Routes
app.use('/api/v1/strategies', strategyRouter);
//app.use('/api/v1/users', userRouter);

// Simple health check route
app.get('/api/v1/health', (req, res) => {
    res.status(200).json({ status: 'Backend is healthy!', timestamp: new Date().toISOString() });
});


// Basic error handler (can be made more sophisticated)
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    // errors: err.errors // Optionally pass validation errors or other details
  });
});


export {app};
