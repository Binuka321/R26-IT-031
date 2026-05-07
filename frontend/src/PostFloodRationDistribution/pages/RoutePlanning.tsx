import React, { useEffect, useState } from 'react';
import { PageHeader, PrimaryButton, Loading, EmptyState, FormSelect } from '../components/UIComponents';
import * as api from '../services/api';

export default function RoutePlanning() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [camps, setCamps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedCamp, setSelectedCamp] = useState('');
  const [startLat, setStartLat] = useState(6.9271);
  const [startLng, setStartLng] = useState(79.8612);

  const load = () => {
    setLoading(true);
    Promise.all([api.getAllRoutes(), api.getCamps()])
      .then(([r, c]) => { setRoutes(r.data || []); setCamps(c.data || []); if (c.data?.length) setSelectedCamp(c.data[0]._id); })
      .catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleGenerate = async () => {
    if (!selectedCamp) return alert('Select a camp');
    setGenerating(true);
    try {
      await api.generateRoute({ camp_id: selectedCamp, start_latitude: startLat, start_longitude: startLng, route_type: 'Safest' });
      load();
    } catch (err: any) { alert(err.message); }
    finally { setGenerating(false); }
  };

  const getSafetyColor = (score: number) => score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-rose-600';
  const getSafetyBg = (score: number) => score >= 70 ? 'from-emerald-50 to-green-50 border-emerald-200' : score >= 40 ? 'from-amber-50 to-yellow-50 border-amber-200' : 'from-rose-50 to-pink-50 border-rose-200';

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title="Route Planning" subtitle="Plan safe routes for rescue and ration distribution" icon="route" />

      {/* Route Generator */}
      <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 mb-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="material-icons text-cyan-500">add_road</span>Generate New Route
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <FormSelect label="Destination Camp" value={selectedCamp} onChange={setSelectedCamp}
            options={camps.map(c => ({ value: c._id, label: c.camp_name }))} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Latitude</label>
            <input type="number" value={startLat} onChange={e => setStartLat(Number(e.target.value))} step="0.0001"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-300 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Longitude</label>
            <input type="number" value={startLng} onChange={e => setStartLng(Number(e.target.value))} step="0.0001"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-300 outline-none" />
          </div>
          <PrimaryButton onClick={handleGenerate} icon="route" disabled={generating}>
            {generating ? 'Generating...' : 'Generate Route'}
          </PrimaryButton>
        </div>
      </div>

      {/* Routes List */}
      {routes.length === 0 ? (
        <EmptyState icon="route" title="No routes generated" subtitle="Generate a route above" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {routes.map(r => {
            const campName = typeof r.camp_id === 'object' ? r.camp_id.camp_name : 'Unknown';
            return (
              <div key={r._id} className={`rounded-2xl p-5 shadow-lg border bg-gradient-to-br ${getSafetyBg(r.safety_score)} hover:shadow-xl transition-shadow`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-800">{r.route_name || `Route to ${campName}`}</h3>
                    <p className="text-sm text-gray-600">{r.route_type} Route</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${getSafetyColor(r.safety_score)}`}>{r.safety_score}</p>
                    <p className="text-xs text-gray-500">Safety Score</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center p-2 bg-white/60 rounded-xl">
                    <span className="material-icons text-sm text-blue-500">straighten</span>
                    <p className="text-sm font-bold text-gray-800">{r.distance} km</p>
                    <p className="text-xs text-gray-500">Distance</p>
                  </div>
                  <div className="text-center p-2 bg-white/60 rounded-xl">
                    <span className="material-icons text-sm text-purple-500">schedule</span>
                    <p className="text-sm font-bold text-gray-800">{r.estimated_time}</p>
                    <p className="text-xs text-gray-500">Est. Time</p>
                  </div>
                  <div className="text-center p-2 bg-white/60 rounded-xl">
                    <span className="material-icons text-sm text-cyan-500">pin_drop</span>
                    <p className="text-sm font-bold text-gray-800">{r.route_coordinates?.length || 0}</p>
                    <p className="text-xs text-gray-500">Waypoints</p>
                  </div>
                </div>
                {r.warnings && r.warnings.length > 0 && (
                  <div className="space-y-1">
                    {r.warnings.map((w: string, i: number) => (
                      <p key={i} className="text-xs text-amber-700 flex items-center gap-1">
                        <span className="material-icons text-xs">warning</span>{w}
                      </p>
                    ))}
                  </div>
                )}
                <div className="mt-3 pt-2 border-t border-gray-200/50">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${r.route_status === 'Active' ? 'bg-emerald-100 text-emerald-700' : r.route_status === 'Blocked' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                    {r.route_status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
