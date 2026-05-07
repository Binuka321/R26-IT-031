import os

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.multioutput import MultiOutputClassifier
from sklearn.preprocessing import LabelEncoder


DATASET_PATH = "dataset/camp_priority_dataset.csv"
MODEL_PATH = "models/camp_relief_priority_model.pkl"
ENCODERS_PATH = "models/label_encoders.pkl"

FEATURE_COLUMNS = [
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

TARGET_COLUMNS = [
    "camp_priority",
    "food_priority",
    "water_priority",
    "medicine_priority",
    "sanitary_priority",
]

VALID_ROAD_STATUS = ["Good", "Limited", "Blocked"]


def load_dataset():
    df = pd.read_csv(DATASET_PATH)

    print("Dataset shape:", df.shape)
    print("Column names:")
    print(df.columns.tolist())
    print("\nFirst 5 rows:")
    print(df.head())

    print("\nMissing values:")
    print(df.isnull().sum())

    return df


def clean_dataset(df):
    if "human_error_flag" in df.columns:
        error_count = (df["human_error_flag"].astype(str).str.lower() == "yes").sum()
        print("\nHuman-error rows:", error_count)
        df = df[df["human_error_flag"].astype(str).str.lower() != "yes"].copy()

    before = len(df)

    df = df.dropna(subset=FEATURE_COLUMNS + TARGET_COLUMNS).copy()
    df = df[df["population"] > 0]
    df = df[df["children_count"] >= 0]
    df = df[df["elderly_count"] >= 0]
    df = df[(df["children_count"] + df["elderly_count"]) <= df["population"]]
    df = df[df["camp_capacity"] > 0]
    df = df[df["food_available"] >= 0]
    df = df[df["water_available"] >= 0]
    df = df[df["medicine_available"] >= 0]
    df = df[df["sanitary_available"] >= 0]
    df = df[df["distance_from_distribution_center"] >= 0]
    df = df[df["road_access_status"].isin(VALID_ROAD_STATUS)]

    print("\nRows before cleaning:", before)
    print("Rows after cleaning:", len(df))

    return df


def encode_data(df):
    X = df[FEATURE_COLUMNS].copy()
    y = df[TARGET_COLUMNS].copy()

    feature_encoders = {}
    target_encoders = {}

    road_encoder = LabelEncoder()
    X["road_access_status"] = road_encoder.fit_transform(X["road_access_status"])
    feature_encoders["road_access_status"] = road_encoder

    for column in TARGET_COLUMNS:
        encoder = LabelEncoder()
        y[column] = encoder.fit_transform(y[column])
        target_encoders[column] = encoder

    encoders = {
        "feature_encoders": feature_encoders,
        "target_encoders": target_encoders,
        "input_columns": FEATURE_COLUMNS,
        "target_columns": TARGET_COLUMNS,
    }

    return X, y, encoders


def evaluate_model(model, X_test, y_test, target_encoders):
    y_pred = model.predict(X_test)

    for index, column in enumerate(TARGET_COLUMNS):
        encoder = target_encoders[column]
        actual = y_test.iloc[:, index]
        predicted = y_pred[:, index]

        print("\n" + "=" * 50)
        print(column)
        print("=" * 50)
        print("Accuracy:", accuracy_score(actual, predicted))
        print("\nClassification report:")
        print(classification_report(actual, predicted, target_names=encoder.classes_))
        print("Confusion matrix:")
        print(confusion_matrix(actual, predicted))


def predict_sample(model, encoders):
    sample_input = {
        "population": 420,
        "children_count": 110,
        "elderly_count": 60,
        "food_available": 90,
        "water_available": 200,
        "medicine_available": 15,
        "sanitary_available": 45,
        "distance_from_distribution_center": 8,
        "camp_capacity": 600,
        "road_access_status": "Limited",
    }

    sample_df = pd.DataFrame([sample_input])
    road_encoder = encoders["feature_encoders"]["road_access_status"]
    sample_df["road_access_status"] = road_encoder.transform(sample_df["road_access_status"])
    sample_df = sample_df[encoders["input_columns"]]

    prediction = model.predict(sample_df)[0]
    result = {}

    for index, column in enumerate(encoders["target_columns"]):
        encoder = encoders["target_encoders"][column]
        result[column] = encoder.inverse_transform([prediction[index]])[0]

    print("\nSample prediction:")
    print(result)


def main():
    np.random.seed(42)
    os.makedirs("models", exist_ok=True)

    df = load_dataset()
    df = clean_dataset(df)
    X, y, encoders = encode_data(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
    )

    base_model = RandomForestClassifier(n_estimators=200, random_state=42)
    model = MultiOutputClassifier(base_model)

    print("\nTraining Multi-Output Random Forest model...")
    model.fit(X_train, y_train)

    print("\nModel evaluation:")
    evaluate_model(model, X_test, y_test, encoders["target_encoders"])

    predict_sample(model, encoders)

    joblib.dump(model, MODEL_PATH)
    joblib.dump(encoders, ENCODERS_PATH)

    print("\nSaved model:", MODEL_PATH)
    print("Saved encoders:", ENCODERS_PATH)


if __name__ == "__main__":
    main()
