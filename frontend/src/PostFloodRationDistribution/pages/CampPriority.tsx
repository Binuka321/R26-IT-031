import React, { useEffect, useState } from 'react';
import { PageHeader, PrimaryButton, PriorityBadge, Loading, EmptyState } from '../components/UIComponents';
import * as api from '../services/api';

export default function CampPriority() {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  const load = () => {
    setLoading(true);
    api.getAllPredictions().then(r => setPredictions(r.data || [])).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await api.recalculateAll();
      load();
    } catch (err: any) { alert(err.message); }
    finally { setRecalculating(false); }
  };

  if (loading) return <Loading message="Loading predictions..." />;

  return (
    <div>
      <PageHeader title="Camp Priority Prediction" subtitle="ML/Rule-based camp priority classification" icon="analytics"
        actions={
          <PrimaryButton onClick={handleRecalculate} icon="refresh" disabled={recalculating}>
            {recalculating ? 'Recalculating...' : 'Recalculate All'}
          </PrimaryButton>
        } />

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
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Factor Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {predictions.map(p => (
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
                      <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">{p.prediction_source}</span>
                    </td>
                    <td className="py-3 px-4">
                      {p.factors && (
                        <div className="flex gap-1 flex-wrap">
                          <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">Pop: {p.factors.population_score}</span>
                          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">Res: {p.factors.resource_shortage_score}</span>
                          <span className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full">Dis: {p.factors.disease_risk_score}</span>
                          <span className="text-xs bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full">Vul: {p.factors.vulnerable_population_score}</span>
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
