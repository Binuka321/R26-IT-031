import fetch from 'node-fetch';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

const normalize = (name) => String(name).toLowerCase();

const buildFeatures = (featureNames, scenario) => {
  const f = {};
  featureNames.forEach(name => {
    const n = normalize(name);
    if (n.includes('rain')) {
      f[name] = scenario === 'low' ? 10 : 200;
    } else if (n.includes('water')) {
      f[name] = scenario === 'low' ? 0.2 : 1.8;
    } else if (n.includes('lat')) {
      f[name] = 6.9;
    } else if (n.includes('lon')) {
      f[name] = 79.9;
    } else if (n.includes('month')) {
      f[name] = scenario === 'low' ? 1 : 10;
    } else if (n.includes('humidity')) {
      f[name] = scenario === 'low' ? 60 : 90;
    } else {
      f[name] = 0;
    }
  });
  return f;
};

(async function run() {
  try {
    console.log('Fetching model-info...');
    const infoResp = await fetch(`${ML_SERVICE_URL}/api/ml/prediction/model-info`);
    if (!infoResp.ok) {
      throw new Error(`model-info failed: ${infoResp.status}`);
    }
    const info = await infoResp.json();
    const featureNames = info.feature_names || [];
    console.log('Model features:', featureNames);

    if (!featureNames.length) {
      console.warn('No feature names returned; aborting validation.');
      process.exit(1);
    }

    const lowFeatures = buildFeatures(featureNames, 'low');
    const highFeatures = buildFeatures(featureNames, 'high');

    console.log('\nSending LOW scenario...');
    const lowResp = await fetch(`${ML_SERVICE_URL}/api/ml/prediction/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features: lowFeatures })
    });
    const lowBody = await lowResp.json();
    console.log('LOW response:', lowBody);

    console.log('\nSending HIGH scenario...');
    const highResp = await fetch(`${ML_SERVICE_URL}/api/ml/prediction/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features: highFeatures })
    });
    const highBody = await highResp.json();
    console.log('HIGH response:', highBody);

    console.log('\nValidation complete. Compare LOW vs HIGH predictions.');
  } catch (err) {
    console.error('Validation error:', err.message);
    process.exit(1);
  }
})();
