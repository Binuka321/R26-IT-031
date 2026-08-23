/**
 * Model Training Routes - For training and managing ML models
 */

import express from 'express';
import { MLModelService } from '../utils/mlModelService.js';
import Rainfall from '../models/Rainfall.js';
import DailyTrainingData from '../models/DailyTrainingData.js';
import ModelTrainingRun from '../models/ModelTrainingRun.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { runDailyTraining } from '../utils/dailyTrainingService.js';

const router = express.Router();

router.use(authenticate);

/**
 * Train ML model with historical data
 * POST /api/training/train-model
 */
router.post('/train-model', async (req, res) => {
  try {
    // Check if ML service is available
    const mlAvailable = await MLModelService.isServiceAvailable();
    if (!mlAvailable) {
      return res.status(503).json({ 
        error: 'ML Model service unavailable',
        message: 'Please start the flood-map-model service on port 5000'
      });
    }

    const { modelName = 'flood_model_trained', modelType = 'random_forest' } = req.body;

    // TODO: Get historical rainfall and flood impact data
    // For now, returning instructions
    res.json({
      status: 'pending',
      message: 'Model training endpoint ready',
      instructions: {
        step1: 'Prepare rainfall dataset (location, month, rainfall, latitude, longitude)',
        step2: 'Prepare flood impact dataset (location, month, risk_level, flood_events)',
        step3: 'Send POST request with datasets to start training',
        endpointExample: {
          url: 'POST /api/training/train-model',
          body: {
            rainfallData: [],
            floodImpactData: [],
            modelName: 'flood_model_v1',
            modelType: 'random_forest'
          }
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Training endpoint error',
      details: error.message 
    });
  }
});

/**
 * Get model status
 * GET /api/training/status
 */
router.get('/status', async (req, res) => {
  try {
    const modelStatus = await MLModelService.getModelStatus();
    res.json({
      status: 'success',
      modelStatus: modelStatus
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get model status',
      details: error.message 
    });
  }
});

/**
 * Get model feature importance
 * GET /api/training/feature-importance
 */
router.get('/feature-importance', async (req, res) => {
  try {
    const importance = await MLModelService.getFeatureImportance();
    res.json({
      status: 'success',
      data: importance
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get feature importance',
      details: error.message 
    });
  }
});

/**
 * Get model info
 * GET /api/training/model-info
 */
router.get('/model-info', async (req, res) => {
  try {
    const modelInfo = await MLModelService.getModelInfo();
    res.json({
      status: 'success',
      data: modelInfo
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get model info',
      details: error.message 
    });
  }
});

/**
 * Check ML service health
 * GET /api/training/health
 */
router.get('/health', async (req, res) => {
  try {
    const isAvailable = await MLModelService.isServiceAvailable();
    
    if (isAvailable) {
      res.json({
        status: 'healthy',
        service: 'ML Model Service',
        available: true,
        url: process.env.ML_SERVICE_URL || 'http://localhost:5000'
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        service: 'ML Model Service',
        available: false,
        url: process.env.ML_SERVICE_URL || 'http://localhost:5000',
        message: 'Please ensure flood-map-model service is running'
      });
    }
  } catch (error) {
    res.status(503).json({ 
      error: 'Service check failed',
      details: error.message 
    });
  }
});

router.get('/daily-data', async (req, res) => {
  try {
    const filter = req.query.day ? { day: String(req.query.day) } : {};
    const data = await DailyTrainingData.find(filter).sort({ day: -1, location: 1 }).limit(500).lean();
    res.json({ status: 'success', data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch daily training data', details: error.message });
  }
});

router.get('/runs', async (req, res) => {
  try {
    const runs = await ModelTrainingRun.find().sort({ day: -1 }).limit(30).lean();
    res.json({ status: 'success', data: runs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch training runs', details: error.message });
  }
});

router.patch('/daily-data/:id/label', authorize('admin'), async (req, res) => {
  try {
    const allowedLabels = ['Low', 'Moderate', 'High', 'Very High'];
    if (!allowedLabels.includes(req.body.riskLevel)) {
      return res.status(400).json({ error: `riskLevel must be one of: ${allowedLabels.join(', ')}` });
    }

    const data = await DailyTrainingData.findByIdAndUpdate(
      req.params.id,
      { riskLevel: req.body.riskLevel },
      { returnDocument: 'after', runValidators: true }
    );
    if (!data) return res.status(404).json({ error: 'Daily training record not found' });
    res.json({ status: 'success', data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to label daily training data', details: error.message });
  }
});

router.post('/run-daily', authorize('admin'), async (req, res) => {
  try {
    const result = await runDailyTraining();
    res.json({ status: 'success', data: result });
  } catch (error) {
    res.status(500).json({ error: 'Daily training job failed', details: error.message });
  }
});

export { router as trainingRouter };
