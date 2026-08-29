import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Cloud,
  Droplets,
  TrendingUp,
  Radio,
  Gauge,
  Home,
} from 'lucide-react';
import OperationsHeader from '../components/dashboard/OperationsHeader';
import SensorPanel from '../components/dashboard/SensorPanel';
import PredictionPanel from '../components/dashboard/PredictionPanel';
import { MetricCard } from '../components/dashboard/MetricCard';
import { AlertFeed } from '../components/dashboard/AlertFeed';
import { ActionTile } from '../components/dashboard/ActionTile';
import MapContainer from '../components/map/MapContainer';

interface OperationsCenterProps {
  authToken: string;
  isAdmin?: boolean;
  onLogout?: () => void;
  onNavigate?: (page: string) => void;
}

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

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3002/api';

const OperationsCenter: React.FC<OperationsCenterProps> = ({
  authToken,
  isAdmin = false,
  onLogout,
  onNavigate,
}) => {
  const [sensorPackages, setSensorPackages] = useState<SensorData[]>([]);
  const [sensorsLoading, setSensorsLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<'active' | 'warning' | 'critical'>(
    'active'
  );
  const [selectedSensor, setSelectedSensor] = useState<SensorData | null>(null);
  const [alerts, setAlerts] = useState([
    {
      title: 'System Online',
      detail: 'All flood monitoring systems operational',
      time: 'now',
      tone: 'success' as const,
    },
  ]);

  // Fetch sensor packages
  useEffect(() => {
    if (!authToken) return;

    const fetchSensors = async () => {
      setSensorsLoading(true);
      try {
        const response = await fetch(`${API_BASE}/sensor-packages`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (response.ok) {
          const data = await response.json();
          const sensorsArray = Array.isArray(data) ? data : [];
          setSensorPackages(sensorsArray);

          // Check for critical alerts
          let criticalCount = 0;
          const newAlerts = [];

          sensorsArray.forEach((sensor) => {
            const waterLevel = sensor.currentReadings?.waterLevel;
            const settings = sensor.waterLevelSettings;

            if (waterLevel && settings && waterLevel >= settings.majorFloodLevel) {
              criticalCount++;
              newAlerts.push({
                title: 'CRITICAL FLOOD',
                detail: `${sensor.name} - Water level at ${waterLevel.toFixed(2)}m`,
                time: new Date(sensor.lastUpdate).toLocaleTimeString(),
                tone: 'danger' as const,
              });
            } else if (
              waterLevel &&
              settings &&
              waterLevel >= settings.minorFloodLevel
            ) {
              newAlerts.push({
                title: 'Minor Flood Warning',
                detail: `${sensor.name} - Water level rising`,
                time: new Date(sensor.lastUpdate).toLocaleTimeString(),
                tone: 'warning' as const,
              });
            }
          });

          setSystemStatus(criticalCount > 0 ? 'critical' : 'active');
          setAlerts([...newAlerts, ...alerts.slice(0, 2)]);
        }
      } catch (error) {
        console.error('Failed to fetch sensor packages:', error);
        setSystemStatus('warning');
      } finally {
        setSensorsLoading(false);
      }
    };

    fetchSensors();
    const interval = setInterval(fetchSensors, 30000);
    return () => clearInterval(interval);
  }, [authToken]);

  const handlePredictionResult = useCallback((result: any) => {
    const riskLevel = result.prediction_label?.toLowerCase().includes('high')
      ? 'danger'
      : result.prediction_label?.toLowerCase().includes('moderate')
        ? 'warning'
        : 'success';

    setAlerts((prev) => [
      {
        title: 'ML Prediction Updated',
        detail: `Risk Level: ${result.prediction_label || 'Unknown'} (${((result.confidence || 0) * 100).toFixed(1)}% confidence)`,
        time: new Date().toLocaleTimeString(),
        tone: riskLevel,
      },
      ...prev.slice(0, 4),
    ]);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white overflow-hidden">
      {/* Animated Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-screen blur-3xl opacity-10 animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-screen blur-3xl opacity-10 animate-pulse" />
        <div className="absolute top-1/2 right-0 w-80 h-80 bg-cyan-500 rounded-full mix-blend-screen blur-3xl opacity-5 animate-pulse" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <OperationsHeader
          status={systemStatus}
          userRole={isAdmin ? 'Administrator' : 'Operator'}
          onLogout={onLogout}
        />

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Top Metrics Row */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
              >
                <motion.div variants={itemVariants}>
                  <MetricCard
                    label="Active Sensors"
                    value={sensorPackages.length}
                    icon={<Radio size={20} />}
                    tone="blue"
                    detail="IoT Network Status"
                  />
                </motion.div>

                <motion.div variants={itemVariants}>
                  <MetricCard
                    label="Critical Alerts"
                    value={alerts.filter((a) => a.tone === 'danger').length}
                    icon={<AlertTriangle size={20} />}
                    tone="rose"
                    detail="Immediate action required"
                  />
                </motion.div>

                <motion.div variants={itemVariants}>
                  <MetricCard
                    label="Avg Water Level"
                    value={
                      sensorPackages.length > 0
                        ? (
                            sensorPackages.reduce(
                              (sum, s) => sum + (s.currentReadings?.waterLevel || 0),
                              0
                            ) / sensorPackages.length
                          ).toFixed(2)
                        : '0.00'
                    }
                    unit="m"
                    icon={<Droplets size={20} />}
                    tone="blue"
                    detail="Network average"
                  />
                </motion.div>

                <motion.div variants={itemVariants}>
                  <MetricCard
                    label="Total Rainfall"
                    value={
                      sensorPackages.length > 0
                        ? (
                            sensorPackages.reduce(
                              (sum, s) => sum + (s.currentReadings?.rainfall || 0),
                              0
                            ) / sensorPackages.length
                          ).toFixed(1)
                        : '0.0'
                    }
                    unit="mm"
                    icon={<Cloud size={20} />}
                    tone="blue"
                    detail="Average precipitation"
                  />
                </motion.div>
              </motion.div>

              {/* Main Content Grid */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                {/* Left Sidebar - Control Panels */}
                <motion.div
                  variants={itemVariants}
                  className="lg:col-span-1 space-y-6"
                >
                  {/* Sensor Panel */}
                  <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-lg p-4">
                    <SensorPanel
                      authToken={authToken}
                      sensorPackages={sensorPackages}
                      loading={sensorsLoading}
                      onSensorClick={setSelectedSensor}
                    />
                  </div>

                  {/* Prediction Panel */}
                  <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-lg p-4">
                    <PredictionPanel
                      authToken={authToken}
                      onPredictionResult={handlePredictionResult}
                      loading={sensorsLoading}
                    />
                  </div>
                </motion.div>

                {/* Center - Map */}
                <motion.div
                  variants={itemVariants}
                  className="lg:col-span-2 h-[600px]"
                >
                  <MapContainer authToken={authToken} />
                </motion.div>
              </motion.div>

              {/* Bottom Section - Alerts and Quick Actions */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                {/* Alert Feed */}
                <motion.div
                  variants={itemVariants}
                  className="lg:col-span-2"
                >
                  <AlertFeed items={alerts} />
                </motion.div>

                {/* Quick Actions */}
                <motion.div
                  variants={itemVariants}
                  className="space-y-3"
                >
                  <h3 className="text-sm font-semibold text-white px-1">Quick Actions</h3>
                  <ActionTile
                    title="Drain Management"
                    description={isAdmin ? 'Manage flood level monitors' : 'View drain status'}
                    icon={Gauge}
                    accent="emerald"
                    onClick={() => onNavigate?.('drain-management')}
                  />
                  <ActionTile
                    title="Post-Flood Aid"
                    description="Ration distribution"
                    icon={Home}
                    accent="amber"
                    onClick={() => onNavigate?.('ration-distribution')}
                  />
                  <ActionTile
                    title="Disease Tracking"
                    description="Post-flood health risks"
                    icon={AlertTriangle}
                    accent="violet"
                    onClick={() => onNavigate?.('disease-management')}
                  />
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationsCenter;
