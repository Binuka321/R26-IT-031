import geopandas as gpd
from shapely.geometry import Point
import requests
import time

# =========================
# LOAD RIVERS SAFELY
# =========================
try:
    rivers = gpd.read_file("data/maps/lka_rapidsl_rvr_250k_sdlka.shp")

    if rivers.crs is None:
        rivers = rivers.set_crs(epsg=5235)

    rivers = rivers.to_crs(epsg=4326)
    rivers_proj = rivers.to_crs(epsg=3857)

    print("✅ Rivers loaded")

except Exception as e:
    print("❌ River loading failed:", e)
    rivers = None
    rivers_proj = None


# =========================
# DISTANCE TO RIVER
# =========================
def get_distance_to_river(lat, lon):
    try:
        if rivers_proj is None:
            return 10000

        point = Point(lon, lat)
        point_proj = gpd.GeoSeries([point], crs="EPSG:4326").to_crs(epsg=3857)[0]

        return rivers_proj.distance(point_proj).min()

    except Exception as e:
        return 10000


# =========================
# ELEVATION (API — SAFE)
# =========================
def get_elevation(lat, lon):
    try:
        url = f"https://api.open-elevation.com/api/v1/lookup?locations={lat},{lon}"
        res = requests.get(url, timeout=3)

        if res.status_code == 200:
            return res.json()['results'][0]['elevation']

        return 0

    except:
        return 0


# =========================
# ENRICH DATAFRAME
# =========================
def enrich_dataframe(df):

    print("🌍 Adding GIS features...")

    # 🔥 LIMIT API CALLS (VERY IMPORTANT)
    df = df.copy().head(200)  # remove or increase later

    # Distance to river
    df["distance_to_river"] = df.apply(
        lambda row: get_distance_to_river(row["latitude"], row["longitude"]),
        axis=1
    )

    # Elevation (slow)
    df["elevation"] = df.apply(
        lambda r: get_elevation(r["latitude"], r["longitude"]),
        axis=1
    )

    # Derived features
    df["water_level"] = df["rainfall"] / 50
    df["soil_moisture"] = df["rainfall"] / 2

    print("✅ GIS features added")

    return df