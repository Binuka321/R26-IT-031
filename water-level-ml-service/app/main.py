from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Literal, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

DATASET_PATH = Path(os.getenv("WATER_LEVEL_DATASET_PATH", "../water-level-model/water_level.csv"))
ARTIFACT_DIR = Path(os.getenv("MODEL_ARTIFACT_DIR", "./artifacts"))
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

MODEL_FILE = ARTIFACT_DIR / "model.joblib"
META_FILE = ARTIFACT_DIR / "meta.joblib"


app = FastAPI(title="Water level prediction service", version="1.0.0")


class TrainResponse(BaseModel):
    ok: bool
    dataset_path: str
    rows_raw: int
    rows_train: int
    stations: int


class PredictRequest(BaseModel):
    river_basin: str = Field(..., description="e.g., Kalu Ganga (RB 03)")
    river: str = Field(..., description="e.g., Kalu Ganga")
    station: str = Field(..., description="e.g., Putupaula")
    time: str = Field(..., description="Target time tomorrow, HH:MM (24h) or h:mm AM/PM")
    rf_mm: Optional[float] = Field(None, description="Optional rainfall (mm) to use for prediction")


class PredictResponse(BaseModel):
    ok: bool
    target_datetime: str
    predicted_water_level_m: float


@dataclass(frozen=True)
class ModelMeta:
    trained_at_utc: str
    dataset_path: str
    stations: int
    rows_train: int
    feature_columns: list[str]


def _parse_time_to_minutes(t: str) -> int:
    t = t.strip()
    # Accept "HH:MM" (24h) or "h:mm AM"
    for fmt in ("%H:%M", "%I:%M %p", "%I:%M%p"):
        try:
            dt = datetime.strptime(t, fmt)
            return dt.hour * 60 + dt.minute
        except ValueError:
            pass
    raise ValueError("Invalid time format. Use HH:MM (24h) or h:mm AM/PM")


def _to_meters(value: float, unit: str) -> float:
    if unit == "m":
        return float(value)
    if unit == "ft":
        return float(value) * 0.3048
    return float(value)


def _load_and_expand_dataset(csv_path: Path) -> pd.DataFrame:
    if not csv_path.exists():
        raise FileNotFoundError(f"Dataset not found at {csv_path}")

    df = pd.read_csv(csv_path)

    # Normalize column names
    rename = {
        "Report Date": "report_date",
        "Report Time": "report_time",
        "River Basin": "river_basin",
        "Tributary/River": "river",
        "Gauging Station": "station",
        "Unit": "unit",
        "Alert Level": "alert_level",
        "Minor Flood Level": "minor_flood_level",
        "Major Flood Level": "major_flood_level",
        "Water Level Time 1": "wl_time_1",
        "Water Level at Time 1": "wl_1",
        "Water Level Time 2": "wl_time_2",
        "Water Level at Time 2": "wl_2",
        "Status": "status",
        "Rising/Falling": "rising_falling",
        "RF (mm)": "rf_mm",
    }
    df = df.rename(columns=rename)

    # Parse dates (support both 27-Nov-2025 and 27-Nov-25)
    raw_report_date = df["report_date"].astype(str)
    parsed_full_year = pd.to_datetime(raw_report_date, errors="coerce", format="%d-%b-%Y")
    parsed_short_year = pd.to_datetime(raw_report_date, errors="coerce", format="%d-%b-%y")
    df["report_date"] = parsed_full_year.fillna(parsed_short_year)

    def to_float(x):
        if x is None:
            return np.nan
        if isinstance(x, (float, int)):
            return float(x)
        s = str(x).strip()
        if s in ("", "NA", "-", "N/A"):
            return np.nan
        try:
            return float(s)
        except ValueError:
            return np.nan

    for col in ["alert_level", "minor_flood_level", "major_flood_level", "wl_1", "wl_2", "rf_mm"]:
        if col in df.columns:
            df[col] = df[col].map(to_float)

    # Expand each row into 2 datapoints (time_1 and time_2) where water level exists
    rows = []
    for _, r in df.iterrows():
        base = {
            "river_basin": r.get("river_basin"),
            "river": r.get("river"),
            "station": r.get("station"),
            "status": r.get("status"),
            "rising_falling": r.get("rising_falling"),
            "rf_mm": r.get("rf_mm"),
            "alert_level": r.get("alert_level"),
            "minor_flood_level": r.get("minor_flood_level"),
            "major_flood_level": r.get("major_flood_level"),
        }
        unit = str(r.get("unit") or "").strip().lower()
        unit = "ft" if unit == "ft" else "m"
        report_date = r.get("report_date")
        if pd.isna(report_date):
            continue

        for time_col, wl_col in (("wl_time_1", "wl_1"), ("wl_time_2", "wl_2")):
            wl = r.get(wl_col)
            t = r.get(time_col)
            if wl is None or pd.isna(wl) or t is None or pd.isna(t):
                continue
            try:
                mins = _parse_time_to_minutes(str(t))
            except ValueError:
                continue
            wl_m = _to_meters(float(wl), unit)
            obs_dt = pd.Timestamp(report_date) + pd.Timedelta(minutes=mins)
            rows.append(
                {
                    **base,
                    "obs_datetime": obs_dt,
                    "time_minutes": mins,
                    "day_of_week": int(obs_dt.dayofweek),
                    "water_level_m": wl_m,
                }
            )

    out = pd.DataFrame(rows)
    return out


