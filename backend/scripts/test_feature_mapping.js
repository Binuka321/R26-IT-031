import MLModelService from '../utils/mlModelService.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

(async function run() {
  try {
    console.log('Fetching model-info...');
    const info = await MLModelService.getModelInfo();
    const featureNames = info.feature_names || [];
    console.log('Feature names:', featureNames);

    const inputsA = {
      location: 'Colombo',
      latitude: 6.9271,
      longitude: 79.8612,
      rainfall: 10,
      waterLevel: 0.2,
      humidity: 60,
      date: '2024-01-15',
      period: 'Morning'
    };

    const inputsB = {
      location: 'Colombo',
      latitude: 6.9271,
      longitude: 79.8612,
      rainfall: 220,
      waterLevel: 1.5,
      humidity: 90,
      date: '2024-10-15',
      period: 'Afternoon'
    };

    const mappedA = MLModelService._mapInputsToModelFeatures(featureNames, inputsA);
    const mappedB = MLModelService._mapInputsToModelFeatures(featureNames, inputsB);

    console.log('\nMapped LOW inputs (A):');
    console.log(mappedA);

    console.log('\nMapped HIGH inputs (B):');
    console.log(mappedB);

    console.log('\nNow sending predictions to validate differences...');
    const lowResp = await fetch(`${ML_SERVICE_URL}/api/ml/prediction/predict`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ features: mappedA })
    });
    const low = await lowResp.json();

    const highResp = await fetch(`${ML_SERVICE_URL}/api/ml/prediction/predict`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ features: mappedB })
    });
    const high = await highResp.json();

    console.log('\nPrediction LOW:', low);
    console.log('Prediction HIGH:', high);

  } catch (err) {
    console.error('Test error:', err.message);
    process.exit(1);
  }
})();
