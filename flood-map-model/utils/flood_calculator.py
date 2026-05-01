def calculate_flood_level(features, prediction_label):
    rainfall = float(features.get("rainfall", 0))
    water_level = float(features.get("water_level", 0))
    soil = float(features.get("soil_moisture", 0))

    flood_depth = (water_level * 0.6) + (rainfall / 100 * 0.3) + (soil / 100 * 0.1)

    if "High" in prediction_label:
        flood_depth *= 1.5
    elif "Moderate" in prediction_label:
        flood_depth *= 1.2

    return round(flood_depth, 2)


def get_severity(depth):
    if depth > 2:
        return "Severe Flood"
    elif depth > 1:
        return "Moderate Flood"
    else:
        return "Minor Flood"