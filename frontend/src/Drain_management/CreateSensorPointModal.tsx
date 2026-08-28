import { useMemo, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import type { SensorPackage, SensorPoint } from './types';

interface CreateSensorPointModalProps {
  packages: SensorPackage[];
  onClose: () => void;
  onCreate: (packageId: string, points: SensorPoint[]) => void | Promise<void>;
  serverError?: string | null;
}

export function CreateSensorPointModal({
  packages,
  onClose,
  onCreate,
  serverError
}: CreateSensorPointModalProps) {
  const [packageId, setPackageId] = useState(packages[0]?.id ?? '');
  const [pointCount, setPointCount] = useState(1);
  const [coords, setCoords] = useState<Array<{ name: string; latitude: string; longitude: string }>>([
    { name: '', latitude: '', longitude: '' }
  ]);
  const [formError, setFormError] = useState('');

  const selectedPackage = useMemo(
    () => packages.find((pkg) => pkg.id === packageId),
    [packages, packageId]
  );

  const updatePointCount = (nextCount: number) => {
    const count = Math.min(20, Math.max(1, nextCount));
    setPointCount(count);
    setCoords((current) => {
      if (count === current.length) return current;
      if (count > current.length) {
        return [
          ...current,
          ...Array.from({ length: count - current.length }, () => ({ name: '', latitude: '', longitude: '' }))
        ];
      }
      return current.slice(0, count);
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');

    if (!packageId) {
      setFormError('Select a sensor package.');
      return;
    }

    const points: Array<{ name: string; latitude: number; longitude: number }> = [];
    for (let i = 0; i < coords.length; i += 1) {
      const name = coords[i].name.trim();
      const latitude = Number(coords[i].latitude);
      const longitude = Number(coords[i].longitude);
      if (!name) {
        setFormError(`Enter a name for point ${i + 1}.`);
        return;
      }
      if (coords[i].latitude.trim() === '' || coords[i].longitude.trim() === '') {
        setFormError(`Enter latitude and longitude for point ${i + 1}.`);
        return;
      }
      if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
        setFormError(`Point ${i + 1} must have valid numbers.`);
        return;
      }
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        setFormError(`Point ${i + 1} coordinates are outside the valid range.`);
        return;
      }
      points.push({ name, latitude, longitude });
    }

    onCreate(packageId, points);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[96svh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
        <div className="drain-brand-gradient sticky top-0 flex items-center justify-between gap-3 rounded-t-2xl bg-linear-to-r from-blue-600 to-cyan-600 p-4 text-white sm:p-6">
          <h2 className="min-w-0 text-xl font-bold sm:text-2xl">Create Sensor Point</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6">
          {(formError || serverError) && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              {formError || serverError}
            </div>
          )}

          {packages.length === 0 ? (
            <p className="text-sm text-gray-600">Create a sensor package first, then add sensor points to it.</p>
          ) : (
            <>
              <div className="mb-5">
                <label htmlFor="sensor-point-package" className="block text-sm font-medium text-gray-700 mb-2">
                  Sensor package *
                </label>
                <select
                  id="sensor-point-package"
                  required
                  value={packageId}
                  onChange={(event) => setPackageId(event.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name}
                    </option>
                  ))}
                </select>
                {selectedPackage && (
                  <p className="mt-2 text-xs text-gray-500">
                    This package currently has {selectedPackage.sensorPoints?.length ?? 0} sensor point
                    {(selectedPackage.sensorPoints?.length ?? 0) === 1 ? '' : 's'}.
                  </p>
                )}
              </div>

              <div className="mb-5">
                <label htmlFor="sensor-point-count" className="block text-sm font-medium text-gray-700 mb-2">
                  How many points *
                </label>
                <input
                  id="sensor-point-count"
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={pointCount}
                  onChange={(event) => updatePointCount(Number(event.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="text-blue-600" size={20} />
                  <h3 className="font-semibold text-gray-900">Point details</h3>
                </div>
                <div className="space-y-4">
                  {coords.map((point, index) => (
                    <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <p className="mb-3 text-sm font-medium text-gray-800">Point {index + 1}</p>
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Point name *</label>
                        <input
                          type="text"
                          required
                          value={point.name}
                          onChange={(event) => {
                            const next = [...coords];
                            next[index] = { ...next[index], name: event.target.value };
                            setCoords(next);
                          }}
                          placeholder="e.g. Upstream gauge"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Latitude *</label>
                          <input
                            type="number"
                            required
                            step="any"
                            value={point.latitude}
                            onChange={(event) => {
                              const next = [...coords];
                              next[index] = { ...next[index], latitude: event.target.value };
                              setCoords(next);
                            }}
                            placeholder="e.g. 6.9271"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Longitude *</label>
                          <input
                            type="number"
                            required
                            step="any"
                            value={point.longitude}
                            onChange={(event) => {
                              const next = [...coords];
                              next[index] = { ...next[index], longitude: event.target.value };
                              setCoords(next);
                            }}
                            placeholder="e.g. 79.8612"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="drain-primary-button w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                Save sensor points
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
