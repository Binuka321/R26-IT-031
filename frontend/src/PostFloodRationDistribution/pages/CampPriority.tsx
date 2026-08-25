import React, { useEffect, useState, useMemo } from 'react';
import {
  PageHeader, PrimaryButton, SecondaryButton, PriorityBadge, UrgencyScoreBar,
  UrgencyRankBadge, Loading, EmptyState
} from '../components/UIComponents';
import * as api from '../services/api';
import { useLiveRefresh } from '../utils/useLiveRefresh';
import { exportRowsToCsv, exportRowsToPdf } from '../utils/exportUtils';

// ─── helpers ────────────────────────────────────────────────────────────────

function getUrgencyTier(score: number): { label: string; cls: string; bg: string } {
  if (score >= 70) return { label: 'Critical', cls: 'text-rose-700', bg: 'bg-rose-50 border-rose-300' };
  if (score >= 45) return { label: 'Moderate', cls: 'text-amber-700', bg: 'bg-amber-50 border-amber-300' };
  return { label: 'Stable', cls: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300' };
}

function explanationTone(severity: string) {
  if (severity === 'High') return 'border-rose-300 bg-rose-50 text-rose-800';
  if (severity === 'Medium') return 'border-amber-300 bg-amber-50 text-amber-800';
  return 'border-emerald-300 bg-emerald-50 text-emerald-800';
}

function getRankingTieBreaker(prediction: any) {
  const factors = prediction.factors || {};
  return (
    Number(prediction.need_report_impact?.impact_score || factors.need_report_impact_score || 0) * 0.35 +
    Number(factors.resource_shortage_score || 0) * 0.25 +
    Number(factors.vulnerable_population_score || 0) * 0.2 +
    Number(factors.road_access_score || 0) * 0.15 +
    Number(factors.last_distribution_score || 0) * 0.05
  );
}

// Mini inline sparkline bar for factor breakdown
function FactorBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-cyan-950/70">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-cyan-50 w-7 text-right">{value}</span>
    </div>
  );
}

