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

PLANNING_DAYS = 2
FOOD_PACKS_PER_PERSON_PER_DAY = 1
WATER_LITRES_PER_PERSON_PER_DAY = 15
PEOPLE_PER_SANITARY_KIT = 5
PEOPLE_PER_MEDICINE_KIT = 1000

PRIORITY_VALUES = {"Low": 1, "Medium": 2, "High": 3}
ROAD_PRIORITY_BONUS = {"Good": 0, "Limited": 0.35, "Blocked": 0.75}


def coverage_priority(available, required):
    if required <= 0:
        return "Low"
    coverage = available / required
    if coverage < 0.5:
        return "High"
    if coverage < 1:
        return "Medium"
    return "Low"


def max_priority(*priorities):
    return max(priorities, key=lambda priority: PRIORITY_VALUES.get(priority, 1))


def standard_requirements(df):
    population = df["population"]
    return pd.DataFrame(
        {
            "food_required": population * FOOD_PACKS_PER_PERSON_PER_DAY * PLANNING_DAYS,
            "water_required": population * WATER_LITRES_PER_PERSON_PER_DAY * PLANNING_DAYS,
            "medicine_required": np.ceil(population / PEOPLE_PER_MEDICINE_KIT),
            "sanitary_required": np.ceil(population / PEOPLE_PER_SANITARY_KIT),
        }
    )


def derive_standard_targets(df):
    requirements = standard_requirements(df)
    derived = df.copy()

    derived["food_priority"] = [
        coverage_priority(available, required)
        for available, required in zip(df["food_available"], requirements["food_required"])
    ]
    derived["water_priority"] = [
        coverage_priority(available, required)
        for available, required in zip(df["water_available"], requirements["water_required"])
    ]
    derived["medicine_priority"] = [
        coverage_priority(available, required)
        for available, required in zip(
            df["medicine_available"],
            requirements["medicine_required"],
        )
    ]
    derived["sanitary_priority"] = [
        coverage_priority(available, required)
        for available, required in zip(
            df["sanitary_available"],
            requirements["sanitary_required"],
        )
    ]

    vulnerable_ratio = (df["children_count"] + df["elderly_count"]) / df["population"]
    for column in ["food_priority", "water_priority", "medicine_priority"]:
        derived.loc[vulnerable_ratio > 0.4, column] = derived.loc[
            vulnerable_ratio > 0.4,
            column,
        ].apply(lambda priority: max_priority(priority, "Medium"))

    limited_or_blocked = df["road_access_status"].isin(["Limited", "Blocked"])
    for column in [
        "food_priority",
        "water_priority",
        "medicine_priority",
        "sanitary_priority",
    ]:
        affected = limited_or_blocked & (derived[column] != "Low")
        derived.loc[affected, column] = derived.loc[affected, column].apply(
            lambda priority: max_priority(priority, "High")
        )

    item_score = (
        derived["food_priority"].map(PRIORITY_VALUES)
        + derived["water_priority"].map(PRIORITY_VALUES)
        + derived["medicine_priority"].map(PRIORITY_VALUES)
        + derived["sanitary_priority"].map(PRIORITY_VALUES)
    ) / 4
    occupancy_score = (df["population"] / df["camp_capacity"]).clip(upper=1)
    distance_score = (df["distance_from_distribution_center"] / 50).clip(upper=1)
    road_bonus = df["road_access_status"].map(ROAD_PRIORITY_BONUS)
    camp_score = item_score + occupancy_score * 0.35 + distance_score * 0.25 + road_bonus

    derived["camp_priority"] = np.where(
        camp_score >= 2.6,
        "High",
        np.where(camp_score >= 1.65, "Medium", "Low"),
    )

    return derived


def augment_adequate_coverage_examples(df):
    sample_size = min(800, len(df))
    adequate = df.sample(sample_size, random_state=42).copy()
    requirements = standard_requirements(adequate)

    adequate["food_available"] = np.ceil(requirements["food_required"] * 1.2)
    adequate["water_available"] = np.ceil(requirements["water_required"] * 1.2)
    adequate["medicine_available"] = np.ceil(requirements["medicine_required"] * 1.2)
    adequate["sanitary_available"] = np.ceil(requirements["sanitary_required"] * 1.2)
    adequate["road_access_status"] = "Good"
    adequate["distance_from_distribution_center"] = np.minimum(
      adequate["distance_from_distribution_center"],
      5,
    )
    adequate["camp_capacity"] = np.maximum(
      adequate["camp_capacity"],
      np.ceil(adequate["population"] * 1.3),
    )
    adequate[TARGET_COLUMNS] = derive_standard_targets(adequate)[TARGET_COLUMNS]
    adequate["record_id"] = adequate["record_id"].astype(str) + "-ADEQUATE"

    return pd.concat([df, adequate], ignore_index=True)


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

    df = augment_adequate_coverage_examples(derive_standard_targets(df))
    print("\nTargets regenerated from humanitarian standards:")
    for column in TARGET_COLUMNS:
        print(column)
        print(df[column].value_counts().to_dict())

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
