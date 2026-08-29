// Dashboard Constants and Configuration

export const SYSTEM_STATUS = {
  ACTIVE: 'active' as const,
  WARNING: 'warning' as const,
  CRITICAL: 'critical' as const,
};

export const ALERT_TONES = {
  SUCCESS: 'success' as const,
  WARNING: 'warning' as const,
  DANGER: 'danger' as const,
  INFO: 'info' as const,
};

export const WATER_LEVEL_THRESHOLDS = {
  CRITICAL: 3.5,
  MAJOR_FLOOD: 2.5,
  MINOR_FLOOD: 1.5,
  ALERT: 1.0,
  NORMAL: 0.5,
};

export const MAP_MODES = {
  HEATMAP: 'heatmap' as const,
  SENSORS: 'sensors' as const,
  PREDICTIONS: 'predictions' as const,
};

export const PREDICTION_PERIODS = [
  'Any',
  'Morning',
  'Afternoon',
  'Evening',
  'Night',
];

export const ALERT_PRIORITY_LEVELS = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
  INFO: 5,
};

export const ANIMATION_DURATION = {
  FAST: 0.2,
  NORMAL: 0.3,
  SLOW: 0.5,
  VERY_SLOW: 0.8,
};

export const COLOR_SCHEME = {
  success: {
    bg: 'from-green-900/20 to-green-800/10',
    border: 'border-green-500/50',
    text: 'text-green-300',
    icon: 'text-green-400',
  },
  warning: {
    bg: 'from-amber-900/20 to-amber-800/10',
    border: 'border-amber-500/50',
    text: 'text-amber-300',
    icon: 'text-amber-400',
  },
  danger: {
    bg: 'from-red-900/20 to-red-800/10',
    border: 'border-red-500/50',
    text: 'text-red-300',
    icon: 'text-red-400',
  },
  info: {
    bg: 'from-cyan-900/20 to-cyan-800/10',
    border: 'border-cyan-500/50',
    text: 'text-cyan-300',
    icon: 'text-cyan-400',
  },
};

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3002/api';
const ML_API_BASE = import.meta.env.VITE_ML_API_URL || 'http://localhost:5000/api';

export const API_ENDPOINTS = {
  SENSOR_PACKAGES: `${API_BASE}/sensor-packages`,
  PREDICTIONS: `${API_BASE}/prediction/sensor-predictions`,
  ML_PREDICTION: `${ML_API_BASE}/ml/prediction/predict`,
};

export const REFRESH_INTERVALS = {
  SENSORS: 30000, // 30 seconds
  PREDICTIONS: 60000, // 1 minute
  ALERTS: 15000, // 15 seconds
};
