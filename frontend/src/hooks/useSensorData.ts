import { useState, useEffect, useCallback } from 'react';
import { SensorData } from '../utils/dashboardUtils';

interface UseSensorDataReturn {
  sensors: SensorData[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Custom hook for managing sensor data
 * Handles fetching, caching, and auto-refresh of sensor packages
 */
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3002/api';

export const useSensorData = (authToken: string, autoRefreshInterval: number = 30000): UseSensorDataReturn => {
  const [sensors, setSensors] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSensors = useCallback(async () => {
    if (!authToken) {
      setError('Authentication token is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/sensor-packages`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch sensor packages`);
      }

      const data = await response.json();
      setSensors(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch sensor packages';
      setError(message);
      console.error('Sensor fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  // Auto-refresh setup
  useEffect(() => {
    fetchSensors();

    const interval = setInterval(fetchSensors, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [fetchSensors, autoRefreshInterval]);

  return {
    sensors,
    loading,
    error,
    refresh: fetchSensors,
  };
};

export default useSensorData;