def _build_pipeline() -> Pipeline:
    categorical = ["river_basin", "river", "station", "status", "rising_falling"]
    numeric = ["rf_mm", "alert_level", "minor_flood_level", "major_flood_level", "time_minutes", "day_of_week"]

    pre = ColumnTransformer(
        transformers=[
            (
                "cat",
                Pipeline(
                    [
                        ("imp", SimpleImputer(strategy="most_frequent")),
                        ("oh", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                    ]
                ),
                categorical,
            ),
            ("num", Pipeline([("imp", SimpleImputer(strategy="median"))]), numeric),
        ],
        remainder="drop",
    )

    model = HistGradientBoostingRegressor(
        random_state=42,
        max_depth=6,
        learning_rate=0.06,
        max_iter=300,
    )

    return Pipeline([("pre", pre), ("model", model)])


def _save(model: Pipeline, meta: ModelMeta) -> None:
    joblib.dump(model, MODEL_FILE)
    joblib.dump(meta, META_FILE)


def _load() -> tuple[Pipeline, ModelMeta]:
    if not MODEL_FILE.exists() or not META_FILE.exists():
        raise FileNotFoundError("Model is not trained yet. Call POST /train first.")
    model = joblib.load(MODEL_FILE)
    meta = joblib.load(META_FILE)
    return model, meta


@app.get("/health")
def health():
    return {"status": "OK", "model_trained": MODEL_FILE.exists()}


@app.post("/train", response_model=TrainResponse)
def train():
    try:
        expanded = _load_and_expand_dataset(DATASET_PATH)
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))

    rows_raw = int(pd.read_csv(DATASET_PATH).shape[0])
    if expanded.empty:
        raise HTTPException(status_code=400, detail="No usable rows after parsing (check NA values and time formats).")

    # Basic cleanup
    expanded = expanded.dropna(subset=["river_basin", "river", "station", "water_level_m", "time_minutes", "day_of_week"])

    feature_cols = ["river_basin", "river", "station", "status", "rising_falling", "rf_mm", "alert_level", "minor_flood_level", "major_flood_level", "time_minutes", "day_of_week"]
    X = expanded[feature_cols]
    y = expanded["water_level_m"]

    pipe = _build_pipeline()
    pipe.fit(X, y)

    meta = ModelMeta(
        trained_at_utc=datetime.utcnow().isoformat() + "Z",
        dataset_path=str(DATASET_PATH),
        stations=int(expanded[["river_basin", "river", "station"]].drop_duplicates().shape[0]),
        rows_train=int(expanded.shape[0]),
        feature_columns=feature_cols,
    )
    _save(pipe, meta)

    return TrainResponse(
        ok=True,
        dataset_path=str(DATASET_PATH),
        rows_raw=rows_raw,
        rows_train=meta.rows_train,
        stations=meta.stations,
    )


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    try:
        model, meta = _load()
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        minutes = _parse_time_to_minutes(req.time)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    target_day = date.today() + timedelta(days=1)
    target_dt = datetime.combine(target_day, datetime.min.time()) + timedelta(minutes=minutes)

    # For threshold features, we don't have them at request time. We use NaN and the imputer will fill from training medians.
    row = {
        "river_basin": req.river_basin,
        "river": req.river,
        "station": req.station,
        "status": None,
        "rising_falling": None,
        "rf_mm": req.rf_mm if req.rf_mm is not None else np.nan,
        "alert_level": np.nan,
        "minor_flood_level": np.nan,
        "major_flood_level": np.nan,
        "time_minutes": minutes,
        "day_of_week": int(target_dt.weekday()),
    }

    X = pd.DataFrame([row], columns=meta.feature_columns)
    pred = float(model.predict(X)[0])
    pred = max(pred, 0.0)  # water level shouldn't be negative

    return PredictResponse(ok=True, target_datetime=target_dt.isoformat(), predicted_water_level_m=pred)
