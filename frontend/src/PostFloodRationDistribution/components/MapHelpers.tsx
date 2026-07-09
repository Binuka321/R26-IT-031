import { useEffect } from "react";
import L from "leaflet";
import { Fragment } from "react";
import { Circle, Marker, Popup, useMap } from "react-leaflet";

export type LiveRoadIncident = {
  latitude: number;
  longitude: number;
  radius_km?: number;
  condition_type?: string;
  road_name?: string;
  status?: string;
  passability?: string;
  report_number?: string;
  updated_at?: string;
};

export function getIncidentTone(incident: LiveRoadIncident) {
  if (incident.passability === "unpassable") return "#dc2626";
  if (["landslide", "collapse", "road_breakage"].includes(String(incident.condition_type))) {
    return "#f97316";
  }
  return "#eab308";
}

export function liveRoadIncidentIcon(incident: LiveRoadIncident) {
  const color = getIncidentTone(incident);
  return L.divIcon({
    className: "live-road-incident-marker",
    html: `<div style="width:24px;height:24px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 8px 18px rgba(15,23,42,.25);display:flex;align-items:center;justify-content:center;color:white;font-size:15px;font-family:'Material Icons'">report_problem</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export function operationalEmojiIcon({
  emoji,
  label,
  color = "#0f172a",
  size = 36,
}: {
  emoji: string;
  label?: string;
  color?: string;
  size?: number;
}) {
  const labelHtml = label
    ? `<span style="position:absolute;left:50%;top:${size - 2}px;transform:translateX(-50%);white-space:nowrap;border-radius:9999px;background:white;padding:2px 6px;font-size:10px;font-weight:800;color:${color};box-shadow:0 6px 16px rgba(15,23,42,.18);">${label}</span>`
    : "";

  return L.divIcon({
    className: "operational-emoji-marker",
    html: `<div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;border-radius:9999px;background:white;border:3px solid ${color};box-shadow:0 10px 22px rgba(15,23,42,.24);font-size:${Math.round(size * 0.56)}px;line-height:1;">${emoji}${labelHtml}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function LiveRoadIncidentLayer({
  incidents,
  maxItems = 250,
}: {
  incidents: LiveRoadIncident[];
  maxItems?: number;
}) {
  return (
    <>
      {incidents.slice(0, maxItems).map((incident, index) => {
        if (!Number.isFinite(incident.latitude) || !Number.isFinite(incident.longitude)) return null;
        const color = getIncidentTone(incident);
        const radius = Math.max(250, Number(incident.radius_km || 0.6) * 1000);

        return (
          <Fragment key={`${incident.report_number || "rda"}-${index}`}>
            <Circle
              center={[incident.latitude, incident.longitude]}
              radius={radius}
              pathOptions={{
                color,
                weight: 1,
                opacity: 0.7,
                fillColor: color,
                fillOpacity: 0.12,
              }}
            />
            <Marker
              position={[incident.latitude, incident.longitude]}
              icon={liveRoadIncidentIcon(incident)}
              zIndexOffset={3000}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-bold">{incident.road_name || "RDA road incident"}</p>
                  <p>Type: {incident.condition_type || "road incident"}</p>
                  <p>Status: {incident.status || "active"}</p>
                  <p>Passability: {incident.passability || "limited"}</p>
                  {incident.updated_at && <p>Updated: {new Date(incident.updated_at).toLocaleString()}</p>}
                </div>
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </>
  );
}

export function FitMapToPoints({
  points,
  padding = [28, 28],
}: {
  points: [number, number][];
  padding?: [number, number];
}) {
  const map = useMap();

  useEffect(() => {
    const validPoints = points.filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (!validPoints.length) return;
    const timer = setTimeout(() => {
      if (validPoints.length === 1) {
        map.setView(validPoints[0], Math.max(map.getZoom(), 12));
      } else {
        map.fitBounds(L.latLngBounds(validPoints), { padding });
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [map, padding, points]);

  return null;
}

export function MapAutoResizer({ deps = [] }: { deps?: unknown[] }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const invalidate = () => {
      window.requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    };
    const observer = new ResizeObserver(invalidate);
    observer.observe(container);
    const timers = [80, 250, 700].map((delay) => window.setTimeout(invalidate, delay));

    return () => {
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [map, ...deps]);

  return null;
}
