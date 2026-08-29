import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Droplets, Wind, AlertTriangle } from 'lucide-react';

interface SensorData {
  id: string;
  name: string;
  location: {
    name: string;
    latitude: number;
    longitude: number;
    river?: string;
  };
  currentReadings: {
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

interface SensorPanelProps {
  authToken: string;
  sensorPackages?: SensorData[];
  loading?: boolean;
  onSensorClick?: (sensor: SensorData) => void;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3002/api';

export const SensorPanel: React.FC<SensorPanelProps> = ({
  authToken,
  sensorPackages = [],
  loading = false,
  onSensorClick,
}) => {
  const [sensors, setSensors] = useState<SensorData[]>(sensorPackages);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (sensorPackages.length > 0) {
      setSensors(sensorPackages);
    }
  }, [sensorPackages]);

  const handleRefresh = async () => {
    if (!authToken) return;
    setRefreshing(true);
    try {
      const response = await fetch(`${API_BASE}/sensor-packages`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSensors(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch sensor packages:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getWaterLevelStatus = (sensor: SensorData) => {
    const waterLevel = sensor.currentReadings?.waterLevel;
    const settings = sensor.waterLevelSettings;

    if (!waterLevel || !settings) return 'info';
    if (waterLevel >= settings.majorFloodLevel) return 'critical';
    if (waterLevel >= settings.minorFloodLevel) return 'warning';
    if (waterLevel >= settings.alertLevel) return 'alert';
    return 'normal';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'from-red-900/20 to-red-800/10 border-red-500/50';
      case 'warning':
        return 'from-amber-900/20 to-amber-800/10 border-amber-500/50';
      case 'alert':
        return 'from-orange-900/20 to-orange-800/10 border-orange-500/50';
      default:
        return 'from-green-900/20 to-green-800/10 border-green-500/50';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">IoT Sensor Network</h3>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="px-3 py-1 bg-cyan-600/20 border border-cyan-500/50 rounded text-sm text-cyan-300 hover:bg-cyan-600/30 disabled:opacity-50"
        >
          {refreshing ? 'Updating...' : 'Refresh'}
        </motion.button>
      </div>

      <div className="grid gap-3 max-h-96 overflow-y-auto pr-2">
        {loading || refreshing ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-400">Loading sensors...</div>
          </div>
        ) : sensors.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-400">No sensor packages detected</div>
          </div>
        ) : (
          sensors.map((sensor, idx) => {
            const status = getWaterLevelStatus(sensor);
            const waterLevel = sensor.currentReadings?.waterLevel;
            const rainfall = sensor.currentReadings?.rainfall;
            const flowRate = sensor.currentReadings?.flowRate;

            return (
              <motion.div
                key={sensor.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => onSensorClick?.(sensor)}
                className={`bg-gradient-to-br ${getStatusColor(status)} border rounded-lg p-3 cursor-pointer hover:shadow-lg transition-all`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-white text-sm">{sensor.name}</p>
                    <p className="text-xs text-gray-400">
                      {sensor.location.name} {sensor.location.river ? `• ${sensor.location.river}` : ''}
                    </p>
                  </div>
                  {status === 'critical' && <AlertTriangle className="text-red-400" size={16} />}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  {waterLevel !== undefined && (
                    <div className="flex items-center gap-1">
                      <Droplets size={14} className="text-blue-400" />
                      <div>
                        <p className="text-gray-500">Water</p>
                        <p className="text-white font-semibold">
                          {waterLevel.toFixed(2)} {sensor.currentReadings?.unit || 'm'}
                        </p>
                      </div>
                    </div>
                  )}
                  {rainfall !== undefined && (
                    <div className="flex items-center gap-1">
                      <Wind size={14} className="text-cyan-400" />
                      <div>
                        <p className="text-gray-500">Rain</p>
                        <p className="text-white font-semibold">{rainfall.toFixed(1)} mm</p>
                      </div>
                    </div>
                  )}
                  {flowRate !== undefined && (
                    <div className="flex items-center gap-1">
                      <Wind size={14} className="text-purple-400" />
                      <div>
                        <p className="text-gray-500">Flow</p>
                        <p className="text-white font-semibold">{flowRate.toFixed(1)} L/s</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
                  <span>
                    {sensor.sensors?.ultrasonic || 0} Ultrasonic • {sensor.sensors?.rain || 0} Rain
                  </span>
                  <span>{new Date(sensor.lastUpdate).toLocaleTimeString()}</span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SensorPanel;
