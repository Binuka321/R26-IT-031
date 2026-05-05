import { useEffect, useState } from 'react';
import { X, MapPin, Cpu, Droplets, Wind, CloudRain, Waves } from 'lucide-react';
import type { SensorPackage } from './types';

interface CreatePackageModalProps {
  onClose: () => void;
  onCreate: (pkg: Omit<SensorPackage, 'id' | 'status' | 'lastUpdate' | 'currentReadings'>) => void | Promise<void>;
  /** Set by parent when the API returns an error */
  serverError?: string | null;
  initialPackage?: SensorPackage | null;
  title?: string;
  submitLabel?: string;
}

const riverBasinData = [
  {
    basin: 'Kelani Ganga (RB 01)',
    rivers: [
      { name: 'Kelani Ganga', stations: ['Nagalagam Street', 'Hanwella', 'Glencourse', 'Kithulgala'] },
      { name: 'Gurugoda Oya', stations: ['Holombuwa'] },
      { name: 'Seethawaka Ganga', stations: ['Daraniyagala'] },
      { name: 'Kehelgamu Oya', stations: ['Norwood'] }
    ]
  },
  {
    basin: 'Kalu Ganga (RB 03)',
    rivers: [
      { name: 'Kalu Ganga', stations: ['Putupaula', 'Ellangawa', 'Rathnapura'] },
      { name: 'Maguru Ganga', stations: ['Magura'] },
      { name: 'Kuda Ganga', stations: ['Kalawellawa'] }
    ]
  },
  {
    basin: 'Gin Ganga (RB 09)',
    rivers: [{ name: 'Gin Ganga', stations: ['Baddegama', 'Thawalama'] }]
  },
  {
    basin: 'Nilwala Ganga (RB 12)',
    rivers: [
      { name: 'Nilwala Ganga', stations: ['Thalgahagoda', 'Panadugama', 'Pitabeddara'] },
      { name: 'Urubokka Ganga', stations: ['Urawa'] }
    ]
  },
  {
    basin: 'Walawe Ganga (RB 18)',
    rivers: [{ name: 'Walawe Ganga', stations: ['Moraketiya'] }]
  },
  {
    basin: 'Kirindi Oya (RB 22)',
    rivers: [
      { name: 'Kirindi Oya', stations: ['Thanamalwila', 'Wellawaya'] },
      { name: 'Kuda Oya', stations: ['Kuda Oya'] }
    ]
  },
  {
    basin: 'Menik Ganga (RB 26)',
    rivers: [{ name: 'Menik Ganga', stations: ['Katharagama'] }]
  },
  {
    basin: 'Kumbukkan Oya (RB 31)',
    rivers: [{ name: 'Kumbukkan Oya', stations: ['Nakkala'] }]
  },
  {
    basin: 'Heda Oya (RB 36)',
    rivers: [{ name: 'Heda Oya', stations: ['Siyambalanduwa'] }]
  },
  {
    basin: 'Maduru Oya (RB 54)',
    rivers: [{ name: 'Maduru Oya', stations: ['Padiyathalawa'] }]
  },
  {
    basin: 'Mahaweli Ganga (RB 60)',
    rivers: [
      { name: 'Mahaweli Ganga', stations: ['Manampitiya', 'Weraganthota', 'Peradeniya', 'Nawalapitiya'] },
      { name: 'Badulu Oya', stations: ['Thaldena'] }
    ]
  },
  {
    basin: 'Yan Oya (RB 67)',
    rivers: [{ name: 'Yan Oya', stations: ['Horowpothana'] }]
  },
  {
    basin: 'Maa Oya (RB 69)',
    rivers: [{ name: 'Mukunu Oya', stations: ['Yaka Wewa'] }]
  },
  {
    basin: 'Malwathu Oya (RB 90)',
    rivers: [{ name: 'Malwathu Oya', stations: ['Thanthirimale'] }]
  },
  {
    basin: 'Mee Oya (RB 95)',
    rivers: [{ name: 'Mee Oya', stations: ['Galgamuwa'] }]
  },
  {
    basin: 'Deduru Oya (RB 99)',
    rivers: [{ name: 'Deduru Oya', stations: ['Moragaswewa'] }]
  },
  {
    basin: 'Maha Oya (RB 102)',
    rivers: [{ name: 'Maha Oya', stations: ['Badalgama', 'Giriulla'] }]
  },
  {
    basin: 'Attanagalu Oya (RB 103)',
    rivers: [{ name: 'Attanagalu Oya', stations: ['Dunamale'] }]
  }
];

