import React, { useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  FormSelect,
  Loading,
  PageHeader,
  PriorityBadge,
  PrimaryButton,
  StatusBadge,
  StatCard,
} from "../components/UIComponents";
import * as api from "../services/api";
import type { Camp, NeedReport, RouteData, SafeZone } from "../types";
import { Permissions } from "../utils/permissions";
import { useLiveRefresh } from "../utils/useLiveRefresh";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

type RescueStatus = "Unassigned" | "Assigned" | "En Route" | "Rescuing" | "Rescued" | "Closed";

const rescueStatuses: RescueStatus[] = [
  "Unassigned",
  "Assigned",
  "En Route",
  "Rescuing",
  "Rescued",
  "Closed",
];

const severityRank: Record<string, number> = {
  Emergency: 5,
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const radius = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
}

function nearestPoint<T extends { latitude: number; longitude: number }>(
  report: NeedReport,
  items: T[],
) {
  return items
    .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .map((item) => ({
      item,
      distance: distanceKm(report.latitude, report.longitude, item.latitude, item.longitude),
    }))
    .sort((a, b) => a.distance - b.distance)[0] || null;
}

function teamName(team: any) {
  if (!team) return "Unassigned";
  if (typeof team === "string") return "Assigned team";
  return team.name || team.username || "Assigned team";
}

function campIdFromRoute(route: RouteData) {
  return typeof route.camp_id === "object" ? route.camp_id._id : route.camp_id;
}

