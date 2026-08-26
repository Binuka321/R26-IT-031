import { useState, useEffect, useCallback } from 'react';
import { Activity, Waves, MapPin, AlertTriangle, CheckCircle } from 'lucide-react';
import { SensorPackageCard, MonitoringView, CreatePackageModal } from './components';
import { FloodWarningPanel } from './FloodWarningPanel';
import { getAggregateFloodRisk, getPackageFloodAlerts } from './floodRisk';
import type { SensorPackage } from './types';
import {
  fetchSensorPackages,
  createSensorPackage,
  updateSensorPackage,
  deleteSensorPackage,
  setPackageIngestEnabled
} from './sensorPackageApi';

export type { SensorPackage } from './types';

export interface DashboardProps {
  /** JWT from login; required to load and create sensor packages */
  authToken: string;
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

export function Dashboard({ authToken }: DashboardProps) {
  const [view, setView] = useState<'overview' | 'monitoring'>('overview');
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingPackage, setEditingPackage] = useState<SensorPackage | null>(null);
  const [selectedBasin, setSelectedBasin] = useState('');
  const [selectedRiver, setSelectedRiver] = useState('');
  const [selectedStation, setSelectedStation] = useState('');
  const [packages, setPackages] = useState<SensorPackage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activePackages = packages.filter(p => p.status === 'active').length;
  const floodAlerts = getPackageFloodAlerts(packages);
  const warningPackages = floodAlerts.length;
  const aggregateFloodRisk = getAggregateFloodRisk(packages);

