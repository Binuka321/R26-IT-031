import os
import json

import joblib
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS


MODEL_PATH = "models/camp_relief_priority_model.pkl"
ENCODERS_PATH = "models/label_encoders.pkl"
TRAINING_REPORT_PATH = "models/training_report.json"
MODEL_VERSION = "post_flood_camp_relief_rf_v2_standards"
INPUT_COLUMNS = [
    "population",
    "children_count",
    "elderly_count",
    "infants_count",
    "pregnant_women_count",
    "disabled_people_count",
    "chronic_patients_count",
    "food_available",
    "water_available",
    "medicine_available",
    "sanitary_available",
    "last_distribution_hours",
    "vehicle_capacity_total",
    "distance_from_distribution_center",
    "camp_capacity",
    "camp_occupancy_ratio",
    "vulnerable_ratio",
    "road_access_status",
]

OPTIONAL_DERIVED_COLUMNS = [
    "infants_count",
    "pregnant_women_count",
    "disabled_people_count",
    "chronic_patients_count",
    "last_distribution_hours",
    "vehicle_capacity_total",
    "camp_occupancy_ratio",
    "vulnerable_ratio",
]

app = Flask(__name__)
CORS(app)

model = None
encoders = None
training_report = None


def load_model_files():
    global model, encoders

    if model is None or encoders is None:
        model = joblib.load(MODEL_PATH)
        encoders = joblib.load(ENCODERS_PATH)

    return model, encoders


def load_training_report():
    global training_report

    if training_report is None and os.path.exists(TRAINING_REPORT_PATH):
        with open(TRAINING_REPORT_PATH, "r", encoding="utf-8") as report_file:
            training_report = json.load(report_file)

    return training_report or {}


def priority_score(priority):
    scores = {
        "High": 90,
        "Medium": 60,
        "Low": 30,
    }
    return scores.get(priority, 0)


def with_derived_defaults(input_data):
    enriched = dict(input_data or {})
    population = float(enriched.get("population") or 0)
    children = float(enriched.get("children_count") or 0)
    elderly = float(enriched.get("elderly_count") or 0)
    camp_capacity = max(float(enriched.get("camp_capacity") or 1), 1)

    enriched.setdefault("infants_count", round(population * 0.06))
    enriched.setdefault("pregnant_women_count", round(population * 0.035))
    enriched.setdefault("disabled_people_count", round(population * 0.05))
    enriched.setdefault(
        "chronic_patients_count",
        round(elderly * 0.35 + population * 0.03),
    )
    enriched.setdefault("last_distribution_hours", 24)
    enriched.setdefault("vehicle_capacity_total", 0)
    enriched.setdefault("camp_occupancy_ratio", min(population / camp_capacity, 1))

    vulnerable_count = (
        children
        + elderly
        + float(enriched.get("infants_count") or 0)
        + float(enriched.get("pregnant_women_count") or 0)
        + float(enriched.get("disabled_people_count") or 0)
        + float(enriched.get("chronic_patients_count") or 0)
    )
    enriched.setdefault("vulnerable_ratio", min(vulnerable_count / max(population, 1), 1))

    return enriched


def validate_input(input_data):
    input_data = with_derived_defaults(input_data)
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
    for column in [
        "infants_count",
        "pregnant_women_count",
        "disabled_people_count",
        "chronic_patients_count",
    ]:
        if cleaned[column] < 0:
            raise ValueError(f"{column} must be greater than or equal to 0")
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
        "last_distribution_hours",
        "vehicle_capacity_total",
        "camp_occupancy_ratio",
        "vulnerable_ratio",
    ]:
        if cleaned[column] < 0:
            raise ValueError(f"{column} must be greater than or equal to 0")

    cleaned["road_access_status"] = str(input_data["road_access_status"]).strip()
    return cleaned