export default function RescueOperations({ userRole }: { userRole: string }) {
  const [reports, setReports] = useState<NeedReport[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [noteByReport, setNoteByReport] = useState<Record<string, string>>({});

  const canAssign = ["admin", "disaster_officer"].includes(userRole.toLowerCase());
  const canUpdate = Permissions.canManageRescueOperations(userRole);

  const load = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [rescueRes, campsRes, zonesRes, routesRes, teamsRes] = await Promise.all([
        api.getRescueOperations(),
        api.getCamps().catch(() => ({ data: [] })),
        api.getSafeZones().catch(() => ({ data: [] })),
        api.getAllRoutes().catch(() => ({ data: [] })),
        api.getUsersByRole("rescue_team").catch(() => ({ data: [] })),
      ]);
      setReports(rescueRes.data || []);
      setCamps(campsRes.data || []);
      setSafeZones(zonesRes.data || []);
      setRoutes(routesRes.data || []);
      setTeams(teamsRes.data || []);
      if (!selectedId && rescueRes.data?.length) setSelectedId(rescueRes.data[0]._id);
    } catch (error) {
      console.error(error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void load(true);
  }, []);
  useLiveRefresh(() => load(false), [], 30000, !busyId);

  const filteredReports = useMemo(() => {
    return reports
      .filter((report) => !statusFilter || (report.rescue_status || "Unassigned") === statusFilter)
      .filter((report) => !severityFilter || report.severity === severityFilter)
      .filter((report) => {
        if (!teamFilter) return true;
        const assigned = report.assigned_rescue_team_id;
        const assignedId = typeof assigned === "object" ? assigned?._id : assigned;
        return assignedId === teamFilter;
      })
      .sort((a, b) => {
        const aClosed = ["Rescued", "Closed"].includes(a.rescue_status || "");
        const bClosed = ["Rescued", "Closed"].includes(b.rescue_status || "");
        if (aClosed !== bClosed) return aClosed ? 1 : -1;
        return (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
      });
  }, [reports, statusFilter, severityFilter, teamFilter]);

  const selectedReport = filteredReports.find((report) => report._id === selectedId) || filteredReports[0];
  const selectedCamp = selectedReport ? nearestPoint(selectedReport, camps) : null;
  const selectedSafeZone = selectedReport ? nearestPoint(selectedReport, safeZones) : null;
  const bestRoute = selectedCamp
    ? routes
        .filter((route) => campIdFromRoute(route) === selectedCamp.item._id)
        .sort((a, b) => {
          if ((b.safety_score || 0) !== (a.safety_score || 0)) return (b.safety_score || 0) - (a.safety_score || 0);
          return (a.distance || 9999) - (b.distance || 9999);
        })[0]
    : null;

  const activeCount = reports.filter((r) => !["Rescued", "Closed"].includes(r.rescue_status || "")).length;
  const assignedCount = reports.filter((r) => r.assigned_rescue_team_id).length;
  const emergencyCount = reports.filter((r) => ["Emergency", "Critical"].includes(r.severity)).length;
  const rescuedCount = reports.filter((r) => ["Rescued", "Closed"].includes(r.rescue_status || "")).length;

  const assignTeam = async (reportId: string, teamId: string) => {
    setBusyId(reportId);
    try {
      await api.assignRescueTeam(reportId, {
        assigned_rescue_team_id: teamId || null,
        note: teamId ? "Assigned from rescue operations dashboard" : "Assignment cleared",
      });
      await load(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setBusyId("");
    }
  };

  const updateStatus = async (reportId: string, status: RescueStatus) => {
    setBusyId(reportId);
    try {
      await api.updateRescueStatus(reportId, {
        rescue_status: status,
        note: noteByReport[reportId] || "",
      });
      setNoteByReport((current) => ({ ...current, [reportId]: "" }));
      await load(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setBusyId("");
    }
  };

  if (loading) return <Loading message="Loading rescue operations..." />;

  return (
    <div>
      <PageHeader
        title="Rescue Operations"
        subtitle="Triage rescue requests, assign teams, track mission progress, and verify safe access"
        icon="emergency_share"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Active Missions" value={activeCount} icon="emergency" color="rose" />
        <StatCard title="Assigned Teams" value={assignedCount} icon="groups" color="blue" />
        <StatCard title="Critical Requests" value={emergencyCount} icon="priority_high" color="amber" />
        <StatCard title="Rescued / Closed" value={rescuedCount} icon="verified" color="emerald" />
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <FormSelect
            label="Mission Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "", label: "All statuses" },
              ...rescueStatuses.map((status) => ({ value: status, label: status })),
            ]}
          />
          <FormSelect
            label="Severity"
            value={severityFilter}
            onChange={setSeverityFilter}
            options={[
              { value: "", label: "All severity levels" },
              { value: "Emergency", label: "Emergency" },
              { value: "Critical", label: "Critical" },
              { value: "High", label: "High" },
              { value: "Medium", label: "Medium" },
              { value: "Low", label: "Low" },
            ]}
          />
          <FormSelect
            label="Assigned Team"
            value={teamFilter}
            onChange={setTeamFilter}
            options={[
              { value: "", label: "All teams" },
              ...teams.map((team) => ({ value: team._id, label: team.name || team.username })),
            ]}
          />
          <div className="flex items-end">
            <PrimaryButton onClick={() => void load(false)} icon="refresh">
              Refresh
            </PrimaryButton>
          </div>
        </div>
      </div>

      {filteredReports.length === 0 ? (
        <EmptyState
          icon="emergency_share"
          title="No rescue missions found"
          subtitle="Rescue requests submitted by citizens will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
          <div className="space-y-4">
            {filteredReports.map((report) => {
              const nearestCamp = nearestPoint(report, camps);
              const nearestZone = nearestPoint(report, safeZones);
              const assigned = report.assigned_rescue_team_id;
              const assignedId = typeof assigned === "object" ? assigned?._id : assigned || "";
              const selected = selectedReport?._id === report._id;

              return (
                <div
                  key={report._id}
                  className={`rounded-lg border bg-white p-4 shadow-sm transition-all ${
                    selected ? "border-cyan-400 ring-2 ring-cyan-100" : "border-slate-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(report._id)}
                    className="w-full text-left"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="material-icons text-rose-500">emergency</span>
                      <h3 className="font-bold text-slate-900">Rescue request</h3>
                      <PriorityBadge level={report.severity} />
                      <StatusBadge status={report.rescue_status || "Unassigned"} />
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <span className="flex items-center gap-2">
                        <span className="material-icons text-sm text-slate-400">person</span>
                        {report.reporter_name} | {report.people_count} people
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="material-icons text-sm text-slate-400">phone</span>
                        {report.contact_phone}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="material-icons text-sm text-slate-400">location_on</span>
                        {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="material-icons text-sm text-slate-400">schedule</span>
                        {new Date(report.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {report.description && (
                      <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        {report.description}
                      </p>
                    )}
                    <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                      <span>
                        <b>Nearest camp:</b>{" "}
                        {nearestCamp ? `${nearestCamp.item.camp_name} (${nearestCamp.distance.toFixed(1)} km)` : "Not available"}
                      </span>
                      <span>
                        <b>Nearest safe zone:</b>{" "}
                        {nearestZone ? `${nearestZone.item.name} (${nearestZone.distance.toFixed(1)} km)` : "Not available"}
                      </span>
                    </div>
                  </button>

                  <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
                    {canAssign && (
                      <FormSelect
                        label="Assign Rescue Team"
                        value={assignedId}
                        onChange={(teamId) => assignTeam(report._id, teamId)}
                        options={[
                          { value: "", label: "Unassigned" },
                          ...teams.map((team) => ({ value: team._id, label: team.name || team.username })),
                        ]}
                      />
                    )}
                    {!canAssign && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        <b>Assigned team:</b> {teamName(assigned)}
                      </div>
                    )}
                    {canUpdate && (
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <FormSelect
                          label="Update Mission Status"
                          value={report.rescue_status || "Unassigned"}
                          onChange={(status) => updateStatus(report._id, status as RescueStatus)}
                          options={rescueStatuses.map((status) => ({ value: status, label: status }))}
                        />
                        <div className="flex items-end">
                          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                            {busyId === report._id ? "Saving..." : "Live"}
                          </span>
                        </div>
                        <input
                          value={noteByReport[report._id] || ""}
                          onChange={(event) =>
                            setNoteByReport((current) => ({
                              ...current,
                              [report._id]: event.target.value,
                            }))
                          }
                          placeholder="Mission note before status change"
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 sm:col-span-2"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-5">
            {selectedReport && (
              <>
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  <MapContainer
                    center={[selectedReport.latitude, selectedReport.longitude]}
                    zoom={12}
                    style={{ height: 360, width: "100%" }}
                    key={selectedReport._id}
                  >
                    <TileLayer
                      attribution="&copy; OpenStreetMap contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[selectedReport.latitude, selectedReport.longitude]}>
                      <Popup>Rescue request: {selectedReport.reporter_name}</Popup>
                    </Marker>
                    {selectedCamp && (
                      <Marker position={[selectedCamp.item.latitude, selectedCamp.item.longitude]}>
                        <Popup>Nearest camp: {selectedCamp.item.camp_name}</Popup>
                      </Marker>
                    )}
                    {selectedSafeZone && (
                      <Marker position={[selectedSafeZone.item.latitude, selectedSafeZone.item.longitude]}>
                        <Popup>Nearest safe zone: {selectedSafeZone.item.name}</Popup>
                      </Marker>
                    )}
                    {bestRoute?.route_coordinates?.length ? (
                      <Polyline
                        positions={bestRoute.route_coordinates.map((coord) => [coord[0], coord[1]] as [number, number])}
                        pathOptions={{
                          color: bestRoute.route_status === "Blocked" ? "#e11d48" : "#0891b2",
                          weight: 5,
                          opacity: 0.85,
                          dashArray: bestRoute.route_source === "road_network" ? undefined : "10 8",
                        }}
                      />
                    ) : null}
                  </MapContainer>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-900">
                      <span className="material-icons text-cyan-600">near_me</span>
                      Rescue Access
                    </h3>
                    <div className="space-y-2 text-sm text-slate-600">
                      <p>
                        <b>Nearest camp:</b>{" "}
                        {selectedCamp ? `${selectedCamp.item.camp_name} (${selectedCamp.distance.toFixed(1)} km)` : "Not available"}
                      </p>
                      <p>
                        <b>Nearest safe zone:</b>{" "}
                        {selectedSafeZone ? `${selectedSafeZone.item.name} (${selectedSafeZone.distance.toFixed(1)} km)` : "Not available"}
                      </p>
                      <p>
                        <b>Best available route:</b>{" "}
                        {bestRoute
                          ? `${bestRoute.route_type} | ${bestRoute.distance} km | safety ${bestRoute.safety_score}`
                          : "Generate a route to the nearest camp for road guidance"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-900">
                      <span className="material-icons text-emerald-600">history</span>
                      Mission History
                    </h3>
                    {selectedReport.rescue_history?.length ? (
                      <div className="space-y-3">
                        {[...selectedReport.rescue_history].reverse().map((entry, index) => (
                          <div key={`${entry.status}-${entry.updated_at}-${index}`} className="border-l-2 border-cyan-200 pl-3">
                            <p className="text-sm font-bold text-slate-800">{entry.status}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(entry.updated_at).toLocaleString()} by {teamName(entry.updated_by)}
                            </p>
                            {entry.note && <p className="mt-1 text-sm text-slate-600">{entry.note}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No mission updates recorded yet.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