function createInitialFormData(initialPackage?: SensorPackage | null) {
  return {
    name: initialPackage?.name ?? '',
    basin: initialPackage?.location.basin ?? '',
    river: initialPackage?.location.river ?? '',
    station: initialPackage?.location.station ?? '',
    latitude: initialPackage?.location.latitude !== undefined ? String(initialPackage.location.latitude) : '',
    longitude: initialPackage?.location.longitude !== undefined ? String(initialPackage.location.longitude) : '',
    address: initialPackage?.location.address ?? '',
    ultrasonic: initialPackage?.sensors.ultrasonic ?? 0,
    flow: initialPackage?.sensors.flow ?? 0,
    rain: initialPackage?.sensors.rain ?? 0,
    turbidity: initialPackage?.sensors.turbidity ?? 0,
    waterUnit: initialPackage?.waterLevelSettings?.unit ?? ('m' as 'ft' | 'm'),
    alertLevel:
      initialPackage?.waterLevelSettings?.alertLevel !== undefined
        ? String(initialPackage.waterLevelSettings.alertLevel)
        : '',
    minorFloodLevel:
      initialPackage?.waterLevelSettings?.minorFloodLevel !== undefined
        ? String(initialPackage.waterLevelSettings.minorFloodLevel)
        : '',
    majorFloodLevel:
      initialPackage?.waterLevelSettings?.majorFloodLevel !== undefined
        ? String(initialPackage.waterLevelSettings.majorFloodLevel)
        : '',
    esp32: initialPackage?.boards.esp32 ?? false,
    uno: initialPackage?.boards.uno ?? false
  };
}

