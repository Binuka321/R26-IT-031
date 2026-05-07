import React, { useEffect, useState } from 'react';
import { PageHeader, PrimaryButton, PriorityBadge, Loading, EmptyState } from '../components/UIComponents';
import * as api from '../services/api';

export default function CampPriority() {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [mlStatus, setMlStatus] = useState<any>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [priorityFilter, setPriorityFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");

  const load = () => {
    setLoading(true);
    Promise.allSettled([api.getAllPredictions(), api.getPostFloodMlStatus()])
      .then(([predictionResult, statusResult]) => {
        if (predictionResult.status === 'fulfilled') {
          setPredictions(predictionResult.value.data || []);
        }
        if (statusResult.status === 'fulfilled') {
          setMlStatus(statusResult.value.data);
        } else {
          setMlStatus({ available: false, status: 'UNAVAILABLE' });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const result = await api.recalculateAll();
      setLastResult(result);
      load();
    } catch (err: any) { alert(err.message); }
    finally { setRecalculating(false); }
  };

  if (loading) return <Loading message="Loading predictions..." />;

  const filteredPredictions = predictions.filter((prediction) => {
    const itemPriorities = prediction.relief_priorities || prediction.item_priority || {};
    const matchesPriority = !priorityFilter || prediction.priority_level === priorityFilter;
    const matchesItem =
      !itemFilter ||
      itemPriorities.food_priority === itemFilter ||
      itemPriorities.water_priority === itemFilter ||
      itemPriorities.medicine_priority === itemFilter ||
      itemPriorities.sanitary_priority === itemFilter;

    return matchesPriority && matchesItem;
  });

  return (
    <div>
      <PageHeader title="Camp Priority Prediction" subtitle="ML camp need analysis for rescue and ration distribution" icon="analytics"
        actions={
          <PrimaryButton onClick={handleRecalculate} icon="refresh" disabled={recalculating}>
            {recalculating ? 'Recalculating...' : 'Recalculate All'}
          </PrimaryButton>
        } />

      <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
        mlStatus?.available
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-rose-200 bg-rose-50 text-rose-700'
      }`}>
        ML Service: {mlStatus?.available ? 'Connected' : 'Unavailable'}
        {mlStatus?.model_version ? ` | ${mlStatus.model_version}` : ''}
      </div>

      <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        ML Predicted Outputs: camp priority, food priority, water priority, medicine priority, and sanitary priority. Route planning and recommended quantities are calculated separately.
      </div>

      {lastResult?.failed > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {lastResult.failed} camp record(s) could not be predicted. Check camp population, capacity, resources, and road access status.
        </div>
      )}

      {predictions.length === 0 ? (
        <EmptyState icon="analytics" title="No predictions yet" subtitle="Click 'Recalculate All' to generate predictions for all camps" />
      ) : (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl p-5 border border-rose-200 shadow-md">
              <div className="flex items-center gap-3">
                <span className="material-icons text-3xl text-rose-500">warning</span>
                <div>
                  <p className="text-2xl font-bold text-rose-700">{predictions.filter(p => p.priority_level === 'High').length}</p>
                  <p className="text-sm text-rose-500">High Priority</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-5 border border-amber-200 shadow-md">
              <div className="flex items-center gap-3">
                <span className="material-icons text-3xl text-amber-500">priority_high</span>
                <div>
                  <p className="text-2xl font-bold text-amber-700">{predictions.filter(p => p.priority_level === 'Medium').length}</p>
                  <p className="text-sm text-amber-500">Medium Priority</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-5 border border-emerald-200 shadow-md">
              <div className="flex items-center gap-3">
                <span className="material-icons text-3xl text-emerald-500">check_circle</span>
                <div>
                  <p className="text-2xl font-bold text-emerald-700">{predictions.filter(p => p.priority_level === 'Low').length}</p>
                  <p className="text-sm text-emerald-500">Low Priority</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm"
            >
              <option value="">All camp priorities</option>
              <option value="High">High camp priority</option>
              <option value="Medium">Medium camp priority</option>
              <option value="Low">Low camp priority</option>
            </select>
            <select
              value={itemFilter}
              onChange={(e) => setItemFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm"
            >
              <option value="">All relief item priorities</option>
              <option value="High">Any item High</option>
              <option value="Medium">Any item Medium</option>
              <option value="Low">Any item Low</option>
            </select>
          </div>

          {/* Predictions Table */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Camp</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Priority</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Score</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Confidence</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Source</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Relief Item Priorities</th>
                </tr>
              </thead>
              <tbody>
                {filteredPredictions.map(p => (
                  <tr key={p._id} className="border-b border-gray-50 hover:bg-cyan-50/30">
                    <td className="py-3 px-4 font-medium text-gray-800">{typeof p.camp_id === 'object' ? p.camp_id.camp_name : p.camp_id}</td>
                    <td className="py-3 px-4 text-center"><PriorityBadge level={p.priority_level} /></td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${p.priority_score >= 65 ? 'bg-rose-500' : p.priority_score >= 35 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${p.priority_score}%` }}></div>
                        </div>
                        <span className="font-bold text-gray-700">{p.priority_score}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600">{(p.confidence_score * 100).toFixed(0)}%</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">{p.prediction_source}</span>
                        <span className="text-[11px] text-gray-500">{p.model_version || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {(p.relief_priorities || p.item_priority) && (
                        <div className="flex gap-1 flex-wrap">
                          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">Food: {(p.relief_priorities || p.item_priority).food_priority}</span>
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Water: {(p.relief_priorities || p.item_priority).water_priority}</span>
                          <span className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full">Medicine: {(p.relief_priorities || p.item_priority).medicine_priority}</span>
                          <span className="text-xs bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full">Sanitary: {(p.relief_priorities || p.item_priority).sanitary_priority}</span>
                        </div>
                      )}
                      {typeof p.camp_id === 'object' && (
                        <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-gray-500">
                          <span>Pop: {p.camp_id.population}</span>
                          <span>Road: {p.camp_id.road_access_status || 'Good'}</span>
                          <span>Food stock: {p.camp_id.food_available}</span>
                          <span>Water stock: {p.camp_id.water_available}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
