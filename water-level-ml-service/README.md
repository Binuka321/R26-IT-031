## Water Level Prediction Microservice

This service trains a simple ML model from `../water-level-model/water_level.csv` and predicts **tomorrow's water level at a specific time** for a station.

### Features used
- River basin, river, gauging station
- Target time of day (hour/minute), day-of-week
- RF (mm) (rainfall) (optional override at predict time)
- Thresholds (alert/minor/major) as numeric context

### Endpoints
- `GET /health`
- `POST /train`
- `POST /predict`

### Run locally

From repo root:

```bash
cd water-level-ml-service
python -m venv .venv
./.venv/Scripts/activate  # Windows PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 5000
```

### Environment variables
- `WATER_LEVEL_DATASET_PATH` (optional): default `../water-level-model/water_level.csv`
- `MODEL_ARTIFACT_DIR` (optional): default `./artifacts`

### Train

```bash
curl -X POST http://localhost:5000/train
```

### Predict

```bash
curl -X POST http://localhost:5000/predict ^
  -H "Content-Type: application/json" ^
  -d "{\"river_basin\":\"Kalu Ganga (RB 03)\",\"river\":\"Kalu Ganga\",\"station\":\"Putupaula\",\"time\":\"08:00\",\"rf_mm\":10.0}"
```

Notes:
- Units are normalized to **meters** in training (rows with `Unit=ft` are converted to meters).
- This is a baseline model intended to be connected later to live `SensorReading` history.
