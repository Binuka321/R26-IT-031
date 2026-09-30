import json
import os
import sys
import warnings
from pathlib import Path

import joblib
import pandas as pd
from sklearn.exceptions import InconsistentVersionWarning

warnings.simplefilter('error', InconsistentVersionWarning)
model_path = Path(os.environ.get('SYMPTOM_MODEL_PATH', str(Path(__file__).with_name('flood_risk_model.pkl'))))
model = joblib.load(model_path)
features = ['age', 'gender', 'symptom_duration', 'selected_symptoms', 'flood_exposures', 'risk_factors']
if list(model.feature_names_in_) != features or set(model.classes_) != {'Low', 'Medium', 'High'}:
    raise ValueError('Model schema does not match the API')
body = json.load(sys.stdin)
if body.get('check'):
    print(json.dumps({'ready': True}))
else:
    row = pd.DataFrame([{
        'age': body['age'],
        'gender': body['gender'],
        'symptom_duration': body['duration'],
        'selected_symptoms': '; '.join(body['selectedSymptoms']),
        'flood_exposures': '; '.join(body['selectedExposures']),
        'risk_factors': '; '.join(body['riskFactors']) or 'None',
    }], columns=features)
    print(json.dumps({'riskLevel': str(model.predict(row)[0])}))
