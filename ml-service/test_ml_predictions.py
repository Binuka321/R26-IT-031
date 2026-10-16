import unittest

import pandas as pd

from app import app, load_model_files, model_priority_scores, validate_input


class MlOnlyPredictionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model, cls.encoders = load_model_files()
        cls.samples = pd.read_csv('dataset/camp_relief_priority_dataset.csv').head(2)
        cls.client = app.test_client()

    def test_single_and_batch_preserve_trained_model_outputs(self):
        camps = self.samples.to_dict(orient='records')
        frame = pd.DataFrame([validate_input(camp) for camp in camps])
        frame['road_access_status'] = self.encoders['feature_encoders']['road_access_status'].transform(frame['road_access_status'])
        frame = frame[self.encoders['input_columns']]
        raw_predictions = self.model.predict(frame)
        scores = model_priority_scores(self.model, self.encoders, frame)

        # A batch containing one camp must also work (confidence is a scalar).
        for size in [1, 2]:
            response = self.client.post('/api/ml/predict-batch', json={'camps': camps[:size]})
            self.assertEqual(response.status_code, 200, response.get_json())
            rows = response.get_json()['predictions']
            self.assertEqual(len(rows), size)
            for index, row in enumerate(rows):
                single = self.client.post('/api/ml/predict', json=camps[index])
                self.assertEqual(single.status_code, 200, single.get_json())
                result = single.get_json()['prediction']
                self.assertEqual(row['prediction'], result)
                for target_index, target in enumerate(self.encoders['target_columns']):
                    expected = self.encoders['target_encoders'][target].inverse_transform([raw_predictions[index][target_index]])[0]
                    self.assertEqual(result[target], expected)
                self.assertEqual(result['priority_score'], scores[index])
                self.assertGreaterEqual(scores[index], 0)
                self.assertLessEqual(scores[index], 100)


if __name__ == '__main__':
    unittest.main()
