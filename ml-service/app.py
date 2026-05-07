import os

import joblib
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS


MODEL_PATH = "models/camp_relief_priority_model.pkl"
ENCODERS_PATH = "models/label_encoders.pkl"
MODEL_VERSION = "post_flood_camp_relief_rf_v1"
INPUT_COLUMNS = [
    "population",
    "children_count",
    "elderly_count",
    "food_available",
    "water_available",
    "medicine_available",
    "sanitary_available",
    "distance_from_distribution_center",
    "camp_capacity",
    "road_access_status",
]

app = Flask(__name__)
CORS(app)

model = None
encoders = None


def load_model_files():
    global model, encoders

    if model is None or encoders is None:
        model = joblib.load(MODEL_PATH)
        encoders = joblib.load(ENCODERS_PATH)

    return model, encoders


def priority_score(priority):
    scores = {
        "High": 90,
        "Medium": 60,
        "Low": 30,
    }
    return scores.get(priority, 0)


def validate_input(input_data):
    missing = [column for column in INPUT_COLUMNS if column not in input_data]
    if missing:
        raise ValueError("Missing input columns: " + ", ".join(missing))

    numeric_columns = [column for column in INPUT_COLUMNS if column != "road_access_status"]
    cleaned = {}

    for column in numeric_columns:
        try:
            cleaned[column] = float(input_data[column])
        except (TypeError, ValueError):
            raise ValueError(f"{column} must be a number")

    if cleaned["population"] <= 0:
        raise ValueError("population must be greater than 0")
    if cleaned["children_count"] < 0:
        raise ValueError("children_count must be greater than or equal to 0")
    if cleaned["elderly_count"] < 0:
        raise ValueError("elderly_count must be greater than or equal to 0")
    if cleaned["children_count"] + cleaned["elderly_count"] > cleaned["population"]:
        raise ValueError("children_count + elderly_count must be less than or equal to population")
    if cleaned["camp_capacity"] <= 0:
        raise ValueError("camp_capacity must be greater than 0")

    for column in [
        "food_available",
        "water_available",
        "medicine_available",
        "sanitary_available",
        "distance_from_distribution_center",
    ]:
        if cleaned[column] < 0:
            raise ValueError(f"{column} must be greater than or equal to 0")

    cleaned["road_access_status"] = str(input_data["road_access_status"]).strip()
    return cleaned


def get_confidence(trained_model, sample_df, prediction):
    probabilities = []

    for index, estimator in enumerate(trained_model.estimators_):
        if not hasattr(estimator, "predict_proba"):
            continue

        proba = estimator.predict_proba(sample_df)[0]
        classes = list(estimator.classes_)
        predicted_class = prediction[index]

        if predicted_class in classes:
            probabilities.append(float(proba[classes.index(predicted_class)]))

    if not probabilities:
        return 0.0

    return round(sum(probabilities) / len(probabilities), 4)


def predict_relief_priority(input_data):
    trained_model, label_data = load_model_files()

    cleaned_input = validate_input(input_data)
    sample_df = pd.DataFrame([cleaned_input])
    road_encoder = label_data["feature_encoders"]["road_access_status"]
    valid_road_status = set(road_encoder.classes_)

    if sample_df.loc[0, "road_access_status"] not in valid_road_status:
        raise ValueError("road_access_status must be Good, Limited, or Blocked")

    sample_df["road_access_status"] = road_encoder.transform(sample_df["road_access_status"])
    sample_df = sample_df[label_data["input_columns"]]

    prediction = trained_model.predict(sample_df)[0]
    result = {}

    for index, column in enumerate(label_data["target_columns"]):
        encoder = label_data["target_encoders"][column]
        result[column] = encoder.inverse_transform([prediction[index]])[0]

    result["priority_score"] = priority_score(result["camp_priority"])
    result["confidence_score"] = get_confidence(trained_model, sample_df, prediction)
    result["model_version"] = MODEL_VERSION

    return result


@app.get("/api/ml/health")
def health():
    model_exists = os.path.exists(MODEL_PATH)
    encoders_exist = os.path.exists(ENCODERS_PATH)

    return jsonify({
        "status": "OK" if model_exists and encoders_exist else "MODEL_FILES_MISSING",
        "component": "Post-Flood Rescue and Ration Distribution Management System",
        "model_version": MODEL_VERSION,
        "model_path": MODEL_PATH,
        "encoders_path": ENCODERS_PATH,
    })


@app.get("/api/ml/model-info")
def model_info():
    _, label_data = load_model_files()

    return jsonify({
        "model_type": "Multi-Output Random Forest Classification Model",
        "model_version": MODEL_VERSION,
        "input_columns": label_data["input_columns"],
        "target_columns": label_data["target_columns"],
    })


@app.post("/api/ml/predict")
def predict():
    try:
        input_data = request.get_json(force=True)
        result = predict_relief_priority(input_data)

        return jsonify({
            "status": "success",
            "prediction": result,
        })
    except Exception as error:
        return jsonify({
            "status": "error",
            "message": str(error),
        }), 400


@app.post("/api/ml/predict-batch")
def predict_batch():
    try:
        payload = request.get_json(force=True)
        camps = payload.get("camps", [])

        if not isinstance(camps, list) or len(camps) == 0:
            raise ValueError("camps must be a non-empty list")

        predictions = []
        errors = []

        for camp in camps:
            camp_id = camp.get("camp_id")
            try:
                result = predict_relief_priority(camp)
                predictions.append({
                    "camp_id": camp_id,
                    "prediction": result,
                })
            except Exception as error:
                errors.append({
                    "camp_id": camp_id,
                    "message": str(error),
                })

        return jsonify({
            "status": "success",
            "predictions": predictions,
            "errors": errors,
        })
    except Exception as error:
        return jsonify({
            "status": "error",
            "message": str(error),
        }), 400


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5050"))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
