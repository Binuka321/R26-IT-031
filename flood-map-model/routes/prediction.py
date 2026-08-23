from flask import Blueprint, request, jsonify, current_app
import numpy as np

prediction_bp = Blueprint('prediction', __name__)

@prediction_bp.route('/predict', methods=['POST'])
def predict():
    try:
        from routes.training import current_model as model, initialize_default_model

        # =========================
        # LOAD MODEL
        # =========================
        if model is None or not model.is_trained:
            try:
                model = initialize_default_model(current_app) or model
            except Exception as e:
                print("⚠️ Model init failed:", e)

        if model is None or not model.is_trained:
            return jsonify({'error': 'Model not trained'}), 400

        # =========================
        # GET REQUEST DATA
        # =========================
        data = request.get_json(force=True, silent=True)

        if not data:
            return jsonify({'error': 'Invalid JSON'}), 400

        # ✅ Accept BOTH formats
        features = data.get("features") or data.get("data")

        if features is None:
            return jsonify({'error': 'Missing features/data'}), 400

        # =========================
        # SINGLE OBJECT
        # =========================
        if isinstance(features, dict):

            aligned = _align_features_dict(features, model.feature_names)

            prediction, confidence = model.predict_single(aligned)

            pred_value, pred_label = _format_prediction(prediction)

            return jsonify({
                'prediction': pred_value,
                'confidence': float(confidence),
                'prediction_label': pred_label
            })

        # =========================
        # LIST (CSV / batch)
        # =========================
        elif isinstance(features, list):

            if len(features) == 0:
                return jsonify({'error': 'Empty input'}), 400

            # CASE 1: list of dicts (CSV)
            if isinstance(features[0], dict):

                aligned_list = [
                    _align_features_dict(row, model.feature_names)
                    for row in features
                ]

                array_data = np.array([
                    list(row.values()) for row in aligned_list
                ])

            # CASE 2: already numeric array
            else:
                array_data = np.array(features)

            predictions, probabilities = model.predict(array_data)

            results = []
            for pred, probs in zip(predictions, probabilities):

                pred_value, pred_label = _format_prediction(pred)

                results.append({
                    'prediction': pred_value,
                    'confidence': float(probs.max()),
                    'prediction_label': pred_label
                })

            return jsonify({
                'status': 'success',
                'count': len(results),
                'predictions': results
            })

        else:
            return jsonify({'error': 'Invalid input format'}), 400

    except Exception as e:
        print("🔥 ERROR:", str(e))
        return jsonify({
            'error': 'Prediction failed',
            'details': str(e)
        }), 500


@prediction_bp.route('/model-info', methods=['GET'])
def model_info():
    try:
        from routes.training import current_model as model, initialize_default_model

        # Ensure model is initialized
        if model is None or not model.is_trained:
            try:
                model = initialize_default_model(current_app) or model
            except Exception as e:
                print("⚠️ Model init failed:", e)

        if model is None or not model.is_trained:
            return jsonify({'error': 'Model not trained'}), 404

        return jsonify({
            'feature_names': model.feature_names or [],
            'model_version': getattr(model, 'model_version', None),
            'model_type': getattr(model, 'model_type', None),
            'label_mapping': model.label_mapping or {}
        }), 200

    except Exception as e:
        print("🔥 MODEL-INFO ERROR:", str(e))
        return jsonify({'error': 'Failed to retrieve model info', 'details': str(e)}), 500


# =========================
# FEATURE ALIGNMENT
# =========================
def _align_features_dict(data_dict, feature_names):
    """
    Match input data to model feature order
    Missing → 0
    Extra → ignored
    """
    aliases = {
        'rainfall': 'predicted_rainfall_mm',
        'rainfall_mm': 'predicted_rainfall_mm',
        'water_level': 'water_level_m',
        'waterlevel': 'water_level_m',
        'flow_rate': 'flow_rate_m3s',
        'elevation': 'elevation_m',
    }
    normalized_data = {str(key).lower(): value for key, value in data_dict.items()}
    aligned = {}

    for f in feature_names:
        value = data_dict.get(f)
        if value is None:
            value = normalized_data.get(str(f).lower())
        if value is None:
            value = normalized_data.get(aliases.get(str(f).lower()), 0)

        try:
            aligned[f] = float(value)
        except:
            aligned[f] = 0.0

    return aligned


# =========================
# HANDLE STRING / NUMERIC OUTPUT
# =========================
def _format_prediction(prediction):
    """
    Handles:
    - numeric predictions (0,1,2)
    - string predictions ("Low", "High")
    """

    if isinstance(prediction, str):
        return prediction, prediction

    try:
        pred_int = int(prediction)
        return pred_int, _get_risk_label(pred_int)
    except:
        return str(prediction), str(prediction)


# =========================
# LABEL MAPPING
# =========================
def _get_risk_label(prediction):
    mapping = {
        0: 'Low Risk',
        1: 'Moderate Risk',
        2: 'High Risk',
        3: 'Very High Risk'
    }
    return mapping.get(prediction, 'Unknown Risk')