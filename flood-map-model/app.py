from flask import Flask, json, jsonify
from flask_cors import CORS
from flask import send_from_directory
from config import config
import os

# Import blueprints
from routes.training import training_bp, initialize_default_model
from routes.prediction import prediction_bp

def create_app(config_name=None):
    """Application factory"""
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
    
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Enable CORS
    CORS(app)
    
    # Create necessary directories
    os.makedirs(app.config['MODEL_PATH'], exist_ok=True)
    os.makedirs(app.config['DATA_PATH'], exist_ok=True)
    
    # Register blueprints
    app.register_blueprint(training_bp, url_prefix='/api/ml/training')
    app.register_blueprint(prediction_bp, url_prefix='/api/ml/prediction')

    # Attempt to initialize or train a default model on startup
    try:
        model = initialize_default_model(app)
        if model is not None and model.is_trained:
            print(f'✅ Default ML model initialized: {model.model_version}')
        else:
            print('⚠️ No default model initialized. Start the service and train a model manually.')
    except Exception as exc:
        print('⚠️ ML model startup initialization failed:', str(exc))
    
    # Health check endpoint
    @app.route('/api/ml/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'OK',
            'message': 'ML Microservice is running',
            'service': 'Flood Prediction ML Service'
        }), 200
    @app.route('/map')
    def serve_map():
        return send_from_directory('outputs', 'flood_map.html')
    
    @app.route('/api/prediction/elevation-map', methods=['GET'])
    def elevation_map():
        import json
        import os

        try:
            BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

        # 🔥 correct path to geojson
            geojson_path = os.path.join(
                BASE_DIR,
                "flood-map-model",
                "scripts",
                "outputs",
                "flood_map.geojson"
        )

            geojson_path = os.path.abspath(geojson_path)

            if not os.path.exists(geojson_path):
                return jsonify({"error": f"File not found: {geojson_path}"}), 404

            with open(geojson_path) as f:
                data = json.load(f)

            return jsonify(data)

        except Exception as e:
            print("🔥 ERROR:", str(e))
            return jsonify({"error": str(e)}), 500
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Endpoint not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Internal server error', 'details': str(error)}), 500
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(
        host='0.0.0.0',
        port=app.config['ML_SERVICE_PORT'],
        debug=app.config['DEBUG']
    )
