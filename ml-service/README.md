# Post-Flood Rescue and Ration Distribution ML Service

This service predicts camp priority and food, water, medicine, and sanitary priorities using the trained Random Forest model.

It does not predict flood risk, drain water level, or disease risk.

## ML-only priority predictions

Single, batch, automatic recalculation, and what-if predictions preserve the five decoded model classes. The backend does not replace them using stock thresholds, citizen-report boosts, or score thresholds. If the ML service fails, prediction requests fail instead of generating rule-based priorities.

The ranking score is the expected camp severity from the model's class probabilities: `100 × P(High) + 50 × P(Medium)`. It is a display scale, not a separately trained regression output, and does not determine the predicted class. Context indicators and shortage quantities remain calculations separate from predictions.

Rescue recommendations, routing, allocation constraints, and explicit officer overrides remain available. The existing trained model and training-label generation are unchanged; this change applies to inference, not the provenance of training labels.

Restart the backend and ML service after updating. Use **Camp Priority → Recalculate All** to replace previously saved priorities; existing database records and history are not automatically rewritten. Generate item priorities again for any camps outside that recalculation.

Verification:

```bash
# From the repository root
node --test backend/__tests__/postFloodMlOnly.test.js
# From ml-service
python -B -m unittest test_ml_predictions.py
```

## Run

```bash
cd ml-service
python -m pip install -r requirements.txt
python app.py
```

Default URL:

```text
http://localhost:5050
```

## Endpoints

```text
GET  /api/ml/health
GET  /api/ml/model-info
POST /api/ml/predict
POST /api/ml/predict-batch
```

## Backend connection

The Node backend reads:

```env
POST_FLOOD_ML_SERVICE_URL=http://localhost:5050
POST_FLOOD_ML_TIMEOUT_MS=15000
```
