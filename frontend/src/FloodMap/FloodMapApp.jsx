import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet.heat";

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

  const runMlPrediction = async () => {
    setMlError(null);
    setMlLoading(true);
    setMlPredictionResult(null);

    try {
      const response = await fetch('http://localhost:5000/api/ml/prediction/predict', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    features: {
  rainfall: Number(mlRainfall),
  latitude: mlLatitude,
  longitude: mlLongitude
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

// 🔥 CREATE HEATMAP FROM ML RESULT
const baseIntensity =
  resultData.prediction_label?.includes("High") ? 1 :
  resultData.prediction_label?.includes("Moderate") ? 0.6 :
  0.3;

const spread = [];

// create surrounding flood spread
for (let i = 0; i < 50; i++) {
  const offsetLat = mlLatitude + (Math.random() - 0.5) * 0.02;
  const offsetLon = mlLongitude + (Math.random() - 0.5) * 0.02;

  const decay = Math.random();

  spread.push([
    offsetLat,
    offsetLon,
    baseIntensity * (1 - decay)
  ]);
}

// 🔥 SET HEATMAP DATA
setHeatData(spread);

    } catch (error) {
      setMlError(error.message || 'Unable to request ML prediction');
    } finally {
      setMlLoading(false);
    }
  };

  useEffect(() => {
    fetch('/src/data/sri_lanka_districts.geojson')
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

  for (const district of Object.keys(DISTRICTS)) {
    if (!selectedDistricts[district]) continue;

    const coords = DISTRICT_COORDS[district];
    if (!coords) continue;

    const [lat, lon] = coords;

    try {
      const response = await fetch('http://localhost:5000/api/ml/prediction/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features: {
            rainfall: Number(rainfall),
            latitude: lat,
            longitude: lon
          }
        })
      });

      const result = await response.json();

      // 🔥 ML output
      const label = result.prediction_label || "Low";
      const confidence = result.confidence ?? 0.5;

      // 🔥 AUTO COLOR BASED ON ML + CONFIDENCE
      let color = "green";

      if (label.toLowerCase().includes("high")) {
        color = `rgba(255, 0, 0, ${0.4 + confidence})`;
      } else if (label.toLowerCase().includes("moderate")) {
        color = `rgba(255, 165, 0, ${0.4 + confidence})`;
      } else {
        color = `rgba(0, 128, 0, ${0.4 + confidence})`;
      }

      updated[district] = {
        level: label,
        color,
        confidence
      };

    } catch (err) {
      console.error("Prediction error:", err);
    }
  }

  setRiskMap(updated);
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
          <h4 style={{color:"black"}}>Risk Color Legend</h4>
          <div style={{ marginBottom: "10px" }}>
            <span style={{ display: "inline-block", width: "20px", height: "20px", background: "blue", marginRight: "10px", borderRadius: "3px" }}></span>
            <b style={{color:"black"}}>SELECTED</b> - District selected
          </div>
          <div style={{ marginBottom: "10px" }}>
            <span style={{ display: "inline-block", width: "20px", height: "20px", background: "green", marginRight: "10px", borderRadius: "3px" }}></span>
            <b style={{color:"black"}}>LOW</b> - Elevation ≥ 100m or rainfall ≤ 80mm
          </div>
          <div style={{ marginBottom: "10px" }}>
            <span style={{ display: "inline-block", width: "20px", height: "20px", background: "orange", marginRight: "10px", borderRadius: "3px" }}></span>
            <b style={{color:"black"}}>MODERATE</b> - 20-100m elevation, rainfall 80-120mm
          </div>
          <div style={{ marginBottom: "10px" }}>
            <span style={{ display: "inline-block", width: "20px", height: "20px", background: "red", marginRight: "10px", borderRadius: "3px" }}></span>
            <b style={{color:"black"}}>HIGH</b> - Below 20m elevation, rainfall 120mm
          </div>
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
        whenCreated={(map) => {
          if (heatData.length > 0) {
        L.heatLayer(heatData, {
        radius: 30,
        blur: 25,
        maxZoom: 10
         }).addTo(map);
        } 
      }}
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

        
      </MapContainer>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
          <p>Loading map...</p>
        </div>
      )}
    </div>
  );
}
