import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';

import { authRouter } from './routes/authRoutes.js';
import { rainfallRouter } from './routes/rainfallRoutes.js';
import { predictionRouter } from './routes/predictionRoutes.js';
import { trainingRouter } from './routes/trainingRoutes.js';
import { sensorPackageRouter } from './routes/sensorPackageRoutes.js';

import createDefaultAdmin from './utils/createAdmin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/rainfall', rainfallRouter);
app.use('/api/prediction', predictionRouter);
app.use('/api/training', trainingRouter);
app.use('/api/sensor-packages', sensorPackageRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Flood Manager API running',
    services: {
      database: 'connected',
      mlService: process.env.ML_SERVICE_URL || 'http://localhost:5000'
    }
  });
});
console.log("MONGO_URI:", process.env.MONGO_URI);

const startServer = async () => {
  try {
    await connectDB();
    await createDefaultAdmin();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 ML Service URL: ${process.env.ML_SERVICE_URL || 'http://localhost:5000'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();