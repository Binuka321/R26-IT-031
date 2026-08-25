import React, { useEffect, useMemo, useState } from "react";
import {
  Loading,
  PageHeader,
  StatCard,
  UrgencyScoreBar,
} from "../components/UIComponents";
import * as api from "../services/api";
import type { DashboardStats, PageName } from "../types";
import { useLiveRefresh } from "../utils/useLiveRefresh";

interface DashboardProps {
  onNavigate?: (page: PageName, data?: any) => void;
}

const emptyStats: DashboardStats = {
  totalSafeZones: 0,
  totalCamps: 0,
  highPriority: 0,
  medPriority: 0,
  lowPriority: 0,
  totalPopulation: 0,
  totalDistributions: 0,
  pendingDistributions: 0,
  completedDistributions: 0,
  totalFood: 0,
  totalWater: 0,
  totalMedicine: 0,
  totalSanitary: 0,
  resourceAvailability: [],
  criticalFoodCamps: 0,
  criticalWaterCamps: 0,
  criticalMedicineCamps: 0,
  criticalSanitaryCamps: 0,
  generatedRoutes: 0,
  activeRoutes: 0,
  blockedRoutes: 0,
  totalNeedReports: 0,
  pendingNeedReports: 0,
  inProgressNeedReports: 0,
  emergencyNeedReports: 0,
  activeRescueMissions: 0,
  unassignedRescueMissions: 0,
  rescuedMissions: 0,
  criticalDepletionCamps: 0,
  stockDepletionForecast: [],
  topNeedImpactCamps: [],
};

function SeeMoreButton({
  label = "See more",
  icon = "arrow_forward",
  onClick,
}: {
  label?: string;
  icon?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"
    >
      {label}
      <span className="material-icons text-sm">{icon}</span>
    </button>
  );
}

