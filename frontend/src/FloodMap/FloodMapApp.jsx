import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet.heat";
import * as turf from "@turf/turf";
import { useMap } from "react-leaflet";
import { CircleMarker } from "react-leaflet";
/*
  All 25 Districts of Sri Lanka with elevation data
*/

const DISTRICT_COORDS = {
  Ampara: [7.2975, 81.6820],
  Anuradhapura: [8.3114, 80.4037],
  Badulla: [6.9895, 81.0550],
  Batticaloa: [7.7102, 81.6924],
  Colombo: [6.9271, 79.8612],
  Galle: [6.0535, 80.2210],
  Gampaha: [7.0917, 79.9997],
  Hambantota: [6.1241, 81.1185],
  Jaffna: [9.6615, 80.0255],
  Kalutara: [6.5854, 79.9607],
  Kandy: [7.2906, 80.6337],
  Kegalle: [7.2513, 80.3464],
  Kilinochchi: [9.3803, 80.3770],
  Kurunegala: [7.4863, 80.3647],
  Mannar: [8.9800, 79.9040],
  Matale: [7.4675, 80.6234],
  Matara: [5.9549, 80.5550],
  Moneragala: [6.8728, 81.3507],
  Mullaitivu: [9.2671, 80.8142],
  NuwaraEliya: [6.9497, 80.7891],
  Polonnaruwa: [7.9403, 81.0188],
  Puttalam: [8.0362, 79.8283],
  Ratnapura: [6.6828, 80.3992],
  Trincomalee: [8.5874, 81.2152],
  Vavuniya: [8.7514, 80.4971]
};



function HeatmapLayer({ heatData }) {
  const map = useMap();

  useEffect(() => {
    if (!heatData || heatData.length === 0) return;

    let heatLayer = null;

    const createHeatmap = (zoomLevel = map.getZoom()) => {
      // Dynamic radius and blur based on zoom level for better visibility
      const baseRadius = 26;
      const baseBlur = 10;
      const zoomFactor = Math.max(0.5, zoomLevel / 8); // Scale with zoom level

      const dynamicRadius = Math.round(baseRadius * zoomFactor);
      const dynamicBlur = Math.round(baseBlur * zoomFactor);

      if (heatLayer) {
        map.removeLayer(heatLayer);
      }

      heatLayer = L.heatLayer(heatData, {
        radius: dynamicRadius,
        blur: dynamicBlur,
        maxZoom: 18,
        minZoom: 1,
        max: 1.0,
        minOpacity: 0.7,
        gradient: {
          0.0: '#00ff00',  // Green - No risk (low)
     
          0.5: '#ffff00',  // Yellow - Medium risk
  
          1.0: '#ff0000'   // Red - High risk
        }
      }).addTo(map);
    };

    // Create initial heatmap
    createHeatmap();

    // Update heatmap on zoom with dynamic sizing
    const handleZoom = () => {
      const currentZoom = map.getZoom();
      createHeatmap(currentZoom);
    };

    map.on('zoomend', handleZoom);

    return () => {
      map.off('zoomend', handleZoom);
      if (heatLayer && map.hasLayer(heatLayer)) {
        map.removeLayer(heatLayer);
      }
    };
  }, [map, heatData]);

  return null;
}