// Score distribution histogram (10 buckets: 0-9, 10-19 … 90-100)
function ScoreHistogram({ predictions }: { predictions: any[] }) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    label: `${i * 10}–${i * 10 + 9}`,
    count: predictions.filter(p => {
      const s = Number(p.priority_score || 0);
      return s >= i * 10 && s < (i + 1) * 10;
    }).length,
  }));
  const max = Math.max(...buckets.map(b => b.count), 1);
  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-cyan-50">
        Urgency Score Distribution
      </p>
      <div className="flex items-end gap-1 h-16">
        {buckets.map((b, i) => {
          const pct = (b.count / max) * 100;
          const color =
            i >= 7 ? 'bg-rose-500' :
            i >= 4 ? 'bg-amber-400' :
            'bg-emerald-400';
          return (
            <div key={b.label} className="flex flex-1 flex-col items-center gap-0.5" title={`${b.label}: ${b.count} camp(s)`}>
              <div className="w-full flex items-end justify-center" style={{ height: 48 }}>
                <div
                  className={`w-full rounded-t ${color} transition-all duration-500`}
                  style={{ height: `${Math.max(pct, b.count > 0 ? 8 : 0)}%` }}
                />
              </div>
              <span className="text-[9px] font-bold text-cyan-100 leading-none">{i * 10}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[9px] font-semibold text-cyan-100">
        <span>Low urgency (0)</span>
        <span>High urgency (100)</span>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function CampPriority() {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [mlStatus, setMlStatus] = useState<any>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'confidence'>('score');

  const load = (showLoading = false) => {
    if (showLoading) setLoading(true);
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
      .finally(() => {
        if (showLoading) setLoading(false);
      });
  };
  useEffect(() => {
    load(true);
  }, []);
  useLiveRefresh(() => load(false), [], 30000, !recalculating);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const result = await api.recalculateAll();
      setLastResult(result);
      load(false);
    } catch (err: any) {
      alert(err.message || 'Failed to recalculate camp priorities');
    } finally {
      setRecalculating(false);
    }
  };

  const getCampId = (prediction: any) =>
    typeof prediction.camp_id === 'object' ? prediction.camp_id._id : prediction.camp_id;

  const handleWhatIf = async (prediction: any) => {
    const campId = getCampId(prediction);
    const food = Number(prompt("Food quantity to simulate", "0") || 0);
    const water = Number(prompt("Water quantity to simulate", "0") || 0);
    const medicine = Number(prompt("Medicine quantity to simulate", "0") || 0);
    const sanitary = Number(prompt("Sanitary quantity to simulate", "0") || 0);
    try {
      const result = await api.simulatePriorityWhatIf({
        camp_id: campId,
        proposed_resources: { food, water, medicine, sanitary },
      });
      alert(result.data?.interpretation || "Simulation completed.");
    } catch (err: any) {
      alert(err.message || "Simulation failed");
    }
  };

  const handleOverride = async (prediction: any) => {
    const campId = getCampId(prediction);
    const priority_level = prompt("Override priority level: Low, Medium, or High", prediction.priority_level);
    if (!priority_level) return;
    const priority_score = Number(prompt("Override urgency score 0-100", String(prediction.priority_score || 0)) || prediction.priority_score || 0);
    const reason = prompt("Reason for override") || "";
    if (!reason.trim()) return alert("Override reason is required");
    try {
      await api.overrideCampPriority({ camp_id: campId, priority_level, priority_score, reason });
      load(false);
    } catch (err: any) {
      alert(err.message || "Override failed");
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const avgScore = useMemo(() => {
    if (!predictions.length) return 0;
    return Math.round(predictions.reduce((s, p) => s + Number(p.priority_score || 0), 0) / predictions.length);
  }, [predictions]);

  const avgConfidence = useMemo(() => {
    if (!predictions.length) return 0;
    return Math.round(predictions.reduce((t, p) => t + Number(p.confidence_score || 0), 0) / predictions.length * 100);
  }, [predictions]);

  const criticalCount = predictions.filter(p => Number(p.priority_score) >= 70).length;
  const moderateCount = predictions.filter(p => Number(p.priority_score) >= 45 && Number(p.priority_score) < 70).length;
  const stableCount   = predictions.filter(p => Number(p.priority_score) < 45).length;
  const topCamp       = predictions.length ? predictions[0] : null;

  // ── Filtered + sorted list ─────────────────────────────────────────────────
  const filteredPredictions = useMemo(() => {
    let list = predictions.filter(p => {
      const score = Number(p.priority_score || 0);
      const itemP = p.item_priority || p.relief_priorities || {};
      const matchesPriority = !priorityFilter || p.priority_level === priorityFilter;
      const matchesItem =
        !itemFilter ||
        itemP.food_priority === itemFilter ||
        itemP.water_priority === itemFilter ||
        itemP.medicine_priority === itemFilter ||
        itemP.sanitary_priority === itemFilter;
      const matchesScore = score >= scoreMin && score <= scoreMax;
      return matchesPriority && matchesItem && matchesScore;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === 'confidence') {
        return Number(b.confidence_score) - Number(a.confidence_score);
      }
      const scoreDiff = Number(b.priority_score) - Number(a.priority_score);
      if (scoreDiff !== 0) return scoreDiff;
      return getRankingTieBreaker(b) - getRankingTieBreaker(a);
    });
    return list;
  }, [predictions, priorityFilter, itemFilter, scoreMin, scoreMax, sortBy]);

  const getCampName = (prediction: any) =>
    prediction.camp_id && typeof prediction.camp_id === "object"
      ? prediction.camp_id.camp_name
      : prediction.camp_id || "Unknown camp";

  const exportLeaderboard = (format: "csv" | "pdf") => {
    const rows = filteredPredictions.map((p, index) => ({
      rank: index + 1,
      camp: getCampName(p),
      tier: getUrgencyTier(Number(p.priority_score || 0)).label,
      score: Number(p.priority_score || 0),
      agreement: `${Math.round(Number(p.confidence_score || 0) * 100)}%`,
      source: p.is_manual_override || p.override_reason ? "Manual override" : p.prediction_source === "ml_model" ? "ML" : "Fallback",
      model: p.model_version || "N/A",
      food: (p.item_priority || p.relief_priorities || {}).food_priority || "N/A",
      water: (p.item_priority || p.relief_priorities || {}).water_priority || "N/A",
      medicine: (p.item_priority || p.relief_priorities || {}).medicine_priority || "N/A",
      sanitary: (p.item_priority || p.relief_priorities || {}).sanitary_priority || "N/A",
      lastSync: p.updatedAt || p.updated_at || p.createdAt || p.created_at || "",
    }));
    const columns = [
      { key: "rank", label: "Rank" },
      { key: "camp", label: "Camp" },
      { key: "tier", label: "Tier" },
      { key: "score", label: "Urgency Score" },
      { key: "agreement", label: "Model Agreement" },
      { key: "source", label: "Trust Source" },
      { key: "model", label: "Model Version" },
      { key: "food", label: "Food Priority" },
      { key: "water", label: "Water Priority" },
      { key: "medicine", label: "Medicine Priority" },
      { key: "sanitary", label: "Sanitary Priority" },
      { key: "lastSync", label: "Last Sync" },
    ];
    if (format === "csv") {
      exportRowsToCsv("Camp Urgency Leaderboard", "camp_urgency_leaderboard", rows, columns);
    } else {
      exportRowsToPdf("Camp Urgency Leaderboard", "camp_urgency_leaderboard", rows, columns, [
        `${rows.length} camp(s) exported`,
        `Average urgency score: ${avgScore}`,
        `Average model agreement: ${avgConfidence}%`,
      ]);
    }
  };

  if (loading) return <Loading message="Loading urgency rankings..." />;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Camp Urgency Rankings"
        subtitle="Continuous 0–100 urgency score — rank all active camps with precision, even within the same priority tier"
        icon="analytics"
        actions={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={() => exportLeaderboard("csv")} icon="download">
              CSV
            </SecondaryButton>
            <SecondaryButton onClick={() => exportLeaderboard("pdf")} icon="picture_as_pdf">
              PDF
            </SecondaryButton>
            <PrimaryButton onClick={handleRecalculate} icon="refresh" disabled={recalculating}>
              {recalculating ? 'Recalculating…' : 'Recalculate All'}
            </PrimaryButton>
          </div>
        }
      />

      {/* ML status banner */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className={`rounded-lg border p-4 shadow-sm ${
          mlStatus?.available
            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
            : 'border-rose-300 bg-rose-50 text-rose-900'
        }`}>
          <div className="flex items-start gap-3">
            <span className="material-icons mt-0.5">
              {mlStatus?.available ? 'verified' : 'error'}
            </span>
            <div>
              <p className="text-sm font-bold">
                ML Service {mlStatus?.available ? 'Connected' : 'Unavailable'}
              </p>
              <p className="mt-1 text-xs font-semibold">{mlStatus?.model_version || 'Model version unavailable'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-cyan-300 bg-cyan-50 p-4 text-sm font-medium leading-relaxed text-cyan-900 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="material-icons text-cyan-600">info</span>
            <p>
              The displayed tier is now derived from the <strong>continuous operational urgency score (0-100)</strong>.
              ML class output is used for item priorities, but a camp is only shown as Critical/High when
              the operational score reaches 70 or more.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm font-medium leading-relaxed text-amber-900 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="material-icons mt-0.5 text-amber-600">warning</span>
          <div>
            <p className="font-bold">Data readiness warning</p>
            <p className="mt-1">
              Until flood-level and disease-level components are fully integrated, this score is based on the camp data currently stored here: resources, vulnerable people, road access, distance, occupancy, last distribution time, and citizen need reports. Do not treat model confidence as real-world rescue accuracy.
            </p>
          </div>
        </div>
      </div>

      {lastResult?.failed > 0 && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {lastResult.failed} camp record(s) could not be scored. Check population, capacity, resources, and road access status.
        </div>
      )}

      {predictions.length === 0 ? (
        <EmptyState icon="analytics" title="No urgency scores yet" subtitle="Click 'Recalculate All' to generate scores for all active camps" />
      ) : (
        <div className="space-y-6">

          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Average urgency score */}
            <div className="rounded-lg border border-cyan-400/30 bg-gradient-to-br from-[#063f73] to-[#075c5d] p-5 shadow-sm col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-50 mb-1">Avg. Urgency Score</p>
              <p className="text-4xl font-black text-white">{avgScore}</p>
              <div className="mt-2">
                <UrgencyScoreBar score={avgScore} showLabel height="h-2" />
              </div>
            </div>

            {/* Critical tier */}
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-icons text-rose-600 text-xl">crisis_alert</span>
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Critical ≥70</p>
              </div>
              <p className="text-3xl font-black text-rose-900">{criticalCount}</p>
              <p className="text-xs text-rose-700 mt-1">camps need immediate support</p>
            </div>

            {/* Moderate tier */}
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-icons text-amber-600 text-xl">priority_high</span>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Moderate 45–69</p>
              </div>
              <p className="text-3xl font-black text-amber-900">{moderateCount}</p>
              <p className="text-xs text-amber-700 mt-1">camps need support soon</p>
            </div>

            {/* Stable tier */}
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-icons text-emerald-600 text-xl">check_circle</span>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Stable &lt;45</p>
              </div>
              <p className="text-3xl font-black text-emerald-900">{stableCount}</p>
              <p className="text-xs text-emerald-700 mt-1">camps are in stable condition</p>
            </div>
          </div>

          {/* ── Top camp spotlight + histogram ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top camp spotlight */}
            {topCamp && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 mb-3">
                  🚨 Highest Urgency Camp
                </p>
                <div className="flex items-center gap-3 mb-4">
                  <UrgencyRankBadge rank={1} />
                  <div>
                    <p className="text-base font-bold text-slate-900">
                      {typeof topCamp.camp_id === 'object' ? topCamp.camp_id.camp_name : topCamp.camp_id}
                    </p>
                    <PriorityBadge level={topCamp.priority_level} />
                  </div>
                </div>
                <UrgencyScoreBar score={Number(topCamp.priority_score)} height="h-4" />
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <span>Model agreement: <strong>{(topCamp.confidence_score * 100).toFixed(0)}%</strong></span>
                  {typeof topCamp.camp_id === 'object' && (
                    <>
                      <span>Population: <strong>{topCamp.camp_id.population}</strong></span>
                      <span>Road: <strong>{topCamp.camp_id.road_access_status || 'Good'}</strong></span>
                      <span>Food stock: <strong>{topCamp.camp_id.food_available}</strong></span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Score histogram */}
            <div className="rounded-lg border border-cyan-400/30 bg-gradient-to-br from-[#063f73] to-[#075c5d] p-5 shadow-sm">
              <ScoreHistogram predictions={predictions} />
            </div>
          </div>

          {/* ── Filter & sort bar ── */}
          <div className="rounded-lg border border-cyan-400/30 bg-gradient-to-br from-[#063f73] via-[#075b75] to-[#08634a] p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-white">Urgency Leaderboard</p>
                <p className="text-xs font-semibold text-cyan-100">
                  {filteredPredictions.length} of {predictions.length} camps shown · {avgConfidence}% avg model agreement · equal scores use need impact, shortage, vulnerability, and road access as tie-breakers
                </p>
              </div>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'score' | 'confidence')}
                className="rounded-lg border border-cyan-400/40 bg-[#04213f] px-3 py-2 text-sm text-cyan-50"
              >
                <option value="score">Sort by Urgency Score ↓</option>
                <option value="confidence">Sort by Confidence ↓</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                className="rounded-lg border border-cyan-400/40 bg-[#04213f] px-4 py-2.5 text-sm text-cyan-50"
              >
                <option value="">All priority tiers</option>
                <option value="High">High score tier (70+)</option>
                <option value="Medium">Medium score tier (45-69)</option>
                <option value="Low">Low score tier (&lt;45)</option>
              </select>
              <select
                value={itemFilter}
                onChange={e => setItemFilter(e.target.value)}
                className="rounded-lg border border-cyan-400/40 bg-[#04213f] px-4 py-2.5 text-sm text-cyan-50"
              >
                <option value="">All relief item priorities</option>
                <option value="High">Any item High</option>
                <option value="Medium">Any item Medium</option>
                <option value="Low">Any item Low</option>
              </select>
              <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                <span className="text-xs text-slate-300 whitespace-nowrap">Score range:</span>
                <input
                  type="number" min={0} max={100} value={scoreMin}
                  onChange={e => setScoreMin(Math.max(0, Number(e.target.value)))}
                  className="w-16 rounded-lg border border-cyan-400/40 bg-[#04213f] px-2 py-2 text-sm text-center text-cyan-50"
                  placeholder="0"
                />
                <span className="text-cyan-100">–</span>
                <input
                  type="number" min={0} max={100} value={scoreMax}
                  onChange={e => setScoreMax(Math.min(100, Number(e.target.value)))}
                  className="w-16 rounded-lg border border-cyan-400/40 bg-[#04213f] px-2 py-2 text-sm text-center text-cyan-50"
                  placeholder="100"
                />
              </div>
            </div>
          </div>

          {/* ── Leaderboard table ── */}
          <div className="overflow-hidden rounded-lg border border-cyan-400/35 bg-[#062f58] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-cyan-400/30 bg-[#073f63]">
                    <th className="py-3 px-4 text-center font-bold text-cyan-50 w-12">Rank</th>
                    <th className="py-3 px-4 text-left font-bold text-cyan-50">Camp</th>
                    <th className="py-3 px-4 text-center font-bold text-cyan-50 w-24">Tier</th>
                    <th className="py-3 px-4 text-left font-bold text-cyan-50 w-52">Urgency Score (0–100)</th>
                    <th className="py-3 px-4 text-center font-bold text-cyan-50 w-28">Model Agreement</th>
                    <th className="py-3 px-4 text-left font-bold text-cyan-50">Relief Priorities</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPredictions.map((p, index) => {
                    const score = Number(p.priority_score || 0);
                    const tier = getUrgencyTier(score);
                    const isExpanded = expandedId === p._id;
                    const itemP = p.item_priority || p.relief_priorities || {};
                    const factors = p.factors || {};
                    const explanations = Array.isArray(p.explanations) ? p.explanations : [];

                    return (
                      <React.Fragment key={p._id}>
                        <tr
                          className={`border-b border-cyan-500/20 transition-colors cursor-pointer ${
                            isExpanded ? 'bg-[#075b75]' : 'bg-[#0a365f] hover:bg-[#0a5670]'
                          }`}
                          onClick={() => setExpandedId(isExpanded ? null : p._id)}
                        >
                          {/* Rank */}
                          <td className="py-3 px-4 text-center">
                            <UrgencyRankBadge rank={index + 1} />
                          </td>

                          {/* Camp name */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="material-icons text-slate-300 text-base">
                                {isExpanded ? 'expand_less' : 'expand_more'}
                              </span>
                              <div>
                                <p className="font-semibold text-slate-100">
                                  {p.camp_id && typeof p.camp_id === 'object' ? p.camp_id.camp_name : p.camp_id || 'Unknown camp'}
                                </p>
                                {p.camp_id && typeof p.camp_id === 'object' && (
                                  <p className="text-[11px] font-medium text-cyan-100">
                                    Pop: {p.camp_id.population} · Road: {p.camp_id.road_access_status || 'Good'}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Priority tier badge */}
                          <td className="py-3 px-4 text-center">
                            <PriorityBadge level={p.priority_level} />
                          </td>

                          {/* Urgency score bar — primary metric */}
                          <td className="py-3 px-4">
                            <UrgencyScoreBar score={score} height="h-3" />
                          </td>

                          {/* Confidence */}
                          <td className="py-3 px-4 text-center">
                            <span className={`text-sm font-bold ${
                              Number(p.confidence_score) >= 0.8 ? 'text-emerald-600' :
                              Number(p.confidence_score) >= 0.5 ? 'text-amber-600' : 'text-rose-500'
                            }`}>
                              {(Number(p.confidence_score) * 100).toFixed(0)}%
                            </span>
                          </td>

                          {/* Relief item pills */}
                          <td className="py-3 px-4">
                            {(itemP.food_priority || itemP.water_priority) && (
                              <div className="flex gap-1 flex-wrap">
                                <span className="rounded-md border border-amber-300/30 bg-amber-500/25 px-2 py-0.5 text-xs font-bold text-amber-50">Food: {itemP.food_priority}</span>
                                <span className="rounded-md border border-blue-300/30 bg-blue-500/25 px-2 py-0.5 text-xs font-bold text-cyan-50">Water: {itemP.water_priority}</span>
                                <span className="rounded-md border border-rose-300/30 bg-rose-500/25 px-2 py-0.5 text-xs font-bold text-rose-50">Medicine: {itemP.medicine_priority}</span>
                                <span className="rounded-md border border-cyan-300/30 bg-cyan-500/25 px-2 py-0.5 text-xs font-bold text-cyan-50">Sanitary: {itemP.sanitary_priority}</span>
                              </div>
                            )}
                          </td>
                        </tr>

                        {/* ── Expanded factor breakdown row ── */}
                        {isExpanded && (
                          <tr className="border-b border-cyan-500/20 bg-[#04213f]">
                            <td colSpan={6} className="px-6 pb-5 pt-2">
                              <div className="rounded-lg border border-cyan-400/30 bg-[#052a4f] p-4">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-300 mb-3">
                                  Score Factor Breakdown · How {score}/100 was calculated
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
                                  {[
                                    { label: 'Resource Shortage', key: 'resource_shortage_score', icon: 'inventory_2', color: 'bg-rose-500', weight: '30%' },
                                    { label: 'ML Item Priority', key: 'ml_item_priority_score', icon: 'analytics', color: 'bg-purple-500', weight: '20%' },
                                    { label: 'Vulnerable Pop.', key: 'vulnerable_population_score', icon: 'elderly', color: 'bg-orange-400', weight: '15%' },
                                    { label: 'Road Access', key: 'road_access_score', icon: 'block', color: 'bg-teal-400', weight: '15%' },
                                    { label: 'Time Since Dist.', key: 'last_distribution_score', icon: 'schedule', color: 'bg-indigo-400', weight: '10%' },
                                    { label: 'Occupancy', key: 'camp_occupancy_score', icon: 'sensor_occupied', color: 'bg-blue-400', weight: '5%' },
                                    { label: 'Distance', key: 'distance_score', icon: 'route', color: 'bg-cyan-400', weight: '5%' },
                                  ].map(f => (
                                    <div key={f.key} className="flex flex-col gap-1.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="material-icons text-slate-400 text-sm">{f.icon}</span>
                                        <span className="text-[11px] font-semibold text-slate-200">{f.label}</span>
                                        <span className="ml-auto text-[10px] text-slate-400">{f.weight}</span>
                                      </div>
                                      <FactorBar
                                        value={Number(factors[f.key] ?? 0)}
                                        color={f.color}
                                      />
                                    </div>
                                  ))}
                                </div>
                                {explanations.length > 0 && (
                                  <div className="mt-4 border-t border-cyan-400/25 pt-4">
                                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-300">
                                      Why this priority?
                                    </p>
                                    <div className="grid gap-2 md:grid-cols-2">
                                      {explanations.map((item: any, idx: number) => (
                                        <div
                                          key={`${item.factor || 'reason'}-${idx}`}
                                          className={`rounded-md border px-3 py-2 text-xs ${explanationTone(item.severity)}`}
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="font-bold">{item.message}</span>
                                            <span className="shrink-0 font-semibold">{item.score}/100</span>
                                          </div>
                                          <p className="mt-1 opacity-80">{item.detail}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {(itemP.recommended_food_qty != null || itemP.required_food_qty != null) && (
                                  <div className="mt-4 border-t border-cyan-400/25 pt-4">
                                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-300">
                                      Standards-based shortage quantities
                                    </p>
                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                      {[
                                        { label: 'Food', key: 'food', tone: 'amber' },
                                        { label: 'Water', key: 'water', tone: 'blue' },
                                        { label: 'Medicine', key: 'medicine', tone: 'rose' },
                                        { label: 'Sanitary', key: 'sanitary', tone: 'cyan' },
                                      ].map(item => {
                                        const required = Number(itemP[`required_${item.key}_qty`] || 0);
                                        const available = Number(itemP[`available_${item.key}_qty`] || 0);
                                        const shortage = Number(itemP[`recommended_${item.key}_qty`] || 0);
                                        return (
                                          <div key={item.key} className="rounded-md border border-cyan-400/25 bg-[#073f63] px-3 py-2">
                                            <div className="mb-1 flex items-center justify-between gap-2">
                                              <span className="text-xs font-bold text-slate-100">{item.label}</span>
                                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                                shortage > 0 ? 'bg-rose-500/15 text-rose-200' : 'bg-emerald-500/15 text-emerald-200'
                                              }`}>
                                                shortage {shortage}
                                              </span>
                                            </div>
                                            <p className="text-[11px] text-slate-300">
                                              Required {required} · Available {available}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                {/* Urgency tier label */}
                                <div className={`mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-semibold ${tier.bg} ${tier.cls}`}>
                                  <span className="material-icons text-base">
                                    {score >= 70 ? 'crisis_alert' : score >= 45 ? 'priority_high' : 'check_circle'}
                                  </span>
                                  Urgency tier: {tier.label} — score {score}/100
                                  {p.model_version && (
                                    <span className="ml-3 text-xs font-normal text-slate-400">({p.model_version})</span>
                                  )}
                                </div>
                                {p.feedback_event && (
                                  <p className="mt-2 text-xs text-amber-200">{p.feedback_event}</p>
                                )}
                                {p.need_report_impact?.impact_score > 0 && (
                                  <div className="mt-3 rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="material-icons text-sm">report</span>
                                      <span className="font-bold">Need report impact</span>
                                      <span>Impact score {p.need_report_impact.impact_score}</span>
                                      <span>Boost +{p.need_report_impact.applied_boost || 0}</span>
                                      <span>{p.need_report_impact.active_reports || 0} active report(s)</span>
                                      <span>{p.need_report_impact.emergency_reports || 0} critical/emergency</span>
                                    </div>
                                  </div>
                                )}
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleWhatIf(p);
                                    }}
                                    className="rounded-lg bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-100 hover:bg-cyan-500/25"
                                  >
                                    What-if simulation
                                  </button>
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleOverride(p);
                                    }}
                                    className="rounded-lg bg-[#075b75] px-3 py-1.5 text-xs font-bold text-cyan-50 hover:bg-[#087eaa]"
                                  >
                                    Override with reason
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
