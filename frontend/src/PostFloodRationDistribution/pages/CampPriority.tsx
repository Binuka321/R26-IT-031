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
    } catch (err: any) {
      alert(err.message || 'Failed to recalculate camp priorities');
    }
    finally { setRecalculating(false); }
  };

  if (loading) return <Loading message="Loading predictions..." />;

  const filteredPredictions = predictions.filter((prediction) => {
    const itemPriorities = prediction.item_priority || prediction.relief_priorities || {};
    const matchesPriority = !priorityFilter || prediction.priority_level === priorityFilter;
    const matchesItem =
      !itemFilter ||
      itemPriorities.food_priority === itemFilter ||
      itemPriorities.water_priority === itemFilter ||
      itemPriorities.medicine_priority === itemFilter ||
      itemPriorities.sanitary_priority === itemFilter;

    return matchesPriority && matchesItem;
  });

  const highCount = predictions.filter(p => p.priority_level === 'High').length;
  const mediumCount = predictions.filter(p => p.priority_level === 'Medium').length;
  const lowCount = predictions.filter(p => p.priority_level === 'Low').length;
  const averageConfidence = predictions.length
    ? Math.round(
        predictions.reduce((total, p) => total + Number(p.confidence_score || 0), 0) /
          predictions.length *
          100
      )
    : 0;

  return (
    <div>
      <PageHeader title="Camp Priority Prediction" subtitle="ML camp need analysis for rescue and ration distribution" icon="analytics"
        actions={
          <PrimaryButton onClick={handleRecalculate} icon="refresh" disabled={recalculating}>
            {recalculating ? 'Recalculating...' : 'Recalculate All'}
          </PrimaryButton>
        } />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className={`rounded-lg border p-4 shadow-sm ${
          mlStatus?.available
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-rose-200 bg-rose-50 text-rose-800'
        }`}>
          <div className="flex items-start gap-3">
            <span className="material-icons mt-0.5">
              {mlStatus?.available ? 'verified' : 'error'}
            </span>
            <div>
              <p className="text-sm font-bold">
                ML Service {mlStatus?.available ? 'Connected' : 'Unavailable'}
              </p>
              <p className="mt-1 text-xs">
                {mlStatus?.model_version || 'Model version unavailable'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="material-icons text-blue-600">model_training</span>
            <p>
              Predicts camp urgency plus food, water, medicine, and sanitary priorities. Quantities and routes are planned separately.
            </p>
          </div>
        </div>
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
            <div className="rounded-lg border border-rose-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="material-icons text-3xl text-rose-500">warning</span>
                <div>
                  <p className="text-2xl font-bold text-rose-700">{highCount}</p>
                  <p className="text-sm text-rose-500">High Priority</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="material-icons text-3xl text-amber-500">priority_high</span>
                <div>
                  <p className="text-2xl font-bold text-amber-700">{mediumCount}</p>
                  <p className="text-sm text-amber-500">Medium Priority</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="material-icons text-3xl text-emerald-500">check_circle</span>
                <div>
                  <p className="text-2xl font-bold text-emerald-700">{lowCount}</p>
                  <p className="text-sm text-emerald-500">Low Priority</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Prediction Worklist</p>
                <p className="text-xs text-gray-500">{filteredPredictions.length} visible camps | {averageConfidence}% avg confidence</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm"
            >
              <option value="">All camp priorities</option>
              <option value="High">High camp priority</option>
              <option value="Medium">Medium camp priority</option>
              <option value="Low">Low camp priority</option>
            </select>
            <select
              value={itemFilter}
              onChange={(e) => setItemFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm"
            >
              <option value="">All relief item priorities</option>
              <option value="High">Any item High</option>
              <option value="Medium">Any item Medium</option>
              <option value="Low">Any item Low</option>
            </select>
            </div>
          </div>

          {/* Predictions Table */}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-slate-50">
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
                  <tr key={p._id} className="border-b border-gray-100 transition-colors hover:bg-cyan-50/40">
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
                        <span className="rounded-md bg-blue-100 px-2 py-1 text-xs text-blue-700">{p.prediction_source}</span>
                        <span className="text-[11px] text-gray-500">{p.model_version || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {(p.item_priority || p.relief_priorities) && (
                        <div className="flex gap-1 flex-wrap">
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-700">Food: {(p.item_priority || p.relief_priorities).food_priority}</span>
                          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-700">Water: {(p.item_priority || p.relief_priorities).water_priority}</span>
                          <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs text-rose-700">Medicine: {(p.item_priority || p.relief_priorities).medicine_priority}</span>
                          <span className="rounded-md bg-cyan-50 px-2 py-0.5 text-xs text-cyan-700">Sanitary: {(p.item_priority || p.relief_priorities).sanitary_priority}</span>
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
        </div>
      )}
    </div>
  );
}
