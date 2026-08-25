const RDA_INCIDENTS_URL =
  process.env.RDA_ROAD_INCIDENTS_URL || "https://road-lk.org/api/v1/map/incidents";
const RDA_LAST_UPDATED_URL =
  process.env.RDA_ROAD_LAST_UPDATED_URL || "https://road-lk.org/api/v1/map/last-updated";

const ACTIVE_RDA_STATUSES = new Set(["pending", "verified", "in_progress"]);
const CLOSED_PASSABILITY_LEVELS = new Set(["unpassable"]);

function isFiniteCoordinate(latitude, longitude) {
  return Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
}

function buildBounds(start, end, paddingDegrees = 0.35) {
  return {
    minLat: Math.min(Number(start.latitude), Number(end.latitude)) - paddingDegrees,
    maxLat: Math.max(Number(start.latitude), Number(end.latitude)) + paddingDegrees,
    minLng: Math.min(Number(start.longitude), Number(end.longitude)) - paddingDegrees,
    maxLng: Math.max(Number(start.longitude), Number(end.longitude)) + paddingDegrees,
  };
}

function buildSriLankaBounds() {
  return {
    minLat: 5.5,
    maxLat: 10.1,
    minLng: 79.0,
    maxLng: 82.2,
  };
}

function isWithinBounds(item, bounds) {
  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);
  return (
    latitude >= bounds.minLat &&
    latitude <= bounds.maxLat &&
    longitude >= bounds.minLng &&
    longitude <= bounds.maxLng
  );
}

function radiusFromIncident(incident) {
  const blockedDistanceKm = Number(incident.blockedDistanceMeters || 0) / 1000;
  const severityRadius =
    CLOSED_PASSABILITY_LEVELS.has(String(incident.passabilityLevel || "").toLowerCase())
      ? 1.5
      : Number(incident.severity || 0) >= 2
        ? 1
        : 0.6;

  return Math.max(severityRadius, Math.min(2, blockedDistanceKm || 0));
}

function mapIncidentToBlockedRoad(incident) {
  return {
    latitude: Number(incident.latitude),
    longitude: Number(incident.longitude),
    radius_km: radiusFromIncident(incident),
    source: "RDA Road Network Status",
    condition_type: incident.damageType || "road_incident",
    road_name: incident.roadLocation || incident.locationName || "Unknown road",
    status: incident.status,
    passability: incident.passabilityLevel,
    report_number: incident.reportNumber,
    updated_at: incident.updatedAt,
  };
}

async function fetchRdaRoadIncidentPayload() {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.RDA_ROAD_CONDITION_TIMEOUT_MS || 6000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const [incidentsResponse, lastUpdatedResponse] = await Promise.all([
      fetch(RDA_INCIDENTS_URL, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "FloodManagerResearch/1.0",
        },
      }),
      fetch(RDA_LAST_UPDATED_URL, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "FloodManagerResearch/1.0",
        },
      }).catch(() => null),
    ]);

    if (!incidentsResponse.ok) {
      throw new Error(`RDA incidents request failed with ${incidentsResponse.status}`);
    }

    const incidentsPayload = await incidentsResponse.json();
    const lastUpdatedPayload = lastUpdatedResponse?.ok
      ? await lastUpdatedResponse.json().catch(() => null)
      : null;

    const incidents = Array.isArray(incidentsPayload)
      ? incidentsPayload
      : Array.isArray(incidentsPayload?.value)
        ? incidentsPayload.value
        : [];

    return {
      incidents,
      last_updated: lastUpdatedPayload?.lastUpdated || null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchRdaRoadConditionsForBounds(bounds = buildSriLankaBounds()) {
  if (process.env.ENABLE_RDA_ROAD_CONDITIONS === "false") {
    return {
      enabled: false,
      source: "RDA Road Network Status",
      count: 0,
      last_updated: null,
      blocked_roads: [],
      warning: "RDA road condition integration is disabled",
    };
  }

  try {
    const { incidents, last_updated } = await fetchRdaRoadIncidentPayload();
    const blockedRoads = incidents
      .filter((incident) => {
        const status = String(incident.status || "").toLowerCase();
        return (
          ACTIVE_RDA_STATUSES.has(status) &&
          isFiniteCoordinate(incident.latitude, incident.longitude) &&
          isWithinBounds(incident, bounds)
        );
      })
      .map(mapIncidentToBlockedRoad);

    return {
      enabled: true,
      source: "RDA Road Network Status",
      count: blockedRoads.length,
      last_updated,
      blocked_roads: blockedRoads,
      bounds,
    };
  } catch (error) {
    return {
      enabled: true,
      source: "RDA Road Network Status",
      count: 0,
      last_updated: null,
      blocked_roads: [],
      warning: `RDA road condition data unavailable: ${error.message}`,
    };
  }
}

export async function fetchRdaRoadConditions(start, end, options = {}) {
  const bounds = buildBounds(start, end, Number(options.paddingDegrees || 0.35));
  return fetchRdaRoadConditionsForBounds(bounds);
}