def get_confidence(trained_model, samples_df, predictions):
    """Calculate confidence score for predictions (handles both single and batch)."""
    num_samples = samples_df.shape[0]
    # predictions should be a 2D array [num_samples, num_targets]
    if len(predictions.shape) == 1:
        predictions = predictions.reshape(1, -1)

    total_probabilities = [0.0] * num_samples
    num_estimators = 0

    for index, estimator in enumerate(trained_model.estimators_):
        if not hasattr(estimator, "predict_proba"):
            continue

        num_estimators += 1
        # proba is a list of arrays if multi-output, or a single array
        proba_output = estimator.predict_proba(samples_df)

        # Handle different scikit-learn versions/estimator types
        # If it's a single Random Forest, it might return a list of arrays for multi-output
        if isinstance(proba_output, list):
            # This case shouldn't happen if trained_model is MultiOutputClassifier
            # but added for robustness
            proba = proba_output[0]
        else:
            proba = proba_output

        classes = list(estimator.classes_)
        for i in range(num_samples):
            pred_class = predictions[i][index]
            if pred_class in classes:
                class_idx = classes.index(pred_class)
                total_probabilities[i] += float(proba[i][class_idx])

    if num_estimators == 0:
        return [0.0] * num_samples if num_samples > 1 else 0.0

    scores = [round(prob / num_estimators, 4) for prob in total_probabilities]
    return scores if num_samples > 1 else scores[0]


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
    result["model_version"] = label_data.get("model_version", MODEL_VERSION)

    return result


@app.get("/api/ml/health")
def health():
    model_exists = os.path.exists(MODEL_PATH)
    encoders_exist = os.path.exists(ENCODERS_PATH)
    report_exists = os.path.exists(TRAINING_REPORT_PATH)

    return jsonify({
        "status": "OK" if model_exists and encoders_exist else "MODEL_FILES_MISSING",
        "component": "Post-Flood Rescue and Ration Distribution Management System",
        "model_version": MODEL_VERSION,
        "model_path": MODEL_PATH,
        "encoders_path": ENCODERS_PATH,
        "training_report_path": TRAINING_REPORT_PATH,
        "training_report_available": report_exists,
    })


@app.get("/api/ml/model-info")
def model_info():
    _, label_data = load_model_files()
    report = load_training_report()

    return jsonify({
        "model_type": "Multi-Output Random Forest Classification Model",
        "model_version": label_data.get("model_version", MODEL_VERSION),
        "input_columns": label_data["input_columns"],
        "target_columns": label_data["target_columns"],
        "standards": label_data.get("standards", {}),
        "evaluation": report.get("evaluation", {}),
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

        valid_camps = []
        valid_indices = []
        predictions = []
        errors = []

        for i, camp in enumerate(camps):
            camp_id = camp.get("camp_id")
            try:
                cleaned = validate_input(camp)
                valid_camps.append(cleaned)
                valid_indices.append(i)
            except Exception as error:
                errors.append({
                    "camp_id": camp_id,
                    "message": str(error),
                })

        if valid_camps:
            trained_model, label_data = load_model_files()
            batch_df = pd.DataFrame(valid_camps)
            road_encoder = label_data["feature_encoders"]["road_access_status"]

            # Transform road status for the whole batch
            batch_df["road_access_status"] = road_encoder.transform(batch_df["road_access_status"])
            batch_df = batch_df[label_data["input_columns"]]

            # Batch predict
            batch_predictions = trained_model.predict(batch_df)
            batch_confidences = get_confidence(trained_model, batch_df, batch_predictions)

            # Map results back
            for i, (orig_idx, pred, conf) in enumerate(zip(valid_indices, batch_predictions, batch_confidences)):
                result = {}
                for target_idx, column in enumerate(label_data["target_columns"]):
                    encoder = label_data["target_encoders"][column]
                    result[column] = encoder.inverse_transform([pred[target_idx]])[0]

                result["priority_score"] = priority_score(result["camp_priority"])
                result["confidence_score"] = conf
                result["model_version"] = label_data.get("model_version", MODEL_VERSION)

                predictions.append({
                    "camp_id": camps[orig_idx].get("camp_id"),
                    "prediction": result,
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
