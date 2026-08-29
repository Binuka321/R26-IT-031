export interface BlockageReading {
  id: string;
  packageId: string;
  timestamp: string;
  sensor1Distance?: number;
  sensor2Distance?: number;
  sensor3Distance?: number;
  sensor1WaterLevel?: number;
  sensor2WaterLevel?: number;
  sensor3WaterLevel?: number;
  difference12?: number;
  difference23?: number;
  blockageDetected: boolean;
  blockageLocation: string;
  unit: string;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3002/api';

function throwApiError(res: Response, data: Record<string, unknown>, fallback: string): never {
  const message = typeof data.message === 'string' ? data.message : res.statusText || fallback;
  throw new Error(message);
}

export function mapBlockageReading(raw: Record<string, unknown>): BlockageReading {
  return {
    id: String(raw.id),
    packageId: String(raw.packageId),
    timestamp: new Date(raw.timestamp as string | number | Date).toISOString(),
    sensor1Distance: raw.sensor1Distance === undefined ? undefined : Number(raw.sensor1Distance),
    sensor2Distance: raw.sensor2Distance === undefined ? undefined : Number(raw.sensor2Distance),
    sensor3Distance: raw.sensor3Distance === undefined ? undefined : Number(raw.sensor3Distance),
    sensor1WaterLevel: raw.sensor1WaterLevel === undefined ? undefined : Number(raw.sensor1WaterLevel),
    sensor2WaterLevel: raw.sensor2WaterLevel === undefined ? undefined : Number(raw.sensor2WaterLevel),
    sensor3WaterLevel: raw.sensor3WaterLevel === undefined ? undefined : Number(raw.sensor3WaterLevel),
    difference12: raw.difference12 === undefined ? undefined : Number(raw.difference12),
    difference23: raw.difference23 === undefined ? undefined : Number(raw.difference23),
    blockageDetected: Boolean(raw.blockageDetected),
    blockageLocation: String(raw.blockageLocation ?? 'NONE'),
    unit: String(raw.unit ?? 'm')
  };
}

export async function fetchLatestBlockageReading(
  token: string,
  packageId: string
): Promise<BlockageReading | null> {
  const q = new URLSearchParams({ packageId, limit: '1' });
  const res = await fetch(`${API_BASE}/blockage-readings?${q.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throwApiError(res, data as Record<string, unknown>, 'Failed to load blockage readings');
  }
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return null;
  return mapBlockageReading(rows[0] as Record<string, unknown>);
}
