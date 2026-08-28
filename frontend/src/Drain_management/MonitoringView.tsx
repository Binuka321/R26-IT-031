import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Droplets, Wind, CloudRain, Waves, MapPin, Activity, AlertTriangle, TrendingUp, Radar } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import type { SensorPackage, SensorPoint } from './types';
import { evaluatePackageRisk, formatCoordinates } from './floodRisk';
import { fetchSensorPackages, fetchSensorReadings } from './sensorPackageApi';
import { fetchLatestBlockageReading, type BlockageReading } from './blockageReadingApi';

interface MonitoringViewProps {
  package: SensorPackage;
  authToken: string;
  onBack: () => void;
}

function blockageLocationLabel(location: string) {
  if (location === 'BETWEEN_S1_S2') return 'Between point 1 and point 2';
  if (location === 'BETWEEN_S2_S3') return 'Between point 2 and point 3';
  if (location === 'BETWEEN_S1_S2_AND_S2_S3') return 'Between points 1–2 and 2–3';
  return 'No blockage';
}

function isPointInBlockedSegment(index: number, location: string) {
  if (location === 'BETWEEN_S1_S2') return index === 0 || index === 1;
  if (location === 'BETWEEN_S2_S3') return index === 1 || index === 2;
  if (location === 'BETWEEN_S1_S2_AND_S2_S3') return index >= 0 && index <= 2;
  return false;
}

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
  const [showBlockageDetection, setShowBlockageDetection] = useState(false);
  const [sensorPoints, setSensorPoints] = useState<SensorPoint[]>(pkg.sensorPoints ?? []);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [blockageReading, setBlockageReading] = useState<BlockageReading | null>(null);

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

  const loadBlockageDetection = useCallback(async (silent = false) => {
    if (!silent) {
      setPointsError(null);
      setPointsLoading(true);
    }
    try {
      const [packages, latestReading] = await Promise.all([
        fetchSensorPackages(authToken),
        fetchLatestBlockageReading(authToken, pkg.id)
      ]);
      const latest = packages.find((item) => item.id === pkg.id);
      setSensorPoints(latest?.sensorPoints ?? pkg.sensorPoints ?? []);
      setBlockageReading(latestReading);
      setPointsError(null);
    } catch (error) {
      if (!silent) {
        setSensorPoints(pkg.sensorPoints ?? []);
      }
      setPointsError(error instanceof Error ? error.message : 'Could not load blockage data');
    } finally {
      if (!silent) setPointsLoading(false);
    }
  }, [authToken, pkg.id, pkg.sensorPoints]);

  useEffect(() => {
    if (!showBlockageDetection) return undefined;
    void loadBlockageDetection();
    const interval = setInterval(() => loadBlockageDetection(true), 5000);
    return () => clearInterval(interval);
  }, [showBlockageDetection, loadBlockageDetection]);

  const floodRisk = evaluatePackageRisk(currentData, pkg.waterLevelSettings);
  const blockageUnit = blockageReading?.unit ?? 'm';
  const pointWaterLevels = [
    blockageReading?.sensor1WaterLevel,
    blockageReading?.sensor2WaterLevel,
    blockageReading?.sensor3WaterLevel
  ];
  const pointDistances = [
    blockageReading?.sensor1Distance,
    blockageReading?.sensor2Distance,
    blockageReading?.sensor3Distance
  ];

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
    <div className="drain-module min-h-screen overflow-x-hidden bg-linear-to-br from-blue-50 via-cyan-50 to-teal-50 p-3 sm:p-4 lg:p-6">
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

          <div className="drain-card bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="mb-2 break-words text-2xl font-bold text-gray-900 sm:text-3xl">{pkg.name}</h1>
                <div className="flex min-w-0 items-center gap-2 text-gray-600">
                  <MapPin size={16} />
                  <span className="min-w-0 break-words">{pkg.location.name}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{pkg.location.address}</p>
              </div>
              <div className="text-left sm:text-right">
                <div className={`inline-block px-4 py-2 rounded-lg ${floodRisk.bgColor} ${floodRisk.textColor} font-bold mb-2`}>
                  {floodRisk.level}
                </div>
                <div className="flex items-center gap-2 text-gray-600 sm:justify-end">
                  <Activity size={14} className="text-green-500" />
                  <span className="text-sm">Live Monitoring</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (showBlockageDetection) {
                      setShowBlockageDetection(false);
                      return;
                    }
                    setShowBlockageDetection(true);
                  }}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700"
                >
                  <Radar size={16} />
                  Blockage Detection
                </button>
              </div>
            </div>
          </div>
        </div>
        {readingError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {readingError}
          </div>
        )}

        {showBlockageDetection ? (
          <div className="drain-card mb-6 rounded-xl bg-white p-4 shadow-lg sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Blockage Detection</h2>
                <p className="text-sm text-gray-600">
                  Arduino ultrasonic readings mapped to sensor points for {pkg.name}, in order
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBlockageDetection(false)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Back to monitoring
              </button>
            </div>

            {pointsLoading && <p className="text-sm text-gray-600">Loading blockage data…</p>}
            {pointsError && (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {pointsError}
              </p>
            )}

            {!pointsLoading && blockageReading && (
              <div
                className={`mb-4 rounded-lg border-l-4 px-4 py-3 ${
                  blockageReading.blockageDetected
                    ? 'border-red-500 bg-red-50'
                    : 'border-green-500 bg-green-50'
                }`}
              >
                <p className={`font-semibold ${blockageReading.blockageDetected ? 'text-red-900' : 'text-green-900'}`}>
                  {blockageReading.blockageDetected ? 'Blockage detected' : 'No blockage'}
                </p>
                <p className={`text-sm ${blockageReading.blockageDetected ? 'text-red-800' : 'text-green-800'}`}>
                  Location: {blockageLocationLabel(blockageReading.blockageLocation)}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Last update {new Date(blockageReading.timestamp).toLocaleString()}
                  {blockageReading.difference12 !== undefined && (
                    <> · Δ 1–2: {blockageReading.difference12.toFixed(3)} {blockageUnit}</>
                  )}
                  {blockageReading.difference23 !== undefined && (
                    <> · Δ 2–3: {blockageReading.difference23.toFixed(3)} {blockageUnit}</>
                  )}
                </p>
              </div>
            )}

            {!pointsLoading && !blockageReading && (
              <p className="mb-4 text-sm text-gray-600">
                Waiting for Arduino blockage data. Send readings to POST /api/blockage-readings/ingest.
              </p>
            )}

            {!pointsLoading && sensorPoints.length === 0 && (
              <p className="text-sm text-gray-600">
                No sensor points have been created for this package yet.
              </p>
            )}
            {!pointsLoading && sensorPoints.length > 0 && (
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {sensorPoints.map((point, index) => {
                  const inBlockedSegment = Boolean(
                    blockageReading?.blockageDetected &&
                      isPointInBlockedSegment(index, blockageReading.blockageLocation)
                  );
                  const waterLevel = index < 3 ? pointWaterLevels[index] : undefined;
                  const distance = index < 3 ? pointDistances[index] : undefined;

                  return (
                    <li
                      key={point.id ?? `${point.name}-${index}`}
                      className={`rounded-xl border p-4 ${
                        inBlockedSegment
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-200 bg-slate-50'
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <p className="text-base font-semibold text-gray-900">
                          {point.name || `Point ${index + 1}`}
                        </p>
                        {index < 3 && (
                          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
                            Sensor {index + 1}
                          </span>
                        )}
                      </div>
                      {inBlockedSegment && (
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-800">
                          Blocked segment
                        </p>
                      )}
                      <p className="flex items-start gap-2 text-sm text-gray-700">
                        <MapPin size={16} className="mt-0.5 shrink-0 text-blue-600" />
                        <span>
                          {formatCoordinates(point.latitude, point.longitude)}
                          <span className="mt-1 block text-xs text-gray-500">
                            Latitude {point.latitude}, Longitude {point.longitude}
                          </span>
                        </span>
                      </p>
                      <div className="mt-3 space-y-1 text-sm text-gray-800">
                        <p>
                          <span className="font-medium">Water level:</span>{' '}
                          {waterLevel === undefined || Number.isNaN(waterLevel)
                            ? 'No reading yet'
                            : `${waterLevel.toFixed(3)} ${blockageUnit}`}
                        </p>
                        <p>
                          <span className="font-medium">Distance:</span>{' '}
                          {distance === undefined || Number.isNaN(distance)
                            ? 'No reading yet'
                            : `${distance.toFixed(2)} cm`}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          <>
        {/* Real-time Sensor Readings */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:gap-6">
          {pkg.sensors.ultrasonic > 0 && currentData.waterLevel !== undefined && (
            <div className="drain-card bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Droplets className="text-blue-600" size={24} />
                  </div>
                  <span className="font-medium text-gray-700">Water Level</span>
                </div>
                <TrendingUp size={16} className="text-green-500" />
              </div>
              <div className="mb-1 text-2xl font-bold text-gray-900 sm:text-3xl">
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
            <div className="drain-card bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-cyan-500">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    <Wind className="text-cyan-600" size={24} />
                  </div>
                  <span className="font-medium text-gray-700">Flow Rate</span>
                </div>
                <Activity size={16} className="text-cyan-500 animate-pulse" />
              </div>
              <div className="mb-1 text-2xl font-bold text-gray-900 sm:text-3xl">
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
            <div className="drain-card bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-sky-500">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-sky-100 rounded-lg">
                    <CloudRain className="text-sky-700" size={24} />
                  </div>
                  <span className="font-medium text-gray-700">Rainfall</span>
                </div>
                {currentData.rainfall > 20 && <AlertTriangle size={16} className="text-orange-500" />}
              </div>
              <div className="mb-1 text-2xl font-bold text-gray-900 sm:text-3xl">
                {currentData.rainfall.toFixed(1)} mm
              </div>
              <div className="text-xs text-gray-500">Last hour accumulation</div>
              <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-600 transition-all duration-500"
                  style={{ width: `${Math.min((currentData.rainfall / 50) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          {pkg.sensors.turbidity > 0 && currentData.turbidity !== undefined && (
            <div className="drain-card bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-teal-500">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-teal-100 rounded-lg">
                    <Waves className="text-teal-600" size={24} />
                  </div>
                  <span className="font-medium text-gray-700">Turbidity</span>
                </div>
              </div>
              <div className="mb-1 text-2xl font-bold text-gray-900 sm:text-3xl">
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          {/* Water Level Chart */}
          {pkg.sensors.ultrasonic > 0 && (
            <div className="overflow-x-auto rounded-xl bg-white p-4 shadow-lg sm:p-6">
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
              <div className="min-w-[560px]">
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
            </div>
          )}

          {/* Rainfall Chart */}
          {pkg.sensors.rain > 0 && (
            <div className="overflow-x-auto rounded-xl bg-white p-4 shadow-lg sm:p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Rainfall Intensity</h3>
              <div className="min-w-[560px]">
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
                    stroke="#087eaa"
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Flow Rate & Turbidity Chart */}
          {(pkg.sensors.flow > 0 || pkg.sensors.turbidity > 0) && (
            <div className="overflow-x-auto rounded-xl bg-white p-4 shadow-lg sm:p-6 lg:col-span-2">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Multi-Sensor Analysis</h3>
              <div className="min-w-[640px]">
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
            </div>
          )}
        </div>

        {/* Alert Messages */}
        {(floodRisk.level === 'High Risk' || floodRisk.level === 'Major flood') && (
          <div className="mt-6 bg-red-50 border-l-4 border-red-500 p-4 sm:p-6 rounded-lg">
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
          <div className="mt-6 bg-orange-50 border-l-4 border-orange-500 p-4 sm:p-6 rounded-lg">
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
          <div className="mt-6 bg-amber-50 border-l-4 border-amber-500 p-4 sm:p-6 rounded-lg">
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
          </>
        )}
      </div>
    </div>
  );
}
export default MonitoringView;
