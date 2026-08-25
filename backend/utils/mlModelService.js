/**
 * ML Model Service - Communicates with the Python flood-map-model microservice
 */

import fetch from 'node-fetch';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

export class MLModelService {
  /**
   * Train the ML model with rainfall and flood impact data
   */
  static async trainModel(rainfallData, floodImpactData, modelName = 'flood_model_default') {
    try {
      const response = await fetch(`${ML_SERVICE_URL}/api/ml/training/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rainfall_data: {
            data: rainfallData,
            format: 'json'
          },
          flood_impact_data: {
            data: floodImpactData,
            format: 'json'
          },
          target_column: 'risk_level',
          model_type: 'random_forest',
          save_model: true,
          model_name: modelName
        })
      });

      if (!response.ok) {
        throw new Error(`ML Service error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('ML Model training error:', error);
      throw error;
    }
  }

  /**
   * Get model status
   */
  static async getModelStatus() {
    try {
      const response = await fetch(`${ML_SERVICE_URL}/api/ml/training/status`);
      if (!response.ok) throw new Error('Failed to get model status');
      return await response.json();
    } catch (error) {
      console.error('ML Model status error:', error);
      throw error;
    }
  }

  /**
   * Load a previously trained model
   */
  static async loadModel(modelName) {
    try {
      const response = await fetch(`${ML_SERVICE_URL}/api/ml/training/load/${modelName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to load model');
      return await response.json();
    } catch (error) {
      console.error('ML Model load error:', error);
      throw error;
    }
  }

  /**
   * Make a flood prediction for a single location
   */
  static _buildFeaturePayload(featureNames, inputs) {
    if (!Array.isArray(featureNames) || featureNames.length === 0) {
      return {
        rainfall: parseFloat(inputs.rainfall),
        latitude: parseFloat(inputs.latitude),
        longitude: parseFloat(inputs.longitude),
        water_level: parseFloat(inputs.waterLevel),
        humidity: parseFloat(inputs.humidity),
        location: inputs.location
      };
    }

    return featureNames.reduce((payload, name) => {
      const normalized = String(name).toLowerCase();
      if (normalized === 'predicted_rainfall_mm' || normalized === 'rainfall_mm' || normalized === 'rainfall') {
        payload[name] = parseFloat(inputs.rainfall);
      } else if (normalized === 'water_level_m' || normalized === 'water_level' || normalized === 'waterlevel') {
        payload[name] = parseFloat(inputs.waterLevel);
      } else if (normalized === 'latitude') {
        payload[name] = parseFloat(inputs.latitude);
      } else if (normalized === 'longitude') {
        payload[name] = parseFloat(inputs.longitude);
      } else if (normalized === 'humidity') {
        payload[name] = parseFloat(inputs.humidity || 75);
      } else if (normalized === 'month') {
        payload[name] = new Date().getMonth() + 1;
      } else if (normalized === 'location' || normalized === 'district') {
        payload[name] = inputs.location;
      } else {
        payload[name] = 0;
      }
      return payload;
    }, {});
  }

  static async predictFloodRisk(location, rainfall, waterLevel, latitude, longitude, humidity = 75) {
    try {
      let featureNames = [];
      try {
        const modelInfo = await MLModelService.getModelInfo();
        featureNames = modelInfo.feature_names || [];
      } catch (infoError) {
        console.warn('Could not determine model feature names:', infoError.message);
      }

      const features = MLModelService._buildFeaturePayload(featureNames, {
        location,
        latitude,
        longitude,
        rainfall,
        waterLevel,
        humidity
      });

      const response = await fetch(`${ML_SERVICE_URL}/api/ml/prediction/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features })
      });

      const text = await response.text();
      let result = {};
      try {
        result = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.warn('ML prediction response is not JSON:', text);
      }

      if (!response.ok) {
        const details = result.details ? ` Details: ${result.details}` : '';
        const rawText = !result.error && !result.message ? ` Raw response: ${text}` : '';
        throw new Error(
          `${result.error || result.message || `ML Service error ${response.status}`}${details}${rawText}`
        );
      }

      return {
        location,
        latitude,
        longitude,
        rainfall,
        waterLevel,
        prediction: result.prediction,
        predictionLabel: result.prediction_label,
        confidence: result.confidence,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Prediction error for ${location}:`, error);
      throw error;
    }
  }

  /**
   * Make batch flood predictions
   */
  static async batchPredict(locations) {
    try {
      // Prepare features for batch prediction
      const features = locations.map(loc => [
        parseFloat(loc.rainfall),
        parseFloat(loc.waterLevel),
        parseFloat(loc.latitude),
        parseFloat(loc.longitude),
        parseFloat(loc.humidity || 75)
      ]);

      const response = await fetch(`${ML_SERVICE_URL}/api/ml/prediction/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features })
      });

      if (!response.ok) throw new Error('Failed to make batch predictions');

      const result = await response.json();

      // Map predictions back to locations
      const predictions = result.predictions.map((pred, index) => ({
        location: locations[index].location,
        latitude: locations[index].latitude,
        longitude: locations[index].longitude,
        rainfall: locations[index].rainfall,
        waterLevel: locations[index].waterLevel,
        prediction: pred.prediction,
        predictionLabel: pred.prediction_label,
        confidence: pred.confidence,
        timestamp: new Date()
      }));

      return predictions;
    } catch (error) {
      console.error('Batch prediction error:', error);
      throw error;
    }
  }

  /**
   * Get feature importance (which factors matter most)
   */
  static async getFeatureImportance() {
    try {
      const response = await fetch(`${ML_SERVICE_URL}/api/ml/prediction/feature-importance`);
      if (!response.ok) throw new Error('Failed to get feature importance');
      return await response.json();
    } catch (error) {
      console.error('Feature importance error:', error);
      throw error;
    }
  }

  /**
   * Get model information
   */
  static async getModelInfo() {
    try {
      const response = await fetch(`${ML_SERVICE_URL}/api/ml/prediction/model-info`);
      if (!response.ok) throw new Error('Failed to get model info');
      return await response.json();
    } catch (error) {
      console.error('Model info error:', error);
      throw error;
    }
  }

  /**
   * Check if ML service is available
   */
  static async isServiceAvailable() {
    try {
      const response = await fetch(`${ML_SERVICE_URL}/api/ml/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

export default MLModelService;
