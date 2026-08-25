# Post-Flood Rescue and Ration Distribution ML Service

This service predicts camp-level rescue and ration priorities.

It does not predict flood risk, drain water level, or disease risk.

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
