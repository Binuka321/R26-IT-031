import React from "react";

export function getGoogleMapsPinUrl(latitude: number, longitude: number) {
  const lat = Number(latitude).toFixed(6);
  const lng = Number(longitude).toFixed(6);
  return `https://www.google.com/maps?q=${lat},${lng}&ll=${lat},${lng}&z=18`;
}

export function getGoogleMapsDirectionsUrl(latitude: number, longitude: number) {
  const lat = Number(latitude).toFixed(6);
  const lng = Number(longitude).toFixed(6);
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function getGoogleMapsRouteUrl(points: [number, number][]) {
  const validPoints = points
    .map(([latitude, longitude]) => [Number(latitude), Number(longitude)] as [number, number])
    .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude));

  if (validPoints.length < 2) {
    return validPoints[0] ? getGoogleMapsPinUrl(validPoints[0][0], validPoints[0][1]) : "#";
  }

  const [originLat, originLng] = validPoints[0];
  const [destinationLat, destinationLng] = validPoints[validPoints.length - 1];
  const waypointPoints = validPoints.slice(1, -1).slice(0, 8);
  const params = new URLSearchParams({
    api: "1",
    origin: `${originLat.toFixed(6)},${originLng.toFixed(6)}`,
    destination: `${destinationLat.toFixed(6)},${destinationLng.toFixed(6)}`,
    travelmode: "driving",
  });

  if (waypointPoints.length) {
    params.set(
      "waypoints",
      waypointPoints.map(([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`).join("|"),
    );
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

type GoogleMapActionsProps = {
  latitude: number;
  longitude: number;
  className?: string;
  compact?: boolean;
  directions?: boolean;
};

export function GoogleMapActions({
  latitude,
  longitude,
  className = "",
  compact = false,
  directions = true,
}: GoogleMapActionsProps) {
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return null;

  const buttonClass =
    "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition-colors";
  const iconClass = compact ? "material-icons text-xs" : "material-icons text-sm";

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <a
        href={getGoogleMapsPinUrl(latitude, longitude)}
        target="_blank"
        rel="noreferrer"
        className={`${buttonClass} bg-blue-50 text-blue-700 hover:bg-blue-100`}
      >
        <span className={iconClass}>map</span>
        Exact Pin
      </a>
      {directions && (
        <a
          href={getGoogleMapsDirectionsUrl(latitude, longitude)}
          target="_blank"
          rel="noreferrer"
          className={`${buttonClass} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
        >
          <span className={iconClass}>directions</span>
          Directions
        </a>
      )}
    </span>
  );
}
