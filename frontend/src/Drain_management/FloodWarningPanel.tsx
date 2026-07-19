import { AlertTriangle, MapPin, Clock, ChevronRight } from 'lucide-react';
import type { PackageFloodAlert } from './floodRisk';
import { formatCoordinates } from './floodRisk';

interface FloodWarningPanelProps {
  alerts: PackageFloodAlert[];
  onViewPackage: (packageId: string) => void;
}

export function FloodWarningPanel({ alerts, onViewPackage }: FloodWarningPanelProps) {
  const criticalCount = alerts.filter((a) => a.risk.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.risk.severity === 'warning').length;

  return (
    <div className="mb-8 rounded-xl border border-orange-200 bg-white shadow-lg overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-100 bg-linear-to-r from-orange-50 to-amber-50 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-orange-100 p-2">
            <AlertTriangle className="text-orange-600" size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Active Flood Warnings</h2>
            <p className="text-sm text-gray-600">
              Live alerts from sensor packages exceeding configured thresholds
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
              {criticalCount} Critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
              {warningCount} Elevated
            </span>
          )}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <AlertTriangle className="text-green-600" size={22} />
          </div>
          <p className="font-medium text-gray-900">No active flood warnings</p>
          <p className="mt-1 text-sm text-gray-600">
            Alerts will appear here when collected sensor data exceeds alert, minor, or major flood levels.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {alerts.map(({ package: pkg, risk }) => (
            <li
              key={pkg.id}
              className={`border-l-4 ${risk.borderColor} ${risk.bgColor} px-6 py-4`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${risk.textColor} bg-white/70 border border-current/20`}
                    >
                      {risk.level}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{pkg.name}</span>
                  </div>

                  <p className={`text-sm ${risk.textColor}`}>{risk.message}</p>

                  <div className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                    <p>
                      <span className="font-medium text-gray-900">Water level:</span>{' '}
                      {risk.waterLevel?.toFixed(2)} {risk.unit}
                      {risk.thresholdValue !== undefined && risk.thresholdLabel && (
                        <span className="text-gray-600">
                          {' '}
                          (threshold: {risk.thresholdValue.toFixed(2)} {risk.unit})
                        </span>
                      )}
                    </p>
                    <p className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 shrink-0 text-gray-500" size={15} />
                      <span>
                        <span className="font-medium text-gray-900">Coordinates:</span>{' '}
                        {formatCoordinates(pkg.location.latitude, pkg.location.longitude)}
                        <span className="block text-xs text-gray-500 mt-0.5">
                          {pkg.location.name}
                          {pkg.location.station ? ` · ${pkg.location.station}` : ''}
                        </span>
                      </span>
                    </p>
                  </div>

                  <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                    <Clock size={13} />
                    Last updated{' '}
                    {pkg.lastUpdate instanceof Date
                      ? pkg.lastUpdate.toLocaleString()
                      : new Date(pkg.lastUpdate).toLocaleString()}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onViewPackage(pkg.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
                >
                  View monitoring
                  <ChevronRight size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