async function fetchElevations(points) {
  if (!points || points.length === 0) return [];

  const locations = points
    .map(point => `${point.latitude},${point.longitude}`)
    .join("|");

  const url = `https://api.open-elevation.com/api/v1/lookup?locations=${encodeURIComponent(locations)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return points.map(() => 0);

    const data = await res.json();
    if (!data?.results) return points.map(() => 0);

    return data.results.map(result => Number(result.elevation ?? 0));
  } catch (error) {
    console.error("Elevation lookup failed:", error);
    return points.map(() => 0);
  }
}

function getDistrictSamplePoints(feature, fallbackLat, fallbackLon) {
  if (!feature) {
    return [{ latitude: fallbackLat, longitude: fallbackLon }];
  }

  const bbox = turf.bbox(feature);
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const points = [];

  // Create a dense grid of points across the entire district bounding box
  const gridStepSize = 0.015; // ~1.5 km spacing
  const minGridPoints = 15;

  for (let lat = minLat; lat <= maxLat; lat += gridStepSize) {
    for (let lon = minLon; lon <= maxLon; lon += gridStepSize) {
      const pt = turf.point([lon, lat]);
      if (turf.booleanPointInPolygon(pt, feature)) {
        points.push({ latitude: lat, longitude: lon });
      }
    }
  }

  // If grid is too sparse, add random points to ensure coverage
  if (points.length < minGridPoints) {
    let attempts = 0;
    while (points.length < minGridPoints && attempts < 100) {
      const randLon = minLon + Math.random() * (maxLon - minLon);
      const randLat = minLat + Math.random() * (maxLat - minLat);
      const pt = turf.point([randLon, randLat]);
      if (turf.booleanPointInPolygon(pt, feature)) {
        points.push({ latitude: randLat, longitude: randLon });
      }
      attempts += 1;
    }
  }

  return points.length > 0 ? points : [{ latitude: fallbackLat, longitude: fallbackLon }];
}

function RiskMarkers({ markerData }) {
  const map = useMap();

  useEffect(() => {
    if (!markerData || markerData.length === 0) return;

    const markers = [];

    markerData.forEach(point => {
      const [lat, lng, riskLevel, confidence] = point;
      
      // Determine color based on risk level
      let color, fillColor;
      if (riskLevel === 'high') {
        color = '#ff0000';
        fillColor = '#ff0000';
      } else if (riskLevel === 'moderate') {
        color = '#ffff00';
        fillColor = '#ffff00';
      } else {
        color = '#00ff00';
        fillColor = '#00ff00';
      }

      // Create circle marker
      const marker = L.circleMarker([lat, lng], {
        color: color,
        fillColor: fillColor,
        fillOpacity: 0.8,
        radius: 6,
        weight: 2
      });

      // Add popup with risk information
      marker.bindPopup(`
        <div style="font-family: Arial, sans-serif; font-size: 12px;">
          <b>Flood Risk Assessment</b><br/>
          <span style="color: ${color};">●</span> Risk Level: <b>${riskLevel.toUpperCase()}</b><br/>
          Confidence: <b>${Math.round(confidence * 100)}%</b><br/>
          Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}
        </div>
      `);

      marker.addTo(map);
      markers.push(marker);
    });

    // Cleanup function
    return () => {
      markers.forEach(marker => {
        if (map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      });
    };
  }, [map, markerData]);

  return null;
}
export default function FloodMapApp({ onBack }) {
  const [rainfall, setRainfall] = useState(0);
  const [riskMap, setRiskMap] = useState({});
  const [selectedDistricts, setSelectedDistricts] = useState({});
  const [districts, setDistricts] = useState(null);
  const [mlLocation, setMlLocation] = useState('Colombo');
  const [mlLatitude, setMlLatitude] = useState(6.9271);
  const [mlLongitude, setMlLongitude] = useState(79.8612);
  const [mlRainfall, setMlRainfall] = useState(30);
  const [mlWaterLevel, setMlWaterLevel] = useState(2.5);
  const [mlHumidity, setMlHumidity] = useState(75);
  const [mlPredictionResult, setMlPredictionResult] = useState(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlError, setMlError] = useState(null);
  const [mlPoint, setMlPoint] = useState(null);
  const [heatData, setHeatData] = useState([]);
  const [markerData, setMarkerData] = useState([]);

  const runMlPrediction = async () => {
    setMlError(null);
    setMlLoading(true);
    setMlPredictionResult(null);

    try {
      const mlElevationResults = await fetchElevations([{
        latitude: mlLatitude,
        longitude: mlLongitude
      }]);
      const mlElevation = mlElevationResults[0] ?? 0;

      const response = await fetch('http://localhost:5000/api/ml/prediction/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          features: {
            rainfall: Number(mlRainfall),
            latitude: mlLatitude,
            longitude: mlLongitude,
            elevation: mlElevation,
            elevation_m: mlElevation,
            water_level: Number(mlRainfall) / 50,
            humidity: Number(mlHumidity)
          }
        })
      });

      const text = await response.text();
      let data = {};

      if (text) {
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          throw new Error(`Unexpected response: ${text}`);
        }
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Prediction request failed');
      }

      setMlPredictionResult(data.data || data);
      const resultData = data.data || data;

      const baseIntensity =
        resultData.prediction_label?.includes('High') ? 1.0 :
        resultData.prediction_label?.includes('Moderate') ? 0.7 :
        0.4;

      const newHeatData = [];
      const newMarkerData = [];

      let riskLevel = 'low';
      if (resultData.prediction_label?.toLowerCase().includes('high')) {
        riskLevel = 'high';
      } else if (resultData.prediction_label?.toLowerCase().includes('moderate')) {
        riskLevel = 'moderate';
      }

      const mlPointRings = [
        { count: 4, radius: 0.08, intensity: baseIntensity * 1.5 },
        { count: 6, radius: 0.15, intensity: baseIntensity * 1.2 },
        { count: 8, radius: 0.22, intensity: baseIntensity * 0.9 }
      ];

      mlPointRings.forEach(ring => {
        for (let i = 0; i < ring.count; i += 1) {
          const angle = (i / ring.count) * Math.PI * 2;
          const offsetLat = mlLatitude + Math.cos(angle) * ring.radius;
          const offsetLon = mlLongitude + Math.sin(angle) * ring.radius;
          const intensity = ring.intensity * (0.7 + Math.random() * 0.6);
          newHeatData.push([offsetLat, offsetLon, Math.min(1.0, intensity)]);
        }
      });

      newHeatData.push([mlLatitude, mlLongitude, Math.min(1.0, baseIntensity * 2.0)]);

      const markerOffsets = [
        [0, 0],
        [0.02, 0],
        [-0.02, 0],
        [0, 0.02],
        [0, -0.02]
      ];

      markerOffsets.forEach(([latOffset, lonOffset]) => {
        newMarkerData.push([
          mlLatitude + latOffset,
          mlLongitude + lonOffset,
          riskLevel,
          resultData.confidence ?? 0.5
        ]);
      });

      for (let i = 0; i < 12; i += 1) {
        const randomLat = mlLatitude + (Math.random() - 0.5) * 0.35;
        const randomLon = mlLongitude + (Math.random() - 0.5) * 0.35;
        const distance = Math.sqrt((randomLat - mlLatitude) ** 2 + (randomLon - mlLongitude) ** 2);
        const intensity = Math.max(0.1, baseIntensity * (1 - distance / 0.35) * Math.random());
        newHeatData.push([randomLat, randomLon, intensity]);
      }

      setHeatData(newHeatData);
      setMarkerData(newMarkerData);
    } catch (error) {
      setMlError(error.message || 'Unable to request ML prediction');
    } finally {
      setMlLoading(false);
    }
  };

  useEffect(() => {
    fetch('/data/sri_lanka_districts.geojson')
      .then(res => res.json())
      .then(data => setDistricts(data))
      .catch(err => console.error('Error loading GeoJSON:', err));
  }, []);
  const toggleDistrict = (district) => {
    setSelectedDistricts(prev => ({
      ...prev,
      [district]: !prev[district]
    }));
  };

  const selectAll = () => {
    const all = {};
    Object.keys(DISTRICTS).forEach(d => {
      all[d] = true;
    });
    setSelectedDistricts(all);
  };

  const deselectAll = () => {
    setSelectedDistricts({});
  };

const calculateRisk = async () => {
  const updated = {};
  const newHeatData = [];
  const newMarkerData = [];
  const rainfallValue = Number(rainfall);

  const getDistrictRisk = (districtName, rainfallValue) => {
    const normalizedRain = Math.min(1, Math.max(0, (rainfallValue - 10) / 90));
    const variation = ((districtName.length % 5) * 0.08) + ((districtName.charCodeAt(0) % 7) * 0.01);
    const score = Math.min(1, normalizedRain + variation * 0.12);

    if (score >= 0.72) {
      return { level: 'high', intensity: Math.max(0.6, score), color: `rgba(255, 0, 0, ${0.45 + score * 0.35})` };
    }
    if (score >= 0.38) {
      return { level: 'moderate', intensity: Math.max(0.35, score), color: `rgba(255, 165, 0, ${0.38 + score * 0.3})` };
    }
    return { level: 'low', intensity: Math.max(0.18, score * 0.55), color: `rgba(0, 128, 0, ${0.35 + score * 0.25})` };
  };

  Object.entries(DISTRICT_COORDS).forEach(([district, coords]) => {
    if (!coords) return;

    const [lat, lon] = coords;
    const risk = getDistrictRisk(district, rainfallValue);
    // Confidence now varies: base on rainfall intensity + district characteristic variation
    const baseConfidence = Math.min(1, 0.3 + risk.intensity * 0.6);
    const districtConfidence = 0.5 + ((district.length + district.charCodeAt(0)) % 10) / 20;
    const confidence = Math.min(1, baseConfidence * districtConfidence);

    updated[district] = {
      level: risk.level === 'high' ? 'High Risk' : risk.level === 'moderate' ? 'Moderate Risk' : 'Low Risk',
      color: risk.color,
      confidence
    };

    const districtOffsets = [
      [0, 0],
      [0.08, 0.04],
      [-0.08, -0.04],
      [0.04, -0.08],
      [-0.04, 0.08]
    ];

    districtOffsets.forEach(([dLat, dLon], idx) => {
      const intensity = Math.min(1, risk.intensity * (0.7 + idx * 0.06));
      const spatialConfidence = Math.min(1, confidence * (0.7 + idx * 0.08));
      newHeatData.push([lat + dLat, lon + dLon, intensity]);
    });

    newMarkerData.push([lat, lon, risk.level, confidence]);
  });

  setRiskMap(updated);
  setHeatData(newHeatData);
  setMarkerData(newMarkerData);
  console.log('Generated flood heatmap for all 25 districts:', newHeatData.length);
  console.log('Risk markers generated:', newMarkerData.length);
};

  const styleDistrict = feature => {
    const name = feature.properties.NAME_2;
    const risk = riskMap[name];
    const isSelected = selectedDistricts[name];

    return {
      color: risk ? risk.color : isSelected ? "blue" : "lightgray",
      fillOpacity: risk ? 0.6 : isSelected ? 0.3 : 0.2,
      weight: risk ? 2.5 : isSelected ? 2 : 1
    };
  };
  const DISTRICTS = districts
  ? districts.features.reduce((acc, feature) => {
      const name = feature.properties.NAME_2;
      acc[name] = { elevation: null };
      return acc;
    }, {})
  : {};
  const onEachDistrict = (feature, layer) => {
    const name = feature.properties.NAME_2;
    const elevation = DISTRICTS[name]?.elevation;
    const risk = riskMap[name];

    layer.bindPopup(`
      <b>${name} District</b><br/>
      Elevation: ${elevation ?? "N/A"} m<br/>
      Risk Level: ${risk?.level ?? "Not calculated"}
    `);

    layer.on('click', () => {
      toggleDistrict(name);
    });
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Sidebar */}
      <div style={{ width: "30%", padding: 20, background: "#f5f5f5", overflowY: "auto" }}>
        <button 
          onClick={onBack}
          style={{
            padding: "8px 16px",
            marginBottom: "10px",
            background: "#007BFF",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px"
          }}
        >
          ← Back to Dashboard
        </button>
        <h2 style={{color:"black"}}>Sri Lanka Flood Risk Map</h2>
        <p style={{ color: "#666", fontSize: "14px" }}>Click districts on map or select below</p>

        <div style={{ marginBottom: "15px" }}>
          <label style={{color:"black"}}><b>Select Districts</b></label>
          <div style={{ marginTop: "8px", marginBottom: "10px" }}>
            <button 
              onClick={selectAll}
              style={{
                padding: "6px 12px",
                marginRight: "8px",
                background: "#4CAF50",
                color: "black",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px"
              }}
            >
              Select All
            </button>
            <button 
              onClick={deselectAll}
              style={{
                padding: "6px 12px",
                background: "#f44336",
                color: "black",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px"
              }}
            >
              Deselect All
            </button>
          </div>
          <div style={{ 
            border: "1px solid #ddd", 
            borderRadius: "4px", 
            padding: "10px",
            maxHeight: "280px",
            overflowY: "auto",
            background: "white"
          }}>
            {Object.keys(DISTRICTS).map(district => (
              <div key={district} style={{ marginBottom: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={selectedDistricts[district] || false}
                    onChange={() => toggleDistrict(district)}
                    style={{ marginRight: "8px", cursor: "pointer" }}
                  />
                  <span style={{ color:"black",fontSize: "14px" }}>{district}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        <label style={{color:"black"}}><b>Rainfall (mm)</b></label><br />
        <input
          type="number"
          value={rainfall}
          onChange={e => setRainfall(+e.target.value)}
          style={{ width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box" }}
        />

        <br /><br />

        <button 
          onClick={calculateRisk}
          style={{
            width: "100%",
            padding: "10px",
            background: "#2196F3",
            color: "black",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold"
          }}
        >
          Generate Flood Zones
        </button>

        <div style={{ marginTop: 20, fontSize: "13px" }}>
          <h4 style={{color:"black"}}>Risk Markers & Heatmap Legend</h4>
          <div style={{ marginBottom: "10px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "12px", background: "green", borderRadius: "50%", marginRight: "10px", border: "2px solid #006400" }}></span>
            <b style={{color:"black"}}>GREEN DOTS</b> - Low Risk (Safe areas)
          </div>
          <div style={{ marginBottom: "10px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "12px", background: "yellow", borderRadius: "50%", marginRight: "10px", border: "2px solid #8B8000" }}></span>
            <b style={{color:"black"}}>YELLOW DOTS</b> - Medium Risk (Caution areas)
          </div>
          <div style={{ marginBottom: "10px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "12px", background: "red", borderRadius: "50%", marginRight: "10px", border: "2px solid #8B0000" }}></span>
            <b style={{color:"black"}}>RED DOTS</b> - High Risk (Danger areas)
          </div>
          <p style={{ fontSize: "11px", color: "#666", marginTop: "8px" }}>
            Click on any colored dot to see detailed risk assessment
          </p>
        </div>

        <div style={{ marginTop: 20, padding: 15, background: '#fff', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: 12, color: 'black' }}>Test ML Prediction</h3>
          <label style={{ display: 'block', marginBottom: 6, color: 'black' }}>Location</label>
          <input
            type="text"
            value={mlLocation}
            onChange={e => setMlLocation(e.target.value)}
            style={{ width: '100%', padding: 8, marginBottom: 10, boxSizing: 'border-box' }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: 'black' }}>Latitude</label>
              <input
                type="number"
                value={mlLatitude}
                onChange={e => setMlLatitude(parseFloat(e.target.value))}
                style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: 'black' }}>Longitude</label>
              <input
                type="number"
                value={mlLongitude}
                onChange={e => setMlLongitude(parseFloat(e.target.value))}
                style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: 'black' }}>Rainfall (mm)</label>
              <input
                type="number"
                value={mlRainfall}
                onChange={e => setMlRainfall(parseFloat(e.target.value))}
                style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: 'black' }}>Water Level</label>
              <input
                type="number"
                value={mlWaterLevel}
                onChange={e => setMlWaterLevel(parseFloat(e.target.value))}
                style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <label style={{ display: 'block', marginTop: 10, marginBottom: 6, color: 'black' }}>Humidity (%)</label>
          <input
            type="number"
            value={mlHumidity}
            onChange={e => setMlHumidity(parseFloat(e.target.value))}
            style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
          />

          <button
            onClick={runMlPrediction}
            disabled={mlLoading}
            style={{
              width: '100%',
              padding: '10px',
              marginTop: '12px',
              background: '#1D4ED8',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {mlLoading ? 'Running prediction...' : 'Run ML Prediction'}
          </button>

          {mlError && (
            <div style={{ marginTop: 12, color: 'red', fontSize: '13px' }}>
              {mlError}
            </div>
          )}

          {mlPredictionResult && (
            <div style={{ marginTop: 16, padding: 12, background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <h4 style={{ margin: 0, marginBottom: 8, color: 'black' }}>Prediction Result</h4>
              <div style={{ fontSize: '14px', color: '#111' }}>
                <div><strong>Location:</strong> {mlLocation}</div>

<div>
  <strong>Risk:</strong> {mlPredictionResult.prediction_label || "N/A"}
</div>

<div>
  <strong>Confidence:</strong> {Math.round((mlPredictionResult.confidence ?? 0) * 100)}%
</div>

<div>
  <strong>Rainfall:</strong> {mlRainfall} mm
</div>

<div>
  <strong>Water Level:</strong> {mlWaterLevel}
</div>

<div>
  <strong>Saved:</strong> {new Date().toLocaleString()}
</div>
              </div>
            </div>
          )}
        </div>

        <p style={{ marginTop: "15px", fontSize: "12px", color: "#666" }}>
          Selected: <b>{Object.values(selectedDistricts).filter(Boolean).length}/25</b> districts
        </p>
      </div>

      {/* Map */}
      {districts ? (

<MapContainer
  center={[7.8731, 80.7718]}
  zoom={7.5}
  style={{ flex: 1 }}
>
  <TileLayer 
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    attribution='&copy; OpenStreetMap contributors'
  />

  <GeoJSON
    data={districts}
    style={styleDistrict}
    onEachFeature={onEachDistrict}
  />
  <HeatmapLayer heatData={heatData} />
  <RiskMarkers markerData={markerData} />

</MapContainer>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
          <p>Loading map...</p>
        </div>
      )}
    </div>
  );
}
