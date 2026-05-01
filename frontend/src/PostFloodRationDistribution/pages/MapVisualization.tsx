import React, { useEffect, useState } from 'react';
import { PageHeader, Loading, PriorityBadge } from '../components/UIComponents';
import * as api from '../services/api';

export default function MapVisualization() {
  const [camps, setCamps] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPriority, setFilterPriority] = useState('');

  useEffect(() => {
    Promise.all([api.getCamps(), api.getSafeZones()])
      .then(([c, z]) => { setCamps(c.data || []); setZones(z.data || []); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading message="Loading map data..." />;

  const filtered = camps.filter(c => !filterPriority || c.priority_level === filterPriority);
  const priorityColor = (p: string) => p === 'High' ? 'bg-rose-500' : p === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500';
  const priorityRing = (p: string) => p === 'High' ? 'ring-rose-300' : p === 'Medium' ? 'ring-amber-300' : 'ring-emerald-300';

  return (
    <div>
      <PageHeader title="Map Visualization" subtitle="View camps, safe zones, and routes on the map" icon="map" />

      {/* Filter Bar */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-500">Filter by priority:</span>
        {['', 'High', 'Medium', 'Low'].map(p => (
          <button key={p} onClick={() => setFilterPriority(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterPriority === p ? 'bg-cyan-100 text-cyan-700 border border-cyan-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {p || 'All'}
          </button>
        ))}
      </div>

      {/* Map Container — Styled grid-based visualization */}
      <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 rounded-2xl p-6 shadow-lg border border-cyan-100 min-h-[500px] relative overflow-hidden">
        {/* Map Background Pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #0891b2 1px, transparent 0)', backgroundSize: '30px 30px' }}></div>

        {/* Legend */}
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-200 z-10">
          <h4 className="font-semibold text-gray-700 text-sm mb-2">Legend</h4>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-500"></div>High Priority</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div>Medium Priority</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div>Low Priority</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-400 ring-2 ring-blue-200"></div>Safe Zone</div>
          </div>
        </div>

        {/* Safe Zones */}
        <div className="relative z-0">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">Safe Zones & Camps</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {zones.map(zone => {
              const zoneCamps = filtered.filter(c => {
                const zId = typeof c.safe_zone_id === 'object' ? c.safe_zone_id._id : c.safe_zone_id;
                return zId === zone._id;
              });
              return (
                <div key={zone._id} className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border-2 border-blue-200 shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-4 h-4 rounded-full bg-blue-400 ring-2 ring-blue-200"></div>
                    <h4 className="font-semibold text-gray-800 text-sm">{zone.name}</h4>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">📍 {zone.latitude.toFixed(4)}, {zone.longitude.toFixed(4)} | R: {zone.radius_km}km</p>
                  <p className="text-xs text-gray-500 mb-3">👥 {zone.current_population}/{zone.capacity} capacity</p>

                  {zoneCamps.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No camps in this zone</p>
                  ) : (
                    <div className="space-y-2">
                      {zoneCamps.map(camp => (
                        <div key={camp._id} className={`flex items-center gap-2 p-2 rounded-xl bg-gray-50 border border-gray-100`}>
                          <div className={`w-3 h-3 rounded-full ${priorityColor(camp.priority_level)} ring-2 ${priorityRing(camp.priority_level)} animate-pulse`}></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{camp.camp_name}</p>
                            <p className="text-xs text-gray-500">Pop: {camp.population}</p>
                          </div>
                          <PriorityBadge level={camp.priority_level} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Info Banner */}
        <div className="mt-6 bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-cyan-200 text-center">
          <p className="text-sm text-gray-600">
            <span className="material-icons text-sm text-cyan-500 align-middle">info</span>
            {' '}Showing {filtered.length} camps across {zones.length} safe zones.
            {' '}For full interactive map, integrate with Leaflet.js map component.
          </p>
        </div>
      </div>
    </div>
  );
}