  const loadPackages = useCallback(async (silent = false) => {
    if (!authToken) {
      setLoadError('Not signed in.');
      setLoading(false);
      return;
    }
    setLoadError(null);
    if (!silent) setLoading(true);
    try {
      const list = await fetchSensorPackages(authToken);
      setPackages(list);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load sensor packages');
      if (!silent) setPackages([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    loadPackages();
    const interval = setInterval(() => loadPackages(true), 5000);
    return () => clearInterval(interval);
  }, [loadPackages]);

  const handleViewMonitoring = (packageId: string) => {
    setSelectedPackage(packageId);
    setView('monitoring');
  };

  const handleCreatePackage = async (pkg: Omit<SensorPackage, 'id' | 'status' | 'lastUpdate' | 'currentReadings'>) => {
    setCreateError(null);
    try {
      await createSensorPackage(authToken, pkg);
      setShowCreateModal(false);
      await loadPackages();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Could not create sensor package');
    }
  };

  const handleUpdatePackage = async (pkg: Omit<SensorPackage, 'id' | 'status' | 'lastUpdate' | 'currentReadings'>) => {
    if (!editingPackage) return;
    setCreateError(null);
    try {
      await updateSensorPackage(authToken, editingPackage.id, pkg);
      setEditingPackage(null);
      await loadPackages();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Could not update sensor package');
    }
  };

  const handleDeletePackage = async (id: string) => {
    const confirmed = window.confirm('Delete this sensor package? This will also delete related readings.');
    if (!confirmed) return;
    try {
      await deleteSensorPackage(authToken, id);
      if (selectedPackage === id) {
        setSelectedPackage(null);
        setView('overview');
      }
      await loadPackages();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not delete sensor package');
    }
  };

  const handleToggleIngest = async (id: string, ingestEnabled: boolean) => {
    try {
      await setPackageIngestEnabled(authToken, id, ingestEnabled);
      await loadPackages();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not toggle data collection');
    }
  };

  const selectedBasinData = riverBasinData.find((item) => item.basin === selectedBasin);
  const riverOptions = selectedBasinData?.rivers ?? [];
  const selectedRiverData = riverOptions.find((item) => item.name === selectedRiver);
  const stationOptions = selectedRiverData?.stations ?? [];
  const hasCompleteSelection = Boolean(selectedBasin && selectedRiver && selectedStation);
  const normalize = (value: string | undefined) => (value ?? '').trim().toLowerCase();
  const filteredPackages = hasCompleteSelection
    ? packages.filter(
        (pkg) => {
          const basinMatch = normalize(pkg.location.basin) === normalize(selectedBasin);
          const riverMatch = normalize(pkg.location.river) === normalize(selectedRiver);
          const stationMatch = normalize(pkg.location.station) === normalize(selectedStation);
          const legacyLocationMatch =
            normalize(pkg.location.name) === normalize(`${selectedRiver} - ${selectedStation}`);

          return (basinMatch && riverMatch && stationMatch) || legacyLocationMatch;
        }
      )
    : packages;

  if (view === 'monitoring' && selectedPackage) {
    const pkg = packages.find(p => p.id === selectedPackage);
    if (pkg) {
      return (
        <MonitoringView
          package={pkg}
          authToken={authToken}
          onBack={() => {
            setView('overview');
            setSelectedPackage(null);
          }}
        />
      );
    }
  }

  return (
    <div className="drain-module min-h-screen overflow-x-hidden bg-linear-to-br from-blue-50 via-cyan-50 to-teal-50 p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900 sm:text-3xl lg:text-4xl">
                <Waves className="shrink-0 text-blue-600" size={36} />
                Flood Detection System
              </h1>
              <p className="text-gray-600 mt-2">Real-time IoT sensor monitoring and flood prediction</p>
            </div>
            <div className="w-full lg:max-w-sm">
              <label htmlFor="basin-select" className="block text-sm font-medium text-gray-700 mb-2">
                Select River...
              </label>
              <select
                id="basin-select"
                value={selectedBasin}
                onChange={(event) => {
                  setSelectedBasin(event.target.value);
                  setSelectedRiver('');
                  setSelectedStation('');
                }}
                className="drain-field w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a river basin</option>
                {riverBasinData.map((item) => (
                  <option key={item.basin} value={item.basin}>
                    {item.basin}
                  </option>
                ))}
              </select>
              <select
                id="river-select"
                value={selectedRiver}
                onChange={(event) => {
                  setSelectedRiver(event.target.value);
                  setSelectedStation('');
                }}
                disabled={!selectedBasin}
                className="drain-field mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">Select a river</option>
                {riverOptions.map((river) => (
                  <option key={river.name} value={river.name}>
                    {river.name}
                  </option>
                ))}
              </select>
              <select
                id="station-select"
                value={selectedStation}
                onChange={(event) => setSelectedStation(event.target.value)}
                disabled={!selectedRiver}
                className="drain-field mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">Select a station</option>
                {stationOptions.map((station) => (
                  <option key={station} value={station}>
                    {station}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm flex flex-wrap items-center justify-between gap-3">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => loadPackages()}
              className="shrink-0 rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        )}

        {loading && !loadError && (
          <p className="text-gray-600 mb-6" role="status">
            Loading sensor packages…
          </p>
        )}

        {/* Stats Overview */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <div className="drain-card bg-white rounded-xl shadow-lg p-4 sm:p-5 lg:p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Total Packages</p>
                <p className="text-2xl font-bold text-gray-900 sm:text-3xl">{packages.length}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <MapPin className="text-blue-600" size={28} />
              </div>
            </div>
          </div>

          <div className="drain-card bg-white rounded-xl shadow-lg p-4 sm:p-5 lg:p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Active Sensors</p>
                <p className="text-2xl font-bold text-gray-900 sm:text-3xl">{activePackages}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle className="text-green-600" size={28} />
              </div>
            </div>
          </div>

          <div className="drain-card bg-white rounded-xl shadow-lg p-4 sm:p-5 lg:p-6 border-l-4 border-amber-400">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Warnings</p>
                <p className="text-2xl font-bold text-gray-900 sm:text-3xl">{warningPackages}</p>
              </div>
              <div className="bg-amber-100 p-3 rounded-lg">
                <AlertTriangle className="text-amber-700" size={28} />
              </div>
            </div>
          </div>

          <div className="drain-card bg-white rounded-xl shadow-lg p-4 sm:p-5 lg:p-6 border-l-4 border-cyan-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Flood Risk</p>
                <p className={`text-2xl font-bold sm:text-3xl ${aggregateFloodRisk.className}`}>{aggregateFloodRisk.label}</p>
              </div>
              <div className="bg-cyan-100 p-3 rounded-lg">
                <Activity className="text-cyan-700" size={28} />
              </div>
            </div>
          </div>
        </div>

        <FloodWarningPanel alerts={floodAlerts} onViewPackage={handleViewMonitoring} />

        {/* Sensor Packages Grid */}
        <div className="mb-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Sensor Packages</h2>
            <button
              type="button"
              onClick={() => {
                setCreateError(null);
                setShowCreateModal(true);
              }}
              className="drain-primary-button w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 sm:w-auto"
            >
              Create Sensor Package
            </button>
          </div>
          {!loading && !loadError && !hasCompleteSelection && packages.length > 0 && (
            <p className="text-gray-600 text-sm mb-4">
              Showing all sensor packages. Select river basin, river, and station to filter.
            </p>
          )}
          {!loading && !loadError && filteredPackages.length === 0 && (
            <p className="text-gray-600 text-sm mb-4">No sensor packages available.</p>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 lg:gap-6">
            {filteredPackages.map(pkg => (
              <SensorPackageCard
                key={pkg.id}
                package={pkg}
                onViewDetails={handleViewMonitoring}
                onEdit={(item) => {
                  setCreateError(null);
                  setEditingPackage(item);
                }}
                onDelete={handleDeletePackage}
                onToggleIngest={handleToggleIngest}
              />
            ))}
          </div>
        </div>
      </div>
      {showCreateModal && (
        <CreatePackageModal
          onClose={() => {
            setShowCreateModal(false);
            setCreateError(null);
          }}
          onCreate={handleCreatePackage}
          serverError={createError}
        />
      )}
      {editingPackage && (
        <CreatePackageModal
          onClose={() => {
            setEditingPackage(null);
            setCreateError(null);
          }}
          onCreate={handleUpdatePackage}
          serverError={createError}
          initialPackage={editingPackage}
          title="Edit Sensor Package"
          submitLabel="Save Changes"
        />
      )}

    </div>
  );
}
