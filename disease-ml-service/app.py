import os

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

import io
import json
from pathlib import Path
from typing import Any

import numpy as np
import tensorflow as tf
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

tf.get_logger().setLevel("ERROR")

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = Path(os.getenv("MODEL_PATH", BASE_DIR / "final_post_flood_rash_model.keras"))
CLASS_NAMES_PATH = Path(os.getenv("CLASS_NAMES_PATH", BASE_DIR / "class_names.json"))
IMG_SIZE = (224, 224)

app = FastAPI(
    title="Skin Disease Classification API",
    version="1.0.0",
    description="Microservice for classifying rash images into Dermatitis, Eczema, or Ringworm.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ALLOW_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model: tf.keras.Model | None = None
class_names: list[str] = []


@app.on_event("startup")
def load_artifacts() -> None:
    global model, class_names

    if not MODEL_PATH.exists():
        raise RuntimeError(f"Model file not found: {MODEL_PATH}")

    if not CLASS_NAMES_PATH.exists():
        raise RuntimeError(f"Class names file not found: {CLASS_NAMES_PATH}")

    model = tf.keras.models.load_model(MODEL_PATH)

    with CLASS_NAMES_PATH.open("r", encoding="utf-8") as file:
        class_names = json.load(file)


def read_image(image_bytes: bytes) -> np.ndarray:
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image.") from exc

    image = image.resize(IMG_SIZE)
    image_array = np.asarray(image, dtype=np.float32)
    return np.expand_dims(image_array, axis=0)


def format_prediction(probabilities: np.ndarray) -> dict[str, Any]:
    scores = probabilities.astype(float).tolist()
    best_index = int(np.argmax(probabilities))

    return {
        "predicted_class": class_names[best_index],
        "confidence": scores[best_index],
        "probabilities": [
            {"class_name": name, "confidence": score}
            for name, score in zip(class_names, scores)
        ],
    }


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "classes": class_names,
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> dict[str, Any]:
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded yet.")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file.")

    image_bytes = await file.read()
    image_batch = read_image(image_bytes)

    predictions = model.predict(image_batch, verbose=0)[0]
    return format_prediction(predictions)
