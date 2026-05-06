import pandas as pd
import geopandas as gpd
import folium
import requests
import rasterio
from shapely.geometry import Point
import os
from pyproj import Transformer

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# =========================
# LOAD DATA
# =========================
df = pd.read_csv("../data/datasets/map_input.csv")

print("📊 Rows:", len(df))

# =========================
# LOAD DEM (ELEVATION)
# =========================
dem = rasterio.open("../data/maps/VaeSSA_DEM_20m_SLD99.img")

def get_elevation(lat, lon):
    try:
        x, y = transformer.transform(lon, lat)

        row, col = dem.index(x, y)
        elevation = dem.read(1)[row, col]

        # 🚨 HANDLE INVALID VALUES
        if elevation is None:
            return None

        # remove extreme no-data values
        if elevation < -100 or elevation > 10000:
            return None

        return float(elevation)

    except:
        return None
transformer = Transformer.from_crs("EPSG:4326", dem.crs, always_xy=True)
# =========================
# LOAD RIVERS
# =========================
rivers = gpd.read_file(os.path.join(BASE_DIR, "data", "maps", "lka_rapidsl_rvr_250k_sdlka.shp"))

# 🔥 FIX CRS IF MISSING
if rivers.crs is None:
    rivers = rivers.set_crs(epsg=5235, allow_override=True)

rivers = rivers.to_crs(epsg=4326)
rivers_proj = rivers.to_crs(epsg=3857)

# =========================
# DISTANCE TO RIVER
# =========================
def get_distance_to_river(lat, lon):
    try:
        point = Point(lon, lat)
        point_proj = gpd.GeoSeries([point], crs="EPSG:4326").to_crs(epsg=3857)[0]
        return rivers_proj.distance(point_proj).min()
    except:
        return 10000

# =========================
# FLOOD RISK FROM ELEVATION
# =========================
def elevation_risk(e):
    if e < 50:
        return 2   # high
    elif e < 150:
        return 1   # moderate
    else:
        return 0   # low

# =========================
# COMBINED RISK FUNCTION
# =========================
def calculate_risk(row):
    lat = float(row["latitude"])
    lon = float(row["longitude"])
    rainfall = float(row["rainfall"])

    elevation = get_elevation(lat, lon)
    dist_river = get_distance_to_river(lat, lon)

    score = 0

    # 🌧️ rainfall
    if rainfall > 100:
        score += 2
    elif rainfall > 50:
        score += 1

    # 🌊 river proximity
    if dist_river < 300:
        score += 2
    elif dist_river < 1000:
        score += 1

    # ⛰️ elevation
    score += elevation_risk(elevation)

    # 🔥 FINAL CLASS
    if score >= 5:
        return "High Risk"
    elif score >= 3:
        return "Moderate Risk"
    else:
        return "Low Risk"

# =========================
# APPLY MODEL
# =========================
print("🔮 Calculating flood zones...")

df["risk"] = df.apply(calculate_risk, axis=1)

print("\n📊 Risk Distribution:")
print(df["risk"].value_counts())

# =========================
# COLOR FUNCTION
# =========================
def get_color(risk):
    if "High" in str(risk):
        return "red"
    elif "Moderate" in str(risk):
        return "orange"
    else:
        return "green"

# =========================
# CREATE MAP
# =========================
m = folium.Map(location=[7.982, 80.233], zoom_start=8)

# 🔵 Rivers
folium.GeoJson(
    rivers,
    style_function=lambda x: {"color": "blue", "weight": 1}
).add_to(m)

# 🔴 Points
for _, row in df.iterrows():
    folium.CircleMarker(
        location=[row["latitude"], row["longitude"]],
        radius=6,
        color=get_color(row["risk"]),
        fill=True,
        fill_opacity=0.7,
        popup=f"""
        Location: {row.get('location')}<br>
        Risk: {row['risk']}<br>
        Elevation: {get_elevation(row['latitude'], row['longitude'])} m<br>
        Rainfall: {row['rainfall']}
        """
    ).add_to(m)

# =========================
# CREATE GEOJSON FOR FRONTEND
# =========================
features = []

for _, row in df.iterrows():
    lat = float(row["latitude"])
    lon = float(row["longitude"])
    elevation = get_elevation(lat, lon)

    features.append({
        "type": "Feature",
        "properties": {
            "risk": row["risk"],
            "elevation": elevation,
            "rainfall": row["rainfall"]
        },
        "geometry": {
            "type": "Point",
            "coordinates": [lon, lat]
        }
    })

geojson_output = {
    "type": "FeatureCollection",
    "features": features
}


# =========================
# SAVE GEOJSON FOR FRONTEND
# =========================
import json

features = []

for _, row in df.iterrows():
    lat = float(row["latitude"])
    lon = float(row["longitude"])
    elevation = get_elevation(lat, lon)

    features.append({
        "type": "Feature",
        "properties": {
            "risk": row["risk"],
            "elevation": elevation,
            "rainfall": row["rainfall"]
        },
        "geometry": {
            "type": "Point",
            "coordinates": [lon, lat]
        }
    })

geojson_output = {
    "type": "FeatureCollection",
    "features": features
}

# 🔥 MAKE SURE FOLDER EXISTS
os.makedirs("outputs", exist_ok=True)

output_path = os.path.join("outputs", "flood_map.geojson")

with open(output_path, "w") as f:
    json.dump(geojson_output, f)

print("✅ flood_map.geojson created at:", output_path)

os.makedirs(os.path.join(BASE_DIR, "outputs"), exist_ok=True)
# =========================
# SAVE
# =========================
m.save("outputs/flood_map.html")

print("\n✅ DONE — Open outputs/flood_map.html")