function Panel({
  icon,
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  icon: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-900 text-white">
            <span className="material-icons text-xl">{icon}</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: string;
  tone: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide opacity-75">{label}</span>
        <span className="material-icons text-lg opacity-80">{icon}</span>
      </div>
      <p className="text-3xl font-black">{value}</p>
    </div>
  );
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [highestUrgencyCamps, setHighestUrgencyCamps] = useState<any[]>([]);

  const go = (page: PageName, data?: any) => onNavigate?.(page, data);

  const load = () => {
    Promise.allSettled([api.getDashboardStats(), api.getAllPredictions()])
      .then(([statsResult, predictionsResult]) => {
        setStats(statsResult.status === "fulfilled" ? statsResult.value.data : emptyStats);

        if (predictionsResult.status === "fulfilled") {
          const predictions: any[] = predictionsResult.value.data || [];
          const sorted = [...predictions].sort(
            (a, b) => Number(b.priority_score || 0) - Number(a.priority_score || 0),
          );
          const highestScore = Number(sorted[0]?.priority_score || 0);
          setHighestUrgencyCamps(
            sorted
              .filter((prediction) => Number(prediction.priority_score || 0) === highestScore)
              .slice(0, 4),
          );
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useLiveRefresh(load, [], 30000);

  const resourceAvailability = useMemo(() => {
    const fallback = [
      { type: "food", available_quantity: stats?.totalFood || 0, low_stock_count: 0 },
      { type: "water", available_quantity: stats?.totalWater || 0, low_stock_count: 0 },
      { type: "medicine", available_quantity: stats?.totalMedicine || 0, low_stock_count: 0 },
      { type: "sanitary", available_quantity: stats?.totalSanitary || 0, low_stock_count: 0 },
    ];
    const rows = stats?.resourceAvailability?.length ? stats.resourceAvailability : fallback;
    const order = ["food", "water", "medicine", "sanitary", "emergency", "clothes", "baby_care"];
    return [...rows].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type)).slice(0, 4);
  }, [stats]);

  if (loading) return <Loading message="Loading dashboard..." />;
  if (!stats) return null;

  const openRequests = (stats.pendingNeedReports || 0) + (stats.inProgressNeedReports || 0);
  const activeRescue = stats.activeRescueMissions || 0;
  const rescueUnassigned = stats.unassignedRescueMissions || 0;
  const routeReadyShare = stats.generatedRoutes
    ? Math.round(((stats.activeRoutes || 0) / stats.generatedRoutes) * 100)
    : 0;
  const deliveryTotal = stats.pendingDistributions + stats.completedDistributions || 1;
  const completionShare = Math.round((stats.completedDistributions / deliveryTotal) * 100);

  return (
    <div>
      <PageHeader
        title="Operational Dashboard"
        subtitle="Main rescue, ration, route, and stock signals for post-flood response"
        icon="dashboard"
      />

      <section className="mb-6 overflow-hidden rounded-lg border border-sky-900/20 bg-gradient-to-br from-[#083f73] via-[#087eaa] to-[#08634a] shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="p-6 text-white">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-sky-200/30 bg-white/10 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-sky-50 shadow-sm">
                Command View
              </span>
              <span className="text-xs font-semibold text-slate-300">
                {stats.totalPopulation.toLocaleString()} people | {stats.totalCamps} camps | {stats.totalSafeZones} safe zones
              </span>
            </div>
            <h2 className="max-w-4xl text-3xl font-black leading-tight">
              Prioritize urgent camps, dispatch rescue teams, and verify safe delivery routes from one screen.
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricTile label="Active Rescue" value={activeRescue} icon="emergency_share" tone="border-rose-400/30 bg-rose-400/10 text-rose-100" />
              <MetricTile label="Critical Camps" value={stats.highPriority} icon="crisis_alert" tone="border-amber-400/30 bg-amber-400/10 text-amber-100" />
              <MetricTile label="Open Requests" value={openRequests} icon="support_agent" tone="border-cyan-400/30 bg-cyan-400/10 text-cyan-100" />
              <MetricTile label="Route Ready" value={`${routeReadyShare}%`} icon="route" tone="border-emerald-400/30 bg-emerald-400/10 text-emerald-100" />
            </div>
          </div>
          <div className="border-t border-white/10 bg-white p-6 lg:border-l lg:border-t-0">
            <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-500">
              Recommended actions
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => go("rescue-operations")}
                className="w-full rounded-lg border border-rose-200 bg-rose-50 p-4 text-left transition-colors hover:bg-rose-100"
              >
                <p className="flex items-center gap-2 text-sm font-black text-rose-900">
                  <span className="material-icons text-base">emergency_share</span>
                  Review rescue missions
                </p>
                <p className="mt-1 text-xs text-rose-700">
                  {rescueUnassigned} unassigned rescue request(s) need team allocation.
                </p>
              </button>
              <button
                onClick={() => go("route-planning")}
                className="w-full rounded-lg border border-cyan-200 bg-cyan-50 p-4 text-left transition-colors hover:bg-cyan-100"
              >
                <p className="flex items-center gap-2 text-sm font-black text-cyan-900">
                  <span className="material-icons text-base">alt_route</span>
                  Verify blocked routes
                </p>
                <p className="mt-1 text-xs text-cyan-700">
                  {stats.blockedRoutes || 0} route(s) are blocked or unsafe.
                </p>
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel
          icon="emergency_share"
          title="Rescue Operations"
          subtitle="New rescue workflow: mission queue, assignment, map, and field status"
          action={<SeeMoreButton onClick={() => go("rescue-operations")} />}
        >
          <div className="grid grid-cols-3 gap-3">
            <MetricTile label="Active" value={activeRescue} icon="emergency" tone="border-rose-200 bg-rose-50 text-rose-800" />
            <MetricTile label="Unassigned" value={rescueUnassigned} icon="person_off" tone="border-amber-200 bg-amber-50 text-amber-800" />
            <MetricTile label="Closed" value={stats.rescuedMissions || 0} icon="verified" tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
          </div>
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Rescue reports submitted by citizens are now tracked as missions with team assignment and mission history.
          </p>
        </Panel>

        <Panel
          icon="analytics"
          title="Camp Urgency"
          subtitle="Highest ML/rule-based urgency scores and tied top-priority camps"
          action={<SeeMoreButton onClick={() => go("camp-priority")} />}
        >
          {highestUrgencyCamps.length > 0 ? (
            <div className="space-y-3">
              {highestUrgencyCamps.map((prediction, index) => {
                const score = Number(prediction.priority_score || 0);
                const campName =
                  typeof prediction.camp_id === "object"
                    ? prediction.camp_id.camp_name
                    : prediction.camp_id;
                return (
                  <div key={prediction._id || `${campName}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-black text-slate-900">{campName}</p>
                      <span className="rounded-md bg-rose-100 px-2 py-1 text-xs font-black text-rose-700">
                        {score}/100
                      </span>
                    </div>
                    <UrgencyScoreBar score={score} height="h-2" />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              No urgency scores available yet.
            </p>
          )}
        </Panel>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr_1fr]">
        <Panel
          icon="local_shipping"
          title="Distribution"
          subtitle="Pending and completed ration delivery plans"
          action={<SeeMoreButton onClick={() => go("distributions")} />}
        >
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-bold text-slate-600">Completion</span>
              <span className="font-black text-emerald-600">{completionShare}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${completionShare}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricTile label="Pending" value={stats.pendingDistributions} icon="schedule" tone="border-amber-200 bg-amber-50 text-amber-800" />
            <MetricTile label="Completed" value={stats.completedDistributions} icon="task_alt" tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
          </div>
        </Panel>

        <Panel
          icon="route"
          title="Route Readiness"
          subtitle="Road-network and backup route safety status"
          action={<SeeMoreButton onClick={() => go("route-planning")} />}
        >
          <div className="grid grid-cols-3 gap-3">
            <MetricTile label="Total" value={stats.generatedRoutes || 0} icon="route" tone="border-blue-200 bg-blue-50 text-blue-800" />
            <MetricTile label="Active" value={stats.activeRoutes || 0} icon="check_circle" tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
            <MetricTile label="Blocked" value={stats.blockedRoutes || 0} icon="block" tone="border-rose-200 bg-rose-50 text-rose-800" />
          </div>
          <p className="mt-4 text-xs font-semibold text-slate-500">
            Use route planning before dispatching rescue or ration teams.
          </p>
        </Panel>

        <Panel
          icon="volunteer_activism"
          title="Citizen Reports"
          subtitle="Public requests affecting rescue and ration priority"
          action={<SeeMoreButton onClick={() => go("need-reports")} />}
        >
          <div className="grid grid-cols-3 gap-3">
            <MetricTile label="Total" value={stats.totalNeedReports || 0} icon="support_agent" tone="border-blue-200 bg-blue-50 text-blue-800" />
            <MetricTile label="Open" value={openRequests} icon="pending_actions" tone="border-amber-200 bg-amber-50 text-amber-800" />
            <MetricTile label="Critical" value={stats.emergencyNeedReports || 0} icon="emergency" tone="border-rose-200 bg-rose-50 text-rose-800" />
          </div>
        </Panel>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel
          icon="hourglass_bottom"
          title="Stock Depletion Forecast"
          subtitle="Camps where available stock may run out soon"
          action={<SeeMoreButton onClick={() => go("camp-priority")} label="Review priority" />}
        >
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
            <MetricTile
              label="Camps below 24h"
              value={stats.criticalDepletionCamps || 0}
              icon="running_with_errors"
              tone="border-rose-200 bg-rose-50 text-rose-800"
            />
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {(stats.stockDepletionForecast || []).slice(0, 4).map((row) => (
                <div key={row.camp_id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-800">{row.camp_name}</p>
                    <p className="text-xs capitalize text-slate-500">{row.most_critical_item || "unknown"} runs out first</p>
                  </div>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                    {row.minimum_hours_remaining == null ? "N/A" : `${row.minimum_hours_remaining}h`}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">Score {row.priority_score || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel
          icon="warehouse"
          title="Resource Stock"
          subtitle="Available inventory by major relief category"
          action={<SeeMoreButton onClick={() => go("resources")} />}
        >
          <div className="grid grid-cols-2 gap-3">
            {resourceAvailability.map((resource) => (
              <div key={resource.type} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  {resource.type.replace("_", " ")}
                </p>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {(resource.available_quantity || 0).toLocaleString()}
                </p>
                {resource.low_stock_count > 0 && (
                  <p className="mt-1 text-xs font-bold text-rose-600">
                    {resource.low_stock_count} low-stock item(s)
                  </p>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Safe Zones" value={stats.totalSafeZones} icon="shield" color="emerald" />
        <StatCard title="Total Camps" value={stats.totalCamps} icon="holiday_village" color="blue" />
        <StatCard title="Population Covered" value={stats.totalPopulation.toLocaleString()} icon="people" color="purple" />
        <StatCard title="Relief Plans" value={stats.totalDistributions} icon="local_shipping" color="indigo" />
      </div>
    </div>
  );
}
