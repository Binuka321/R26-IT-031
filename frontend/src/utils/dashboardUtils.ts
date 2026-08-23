// Utility Functions for Dashboard

import { WATER_LEVEL_THRESHOLDS, ALERT_PRIORITY_LEVELS } from './constants';

export interface SensorData {
  id: string;
  name: string;
  location: {
    name: string;
    latitude: number;
    longitude: number;
    river?: string;
  };
  currentReadings?: {
    waterLevel?: number;
    rainfall?: number;
    flowRate?: number;
    unit?: string;
  };
  waterLevelSettings?: {
    alertLevel: number;
    minorFloodLevel: number;
    majorFloodLevel: number;
  };
  status: string;
  lastUpdate: string;
  sensors?: {
    ultrasonic: number;
    rain: number;
    flow: number;
    turbidity: number;
  };
}

/**
 * Determine water level status based on sensor readings
 */
export const getWaterLevelStatus = (sensor: SensorData): string => {
  const waterLevel = sensor.currentReadings?.waterLevel;
  const settings = sensor.waterLevelSettings;

  if (!waterLevel || !settings) return 'normal';

  if (waterLevel >= settings.majorFloodLevel) return 'critical';
  if (waterLevel >= settings.minorFloodLevel) return 'warning';
  if (waterLevel >= settings.alertLevel) return 'alert';

  return 'normal';
};

/**
 * Get color scheme for status
 */
export const getStatusColor = (
  status: string
): {
  bg: string;
  border: string;
  text: string;
} => {
  const colorMap: Record<string, any> = {
    critical: {
      bg: 'from-red-900/20 to-red-800/10',
      border: 'border-red-500/50',
      text: 'text-red-300',
    },
    warning: {
      bg: 'from-amber-900/20 to-amber-800/10',
      border: 'border-amber-500/50',
      text: 'text-amber-300',
    },
    alert: {
      bg: 'from-orange-900/20 to-orange-800/10',
      border: 'border-orange-500/50',
      text: 'text-orange-300',
    },
    normal: {
      bg: 'from-green-900/20 to-green-800/10',
      border: 'border-green-500/50',
      text: 'text-green-300',
    },
  };

  return colorMap[status] || colorMap.normal;
};

/**
 * Calculate overall system status based on sensor data
 */
export const calculateSystemStatus = (sensors: SensorData[]): 'active' | 'warning' | 'critical' => {
  if (!sensors || sensors.length === 0) return 'active';

  const criticalCount = sensors.filter(
    (s) => getWaterLevelStatus(s) === 'critical'
  ).length;
  const warningCount = sensors.filter(
    (s) => ['warning', 'alert'].includes(getWaterLevelStatus(s))
  ).length;

  if (criticalCount > 0) return 'critical';
  if (warningCount > 0) return 'warning';

  return 'active';
};

/**
 * Format timestamp for display
 */
export const formatTime = (timestamp: string | Date): string => {
  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return 'N/A';
  }
};

/**
 * Format date for API queries
 */
export const formatDateForQuery = (value: string): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

/**
 * Calculate distance between two coordinates (in km)
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Get nearby sensors for a given location
 */
export const getNearBySensors = (
  sensors: SensorData[],
  latitude: number,
  longitude: number,
  radiusKm: number = 50
): SensorData[] => {
  return sensors.filter((sensor) => {
    const distance = calculateDistance(
      latitude,
      longitude,
      sensor.location.latitude,
      sensor.location.longitude
    );
    return distance <= radiusKm;
  });
};

/**
 * Calculate average water level across all sensors
 */
export const calculateAverageWaterLevel = (sensors: SensorData[]): number => {
  if (!sensors || sensors.length === 0) return 0;
  const sum = sensors.reduce((acc, s) => acc + (s.currentReadings?.waterLevel || 0), 0);
  return sum / sensors.length;
};

/**
 * Calculate average rainfall across all sensors
 */
export const calculateAverageRainfall = (sensors: SensorData[]): number => {
  if (!sensors || sensors.length === 0) return 0;
  const sum = sensors.reduce((acc, s) => acc + (s.currentReadings?.rainfall || 0), 0);
  return sum / sensors.length;
};

/**
 * Generate alert from prediction result
 */
export const generatePredictionAlert = (result: any): { title: string; detail: string; tone: 'success' | 'warning' | 'danger' } => {
  const label = result.prediction_label?.toLowerCase() || '';
  const confidence = ((result.confidence || 0) * 100).toFixed(1);

  let tone: 'success' | 'warning' | 'danger' = 'success';
  if (label.includes('high')) tone = 'danger';
  else if (label.includes('moderate')) tone = 'warning';

  return {
    title: 'ML Prediction Updated',
    detail: `Risk Level: ${result.prediction_label || 'Unknown'} (${confidence}% confidence)`,
    tone,
  };
};

/**
 * Sort alerts by priority
 */
export const sortAlertsByPriority = (
  alerts: Array<{ title: string; detail: string; tone: 'success' | 'warning' | 'danger' | 'info' }>
) => {
  const priorityMap: Record<string, number> = {
    danger: ALERT_PRIORITY_LEVELS.CRITICAL,
    warning: ALERT_PRIORITY_LEVELS.HIGH,
    info: ALERT_PRIORITY_LEVELS.MEDIUM,
    success: ALERT_PRIORITY_LEVELS.LOW,
  };

  return [...alerts].sort(
    (a, b) => (priorityMap[a.tone] || 5) - (priorityMap[b.tone] || 5)
  );
};
