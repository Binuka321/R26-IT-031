import fetch from 'node-fetch';
import MLModelService from '../utils/mlModelService.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

function buildScenario(featureNames, type) {
  return MLModelService._mapInputsToModelFeatures(featureNames, {
    location: 'Colombo',
    latitude: 6.9271,
    longitude: 79.8612,
    rainfall: type === 'low' ? 10 : 220,
    waterLevel: type === 'low' ? 0.2 : 1.6,
    humidity: type === 'low' ? 60 : 90,
    date: type === 'low' ? '2024-01-15' : '2024-10-15',
    period: type === 'low' ? 'Morning' : 'Afternoon'
  });
}

jest.setTimeout(20000);

test('ML contract: different inputs produce different predictions', async () => {
  // Health check
  try {
    const health = await fetch(`${ML_SERVICE_URL}/api/ml/health`);
    if (!health.ok) {
      console.warn('ML service health check failed; skipping integration test');
      return expect(true).toBe(true);
    }
  } catch (err) {
    console.warn('ML service unreachable; skipping integration test');
    return expect(true).toBe(true);
  }

  // Get model-info
  const info = await MLModelService.getModelInfo();
  const featureNames = info.feature_names || [];
  if (!featureNames.length) {
    console.warn('No feature_names returned; skipping test');
    return expect(true).toBe(true);
  }

  const lowFeatures = buildScenario(featureNames, 'low');
  const highFeatures = buildScenario(featureNames, 'high');

  const lowResp = await fetch(`${ML_SERVICE_URL}/api/ml/prediction/predict`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ features: lowFeatures })
  });
  const low = await lowResp.json();

  const highResp = await fetch(`${ML_SERVICE_URL}/api/ml/prediction/predict`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ features: highFeatures })
  });
  const high = await highResp.json();

  // Basic assertions
  expect(low).toBeDefined();
  expect(high).toBeDefined();

  // If predictions are identical (label and prediction value), fail
  const lowLabel = low.prediction_label || low.prediction;
  const highLabel = high.prediction_label || high.prediction;

  const lowPredVal = String(low.prediction || lowLabel);
  const highPredVal = String(high.prediction || highLabel);

  expect(lowPredVal).not.toBe(highPredVal);
});
