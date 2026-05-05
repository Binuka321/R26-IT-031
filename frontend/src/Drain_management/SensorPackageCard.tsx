import { MapPin, Droplets, Wind, CloudRain, Waves, Cpu, Activity } from 'lucide-react';
import type { SensorPackage } from './types';

interface SensorPackageCardProps {
  package: SensorPackage;
  onViewDetails: (id: string) => void;
  onEdit: (pkg: SensorPackage) => void;
  onDelete: (id: string) => void;
  onToggleIngest: (id: string, ingestEnabled: boolean) => void;
}

export function SensorPackageCard({ package: pkg, onViewDetails, onEdit, onDelete, onToggleIngest }: SensorPackageCardProps) {
  const statusColors = {
    active: 'bg-green-100 text-green-800 border-green-300',
    inactive: 'bg-gray-100 text-gray-800 border-gray-300',
    warning: 'bg-orange-100 text-orange-800 border-orange-300'
  };

  const statusLabels = {
    active: 'Active',
    inactive: 'Inactive',
    warning: 'Warning'
  };

  const totalSensors = Object.values(pkg.sensors).reduce((sum, count) => sum + count, 0);
  const activeBoards = [pkg.boards.esp32 && 'ESP32', pkg.boards.uno && 'UNO'].filter(Boolean);
  const ingestEnabled = pkg.ingestEnabled !== false;

  return (
    <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="bg-linear-to-r from-blue-600 to-cyan-600 p-4 text-white">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-bold text-lg">{pkg.name}</h3>
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[pkg.status]}`}>
            {statusLabels[pkg.status]}
          </span>
        </div>
        <div className="flex items-center gap-2 text-blue-100">
          <MapPin size={14} />
          <span className="text-sm">{pkg.location.name}</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {/* Location Details */}
        <div className="mb-4 pb-4 border-b border-gray-200">
          <p className="text-sm text-gray-600">{pkg.location.address}</p>
          <p className="text-xs text-gray-500 mt-1">
            {pkg.location.latitude.toFixed(4)}°N, {pkg.location.longitude.toFixed(4)}°E
          </p>
        </div>

        {/* Sensors + Data collection toggle */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2 gap-3">
            <div>
              <span className="text-sm font-medium text-gray-700">Sensors</span>
              <span className="ml-2 text-sm font-bold text-blue-600">{totalSensors} total</span>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-700 select-none">
              <span className="hidden sm:inline">Data</span>
              <button
                type="button"
                onClick={() => onToggleIngest(pkg.id, !ingestEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  ingestEnabled ? 'bg-green-600' : 'bg-gray-300'
                }`}
                aria-pressed={ingestEnabled}
                aria-label="Toggle data collection"
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    ingestEnabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={ingestEnabled ? 'text-green-700 font-medium' : 'text-gray-600'}>
                {ingestEnabled ? 'ON' : 'OFF'}
              </span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className={`flex items-center justify-between p-2 rounded-lg ${pkg.sensors.ultrasonic > 0 ? 'bg-blue-50' : 'bg-gray-50 opacity-50'}`}>
              <div className="flex items-center gap-2">
                <Droplets size={16} className={pkg.sensors.ultrasonic > 0 ? 'text-blue-600' : 'text-gray-400'} />
                <span className="text-xs">Ultrasonic</span>
              </div>
              <span className="text-xs font-bold text-blue-600">{pkg.sensors.ultrasonic}</span>
            </div>
            <div className={`flex items-center justify-between p-2 rounded-lg ${pkg.sensors.flow > 0 ? 'bg-cyan-50' : 'bg-gray-50 opacity-50'}`}>
              <div className="flex items-center gap-2">
                <Wind size={16} className={pkg.sensors.flow > 0 ? 'text-cyan-600' : 'text-gray-400'} />
                <span className="text-xs">Flow</span>
              </div>
              <span className="text-xs font-bold text-cyan-600">{pkg.sensors.flow}</span>
            </div>
            <div className={`flex items-center justify-between p-2 rounded-lg ${pkg.sensors.rain > 0 ? 'bg-indigo-50' : 'bg-gray-50 opacity-50'}`}>
              <div className="flex items-center gap-2">
                <CloudRain size={16} className={pkg.sensors.rain > 0 ? 'text-indigo-600' : 'text-gray-400'} />
                <span className="text-xs">Rain</span>
              </div>
              <span className="text-xs font-bold text-indigo-600">{pkg.sensors.rain}</span>
            </div>
            <div className={`flex items-center justify-between p-2 rounded-lg ${pkg.sensors.turbidity > 0 ? 'bg-teal-50' : 'bg-gray-50 opacity-50'}`}>
              <div className="flex items-center gap-2">
                <Waves size={16} className={pkg.sensors.turbidity > 0 ? 'text-teal-600' : 'text-gray-400'} />
                <span className="text-xs">Turbidity</span>
              </div>
              <span className="text-xs font-bold text-teal-600">{pkg.sensors.turbidity}</span>
            </div>
          </div>
        </div>

        {/* Board Info */}
        <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Cpu size={18} className="text-gray-600" />
            <div className="flex gap-2">
              {activeBoards.map((board, idx) => (
                <span key={idx} className="text-sm font-medium text-gray-700 bg-white px-2 py-1 rounded">
                  {board}
                </span>
              ))}
              {activeBoards.length === 0 && (
                <span className="text-sm text-gray-500">No boards</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Activity size={14} className="text-green-500" />
            <span className="text-xs text-gray-600">
              {Math.floor((Date.now() - pkg.lastUpdate.getTime()) / 1000)}s ago
            </span>
          </div>
        </div>

        {/* Current Readings Preview */}
        {pkg.status === 'active' && Object.keys(pkg.currentReadings).length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {pkg.currentReadings.waterLevel !== undefined && (
                <div>
                  <span className="text-gray-600">Water Level:</span>
                  <span className="font-bold text-blue-700 ml-1">{pkg.currentReadings.waterLevel}m</span>
                </div>
              )}
              {pkg.currentReadings.rainfall !== undefined && (
                <div>
                  <span className="text-gray-600">Rainfall:</span>
                  <span className="font-bold text-blue-700 ml-1">{pkg.currentReadings.rainfall}mm</span>
                </div>
              )}
              {pkg.currentReadings.flowRate !== undefined && (
                <div>
                  <span className="text-gray-600">Flow:</span>
                  <span className="font-bold text-blue-700 ml-1">{pkg.currentReadings.flowRate}m/s</span>
                </div>
              )}
              {pkg.currentReadings.turbidity !== undefined && (
                <div>
                  <span className="text-gray-600">Turbidity:</span>
                  <span className="font-bold text-blue-700 ml-1">{pkg.currentReadings.turbidity} NTU</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onViewDetails(pkg.id)}
            className="col-span-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            View Real-time Monitoring
          </button>
          <button
            onClick={() => onEdit(pkg)}
            className="py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(pkg.id)}
            className="col-span-2 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
