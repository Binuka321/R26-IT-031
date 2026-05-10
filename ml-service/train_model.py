import os
import json

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.multioutput import MultiOutputClassifier
from sklearn.preprocessing import LabelEncoder


DATASET_PATH = "dataset/camp_relief_priority_dataset.csv"
MODEL_PATH = "models/camp_relief_priority_model.pkl"
ENCODERS_PATH = "models/label_encoders.pkl"
TRAINING_REPORT_PATH = "models/training_report.json"
MODEL_VERSION = "post_flood_camp_relief_rf_v2_standards"

FEATURE_COLUMNS = [
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
    medical_vulnerability = (
        df["infants_count"]
        + df["pregnant_women_count"]
        + df["disabled_people_count"]
        + df["chronic_patients_count"]
    )
    return pd.DataFrame(
        {
            "food_required": population * FOOD_PACKS_PER_PERSON_PER_DAY * PLANNING_DAYS,
            "water_required": population * WATER_LITRES_PER_PERSON_PER_DAY * PLANNING_DAYS,
            "medicine_required": np.ceil(
                (population + medical_vulnerability * 1.5) / PEOPLE_PER_MEDICINE_KIT
            ),
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

    vulnerable_ratio = df["vulnerable_ratio"]
    for column in ["food_priority", "water_priority", "medicine_priority"]:
        derived.loc[vulnerable_ratio > 0.4, column] = derived.loc[
            vulnerable_ratio > 0.4,
            column,
        ].apply(lambda priority: max_priority(priority, "Medium"))

    overdue_distribution = df["last_distribution_hours"] > 48
    for column in ["food_priority", "water_priority", "sanitary_priority"]:
        derived.loc[overdue_distribution, column] = derived.loc[
            overdue_distribution,
            column,
        ].apply(lambda priority: max_priority(priority, "Medium"))

    low_transport_capacity = df["vehicle_capacity_total"] < (df["population"] * 0.5)
    for column in ["food_priority", "water_priority"]:
        affected = low_transport_capacity & (derived[column] != "Low")
        derived.loc[affected, column] = derived.loc[affected, column].apply(
            lambda priority: max_priority(priority, "High")
        )

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
    occupancy_score = df["camp_occupancy_ratio"].clip(upper=1)
    distance_score = (df["distance_from_distribution_center"] / 50).clip(upper=1)
    recency_score = (df["last_distribution_hours"] / 72).clip(upper=1)
    transport_gap_score = (1 - (df["vehicle_capacity_total"] / df["population"]).replace([np.inf, -np.inf], 0)).clip(lower=0, upper=1)
    road_bonus = df["road_access_status"].map(ROAD_PRIORITY_BONUS)
    camp_score = (
        item_score
        + occupancy_score * 0.3
        + distance_score * 0.2
        + recency_score * 0.25
        + transport_gap_score * 0.2
        + road_bonus
    )

    derived["camp_priority"] = np.where(
        camp_score >= 2.6,
        "High",
        np.where(camp_score >= 1.65, "Medium", "Low"),
    )

    return derived


def augment_adequate_coverage_examples(df):
    sample_size = min(800, len(df))
    adequate = df.sample(sample_size, random_state=42).copy()
    population = adequate["population"]
    adequate["children_count"] = np.ceil(population * 0.1)
    adequate["elderly_count"] = np.ceil(population * 0.05)
    adequate["infants_count"] = np.ceil(population * 0.02)
    adequate["pregnant_women_count"] = np.ceil(population * 0.02)
    adequate["disabled_people_count"] = np.ceil(population * 0.02)
    adequate["chronic_patients_count"] = np.ceil(population * 0.03)
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
    adequate["last_distribution_hours"] = 12
    adequate["vehicle_capacity_total"] = np.ceil(adequate["population"] * 1.2)
    adequate["camp_occupancy_ratio"] = (
        adequate["population"] / adequate["camp_capacity"]
    ).clip(upper=1).round(4)
    adequate["vulnerable_ratio"] = (
        (
            adequate["children_count"]
            + adequate["elderly_count"]
            + adequate["pregnant_women_count"]
            + adequate["disabled_people_count"]
            + adequate["infants_count"]
            + adequate["chronic_patients_count"]
        )
        / adequate["population"].replace(0, np.nan)
    ).clip(upper=1).fillna(0).round(4)
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
    df = df[df["infants_count"] >= 0]
    df = df[df["pregnant_women_count"] >= 0]
    df = df[df["disabled_people_count"] >= 0]
    df = df[df["chronic_patients_count"] >= 0]
    df = df[df["camp_capacity"] > 0]
    df = df[df["food_available"] >= 0]
    df = df[df["water_available"] >= 0]
    df = df[df["medicine_available"] >= 0]
    df = df[df["sanitary_available"] >= 0]
    df = df[df["distance_from_distribution_center"] >= 0]
    df = df[df["last_distribution_hours"] >= 0]
    df = df[df["vehicle_capacity_total"] >= 0]
    df = df[df["camp_occupancy_ratio"] >= 0]
    df = df[df["vulnerable_ratio"] >= 0]
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
        "model_version": MODEL_VERSION,
        "standards": {
            "planning_days": PLANNING_DAYS,
            "food_packs_per_person_per_day": FOOD_PACKS_PER_PERSON_PER_DAY,
            "water_litres_per_person_per_day": WATER_LITRES_PER_PERSON_PER_DAY,
            "people_per_sanitary_kit": PEOPLE_PER_SANITARY_KIT,
            "people_per_medicine_kit": PEOPLE_PER_MEDICINE_KIT,
            "coverage_priority_thresholds": {
                "High": "coverage < 50%",
                "Medium": "50% <= coverage < 100%",
                "Low": "coverage >= 100%",
            },
            "camp_priority_thresholds": {
                "High": "camp_score >= 2.6",
                "Medium": "1.65 <= camp_score < 2.6",
                "Low": "camp_score < 1.65",
            },
            "additional_features": [
                "infants_count",
                "pregnant_women_count",
                "disabled_people_count",
                "chronic_patients_count",
                "last_distribution_hours",
                "vehicle_capacity_total",
                "camp_occupancy_ratio",
                "vulnerable_ratio",
            ],
        },
    }

    return X, y, encoders


def evaluate_model(model, X_test, y_test, target_encoders):
    y_pred = model.predict(X_test)
    report = {}

    for index, column in enumerate(TARGET_COLUMNS):
        encoder = target_encoders[column]
        actual = y_test.iloc[:, index]
        predicted = y_pred[:, index]
        accuracy = accuracy_score(actual, predicted)
        class_report = classification_report(
            actual,
            predicted,
            target_names=encoder.classes_,
            output_dict=True,
            zero_division=0,
        )
        matrix = confusion_matrix(actual, predicted).tolist()

        print("\n" + "=" * 50)
        print(column)
        print("=" * 50)
        print("Accuracy:", accuracy)
        print("\nClassification report:")
        print(classification_report(actual, predicted, target_names=encoder.classes_))
        print("Confusion matrix:")
        print(confusion_matrix(actual, predicted))
        report[column] = {
            "accuracy": accuracy,
            "classification_report": class_report,
            "confusion_matrix": matrix,
            "classes": encoder.classes_.tolist(),
        }

    return report


def predict_sample(model, encoders):
    sample_input = {
        "population": 420,
        "children_count": 110,
        "elderly_count": 60,
        "infants_count": 25,
        "pregnant_women_count": 15,
        "disabled_people_count": 20,
        "chronic_patients_count": 35,
        "food_available": 90,
        "water_available": 200,
        "medicine_available": 15,
        "sanitary_available": 45,
        "last_distribution_hours": 60,
        "vehicle_capacity_total": 200,
        "distance_from_distribution_center": 8,
        "camp_capacity": 600,
        "camp_occupancy_ratio": 0.7,
        "vulnerable_ratio": 0.631,
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
        stratify=y["camp_priority"],
    )

    base_model = RandomForestClassifier(
        n_estimators=400,
        random_state=42,
        class_weight="balanced_subsample",
        min_samples_leaf=2,
        n_jobs=-1,
    )
    model = MultiOutputClassifier(base_model)

    print("\nTraining Multi-Output Random Forest model...")
    model.fit(X_train, y_train)

    print("\nModel evaluation:")
    evaluation_report = evaluate_model(model, X_test, y_test, encoders["target_encoders"])

    predict_sample(model, encoders)

    joblib.dump(model, MODEL_PATH)
    joblib.dump(encoders, ENCODERS_PATH)
    with open(TRAINING_REPORT_PATH, "w", encoding="utf-8") as report_file:
        json.dump(
            {
                "model_version": MODEL_VERSION,
                "dataset_rows_after_cleaning_and_augmentation": len(df),
                "feature_columns": FEATURE_COLUMNS,
                "target_columns": TARGET_COLUMNS,
                "standards": encoders["standards"],
                "evaluation": evaluation_report,
            },
            report_file,
            indent=2,
        )

    print("\nSaved model:", MODEL_PATH)
    print("Saved encoders:", ENCODERS_PATH)
    print("Saved training report:", TRAINING_REPORT_PATH)


if __name__ == "__main__":
    main()
