import React, { useEffect, useState } from 'react';
import { StatCard, Loading, PageHeader, UrgencyScoreBar } from '../components/UIComponents';
import * as api from '../services/api';
import type { DashboardStats } from '../types';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [topCamps, setTopCamps] = useState<any[]>([]);

  useEffect(() => {
    Promise.allSettled([
      api.getDashboardStats({ include_seed: "true" }),
      api.getAllPredictions()
    ]).then(([statsResult, predictionsResult]) => {
      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value.data);
      } else {
        setStats({
          totalSafeZones: 0, totalCamps: 0, highPriority: 0, medPriority: 0,
          lowPriority: 0, totalPopulation: 0, totalDistributions: 0,
          pendingDistributions: 0, completedDistributions: 0,
          totalFood: 0, totalWater: 0, totalMedicine: 0, totalSanitary: 0,
          resourceAvailability: [],
          criticalFoodCamps: 0, criticalWaterCamps: 0, criticalMedicineCamps: 0,
          criticalSanitaryCamps: 0, generatedRoutes: 0, activeRoutes: 0,
          blockedRoutes: 0, totalNeedReports: 0, pendingNeedReports: 0,
          inProgressNeedReports: 0, emergencyNeedReports: 0
        });
      }
      if (predictionsResult.status === 'fulfilled') {
        const preds: any[] = predictionsResult.value.data || [];
        const sorted = [...preds].sort((a, b) => Number(b.priority_score) - Number(a.priority_score));
        setTopCamps(sorted.slice(0, 3));
      }
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading message="Loading dashboard..." />;
  if (!stats) return null;

  const totalPriority =
    stats.highPriority + stats.medPriority + stats.lowPriority || 1;
  const urgentShare = Math.round((stats.highPriority / totalPriority) * 100);
  const deliveryTotal =
    stats.pendingDistributions + stats.completedDistributions || 1;
  const completionShare = Math.round(
    (stats.completedDistributions / deliveryTotal) * 100
  );

  const SectionTitle = ({
    icon,
    title,
    subtitle,
  }: {
    icon: string;
    title: string;
    subtitle: string;
  }) => (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div className="flex items-center gap-2">
        <span className="material-icons text-slate-500">{icon}</span>
        <div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );

  const resourceConfig: Record<
    string,
    {
      title: string;
      icon: string;
      color: "cyan" | "purple" | "emerald" | "amber" | "rose" | "blue" | "indigo";
    }
  > = {
    food: { title: "Food", icon: "restaurant", color: "amber" },
    water: { title: "Water", icon: "water_drop", color: "cyan" },
    medicine: { title: "Medicine", icon: "medical_services", color: "rose" },
    sanitary: { title: "Sanitary", icon: "sanitizer", color: "purple" },
    emergency: { title: "Emergency", icon: "emergency", color: "rose" },
    clothes: { title: "Clothes", icon: "checkroom", color: "emerald" },
    baby_care: { title: "Baby Care", icon: "child_care", color: "indigo" },
  };
  const resourceOrder = [
    "food",
    "water",
    "medicine",
    "sanitary",
    "emergency",
    "clothes",
    "baby_care",
  ];
  const resourceFallback = [
    { type: "food", available_quantity: stats.totalFood || 0, item_count: 0, low_stock_count: 0 },
    { type: "water", available_quantity: stats.totalWater || 0, item_count: 0, low_stock_count: 0 },
    { type: "medicine", available_quantity: stats.totalMedicine || 0, item_count: 0, low_stock_count: 0 },
    { type: "sanitary", available_quantity: stats.totalSanitary || 0, item_count: 0, low_stock_count: 0 },
  ];
  const resourceAvailability =
    stats.resourceAvailability && stats.resourceAvailability.length > 0
      ? stats.resourceAvailability
      : resourceFallback;
  const sortedResourceAvailability = [...resourceAvailability].sort((a, b) => {
    const aIndex = resourceOrder.indexOf(a.type);
    const bIndex = resourceOrder.indexOf(b.type);
    if (aIndex === -1 && bIndex === -1) return a.type.localeCompare(b.type);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Post-Flood Rescue & Ration Distribution Overview" icon="dashboard" />

      <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-slate-950 shadow-sm">
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1.4fr_1fr]">
          <div className="p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
              Operational Command View
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              Relief priorities, stock readiness, and delivery movement in one place
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Monitor active camps, urgent shortages, citizen requests, and route readiness before creating distribution plans.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-white/10 p-3">
                <p className="text-xs text-slate-300">Urgent Camps</p>
                <p className="text-2xl font-bold text-white">{stats.highPriority}</p>
              </div>
              <div className="rounded-lg bg-white/10 p-3">
                <p className="text-xs text-slate-300">People Covered</p>
                <p className="text-2xl font-bold text-white">{stats.totalPopulation.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-white/10 p-3">
                <p className="text-xs text-slate-300">Open Requests</p>
                <p className="text-2xl font-bold text-white">{(stats.pendingNeedReports || 0) + (stats.inProgressNeedReports || 0)}</p>
              </div>
              <div className="rounded-lg bg-white/10 p-3">
                <p className="text-xs text-slate-300">Active Routes</p>
                <p className="text-2xl font-bold text-white">{stats.activeRoutes || 0}</p>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 bg-white p-6 lg:border-l lg:border-t-0">
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700">Urgency mix</span>
                <span className="font-bold text-rose-600">{urgentShare}% high</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-rose-500" style={{ width: `${urgentShare}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700">Delivery completion</span>
                <span className="font-bold text-emerald-600">{completionShare}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${completionShare}%` }} />
              </div>
            </div>
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">Next best action</p>
              <p className="mt-1 text-xs text-amber-800">
                Recalculate camp priorities after major stock updates or new citizen reports.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Safe Zones" value={stats.totalSafeZones} icon="shield" color="emerald" />
        <StatCard title="Total Camps" value={stats.totalCamps} icon="holiday_village" color="blue" />
        <StatCard title="Total Population" value={stats.totalPopulation.toLocaleString()} icon="people" color="purple" />
        <StatCard title="Total Distributions" value={stats.totalDistributions} icon="local_shipping" color="indigo" />
      </div>

      {/* Priority Cards + Urgency Score Spotlight */}
      <SectionTitle icon="analytics" title="ML Camp Urgency Rankings" subtitle="Continuous 0–100 score enables precise ranking even within the same priority tier" />

      {/* Urgency score highlight strip */}
      {topCamps.length > 0 && (
        <div className="mb-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 flex items-center gap-2">
            <span className="material-icons text-rose-500 text-base">leaderboard</span>
            <p className="text-sm font-bold text-slate-800">Top 3 Most Urgent Camps</p>
            <span className="ml-auto text-xs text-slate-400">Sorted by continuous urgency score</span>
          </div>
          <div className="divide-y divide-slate-100">
            {topCamps.map((p, i) => {
              const score = Number(p.priority_score || 0);
              const campName = typeof p.camp_id === 'object' ? p.camp_id.camp_name : p.camp_id;
              return (
                <div key={p._id} className="flex items-center gap-4 px-4 py-3">
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold flex-shrink-0 ${
                    i === 0 ? 'bg-rose-600 text-white' :
                    i === 1 ? 'bg-orange-500 text-white' :
                    'bg-amber-400 text-white'
                  }`}>#{i + 1}</span>
                  <p className="font-semibold text-slate-800 w-44 truncate">{campName}</p>
                  <div className="flex-1">
                    <UrgencyScoreBar score={score} height="h-2.5" />
                  </div>
                  <span className="ml-2 text-xs text-slate-500 flex-shrink-0">{p.priority_level}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard title="Critical Camps (≥70)" value={stats.highPriority} icon="crisis_alert" color="rose" subtitle="Score ≥ 70 — immediate support" />
        <StatCard title="Moderate Camps (45–69)" value={stats.medPriority} icon="priority_high" color="amber" subtitle="Score 45–69 — support soon" />
        <StatCard title="Stable Camps (<45)" value={stats.lowPriority} icon="check_circle" color="emerald" subtitle="Score < 45 — stable condition" />
      </div>

      <SectionTitle icon="psychology" title="Relief Item Priority" subtitle="Spot item-specific shortages predicted by the model" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Critical Food Camps" value={stats.criticalFoodCamps || 0} icon="restaurant" color="amber" subtitle="ML predicted High" />
        <StatCard title="Critical Water Camps" value={stats.criticalWaterCamps || 0} icon="water_drop" color="cyan" subtitle="ML predicted High" />
        <StatCard title="Critical Medicine Camps" value={stats.criticalMedicineCamps || 0} icon="medical_services" color="rose" subtitle="ML predicted High" />
        <StatCard title="Critical Sanitary Camps" value={stats.criticalSanitaryCamps || 0} icon="sanitizer" color="purple" subtitle="ML predicted High" />
      </div>

      {/* Distribution Status */}
      <SectionTitle icon="local_shipping" title="Distribution Status" subtitle="Track pending and completed delivery plans" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <StatCard title="Pending Distributions" value={stats.pendingDistributions} icon="schedule" color="amber" />
        <StatCard title="Completed Distributions" value={stats.completedDistributions} icon="check_circle" color="emerald" />
      </div>

      <SectionTitle icon="volunteer_activism" title="Citizen Assistance Requests" subtitle="Monitor public requests that may change relief priority" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Requests" value={stats.totalNeedReports || 0} icon="support_agent" color="blue" />
        <StatCard title="Pending Requests" value={stats.pendingNeedReports || 0} icon="pending_actions" color="amber" />
        <StatCard title="In Progress" value={stats.inProgressNeedReports || 0} icon="engineering" color="cyan" />
        <StatCard title="Critical / Emergency" value={stats.emergencyNeedReports || 0} icon="emergency" color="rose" subtitle="Pending or in progress" />
      </div>

      <SectionTitle icon="route" title="Algorithmic Route Planning" subtitle="Review route availability and blocked access" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard title="Generated Routes" value={stats.generatedRoutes || 0} icon="route" color="blue" subtitle="A* / Dijkstra" />
        <StatCard title="Active Routes" value={stats.activeRoutes || 0} icon="check_circle" color="emerald" />
        <StatCard title="Blocked Routes" value={stats.blockedRoutes || 0} icon="block" color="rose" />
      </div>

      {/* Resource Availability */}
      <SectionTitle icon="warehouse" title="Resource Availability" subtitle="Understand current usable stock by relief category" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sortedResourceAvailability.map((resource) => {
          const config = resourceConfig[resource.type] || {
            title: resource.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            icon: "inventory_2",
            color: "blue" as const,
          };
          const subtitleParts = [
            `${resource.item_count || 0} item${resource.item_count === 1 ? "" : "s"}`,
          ];
          if (resource.low_stock_count > 0) {
            subtitleParts.push(`${resource.low_stock_count} low stock`);
          }

          return (
            <StatCard
              key={resource.type}
              title={config.title}
              value={(resource.available_quantity || 0).toLocaleString()}
              icon={config.icon}
              color={config.color}
              subtitle={subtitleParts.join(" | ")}
            />
          );
        })}
      </div>
    </div>
  );
}
