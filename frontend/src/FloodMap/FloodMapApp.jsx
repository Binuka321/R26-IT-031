import React, { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, Circle, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet.heat";
import * as turf from "@turf/turf";
import { useMap } from "react-leaflet";
import { CircleMarker } from "react-leaflet";
import { fetchSensorPackages } from "../Drain_management/sensorPackageApi";
import { getMapFloodAlerts, formatCoordinates } from "../Drain_management/floodRisk";
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
      const baseRadius = 10;
      const baseBlur = 14;
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
        minOpacity: 0.45,
       gradient: {
         0.05: '#00aa00',
         0.25: '#55ff55',
         0.45: '#ffff00',
         0.7: '#ff8800',
         1.0: '#ff0000'

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
  const gridStepSize = 0.005; // ~500 meters spacing
  const minGridPoints = 50;

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
    while (points.length < minGridPoints && attempts < 200) {
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

function selectSpreadPoints(points, count) {
  if (points.length <= count) return points;

  const step = points.length / count;
  return Array.from({ length: count }, (_, index) => points[Math.floor(index * step)]);
}

function getNearestSensor(point, sensorPackages) {
  return sensorPackages
    .map(pkg => ({
      pkg,
      distance: turf.distance(
        turf.point([point.longitude, point.latitude]),
        turf.point([pkg.location.longitude, pkg.location.latitude]),
        { units: 'kilometers' }
      )
    }))
    .sort((a, b) => a.distance - b.distance)[0];
}

function buildDistrictHeatPoints(sensorPredictions, districts) {
  if (!districts?.features?.length || !sensorPredictions.length) return [];

  const predictions = sensorPredictions
    .map(pred => ({
      ...pred,
      latitude: Number(pred.latitude),
      longitude: Number(pred.longitude),
      floodDepth: Number(pred.floodDepth || 0)
    }))
    .filter(pred => Number.isFinite(pred.latitude) && Number.isFinite(pred.longitude));

  const sensors = predictions.map(pred => ({
    ...pred,
    intensity: Math.min(1, Math.max(0.2, pred.floodDepth / 3))
  }));

  const heatPoints = [];

  districts.features.forEach(feature => {
    const samplePoints = getDistrictSamplePoints(
      feature,
      sensors[0]?.latitude || 7.8731,
      sensors[0]?.longitude || 80.7718
    );

    samplePoints.forEach(point => {
      const pointFeature = turf.point([point.longitude, point.latitude]);
      let maxValue = 0;

      sensors.forEach(pred => {
        const sensorPoint = turf.point([pred.longitude, pred.latitude]);
        const distanceKm = turf.distance(pointFeature, sensorPoint, { units: 'kilometers' });
        if (distanceKm > 40) return;

        const influence = Math.max(0, 1 - distanceKm / 30);
        const value = pred.intensity * (0.2 + influence * 0.8) * (1 - distanceKm / 50);
        maxValue = Math.max(maxValue, value);
      });

      if (maxValue > 0.08) {
        heatPoints.push([point.latitude, point.longitude, Math.min(1, maxValue)]);
      }
    });
  });

  sensors.forEach(pred => {
    const ringStructure = [
      { count: 1, radius: 0.0, intensity: pred.intensity * 1.3 },
      { count: 12, radius: 0.03, intensity: pred.intensity * 1.0 },
      { count: 20, radius: 0.06, intensity: pred.intensity * 0.6 }
    ];

    ringStructure.forEach(ring => {
      for (let i = 0; i < ring.count; i += 1) {
        const angle = (i / Math.max(ring.count, 1)) * Math.PI * 2;
        const offsetLat = pred.latitude + Math.cos(angle) * ring.radius;
        const offsetLon = pred.longitude + Math.sin(angle) * ring.radius;
        heatPoints.push([
          offsetLat,
          offsetLon,
          Math.min(1, Math.max(0.3, ring.intensity * (0.6 + Math.random() * 0.4)))
        ]);
      }
    });
  });

  for (let i = 0; i < sensors.length; i += 1) {
    for (let j = i + 1; j < sensors.length; j += 1) {
      const sensorA = sensors[i];
      const sensorB = sensors[j];
      const pathDistanceKm = turf.distance(
        turf.point([sensorA.longitude, sensorA.latitude]),
        turf.point([sensorB.longitude, sensorB.latitude]),
        { units: 'kilometers' }
      );

      if (pathDistanceKm > 25) continue;

      const segmentCount = Math.max(8, Math.round(pathDistanceKm * 4));
      for (let step = 0; step <= segmentCount; step += 1) {
        const t = step / Math.max(segmentCount, 1);
        const lat = sensorA.latitude + (sensorB.latitude - sensorA.latitude) * t;
        const lon = sensorA.longitude + (sensorB.longitude - sensorA.longitude) * t;
        const distanceA = turf.distance(turf.point([lon, lat]), turf.point([sensorA.longitude, sensorA.latitude]), { units: 'kilometers' });
        const distanceB = turf.distance(turf.point([lon, lat]), turf.point([sensorB.longitude, sensorB.latitude]), { units: 'kilometers' });
        const influence = Math.max(0, 1 - Math.min(distanceA, distanceB) / 25);
        const intensity = Math.max(sensorA.intensity, sensorB.intensity) * (0.25 + influence * 0.75);
        heatPoints.push([lat, lon, Math.min(1, Math.max(0.25, intensity))]);
      }
    }
  }

  return heatPoints;
}

function RiskMarkers({ markerData }) {
  const map = useMap();

  useEffect(() => {
    if (!markerData || markerData.length === 0) return;

    const markers = [];

    markerData.forEach(point => {
      const [lat, lng, riskLevel, confidence, rainfall, sensorName, sensorDistance] = point;

      // Use palette that matches the sidebar legend: green (safe), yellow (moderate), red (danger)
      let strokeColor = '#006400'; // dark green border for safe
      let fillColor = '#16a34a';   // green fill

      if (riskLevel === 'high') {
        strokeColor = '#8B0000';
        fillColor = '#dc2626';
      } else if (riskLevel === 'moderate') {
        strokeColor = '#8B8000';
        fillColor = '#fbbf24';
      }

      // Create circle marker and make it more visible above heatmap
      const marker = L.circleMarker([lat, lng], {
        color: strokeColor,
        fillColor: fillColor,
        fillOpacity: 0.95,
        radius: 8,
        weight: 2
      }).addTo(map);

      // Ensure markers render above heatmap layers
      if (marker.bringToFront) marker.bringToFront();

      marker.bindPopup(`
        <div style="font-family: Arial, sans-serif; font-size: 12px;">
          <b>Flood Risk Assessment</b><br/>
          <span style="color: ${fillColor};">●</span> Risk Level: <b>${String(riskLevel).toUpperCase()}</b><br/>
          Confidence: <b>${Math.round((confidence || 0) * 100)}%</b><br/>
          Rainfall: <b>${Number.isFinite(Number(rainfall)) ? Number(rainfall).toFixed(1) : 'N/A'} mm</b><br/>
          Nearest station: <b>${sensorName || 'N/A'}</b><br/>
          Distance: <b>${Number.isFinite(Number(sensorDistance)) ? `${Number(sensorDistance).toFixed(1)} km` : 'N/A'}</b><br/>
          Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}
        </div>
      `);

      markers.push(marker);
    });

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

function SensorMarkers({ sensorPackages }) {
  const map = useMap();

  useEffect(() => {
    if (!sensorPackages || sensorPackages.length === 0) return;

    const markers = [];

    sensorPackages.forEach(pkg => {
      const { location, currentReadings, status, name } = pkg;
      const lat = location.latitude;
      const lng = location.longitude;

      // Determine color based on water level
      let color = '#0066cc'; // Blue for normal
      const waterLevel = currentReadings?.waterLevel;
      const waterLevelSettings = pkg.waterLevelSettings;

      if (waterLevelSettings && waterLevel !== undefined) {
        if (waterLevel >= waterLevelSettings.majorFloodLevel) {
          color = '#ff0000'; // Red for major flood
        } else if (waterLevel >= waterLevelSettings.minorFloodLevel) {
          color = '#ff8800'; // Orange for minor flood
        } else if (waterLevel >= waterLevelSettings.alertLevel) {
          color = '#ffff00'; // Yellow for alert
        }
      }

      // Create circle marker with larger radius for sensors
      const marker = L.circleMarker([lat, lng], {
        color: color,
        fillColor: color,
        fillOpacity: 0.7,
        radius: 8,
        weight: 2.5
      });

      // Build sensor info popup
      const sensorCounts = [
        pkg.sensors?.ultrasonic > 0 ? `${pkg.sensors.ultrasonic} Ultrasonic` : null,
        pkg.sensors?.rain > 0 ? `${pkg.sensors.rain} Rain` : null,
        pkg.sensors?.flow > 0 ? `${pkg.sensors.flow} Flow` : null,
        pkg.sensors?.turbidity > 0 ? `${pkg.sensors.turbidity} Turbidity` : null
      ].filter(Boolean).join(', ');

      const popupContent = `
        <div style="font-family: Arial, sans-serif; font-size: 12px; min-width: 180px;">
          <b>${name}</b><br/>
          <span style="color: #666; font-size: 11px;">${location.name} - ${location.river || 'N/A'}</span><br/>
          <hr style="margin: 6px 0; border: none; border-top: 1px solid #ddd;"/>
          <b>Status:</b> ${status}<br/>
          ${waterLevel !== undefined ? `<b>Water Level:</b> ${waterLevel.toFixed(2)} ${currentReadings?.unit || 'm'}<br/>` : ''}
          ${currentReadings?.rainfall !== undefined ? `<b>Rainfall:</b> ${currentReadings.rainfall.toFixed(2)} mm<br/>` : ''}
          ${currentReadings?.flowRate !== undefined ? `<b>Flow Rate:</b> ${currentReadings.flowRate.toFixed(2)} L/s<br/>` : ''}
          <b>Sensors:</b> ${sensorCounts}<br/>
          <b>Updated:</b> ${new Date(pkg.lastUpdate).toLocaleString()}
        </div>
      `;

        marker.bindTooltip(
      name,
  {
    permanent: true,
    direction: "top",
    offset: [0, -10]
  }
);
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
  }, [map, sensorPackages]);

  return null;
}

function CoverageSensorMarkers({ sensors }) {
  const map = useMap();

  useEffect(() => {
    if (!sensors || sensors.length === 0) return;

    const markers = [];

    sensors.forEach(sensor => {
      const marker = L.circleMarker(
        [sensor.latitude, sensor.longitude],
        {
          radius: 16,
          color: "#000",
          fillColor: "#ff00ff",
          fillOpacity: 0.95,
          weight: 3
        }
      );

      marker.bindPopup(`
        <div style="min-width:220px">
          <h3>${sensor.name}</h3>

          <b>Severity:</b> ${sensor.severity}<br/>
          <b>Flood Depth:</b> ${sensor.floodDepth.toFixed(2)} m<br/>
          <b>Confidence:</b> ${Math.round(sensor.confidence * 100)}%<br/>
          <b>Rainfall:</b> ${sensor.rainfall ?? "N/A"} mm<br/>
          <b>Water Level:</b> ${sensor.waterLevel ?? "N/A"}
        </div>
      `);

      marker.addTo(map);
      markers.push(marker);
    });

    return () => {
      markers.forEach(marker => {
        if (map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      });
    };
  }, [map, sensors]);

  return null;
}

function MapPresentationControls({ showSensorMarkers, onToggleSensors }) {
  const map = useMap();

  const toggleFullscreen = () => {
    const mapElement = map.getContainer().parentElement;
    if (!document.fullscreenElement) {
      mapElement?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1000, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 8, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pointerEvents: 'auto' }}>
        <div style={{ padding: '4px 8px', color: '#f8fafc', background: 'rgba(5, 15, 30, 0.82)', borderLeft: '3px solid #22d3ee', fontSize: 16, fontWeight: 700, textShadow: '0 1px 3px #000' }}>
          Flood Risk Map (Predicted) <span title="Prediction generated from the ML model" style={{ marginLeft: 4, color: '#bae6fd' }}>ⓘ</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <select aria-label="Map zone" defaultValue="all" style={{ padding: '4px 8px', color: '#f8fafc', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid #64748b', borderRadius: 4, fontSize: 13 }}>
            <option value="all">All Zones</option>
          </select>
          <button type="button" onClick={onToggleSensors} title="Toggle sensor layers" style={{ padding: '4px 9px', color: '#f8fafc', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid #64748b', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
            Layers {showSensorMarkers ? 'On' : 'Off'}
          </button>
        </div>
      </div>
      <div style={{ position: 'absolute', right: 10, top: '42%', display: 'flex', flexDirection: 'column', gap: 4, pointerEvents: 'auto' }}>
        <button type="button" onClick={() => map.zoomIn()} title="Zoom in" style={mapControlStyle}>+</button>
        <button type="button" onClick={() => map.zoomOut()} title="Zoom out" style={mapControlStyle}>-</button>
        <button type="button" onClick={() => map.setView([6.9271, 79.8612], 11)} title="Center on Colombo" style={mapControlStyle}>o</button>
      </div>
      <button type="button" onClick={toggleFullscreen} title="View full map" style={{ position: 'absolute', left: 10, bottom: 10, padding: '6px 10px', color: '#f8fafc', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid #64748b', borderRadius: 4, cursor: 'pointer', fontSize: 13, pointerEvents: 'auto' }}>
        View Full Map
      </button>
    </div>
  );
}

const mapControlStyle = {
  width: 28,
  height: 28,
  padding: 0,
  color: '#f8fafc',
  background: 'rgba(15, 23, 42, 0.9)',
  border: '1px solid #64748b',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 20,
  lineHeight: 1
};

export default function FloodMapApp({ onBack, authToken, embedded = false, height, hideSidebar = false }) {
const SENSOR_FLOOD_RADIUS_M = 1500;

function SensorFloodAlertCircles({ alerts }) {
  if (!alerts || alerts.length === 0) return null;

  return alerts.map(({ package: pkg, risk }) => {
    const isMajor = risk.level === "Major flood" || risk.level === "High Risk";
    const lat = pkg.location.latitude;
    const lng = pkg.location.longitude;

    return (
      <Circle
        key={pkg.id}
        center={[lat, lng]}
        radius={SENSOR_FLOOD_RADIUS_M}
        pathOptions={{
          color: "#b91c1c",
          fillColor: "#ef4444",
          fillOpacity: isMajor ? 0.35 : 0.25,
          weight: 2
        }}
      >
        <Popup>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: "12px", minWidth: "180px" }}>
            <b style={{ color: "#b91c1c" }}>{risk.level}</b>
            <br />
            <b>{pkg.name}</b>
            <br />
            {pkg.location.name}
            {pkg.location.station ? ` · ${pkg.location.station}` : ""}
            <br />
            Water level: <b>{risk.waterLevel?.toFixed(2)} {risk.unit}</b>
            {risk.thresholdValue !== undefined && (
              <>
                <br />
                Threshold: {risk.thresholdValue.toFixed(2)} {risk.unit}
              </>
            )}
            <br />
            {formatCoordinates(lat, lng)}
            <br />
            <span style={{ color: "#666" }}>1.5 km affected radius</span>
          </div>
        </Popup>
      </Circle>
    );
  });
}

  const [districts, setDistricts] = useState(null);
  const [mlLocation, setMlLocation] = useState('Colombo');
  const [mlLatitude, setMlLatitude] = useState(6.9271);
  const [mlLongitude, setMlLongitude] = useState(79.8612);
  const [mlRainfall, setMlRainfall] = useState(30);
  const [mlHumidity, setMlHumidity] = useState(75);
  const [mlPredictionDate, setMlPredictionDate] = useState(new Date().toISOString().slice(0, 10));
  const [mlPredictionPeriod, setMlPredictionPeriod] = useState('Any');
  const [mlPredictionResult, setMlPredictionResult] = useState(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlError, setMlError] = useState(null);
  const [mlPoint, setMlPoint] = useState(null);
  const [heatData, setHeatData] = useState([]);
  const [markerData, setMarkerData] = useState([]);
  const [sensorPackages, setSensorPackages] = useState([]);
  const [affectedSensors, setAffectedSensors] = useState([]);
  const [coveredDistricts, setCoveredDistricts] = useState([]);
  const [sensorsLoading, setSensorsLoading] = useState(false);
  const [showSensorMarkers, setShowSensorMarkers] = useState(true);
  const [sensorPredictionDate, setSensorPredictionDate] = useState(new Date().toISOString().slice(0, 10));
  const [sensorPredictionPeriod, setSensorPredictionPeriod] = useState('Any');
  const [iotMapLoading, setIotMapLoading] = useState(false);
  const [iotMapError, setIotMapError] = useState(null);
  const [lastSensorMapUpdate, setLastSensorMapUpdate] = useState(null);
  const [hasGeneratedIotMap, setHasGeneratedIotMap] = useState(false);
  const [districtCoverageMap, setDistrictCoverageMap] = useState({});
  // Fetch sensor packages on mount
  useEffect(() => {
    if (!authToken) return;

    const fetchSensors = async () => {
      setSensorsLoading(true);
      try {
        const response = await fetch('http://localhost:3001/api/sensor-packages', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (response.ok) {
          const data = await response.json();
          setSensorPackages(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Failed to fetch sensor packages:', error);
      } finally {
        setSensorsLoading(false);
      }
    };

    fetchSensors();
    // Refresh sensors every 30 seconds
    const interval = setInterval(fetchSensors, 30000);
    return () => clearInterval(interval);
  }, [authToken]);

  const formatDateForQuery = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  };
  const [sensorFloodAlerts, setSensorFloodAlerts] = useState([]);
  const [sensorAlertsError, setSensorAlertsError] = useState(null);
  const [sensorAlertsLoading, setSensorAlertsLoading] = useState(false);

  const loadSensorFloodAlerts = useCallback(async (silent = false) => {
    if (!authToken) return;

    if (!silent) setSensorAlertsLoading(true);

    try {
      const packages = await fetchSensorPackages(authToken);
      setSensorFloodAlerts(getMapFloodAlerts(packages));
      setSensorAlertsError(null);
    } catch (error) {
      setSensorAlertsError(error.message || "Could not load sensor flood alerts");
      if (!silent) setSensorFloodAlerts([]);
    } finally {
      if (!silent) setSensorAlertsLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    loadSensorFloodAlerts();
    const interval = setInterval(() => loadSensorFloodAlerts(true), 5000);
    return () => clearInterval(interval);
  }, [loadSensorFloodAlerts]);

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

      // Check if there's a nearby sensor and use its data
      let usedRainfall = Number(mlRainfall);
      let usedWaterLevel = 0;
      let nearestSensor = null;

      if (sensorPackages.length > 0) {
        const nearby = sensorPackages
          .map(pkg => ({
            ...pkg,
            distance: Math.sqrt(
              Math.pow(pkg.location.latitude - mlLatitude, 2) +
              Math.pow(pkg.location.longitude - mlLongitude, 2)
            )
          }))
          .sort((a, b) => a.distance - b.distance)[0];

        if (nearby && nearby.distance < 0.5) { // Within ~55km
          nearestSensor = nearby;
          if (nearby.currentReadings?.rainfall !== undefined) {
            usedRainfall = nearby.currentReadings.rainfall;
          }
          if (nearby.currentReadings?.waterLevel !== undefined) {
            usedWaterLevel = nearby.currentReadings.waterLevel;
          }
        }
      }

      const response = await fetch('http://localhost:3001/api/prediction/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          location: mlLocation,
          latitude: mlLatitude,
          longitude: mlLongitude,
          rainfall: usedRainfall,
          humidity: Number(mlHumidity),
          predictionDate: formatDateForQuery(mlPredictionDate),
          predictionPeriod: mlPredictionPeriod || 'Any'
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

      setMlPredictionResult({
        ...(data.data || data),
        prediction_label: data.data?.mlPrediction?.predictionLabel || data.prediction_label,
        confidence: data.data?.mlPrediction?.confidence ?? data.confidence,
        usedSensorData: !!nearestSensor,
        nearestSensorName: nearestSensor?.name
      });
      const resultData = data.data || data;
      usedRainfall = Number(resultData.rainfall ?? usedRainfall);
      usedWaterLevel = Number(resultData.waterLevel ?? 0);

      const predictionLabel = resultData.prediction_label || resultData.prediction || 'Low Risk';
      const colomboFeature = districts?.features?.find(feature => {
        const name = feature.properties.NAME_2 || feature.properties.NAME_1 || '';
        return /colombo/i.test(String(name));
      });
      const colomboSamples = colomboFeature
        ? selectSpreadPoints(getDistrictSamplePoints(colomboFeature, mlLatitude, mlLongitude), 160)
        : [{ latitude: mlLatitude, longitude: mlLongitude }];
      const sampleElevations = await fetchElevations(colomboSamples);
      const pointInputs = colomboSamples.map((point, index) => {
        const nearest = getNearestSensor(point, sensorPackages);
        const nearby = nearest?.distance <= 40 ? nearest.pkg : null;
        const rainfall = nearby?.currentReadings?.rainfall ?? usedRainfall;
        const waterLevel = nearby?.currentReadings?.waterLevel ?? usedWaterLevel;

        return {
          predicted_rainfall_mm: Number(rainfall),
          rainfall: Number(rainfall),
          latitude: point.latitude,
          longitude: point.longitude,
          elevation: sampleElevations[index] ?? mlElevation,
          elevation_m: sampleElevations[index] ?? mlElevation,
          water_level_m: Number(waterLevel),
          water_level: Number(waterLevel),
          flow_rate_m3s: Math.max(0, Number(waterLevel)),
          historical_risk: 0,
          humidity: Number(mlHumidity),
          date: formatDateForQuery(mlPredictionDate),
          period: mlPredictionPeriod || 'Any'
        };
      });
      const pointPredictions = await fetch('http://localhost:5000/api/ml/prediction/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features: pointInputs
        })
      });
      const pointPayload = await pointPredictions.json();
      if (!pointPredictions.ok || !Array.isArray(pointPayload.predictions)) {
        throw new Error(pointPayload.error || 'Colombo point predictions could not be generated');
      }

      const newMarkerData = pointPayload.predictions.map((prediction, index) => {
        const label = prediction.prediction_label || prediction.prediction || predictionLabel;
        const nearest = getNearestSensor(colomboSamples[index], sensorPackages);
        const pointRisk = sensorPackages.length > 0
          ? nearest.distance <= 5 ? 'high' : nearest.distance <= 15 ? 'moderate' : 'low'
          : /very high|high/i.test(label) ? 'high'
            : /moderate|medium/i.test(label) ? 'moderate' : 'low';
        return [
          colomboSamples[index].latitude,
          colomboSamples[index].longitude,
          pointRisk,
          prediction.confidence ?? 0.5,
          pointInputs[index].rainfall,
          nearest?.pkg?.name || nearest?.pkg?.location?.name,
          nearest?.distance
        ];
      });
      const newHeatData = pointPayload.predictions.map((prediction, index) => {
        const label = prediction.prediction_label || prediction.prediction || predictionLabel;
        const nearest = getNearestSensor(colomboSamples[index], sensorPackages);
        const intensity = sensorPackages.length > 0
          ? nearest.distance <= 5 ? 1 : nearest.distance <= 15 ? 0.65 : 0.15
          : /very high|high/i.test(label) ? 1 : /moderate|medium/i.test(label) ? 0.7 : 0.15;
        return [colomboSamples[index].latitude, colomboSamples[index].longitude, intensity];
      });

      setHeatData(newHeatData);
      setMarkerData(newMarkerData);
    } catch (error) {
      setMlError(error.message || 'Unable to request ML prediction');
    } finally {
      setMlLoading(false);
    }
  };

  const generateIotFloodMap = useCallback(async () => {
    if (!authToken) {
      setIotMapError('Authentication is required to fetch sensor-driven flood map data.');
      return;
    }

    setIotMapError(null);
    setIotMapLoading(true);

    try {
      const dateQuery = formatDateForQuery(sensorPredictionDate);
      const periodQuery = sensorPredictionPeriod || 'Any';
      const response = await fetch(`http://localhost:3001/api/prediction/sensor-predictions?date=${encodeURIComponent(dateQuery)}&period=${encodeURIComponent(periodQuery)}`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || payload.message || `Status ${response.status}`);
      }

      const sensorPredictions = Array.isArray(payload.data) ? payload.data : [];
      if (sensorPredictions.length === 0) {
        throw new Error('No sensor-driven predictions were returned.');
      }

      const newMarkerData = sensorPredictions.map(pred => {
        const label = pred.mlPrediction?.predictionLabel || pred.severity || 'Minor Flood';
        let level = 'low';
        if (/high|severe/i.test(label)) level = 'high';
        else if (/moderate/i.test(label)) level = 'moderate';

        return [
          pred.latitude,
          pred.longitude,
          level,
          pred.mlPrediction?.confidence ?? 0.5
        ];
      });

      const newHeatData = buildDistrictHeatPoints(sensorPredictions, districts);

      if (newHeatData.length === 0) {
        // Fallback to sensor-centered heat points when district polygons are not ready
        sensorPredictions.forEach(pred => {
          const intensity = Math.min(1, (pred.floodDepth || 0) / 4);
          newHeatData.push([pred.latitude, pred.longitude, intensity]);
        });
      }

      const coveringSensors = sensorPredictions
        .filter(pred => pred.latitude !== undefined && pred.longitude !== undefined)
        .map(pred => ({
          name: pred.location || pred.name || 'Sensor package',
          latitude: pred.latitude,
          longitude: pred.longitude,
          floodDepth: pred.floodDepth || 0,
          severity: pred.severity || 'Minor Flood',
          confidence: pred.mlPrediction?.confidence ?? 0.5,
          rainfall: pred.rainfall,
          waterLevel: pred.waterLevel
        }));

      const coveredDistrictNames = [];
const coverageMap = {};

if (districts?.features?.length) {
  districts.features.forEach(feature => {
    const districtName =
      feature.properties.NAME_2 ||
      feature.properties.NAME_1 ||
      "Unknown";

    const sensorsInDistrict = coveringSensors.filter(sensor =>
      turf.booleanPointInPolygon(
        turf.point([sensor.longitude, sensor.latitude]),
        feature
      )
    );

    if (sensorsInDistrict.length > 0) {
      coveredDistrictNames.push(districtName);
      coverageMap[districtName] = sensorsInDistrict;
    }
  });
}

setDistrictCoverageMap(coverageMap);

setHeatData(newHeatData);
setMarkerData(newMarkerData);
setAffectedSensors(coveringSensors);
setCoveredDistricts(coveredDistrictNames);
setLastSensorMapUpdate(`${formatDateForQuery(sensorPredictionDate)} ${sensorPredictionPeriod} • ${new Date().toLocaleString()}`);
setHasGeneratedIotMap(true);


    } catch (error) {
      setIotMapError(error.message || 'Failed to generate IoT flood map data');
    } finally {
      setIotMapLoading(false);
    }
  }, [authToken, districts]);

  useEffect(() => {
    if (sensorPackages.length > 0 && hasGeneratedIotMap) {
      generateIotFloodMap();
    }
  }, [sensorPackages, hasGeneratedIotMap, generateIotFloodMap]);

  useEffect(() => {
    fetch('/data/sri_lanka_districts.geojson')
      .then(res => res.json())
      .then(data => setDistricts(data))
      .catch(err => console.error('Error loading GeoJSON:', err));
  }, []);


  const styleDistrict = feature => {
  const name = feature.properties.NAME_2 || feature.properties.NAME_1;
  const isCovered = coveredDistricts.includes(name);

  return {
    color: isCovered ? "#f59e0b" : "#555",
    fillColor: isCovered ? "#fbbf24" : "#fff",
    fillOpacity: isCovered ? 0.55 : 0.06,
    weight: isCovered ? 4 : 1,
    dashArray: isCovered ? "6 4" : "2 2"
  };
};

  const onEachDistrict = (feature, layer) => {
  const name =
    feature.properties.NAME_2 ||
    feature.properties.NAME_1;

  const sensors = districtCoverageMap[name] || [];

  layer.bindPopup(`
    <div style="min-width:260px">
      <h3>${name} District</h3>

      ${
        sensors.length > 0
          ? `<span style="color:#16a34a;font-weight:bold">
               Covered by ${sensors.length} Sensor Package(s)
             </span>`
          : `<span style="color:#6b7280">
               No Sensor Coverage
             </span>`
      }

      <hr/>

      ${
        sensors.length > 0
          ? sensors.map(sensor => `
              <div style="margin-bottom:8px">
                <b>${sensor.name}</b><br/>
                Severity: ${sensor.severity}<br/>
                Flood Depth: ${sensor.floodDepth.toFixed(2)} m<br/>
                Confidence: ${Math.round(sensor.confidence * 100)}%
              </div>
            `).join("")
          : ""
      }
    </div>
  `);
};

  const mapShellStyle = {
    display: "flex",
    height: height || (embedded ? "720px" : "100vh"),
    minHeight: embedded ? 560 : undefined,
    background: "linear-gradient(135deg, #061815 0%, #082f49 56%, #07120f 100%)",
    borderRadius: embedded ? 8 : 0,
    overflow: "hidden",
    border: embedded ? "1px solid rgba(125, 211, 252, 0.22)" : "none",
    boxShadow: embedded ? "0 24px 70px rgba(0,0,0,0.28)" : "none"
  };
  const mapSidebarStyle = {
    flex: embedded ? '0 0 320px' : '0 0 340px',
    width: embedded ? 320 : 340,
    minWidth: 300,
    padding: embedded ? 16 : 20,
    boxSizing: 'border-box',
    background: "linear-gradient(180deg, #f8fafc 0%, #eef7fb 100%)",
    color: "#0f172a",
    overflowY: "auto",
    overflowX: 'hidden',
    borderRight: "1px solid rgba(14, 165, 233, 0.22)"
  };
  const mapCardStyle = {
    marginBottom: 16,
    padding: 14,
    background: "rgba(255,255,255,0.94)",
    border: "1px solid #bae6fd",
    borderRadius: 10,
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)"
  };
  const primaryButtonStyle = {
    padding: "10px 14px",
    background: "linear-gradient(135deg, #0284c7, #10b981)",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 800,
    boxShadow: "0 10px 18px rgba(2, 132, 199, 0.22)"
  };

  //styles
  return (
    <div style={mapShellStyle}>
      {/* Sidebar */}
      {!hideSidebar && (
      <div style={mapSidebarStyle}>
        {!embedded && <button 
          onClick={onBack}
          style={{
            padding: "10px 14px",
            marginBottom: "12px",
            background: "linear-gradient(135deg, #0284c7, #10b981)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 800,
            boxShadow: "0 10px 18px rgba(2, 132, 199, 0.22)"
          }}
        >
          ← Back to Dashboard
        </button>}
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: 0, color: "#0284c7", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4 }}>FloodGuard360</p>
          <h2 style={{ color:"#0f172a", margin: "4px 0 4px", fontSize: 22, lineHeight: 1.15 }}>Sri Lanka Flood Risk Map</h2>
          <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>Click districts on map or select below</p>
        </div>

        {/* IoT Sensors Section */}
        <div>
          <div style={mapCardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <h4 style={{ margin: 0, color: "black" }}>IoT Sensors (Active: {sensorPackages.length})</h4>
              <input
                type="checkbox"
                checked={showSensorMarkers}
                onChange={e => setShowSensorMarkers(e.target.checked)}
                title="Toggle sensor markers on map"
              />
            </div>
            <div style={{ fontSize: "12px", maxHeight: "120px", overflowY: "auto", color: "#333" }}>
              {sensorPackages.map(pkg => (
                <div key={pkg.id} style={{ marginBottom: "8px", padding: "8px", background: "#e0f2fe", borderRadius: "8px", border: "1px solid #bae6fd" }}>
                  <strong>{pkg.name}</strong><br/>
                  {pkg.currentReadings?.waterLevel !== undefined && (
                    <span style={{ color: "#0066cc" }}>
                      💧 Water: {pkg.currentReadings.waterLevel.toFixed(2)} {pkg.currentReadings?.unit || 'm'}
                    </span>
                  )}<br/>
                  {pkg.currentReadings?.rainfall !== undefined && (
                    <span style={{ color: "#0066cc" }}>
                      🌧️ Rain: {pkg.currentReadings.rainfall.toFixed(2)} mm
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginBottom: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, color: 'black' }}>Forecast Date</label>
                <input
                  type="date"
                  value={sensorPredictionDate}
                  onChange={e => setSensorPredictionDate(e.target.value)}
                  style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, color: 'black' }}>Time Period</label>
                <select
                  value={sensorPredictionPeriod}
                  onChange={e => setSensorPredictionPeriod(e.target.value)}
                  style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
                >
                  <option value="Any">Any</option>
                  <option value="Morning">Morning</option>
                  <option value="Afternoon">Afternoon</option>
                  <option value="Evening">Evening</option>
                  <option value="Night">Night</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px', alignItems: 'start' }}>
              <button
                type="button"
                onClick={generateIotFloodMap}
                disabled={iotMapLoading || sensorsLoading || sensorPackages.length === 0}
                style={{
                  padding: '10px 14px',
                  width: '100%',
                  background: sensorPackages.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #0284c7, #10b981)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: sensorPackages.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 800,
                  lineHeight: 1.25,
                  minHeight: 44,
                  boxShadow: sensorPackages.length === 0 ? 'none' : '0 10px 18px rgba(2, 132, 199, 0.22)'
                }}
              >
                {iotMapLoading ? 'Generating IoT Zones...' : 'Use IoT Sensor Zones'}
              </button>
              <span style={{ fontSize: '11px', lineHeight: 1.35, color: '#475569' }}>
                {lastSensorMapUpdate ? `Updated: ${lastSensorMapUpdate}` : 'Sensor-driven map not generated'}
              </span>
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#334155' }}>
              <strong>Forecast:</strong> {sensorPredictionDate} • {sensorPredictionPeriod}
            </div>
            {affectedSensors.length > 0 && (
              <div style={{ marginTop: '12px', padding: '10px', background: '#eef6ff', borderRadius: '6px', color: '#1f2937' }}>
                <h5 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Sensors covering marked area</h5>
                <div style={{ marginBottom: '8px', fontSize: '12px', color: '#475569' }}>
                  {coveredDistricts.length > 0 ? (
                    <span>Marked coverage across: <strong>{coveredDistricts.join(', ')}</strong></span>
                  ) : (
                    <span>Marked coverage across detected sensor areas.</span>
                  )}
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  {affectedSensors.map((sensor, index) => (
                    <div key={`${sensor.name}-${index}`} style={{ marginBottom: '10px', padding: '8px', background: '#fff', borderRadius: '6px', border: '1px solid #dbeafe' }}>
                      <div style={{ fontWeight: 600 }}>{sensor.name}</div>
                      <div style={{ fontSize: '12px', color: '#4b5563' }}>
                        {sensor.severity} • Flood depth: {sensor.floodDepth.toFixed(2)} m • Confidence: {Math.round(sensor.confidence * 100)}%
                      </div>
                      <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '4px' }}>
                        Rainfall: {sensor.rainfall ?? 'N/A'} mm • Water level: {sensor.waterLevel ?? 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {iotMapError && (
              <div style={{ marginTop: '8px', color: '#b91c1c', fontSize: '12px' }}>
                {iotMapError}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: "16px", padding: "12px 14px", borderRadius: 10, background: "rgba(14, 165, 233, 0.08)", border: "1px solid #bae6fd" }}>
          <p style={{ color: "#334155", fontSize: "13px", lineHeight: 1.6, margin: 0 }}>
            The map below uses ML-based flood prediction logic. Enter a location and sensor-aware inputs, then click <strong>Run ML Prediction</strong> to update the model output.
          </p>
        </div>

        <div style={{ ...mapCardStyle, border: "1px solid #fecaca" }}>
          <h3 style={{ margin: "0 0 8px", color: "#991b1b" }}>Live Sensor Flood Zones</h3>
          <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#666" }}>
            Minor and major flood detections from sensor packages (refreshes every 5s)
          </p>
          {sensorAlertsLoading && (
            <p style={{ fontSize: "12px", color: "#666" }}>Loading sensor alerts…</p>
          )}
          {sensorAlertsError && (
            <p style={{ fontSize: "12px", color: "#b91c1c" }}>{sensorAlertsError}</p>
          )}
          {!sensorAlertsLoading && !sensorAlertsError && sensorFloodAlerts.length === 0 && (
            <p style={{ fontSize: "12px", color: "#666" }}>No minor or major flood detections right now.</p>
          )}
          {sensorFloodAlerts.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", maxHeight: "160px", overflowY: "auto" }}>
              {sensorFloodAlerts.map(({ package: pkg, risk }) => (
                <li
                  key={pkg.id}
                  style={{
                    marginBottom: "8px",
                    padding: "8px",
                    borderRadius: "6px",
                    background: risk.level === "Major flood" || risk.level === "High Risk" ? "#fef2f2" : "#fff7ed",
                    border: "1px solid #fecaca",
                    fontSize: "12px",
                    color: "#111"
                  }}
                >
                  <b>{risk.level}</b> — {pkg.name}
                  <br />
                  {formatCoordinates(pkg.location.latitude, pkg.location.longitude)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ ...mapCardStyle, fontSize: "13px" }}>
          <h4 style={{color:"#0f172a", marginTop: 0}}>Risk Markers & Heatmap Legend</h4>
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
          <div style={{ marginBottom: "10px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "12px", background: "#0066cc", borderRadius: "50%", marginRight: "10px", border: "2px solid #003366" }}></span>
            <b style={{color:"black"}}>BLUE DOTS</b> - IoT Sensors (Real-time data)
          </div>
          <div style={{ marginBottom: "10px" }}>
            <span style={{ display: "inline-block", width: "14px", height: "14px", background: "rgba(239, 68, 68, 0.35)", borderRadius: "50%", marginRight: "10px", border: "2px solid #b91c1c" }}></span>
            <b style={{color:"black"}}>RED CIRCLES</b> - Sensor flood zone (1.5 km radius)
          </div>
          <p style={{ fontSize: "11px", color: "#666", marginTop: "8px" }}>
            Click on any colored dot to see detailed information
          </p>
        </div>

        <div style={{ ...mapCardStyle, border: '1px solid #cbd5e1' }}>
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
          </div>

          <label style={{ display: 'block', marginTop: 10, marginBottom: 6, color: 'black' }}>Humidity (%)</label>
          <input
            type="number"
            value={mlHumidity}
            onChange={e => setMlHumidity(parseFloat(e.target.value))}
            style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
          />

          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: 'black' }}>Forecast Date</label>
              <input
                type="date"
                value={mlPredictionDate}
                onChange={e => setMlPredictionDate(e.target.value)}
                style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: 'black' }}>Time Period</label>
              <select
                value={mlPredictionPeriod}
                onChange={e => setMlPredictionPeriod(e.target.value)}
                style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
              >
                <option value="Any">Any</option>
                <option value="Morning">Morning</option>
                <option value="Afternoon">Afternoon</option>
                <option value="Evening">Evening</option>
                <option value="Night">Night</option>
              </select>
            </div>
          </div>

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
                <div><strong>Forecast Date:</strong> {mlPredictionDate}</div>
                <div><strong>Period:</strong> {mlPredictionPeriod}</div>

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
                  <strong>Water Level (backend):</strong> {mlPredictionResult.waterLevel ?? 'N/A'}
                </div>

                {mlPredictionResult.usedSensorData && (
                  <div style={{ marginTop: 8, padding: 8, background: '#d4edda', borderRadius: '4px', color: '#155724' }}>
                    <strong>✓ Using real sensor data:</strong> {mlPredictionResult.nearestSensorName}
                  </div>
                )}

                <div>
                  <strong>Saved:</strong> {new Date().toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
      )}

      {/* Map */}
      {districts ? (

<div style={{ position: 'relative', flex: 1, minWidth: 0, padding: embedded ? 12 : 14 }}>
<div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: 10, border: '1px solid rgba(125, 211, 252, 0.28)', boxShadow: '0 24px 70px rgba(0,0,0,0.28)' }}>
<MapContainer
  center={mlPredictionResult ? [mlLatitude, mlLongitude] : [7.8731, 80.7718]}
  zoom={mlPredictionResult ? 11 : 7.5}
  zoomControl={false}
  style={{ width: '100%', height: '100%' }}
>
  <TileLayer
    url={mlPredictionResult ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
    attribution={mlPredictionResult ? '&copy; OpenStreetMap &copy; CARTO' : '&copy; OpenStreetMap contributors'}
  />

  <GeoJSON
    data={districts}
    style={styleDistrict}
    onEachFeature={onEachDistrict}
  />
  <HeatmapLayer heatData={heatData} />
  <RiskMarkers markerData={markerData} />
  <CoverageSensorMarkers sensors={affectedSensors} />
  {showSensorMarkers && <SensorMarkers sensorPackages={sensorPackages} />}
  {mlPredictionResult && <MapPresentationControls showSensorMarkers={showSensorMarkers} onToggleSensors={() => setShowSensorMarkers(value => !value)} />}
  <SensorFloodAlertCircles alerts={sensorFloodAlerts} />

</MapContainer>
</div>
</div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#082f49', color: '#e0f2fe' }}>
          <p>Loading map...</p>
        </div>
      )}
    </div>
  );
}
