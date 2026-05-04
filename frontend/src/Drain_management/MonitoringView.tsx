import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Droplets, Wind, CloudRain, Waves, MapPin, Activity, AlertTriangle, TrendingUp } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import type { SensorPackage } from './types';
import { fetchSensorReadings } from './sensorPackageApi';

interface MonitoringViewProps {
  package: SensorPackage;
  authToken: string;
  onBack: () => void;
}

export function MonitoringView({ package: pkg, authToken, onBack }: MonitoringViewProps) {
  const [historicalData, setHistoricalData] = useState<Array<{
    time: string;
    waterLevel?: number;
    flowRate?: number;
    rainfall?: number;
    turbidity?: number;
  }>>([]);
  const [currentData, setCurrentData] = useState(pkg.currentReadings);
  const [readingError, setReadingError] = useState<string | null>(null);

  const waterUnit = pkg.waterLevelSettings?.unit ?? 'm';

  const loadReadings = useCallback(async () => {
    try {
      const readings = await fetchSensorReadings(authToken, pkg.id, 240);
      const chartRows = readings.map((row) => ({
        time: new Date(row.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        waterLevel: row.waterLevel,
        flowRate: row.flowRate,
        rainfall: row.rainfall,
        turbidity: row.turbidity
      }));
      setHistoricalData(chartRows);
      const latest = readings[readings.length - 1];
      if (latest) {
        setCurrentData({
          waterLevel: latest.waterLevel,
          flowRate: latest.flowRate,
          rainfall: latest.rainfall,
          turbidity: latest.turbidity
        });
      }
      setReadingError(null);
    } catch (error) {
      setReadingError(error instanceof Error ? error.message : 'Failed to load readings');
    }
  }, [authToken, pkg.id]);

  useEffect(() => {
    loadReadings();
    const interval = setInterval(loadReadings, 5000);
    return () => clearInterval(interval);
  }, [loadReadings]);

  const getFloodRiskLevel = () => {
    if (currentData.waterLevel === undefined) {
      return { level: 'Unknown', color: 'gray', bgColor: 'bg-gray-100', textColor: 'text-gray-800' };
    }

    const wl = pkg.waterLevelSettings;
    if (wl) {
      const v = currentData.waterLevel;
      if (v >= wl.majorFloodLevel) {
        return { level: 'Major flood', color: 'red', bgColor: 'bg-red-100', textColor: 'text-red-800' };
      }
      if (v >= wl.minorFloodLevel) {
        return { level: 'Minor flood', color: 'orange', bgColor: 'bg-orange-100', textColor: 'text-orange-800' };
      }
      if (v >= wl.alertLevel) {
        return { level: 'Alert', color: 'amber', bgColor: 'bg-amber-100', textColor: 'text-amber-900' };
      }
      return { level: 'Normal', color: 'green', bgColor: 'bg-green-100', textColor: 'text-green-800' };
    }

    if (currentData.waterLevel > 3.5) {
      return { level: 'High Risk', color: 'red', bgColor: 'bg-red-100', textColor: 'text-red-800' };
    }
    if (currentData.waterLevel > 2.5) {
      return { level: 'Medium Risk', color: 'orange', bgColor: 'bg-orange-100', textColor: 'text-orange-800' };
    }
    return { level: 'Low Risk', color: 'green', bgColor: 'bg-green-100', textColor: 'text-green-800' };
  };

  const floodRisk = getFloodRiskLevel();

  const wl = pkg.waterLevelSettings;
  const waterVals = historicalData.map((row) => row.waterLevel).filter((x: unknown) => typeof x === 'number');
  const threshVals = wl ? [wl.alertLevel, wl.minorFloodLevel, wl.majorFloodLevel] : [];
  const ymax = threshVals.length
    ? Math.max(...threshVals, ...waterVals, 0.001) * 1.08
    : undefined;
  const ymin = threshVals.length
    ? Math.min(0, ...threshVals, ...waterVals) - Math.max(Math.max(...threshVals, ...waterVals, 1) * 0.06, 0.05)
    : undefined;

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-cyan-50 to-teal-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4 font-medium"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{pkg.name}</h1>
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin size={16} />
                  <span>{pkg.location.name}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{pkg.location.address}</p>
              </div>
              <div className="text-right">
                <div className={`inline-block px-4 py-2 rounded-lg ${floodRisk.bgColor} ${floodRisk.textColor} font-bold mb-2`}>
                  {floodRisk.level}
                </div>
                <div className="flex items-center gap-2 text-gray-600 justify-end">
                  <Activity size={14} className="text-green-500" />
                  <span className="text-sm">Live Monitoring</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {readingError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {readingError}
          </div>
        )}

        {/* Real-time Sensor Readings */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {pkg.sensors.ultrasonic > 0 && currentData.waterLevel !== undefined && (
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Droplets className="text-blue-600" size={24} />
                  </div>
                  <span className="font-medium text-gray-700">Water Level</span>
                </div>
                <TrendingUp size={16} className="text-green-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {currentData.waterLevel.toFixed(2)} {waterUnit}
              </div>
              <div className="text-xs text-gray-500">
                {wl
                  ? `Thresholds (${waterUnit}): alert ${wl.alertLevel}, minor ${wl.minorFloodLevel}, major ${wl.majorFloodLevel}`
                  : 'Normal: < 2.5 m'}
              </div>
              <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-500"
                  style={{
                    width: `${
                      wl
                        ? Math.min((currentData.waterLevel / (wl.majorFloodLevel * 1.2 || 1)) * 100, 100)
                        : Math.min((currentData.waterLevel / 5) * 100, 100)
                    }%`
                  }}
                />
              </div>
            </div>
          )}

          {pkg.sensors.flow > 0 && currentData.flowRate !== undefined && (
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-cyan-500">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    <Wind className="text-cyan-600" size={24} />
                  </div>
                  <span className="font-medium text-gray-700">Flow Rate</span>
                </div>
                <Activity size={16} className="text-cyan-500 animate-pulse" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {currentData.flowRate.toFixed(2)} m/s
              </div>
              <div className="text-xs text-gray-500">Current velocity</div>
              <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-600 transition-all duration-500"
                  style={{ width: `${Math.min((currentData.flowRate / 3) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          {pkg.sensors.rain > 0 && currentData.rainfall !== undefined && (
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-indigo-500">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <CloudRain className="text-indigo-600" size={24} />
                  </div>
                  <span className="font-medium text-gray-700">Rainfall</span>
                </div>
                {currentData.rainfall > 20 && <AlertTriangle size={16} className="text-orange-500" />}
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {currentData.rainfall.toFixed(1)} mm
              </div>
              <div className="text-xs text-gray-500">Last hour accumulation</div>
              <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-500"
                  style={{ width: `${Math.min((currentData.rainfall / 50) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          {pkg.sensors.turbidity > 0 && currentData.turbidity !== undefined && (
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-teal-500">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-teal-100 rounded-lg">
                    <Waves className="text-teal-600" size={24} />
                  </div>
                  <span className="font-medium text-gray-700">Turbidity</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {currentData.turbidity.toFixed(0)} NTU
              </div>
              <div className="text-xs text-gray-500">Water clarity index</div>
              <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-600 transition-all duration-500"
                  style={{ width: `${Math.min((currentData.turbidity / 200) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Water Level Chart */}
          {pkg.sensors.ultrasonic > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Water Level Trend</h3>
              {wl && (
                <div className="flex flex-wrap gap-4 mb-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-3 rounded-sm bg-amber-500" />
                    Alert {wl.alertLevel} {wl.unit}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-3 rounded-sm bg-orange-500" />
                    Minor flood {wl.minorFloodLevel} {wl.unit}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-3 rounded-sm bg-red-600" />
                    Major flood {wl.majorFloodLevel} {wl.unit}
                  </span>
                </div>
              )}
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={historicalData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                  <defs>
                    <linearGradient id="colorWaterLevel" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="#6b7280" />
                  <YAxis
                    domain={threshVals.length && ymin !== undefined && ymax !== undefined ? [ymin, ymax] : undefined}
                    tick={{ fontSize: 12 }}
                    stroke="#6b7280"
                    label={{
                      value: `Water level (${waterUnit})`,
                      angle: -90,
                      position: 'insideLeft'
                    }}
                  />
                  <Tooltip
                    formatter={(value) =>
                      typeof value === 'number'
                        ? [`${value.toFixed(2)} ${waterUnit}`, 'Water level']
                        : [String(value), 'Water level']
                    }
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="waterLevel"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorWaterLevel)"
                  />
                  {wl && (
                    <>
                      <ReferenceLine
                        y={wl.alertLevel}
                        stroke="#eab308"
                        strokeWidth={2}
                        strokeDasharray="6 6"
                        label={{ value: 'Alert', fill: '#a16207', fontSize: 11 }}
                      />
                      <ReferenceLine
                        y={wl.minorFloodLevel}
                        stroke="#f97316"
                        strokeWidth={2}
                        strokeDasharray="6 6"
                        label={{ value: 'Minor', fill: '#c2410c', fontSize: 11 }}
                      />
                      <ReferenceLine
                        y={wl.majorFloodLevel}
                        stroke="#dc2626"
                        strokeWidth={2}
                        strokeDasharray="6 6"
                        label={{ value: 'Major', fill: '#991b1b', fontSize: 11 }}
                      />
                    </>
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Rainfall Chart */}
          {pkg.sensors.rain > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Rainfall Intensity</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="#6b7280" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" label={{ value: 'mm/hr', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rainfall"
                    stroke="#6366f1"
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Flow Rate & Turbidity Chart */}
          {(pkg.sensors.flow > 0 || pkg.sensors.turbidity > 0) && (
            <div className="bg-white rounded-xl shadow-lg p-6 lg:col-span-2">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Multi-Sensor Analysis</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="#6b7280" />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="#6b7280" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Legend />
                  {pkg.sensors.flow > 0 && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="flowRate"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      name="Flow Rate (m/s)"
                      dot={false}
                    />
                  )}
                  {pkg.sensors.turbidity > 0 && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="turbidity"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      name="Turbidity (NTU)"
                      dot={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Alert Messages */}
        {(floodRisk.level === 'High Risk' || floodRisk.level === 'Major flood') && (
          <div className="mt-6 bg-red-50 border-l-4 border-red-500 p-6 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-600 mt-1" size={24} />
              <div>
                <h4 className="font-bold text-red-900 mb-1">Flood Warning Alert!</h4>
                <p className="text-red-800">
                  Water level has exceeded critical threshold. Immediate action recommended for areas downstream.
                  Rainfall intensity: {currentData.rainfall?.toFixed(1)} mm/hr
                </p>
              </div>
            </div>
          </div>
        )}

        {(floodRisk.level === 'Medium Risk' || floodRisk.level === 'Minor flood') && (
          <div className="mt-6 bg-orange-50 border-l-4 border-orange-500 p-6 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-orange-600 mt-1" size={24} />
              <div>
                <h4 className="font-bold text-orange-900 mb-1">Elevated Water Level</h4>
                <p className="text-orange-800">
                  Water level is rising. Continue monitoring conditions closely. Consider precautionary measures.
                </p>
              </div>
            </div>
          </div>
        )}

        {floodRisk.level === 'Alert' && (
          <div className="mt-6 bg-amber-50 border-l-4 border-amber-500 p-6 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-700 mt-1" size={24} />
              <div>
                <h4 className="font-bold text-amber-900 mb-1">Alert threshold reached</h4>
                <p className="text-amber-900">
                  Water level has reached the configured alert line. Increase monitoring readiness.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default MonitoringView;