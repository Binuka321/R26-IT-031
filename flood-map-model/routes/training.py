from flask import Blueprint, request, jsonify, current_app
from models.flood_model import FloodPredictionModel
from utils.data_processor import DataProcessor
from gis.gis_features import enrich_dataframe  # 🔥 NEW
import pandas as pd
import os
import json
import rasterio

dem = rasterio.open("data/maps/VaeSSA_DEM_20m_SLD99.img")
training_bp = Blueprint('training', __name__)

# Global model instance
current_model = None


def _list_saved_models(model_path):
    if not os.path.exists(model_path):
        return []
    return [f[:-4] for f in os.listdir(model_path) if f.endswith('.pkl') and not f.endswith('_scaler.pkl')]
def get_elevation(lat, lon):
    row, col = dem.index(lon, lat)
    return dem.read(1)[row, col]


def _is_saved_model_valid(model_path, model_name):
    metadata_file = os.path.join(model_path, f"{model_name}_metadata.json")
    if not os.path.exists(metadata_file):
        return False
    try:
        with open(metadata_file, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        return isinstance(metadata.get('feature_names'), list)
    except:
        return False


def _find_default_dataset_paths():
    data_path = current_app.config.get('DATA_PATH', './data/datasets')
    rainfall_path = os.path.join(data_path, 'rainfall_data.csv')
    flood_path = os.path.join(data_path, 'flood_impact_data.csv')

    if os.path.exists(rainfall_path) and os.path.exists(flood_path):
        return rainfall_path, flood_path

    return None, None


# =========================
# INITIAL MODEL
# =========================
def initialize_default_model(app=None):
    global current_model

    if app is None:
        raise ValueError("App required")

    with app.app_context():
        model_path = current_app.config['MODEL_PATH']

        rainfall_path, flood_path = _find_default_dataset_paths()
        if not rainfall_path:
            return None

        processor = DataProcessor()

        rainfall_df = processor.load_csv(rainfall_path)
        flood_df = processor.load_csv(flood_path)

        combined_df = processor.split_datasets(rainfall_df, flood_df)
        combined_df = processor.create_features(combined_df)

        # 🔥 ADD GIS FEATURES
        combined_df = enrich_dataframe(combined_df)

        X, y = processor.preprocess_data(
            combined_df,
            target_column="risk_level",
            drop_columns=["location", "month"]  # ✅ FIXED
        )

        # 🔥 ENCODE TARGET
        y, mapping = processor.encode_target(y)

        current_model = FloodPredictionModel(
            model_path=current_app.config['MODEL_PATH']
        )

        current_model.train(X, y)
        current_model.save("default_model")

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

        # Merge
        combined_df = processor.split_datasets(rainfall_df, flood_df)

        # Features
        combined_df = processor.create_features(combined_df)

        # 🔥 ADD GIS FEATURES
        combined_df = enrich_dataframe(combined_df)

        # Preprocess
        X, y = processor.preprocess_data(
            combined_df,
            target_column=data["target_column"],
            drop_columns=["location", "month"]  # ✅ FIXED
        )

        # 🔥 ENCODE TARGET
        y, mapping = processor.encode_target(y)

        # Train
        global current_model
        current_model = FloodPredictionModel(
            model_type=data.get("model_type", "random_forest"),
            model_path=current_app.config['MODEL_PATH']
        )

        metrics = current_model.train(X, y)

        current_model.save(data.get("model_name", "flood_model"))

        return jsonify({
            "status": "success",
            "features": X.columns.tolist(),
            "metrics": metrics
        })

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500


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