export function CreatePackageModal({
  onClose,
  onCreate,
  serverError,
  initialPackage = null,
  title = 'Create Sensor Package',
  submitLabel = 'Create Package'
}: CreatePackageModalProps) {
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState(() => createInitialFormData(initialPackage));
  const selectedBasinData = riverBasinData.find((item) => item.basin === formData.basin);
  const riverOptions = selectedBasinData?.rivers ?? [];
  const selectedRiverData = riverOptions.find((item) => item.name === formData.river);
  const stationOptions = selectedRiverData?.stations ?? [];

  useEffect(() => {
    setFormData(createInitialFormData(initialPackage));
  }, [initialPackage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.esp32 && !formData.uno) {
      setFormError('Select at least one board (ESP32 or UNO).');
      return;
    }

    if (formData.ultrasonic > 0) {
      const alertN = parseFloat(formData.alertLevel);
      const minorN = parseFloat(formData.minorFloodLevel);
      const majorN = parseFloat(formData.majorFloodLevel);
      if (Number.isNaN(alertN) || Number.isNaN(minorN) || Number.isNaN(majorN)) {
        setFormError('Enter Alert Level, Minor Flood Level, and Major Flood Level as numbers.');
        return;
      }
      if (alertN < 0 || minorN < 0 || majorN < 0) {
        setFormError('Water level thresholds must not be negative.');
        return;
      }
    }

    const newPackage: Omit<SensorPackage, 'id' | 'status' | 'lastUpdate' | 'currentReadings'> = {
      name: formData.name,
      location: {
        name: `${formData.river} - ${formData.station}`,
        basin: formData.basin,
        river: formData.river,
        station: formData.station,
        latitude: parseFloat(formData.latitude) || 0,
        longitude: parseFloat(formData.longitude) || 0,
        address: formData.address
      },
      sensors: {
        ultrasonic: formData.ultrasonic,
        flow: formData.flow,
        rain: formData.rain,
        turbidity: formData.turbidity
      },
      boards: {
        esp32: formData.esp32,
        uno: formData.uno
      },
      ...(formData.ultrasonic > 0
        ? {
            waterLevelSettings: {
              unit: formData.waterUnit,
              alertLevel: parseFloat(formData.alertLevel)!,
              minorFloodLevel: parseFloat(formData.minorFloodLevel)!,
              majorFloodLevel: parseFloat(formData.majorFloodLevel)!
            }
          }
        : {})
    };

    onCreate(newPackage);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-linear-to-r from-blue-600 to-cyan-600 text-white p-6 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-2xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {(formError || serverError) && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              {formError || serverError}
            </div>
          )}
          {/* Package Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Package Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., River Station Alpha"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Location Section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="text-blue-600" size={20} />
              <h3 className="font-semibold text-gray-900">Location Details</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  River Basin *
                </label>
                <select
                  required
                  value={formData.basin}
                  onChange={(e) => setFormData({ ...formData, basin: e.target.value, river: '', station: '' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a river basin</option>
                  {riverBasinData.map((item) => (
                    <option key={item.basin} value={item.basin}>
                      {item.basin}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  River *
                </label>
                <select
                  required
                  value={formData.river}
                  onChange={(e) => setFormData({ ...formData, river: e.target.value, station: '' })}
                  disabled={!formData.basin}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">Select a river</option>
                  {riverOptions.map((river) => (
                    <option key={river.name} value={river.name}>
                      {river.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Station *
                </label>
                <select
                  required
                  value={formData.station}
                  onChange={(e) => setFormData({ ...formData, station: e.target.value })}
                  disabled={!formData.river}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">Select a station</option>
                  {stationOptions.map((station) => (
                    <option key={station} value={station}>
                      {station}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Latitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    placeholder="6.9271"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Longitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="79.8612"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address *
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g., Colombo District, Western Province"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Sensors Section */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Select Sensors</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <Droplets className="text-blue-600" size={20} />
                  <span className="font-medium text-gray-700">Ultrasonic Sensor</span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={formData.ultrasonic}
                  onChange={(e) => setFormData({ ...formData, ultrasonic: parseInt(e.target.value, 10) || 0 })}
                  placeholder="Number of sensors"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Use 1 or more to enable water level monitoring. Levels below are required when count is 1+.
                </p>
              </div>

              <div className="p-4 border-2 border-gray-200 rounded-lg hover:border-cyan-400 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <Wind className="text-cyan-600" size={20} />
                  <span className="font-medium text-gray-700">Flow Sensor</span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={formData.flow}
                  onChange={(e) => setFormData({ ...formData, flow: parseInt(e.target.value) || 0 })}
                  placeholder="Number of sensors"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>

              <div className="p-4 border-2 border-gray-200 rounded-lg hover:border-indigo-400 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <CloudRain className="text-indigo-600" size={20} />
                  <span className="font-medium text-gray-700">Rain Sensor</span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={formData.rain}
                  onChange={(e) => setFormData({ ...formData, rain: parseInt(e.target.value) || 0 })}
                  placeholder="Number of sensors"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div className="p-4 border-2 border-gray-200 rounded-lg hover:border-teal-400 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <Waves className="text-teal-600" size={20} />
                  <span className="font-medium text-gray-700">Turbidity Sensor</span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={formData.turbidity}
                  onChange={(e) => setFormData({ ...formData, turbidity: parseInt(e.target.value) || 0 })}
                  placeholder="Number of sensors"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div
            className={`mb-6 p-4 border-2 rounded-xl ${
              formData.ultrasonic > 0
                ? 'border-blue-200 bg-blue-50/50'
                : 'border-amber-200 bg-amber-50/40'
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <Droplets className="text-blue-600" size={20} />
              <h3 className="font-semibold text-gray-900">Water level thresholds</h3>
            </div>
            {formData.ultrasonic <= 0 ? (
              <p className="text-sm text-amber-900 mb-4">
                You can fill these now. They are saved only when <strong>Ultrasonic Sensor</strong> count is{' '}
                <strong>1 or more</strong> (required in that case before create).
              </p>
            ) : (
              <p className="text-sm text-gray-600 mb-4">
                Shown on the water level chart; use the same unit as your sensor readings.
              </p>
            )}
            <div className="space-y-4 min-w-0">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Unit {formData.ultrasonic > 0 ? '*' : ''}</label>
                <select
                  required={formData.ultrasonic > 0}
                  value={formData.waterUnit}
                  onChange={(e) => setFormData({ ...formData, waterUnit: e.target.value as 'ft' | 'm' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="m">m (metres)</option>
                  <option value="ft">ft (feet)</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Alert Level {formData.ultrasonic > 0 ? '*' : ''}</label>
                  <input
                    type="number"
                    step="any"
                    required={formData.ultrasonic > 0}
                    value={formData.alertLevel}
                    onChange={(e) => setFormData({ ...formData, alertLevel: e.target.value })}
                    placeholder="e.g. 2.5"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Minor Flood Level {formData.ultrasonic > 0 ? '*' : ''}</label>
                  <input
                    type="number"
                    step="any"
                    required={formData.ultrasonic > 0}
                    value={formData.minorFloodLevel}
                    onChange={(e) => setFormData({ ...formData, minorFloodLevel: e.target.value })}
                    placeholder="e.g. 3.0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Major Flood Level {formData.ultrasonic > 0 ? '*' : ''}</label>
                  <input
                    type="number"
                    step="any"
                    required={formData.ultrasonic > 0}
                    value={formData.majorFloodLevel}
                    onChange={(e) => setFormData({ ...formData, majorFloodLevel: e.target.value })}
                    placeholder="e.g. 4.0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Board Selection */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="text-blue-600" size={20} />
              <h3 className="font-semibold text-gray-900">Select Boards *</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                formData.esp32
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-400'
              }`}>
                <input
                  type="checkbox"
                  checked={formData.esp32}
                  onChange={(e) => setFormData({ ...formData, esp32: e.target.checked })}
                  className="sr-only"
                />
                <div className="text-center">
                  <div className="font-bold text-lg mb-1">ESP32</div>
                  <div className="text-sm text-gray-600">Wi-Fi & Bluetooth</div>
                  {formData.esp32 && (
                    <div className="mt-2 inline-block px-2 py-1 bg-blue-600 text-white text-xs rounded">
                      Selected
                    </div>
                  )}
                </div>
              </label>

              <label className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                formData.uno
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-400'
              }`}>
                <input
                  type="checkbox"
                  checked={formData.uno}
                  onChange={(e) => setFormData({ ...formData, uno: e.target.checked })}
                  className="sr-only"
                />
                <div className="text-center">
                  <div className="font-bold text-lg mb-1">UNO Board</div>
                  <div className="text-sm text-gray-600">Arduino Compatible</div>
                  {formData.uno && (
                    <div className="mt-2 inline-block px-2 py-1 bg-blue-600 text-white text-xs rounded">
                      Selected
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg hover:shadow-xl"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
