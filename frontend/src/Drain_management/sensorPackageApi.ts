import type { SensorPackage, SensorReading } from './types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` } as const;
}

function jsonAuth(token: string) {
  return { ...bearer(token), 'Content-Type': 'application/json' } as const;
}

export type CreateSensorPackageInput = Omit<
  SensorPackage,
  'id' | 'status' | 'lastUpdate' | 'currentReadings'
>;

export function mapApiPackage(raw: Record<string, unknown>): SensorPackage {
  const lu = raw.lastUpdate;
  const lastUpdate =
    lu instanceof Date ? lu : new Date(typeof lu === 'string' || typeof lu === 'number' ? lu : Date.now());

  const cr = raw.currentReadings;
  const readings =
    cr && typeof cr === 'object' && !Array.isArray(cr)
      ? (cr as SensorPackage['currentReadings'])
      : {};

  const rawWl = raw.waterLevelSettings;
  let waterLevelSettings: SensorPackage['waterLevelSettings'] | undefined;
  if (rawWl && typeof rawWl === 'object' && !Array.isArray(rawWl)) {
    const w = rawWl as Record<string, unknown>;
    const unit = w.unit === 'ft' || w.unit === 'm' ? w.unit : null;
    const alertLevel = typeof w.alertLevel === 'number' ? w.alertLevel : Number(w.alertLevel);
    const minorFloodLevel = typeof w.minorFloodLevel === 'number' ? w.minorFloodLevel : Number(w.minorFloodLevel);
    const majorFloodLevel = typeof w.majorFloodLevel === 'number' ? w.majorFloodLevel : Number(w.majorFloodLevel);
    if (
      unit &&
      !Number.isNaN(alertLevel) &&
      !Number.isNaN(minorFloodLevel) &&
      !Number.isNaN(majorFloodLevel)
    ) {
      waterLevelSettings = { unit, alertLevel, minorFloodLevel, majorFloodLevel };
    }
  }

  const ingestEnabled = typeof raw.ingestEnabled === 'boolean' ? raw.ingestEnabled : undefined;

  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    location: raw.location as SensorPackage['location'],
    sensors: raw.sensors as SensorPackage['sensors'],
    boards: raw.boards as SensorPackage['boards'],
    ...(ingestEnabled !== undefined ? { ingestEnabled } : {}),
    ...(waterLevelSettings ? { waterLevelSettings } : {}),
    status: (raw.status as SensorPackage['status']) || 'active',
    lastUpdate,
    currentReadings: readings
  };
}

export async function fetchSensorPackages(token: string): Promise<SensorPackage[]> {
  const res = await fetch(`${API_BASE}/sensor-packages`, {
    headers: bearer(token)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : res.statusText || 'Failed to load packages');
  }
  return (Array.isArray(data) ? data : []).map((row) => mapApiPackage(row as Record<string, unknown>));
}

export async function createSensorPackage(token: string, body: CreateSensorPackageInput): Promise<SensorPackage> {
  const res = await fetch(`${API_BASE}/sensor-packages`, {
    method: 'POST',
    headers: jsonAuth(token),
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : res.statusText || 'Failed to create package');
  }
  return mapApiPackage(data as Record<string, unknown>);
}

export async function updateSensorPackage(
  token: string,
  id: string,
  body: CreateSensorPackageInput
): Promise<SensorPackage> {
  const res = await fetch(`${API_BASE}/sensor-packages/${id}`, {
    method: 'PUT',
    headers: jsonAuth(token),
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : res.statusText || 'Failed to update package');
  }
  return mapApiPackage(data as Record<string, unknown>);
}

export async function deleteSensorPackage(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/sensor-packages/${id}`, {
    method: 'DELETE',
    headers: bearer(token)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : res.statusText || 'Failed to delete package');
  }
}

export async function setPackageIngestEnabled(
  token: string,
  id: string,
  ingestEnabled: boolean
): Promise<SensorPackage> {
  const res = await fetch(`${API_BASE}/sensor-packages/${id}/ingest`, {
    method: 'PATCH',
    headers: jsonAuth(token),
    body: JSON.stringify({ ingestEnabled })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : res.statusText || 'Failed to toggle data collection');
  }
  return mapApiPackage(data as Record<string, unknown>);
}

function mapApiReading(raw: Record<string, unknown>): SensorReading {
  return {
    id: String(raw.id),
    packageId: String(raw.packageId),
    timestamp: new Date(raw.timestamp as string | number | Date).toISOString(),
    waterLevel: raw.waterLevel === undefined ? undefined : Number(raw.waterLevel),
    unit: raw.unit === 'ft' ? 'ft' : 'm',
    flowRate: raw.flowRate === undefined ? undefined : Number(raw.flowRate),
    rainfall: raw.rainfall === undefined ? undefined : Number(raw.rainfall),
    turbidity: raw.turbidity === undefined ? undefined : Number(raw.turbidity)
  };
}

export async function fetchSensorReadings(
  token: string,
  packageId: string,
  limit = 200
): Promise<SensorReading[]> {
  const q = new URLSearchParams({ packageId, limit: String(limit) });
  const res = await fetch(`${API_BASE}/sensor-readings?${q.toString()}`, {
    headers: bearer(token)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : res.statusText || 'Failed to load readings');
  }
  return (Array.isArray(data) ? data : []).map((row) => mapApiReading(row as Record<string, unknown>));
}

