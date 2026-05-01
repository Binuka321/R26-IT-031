import pandas as pd
import numpy as np
from typing import Tuple, List
import os
from scipy.spatial import cKDTree


class DataProcessor:

    @staticmethod
    def load_csv(filepath: str) -> pd.DataFrame:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File not found: {filepath}")
        return pd.read_csv(filepath)

    # =========================
    # PREPROCESSING
    # =========================
    @staticmethod
    def preprocess_data(df: pd.DataFrame, target_column: str, drop_columns: List[str] = None):

        df = df.copy()

        if drop_columns:
            df = df.drop(columns=[col for col in drop_columns if col in df.columns])

        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found")

        y = df[target_column]
        X = df.drop(columns=[target_column])

        # Convert to numeric
        for col in X.columns:
            X[col] = pd.to_numeric(X[col], errors="coerce")

        X = X.fillna(0)
        X = X.select_dtypes(include=["number"])

        print("\n📊 FINAL FEATURES USED:")
        print(X.columns.tolist())

        return X.astype(float), y

    # =========================
    # 🔥 SPATIAL MERGE + LABELING
    # =========================
    @staticmethod
    def split_datasets(rainfall_df: pd.DataFrame, flood_df: pd.DataFrame):

        rainfall_df.columns = rainfall_df.columns.str.lower().str.strip()
        flood_df.columns = flood_df.columns.str.lower().str.strip()

        print("Rainfall columns:", rainfall_df.columns.tolist())
        print("Flood columns:", flood_df.columns.tolist())

        # -------------------------
        # NEAREST NEIGHBOR MATCH
        # -------------------------
        rainfall_coords = rainfall_df[["latitude", "longitude"]].values
        flood_coords = flood_df[["latitude", "longitude"]].values

        tree = cKDTree(flood_coords)
        distances, indices = tree.query(rainfall_coords, k=1)

        matched_flood = flood_df.iloc[indices].reset_index(drop=True)

        merged_df = pd.concat(
            [rainfall_df.reset_index(drop=True), matched_flood],
            axis=1
        )

        # Remove duplicate columns
        merged_df = merged_df.loc[:, ~merged_df.columns.duplicated()]

        print("\n📊 After spatial matching:", merged_df.shape)

        # =========================
        # 🔥 REALISTIC MULTI-CLASS RISK
        # =========================
        def calculate_risk(row):
            score = 0

            rainfall = row.get("rainfall_mm", 0)
            elevation = row.get("elevation_m", 0)
            distance = row.get("distance_to_river_m", 1000)

            # 🌧 Rainfall
            if rainfall > 80:
                score += 2
            elif rainfall > 50:
                score += 1

            # 🌊 River distance
            if distance < 300:
                score += 2
            elif distance < 1000:
                score += 1

            # ⛰ Elevation
            if elevation < 50:
                score += 2
            elif elevation < 150:
                score += 1

            # Final class
            if score >= 4:
                return "High"
            elif score >= 2:
                return "Moderate"
            else:
                return "Low"

        merged_df["risk_level"] = merged_df.apply(calculate_risk, axis=1)

        # =========================
        # RENAME FEATURES
        # =========================
        merged_df = merged_df.rename(columns={
            "rainfall_mm": "rainfall",
            "elevation_m": "elevation",
            "distance_to_river_m": "distance_to_river"
        })

        return merged_df

    # =========================
    # FEATURE ENGINEERING
    # =========================
    @staticmethod
    def create_features(df: pd.DataFrame):

        df = df.copy()

        if 'rainfall' in df.columns:

            df['rainfall_moving_avg'] = df.groupby(['latitude', 'longitude'])['rainfall'].transform(
                lambda x: x.rolling(window=3, min_periods=1).mean()
            )

            df['rainfall_deviation'] = df.groupby(['latitude', 'longitude'])['rainfall'].transform(
                lambda x: (x - x.mean()) / (x.std() if x.std() != 0 else 1)
            )

        return df

    # =========================
    # TARGET ENCODING
    # =========================
    @staticmethod
    def encode_target(y: pd.Series):

        mapping = {val: idx for idx, val in enumerate(sorted(y.unique()))}
        y_encoded = y.map(mapping)

        print("\n🎯 TARGET MAPPING:", mapping)

        return y_encoded.astype(int), mapping