from flask import Blueprint, request, jsonify, current_app
from models.flood_model import FloodPredictionModel
from utils.data_processor import DataProcessor
from gis.gis_features import enrich_dataframe
import pandas as pd
import os
import rasterio

training_bp = Blueprint('training', __name__)

# =========================
# LOAD DEM
# =========================
dem = rasterio.open("data/maps/VaeSSA_DEM_20m_SLD99.img")


def get_elevation(lat, lon):
    try:
        row, col = dem.index(lon, lat)
        return dem.read(1)[row, col]
    except:
        return 0


# Global model
current_model = None


# =========================
# HELPERS
# =========================
def _find_default_dataset_paths():
    data_path = current_app.config.get('DATA_PATH', './data/datasets')

    rainfall_path = os.path.join(data_path, 'rainfall_data.csv')
    flood_path = os.path.join(data_path, 'flood_impact_data.csv')

    if os.path.exists(rainfall_path) and os.path.exists(flood_path):
        return rainfall_path, flood_path

    return None, None


# =========================
# MULTI-MODEL TRAINING
# =========================
def train_multiple_models(X, y, model_path):
    models_to_train = [
        "random_forest",
        "gradient_boosting"
    ]

    best_model = None
    best_score = -1
    all_results = []

    for model_type in models_to_train:
        print(f"\n🚀 Training {model_type}...")

        model = FloodPredictionModel(
            model_type=model_type,
            model_path=model_path
        )

        metrics = model.train(X, y)
        f1 = metrics["f1_score"]

        print(f"✅ {model_type} F1 Score: {f1}")

        all_results.append({
            "model": model_type,
            "metrics": metrics
        })

        if f1 > best_score:
            best_score = f1
            best_model = model

    return best_model, best_score, all_results


# =========================
# INITIAL MODEL (AUTO TRAIN)
# =========================
def initialize_default_model(app=None):
    global current_model

    if app is None:
        raise ValueError("App required")

    with app.app_context():
        model_path = current_app.config['MODEL_PATH']

        rainfall_path, flood_path = _find_default_dataset_paths()

        if not rainfall_path:
            print("❌ Dataset not found")
            return None

        processor = DataProcessor()

        # Load data
        rainfall_df = processor.load_csv(rainfall_path)
        flood_df = processor.load_csv(flood_path)

        # =========================
        # PIPELINE
        # =========================
        combined_df = processor.split_datasets(rainfall_df, flood_df)
        combined_df = processor.create_features(combined_df)
        combined_df = enrich_dataframe(combined_df)

        print("\n📊 MERGED DATA SAMPLE:")
        print(combined_df.head())

        # =========================
        # PREPROCESS
        # =========================
        X, y = processor.preprocess_data(
            combined_df,
            target_column="risk_level",
            drop_columns=[
                "date",
                "record_id",
                "place_name",
                "generation_date",
                "reason_not_good_to_live",
                "flood_occurrence_current_event"
            ]
        )

        # Encode target
        y, mapping = processor.encode_target(y)

        print("\n🎯 TARGET DISTRIBUTION:")
        print(y.value_counts())

        print("\n📊 FEATURES USED:", X.columns.tolist())

        # Train models
        best_model, best_score, results = train_multiple_models(
            X, y, model_path
        )

        # Save best model
        current_model = best_model
        model_name = f"best_model_{best_model.model_type}"
        current_model.save(model_name)

        print(f"\n🏆 BEST MODEL: {best_model.model_type} (F1: {best_score})")

        return current_model


# =========================
# TRAIN API
# =========================
@training_bp.route('/train', methods=['POST'])
def train_model():
    try:
        data = request.get_json()

        processor = DataProcessor()

        rainfall_df = pd.DataFrame(data["rainfall_data"]["data"])
        flood_df = pd.DataFrame(data["flood_impact_data"]["data"])

        # =========================
        # PIPELINE
        # =========================
        combined_df = processor.split_datasets(rainfall_df, flood_df)
        combined_df = processor.create_features(combined_df)
        combined_df = enrich_dataframe(combined_df)

        print("\n📊 MERGED DATA SAMPLE:")
        print(combined_df.head())

        # =========================
        # PREPROCESS
        # =========================
        X, y = processor.preprocess_data(
            combined_df,
            target_column=data["target_column"],
            drop_columns=[
                "date",
                "record_id",
                "place_name",
                "generation_date",
                "reason_not_good_to_live",
                "flood_occurrence_current_event"
            ]
        )

        # Encode
        y, mapping = processor.encode_target(y)

        print("\n📊 FEATURES USED:", X.columns.tolist())

        # Train models
        best_model, best_score, results = train_multiple_models(
            X, y, current_app.config['MODEL_PATH']
        )

        global current_model
        current_model = best_model

        model_name = f"best_model_{best_model.model_type}"
        current_model.save(model_name)

        return jsonify({
            "status": "success",
            "best_model": best_model.model_type,
            "best_f1_score": best_score,
            "all_models": results,
            "features": X.columns.tolist()
        })

    except Exception as e:
        print("🔥 TRAIN ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


# =========================
# STATUS
# =========================
@training_bp.route('/status', methods=['GET'])
def status():
    global current_model

    if current_model is None:
        return jsonify({"status": "no_model"})

    return jsonify({
        "trained": current_model.is_trained,
        "features": current_model.feature_names
    })