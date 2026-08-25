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
import { GoogleMapActions, getGoogleMapsRouteUrl } from "../utils/googleMaps";
import { useLiveRefresh } from "../utils/useLiveRefresh";
import { enqueueOfflineAction, getOfflineQueue, subscribeOfflineQueue, syncOfflineQueue } from "../utils/offlineQueue";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { FitMapToPoints, LiveRoadIncidentLayer, operationalEmojiIcon, type LiveRoadIncident } from "../components/MapHelpers";

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

const rescueLocationIcon = operationalEmojiIcon({
  emoji: "🆘",
  label: "Rescue",
  color: "#dc2626",
  size: 42,
});

const reliefCampIcon = operationalEmojiIcon({
  emoji: "🏕️",
  label: "Relief camp",
  color: "#16a34a",
  size: 40,
});

const safeZoneIcon = operationalEmojiIcon({
  emoji: "🛡️",
  label: "Safe zone",
  color: "#2563eb",
  size: 38,
});

const teamLocationIcon = operationalEmojiIcon({
  emoji: "GPS",
  label: "Team",
  color: "#0891b2",
  size: 38,
});

const rescueCenterIcon = operationalEmojiIcon({
  emoji: "HQ",
  label: "Rescue center",
  color: "#7c3aed",
  size: 38,
});

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

function assignedTeamId(report: NeedReport) {
  const assigned = report.assigned_rescue_team_id;
  return typeof assigned === "object" ? assigned?._id || "" : assigned || "";
}

function campIdFromRoute(route: RouteData) {
  return typeof route.camp_id === "object" ? route.camp_id._id : route.camp_id;
}

export default function RescueOperations({ userRole }: { userRole: string }) {
  const [reports, setReports] = useState<NeedReport[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [rescueCenters, setRescueCenters] = useState<any[]>([]);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [liveRoadIncidents, setLiveRoadIncidents] = useState<LiveRoadIncident[]>([]);
  const [teamLocations, setTeamLocations] = useState<any[]>([]);
  const [showLiveRoadIncidents, setShowLiveRoadIncidents] = useState(false);
  const [showTeamLocations, setShowTeamLocations] = useState(true);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [rescueCenterFilter, setRescueCenterFilter] = useState("");
  const [mapViewMode, setMapViewMode] = useState<"current" | "all">("current");
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [noteByReport, setNoteByReport] = useState<Record<string, string>>({});
  const [transportByReport, setTransportByReport] = useState<Record<string, "truck" | "boat">>({});
  const [rescueCenterByReport, setRescueCenterByReport] = useState<Record<string, string>>({});
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(() => getOfflineQueue().length);
  const [offlineNotice, setOfflineNotice] = useState("");
  const [teamForm, setTeamForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "Team@123",
  });
  const [teamFormError, setTeamFormError] = useState("");

  const canAssign = ["admin", "disaster_officer"].includes(userRole.toLowerCase());
  const canUpdate = Permissions.canManageRescueOperations(userRole);
  const canManageTeams = userRole.toLowerCase() === "admin";

  const load = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [rescueRes, campsRes, zonesRes, rescueCentersRes, routesRes, teamsRes, liveRoadRes, teamLocationRes] = await Promise.all([
        api.getRescueOperations(),
        api.getCamps().catch(() => ({ data: [] })),
        api.getSafeZones().catch(() => ({ data: [] })),
        api.getRescueCenters().catch(() => ({ data: [] })),
        api.getAllRoutes().catch(() => ({ data: [] })),
        api.getUsersByRole("rescue_team").catch(() => ({ data: [] })),
        (api as any).getLiveRoadConditions?.().catch(() => ({ data: { blocked_roads: [] } })),
        api.getLatestRescueTeamLocations().catch(() => ({ data: [] })),
      ]);
      setReports(rescueRes.data || []);
      setCamps(campsRes.data || []);
      setSafeZones(zonesRes.data || []);
      setRescueCenters(rescueCentersRes.data || []);
      setRoutes(routesRes.data || []);
      setLiveRoadIncidents(liveRoadRes?.data?.blocked_roads || []);
      setTeamLocations(teamLocationRes?.data || []);
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
  useEffect(() => {
    const refresh = () => setOfflineQueueCount(getOfflineQueue().length);
    const unsubscribe = subscribeOfflineQueue(refresh);
    refresh();
    return unsubscribe;
  }, []);

  const filteredReports = useMemo(() => {
    return reports
      .filter((report) => !statusFilter || (report.rescue_status || "Unassigned") === statusFilter)
      .filter((report) => !severityFilter || report.severity === severityFilter)
      .filter((report) => {
        if (!teamFilter) return true;
        return assignedTeamId(report) === teamFilter;
      })
      .filter((report) => {
        if (!rescueCenterFilter) return true;
        const center = nearestPoint(report, rescueCenters.filter((item) => item.operating_status !== "Closed"));
        return center?.item?._id === rescueCenterFilter;
      })
      .sort((a, b) => {
        const aClosed = ["Rescued", "Closed"].includes(a.rescue_status || "");
        const bClosed = ["Rescued", "Closed"].includes(b.rescue_status || "");
        if (aClosed !== bClosed) return aClosed ? 1 : -1;
        return (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
      });
  }, [reports, statusFilter, severityFilter, teamFilter, rescueCenterFilter, rescueCenters]);

  const selectedReport = filteredReports.find((report) => report._id === selectedId) || filteredReports[0];
  const usableRescueCenters = rescueCenters.filter((center) => center.operating_status !== "Closed");
  const getRescueCenterForReport = (report: NeedReport | undefined) => {
    if (!report) return null;
    const selectedCenterId = rescueCenterByReport[report._id];
    const selectedCenter = selectedCenterId
      ? usableRescueCenters.find((center) => center._id === selectedCenterId)
      : null;
    if (selectedCenter) {
      return {
        item: selectedCenter,
        distance: distanceKm(report.latitude, report.longitude, selectedCenter.latitude, selectedCenter.longitude),
      };
    }
    return nearestPoint(report, usableRescueCenters);
  };
  const selectedRescueCenter = getRescueCenterForReport(selectedReport);
  const selectedCamp = selectedReport ? nearestPoint(selectedReport, camps) : null;
  const selectedSafeZone = selectedReport ? nearestPoint(selectedReport, safeZones) : null;
  const currentRouteOptions = selectedCamp
    ? routes
        .filter((route) => campIdFromRoute(route) === selectedCamp.item._id)
        .sort((a, b) => {
          if ((b.safety_score || 0) !== (a.safety_score || 0)) return (b.safety_score || 0) - (a.safety_score || 0);
          return (a.distance || 9999) - (b.distance || 9999);
        })
    : [];
  const suggestedRoute = currentRouteOptions[0] || null;
  const selectedRoute = currentRouteOptions.find((route) => route._id === selectedRouteId) || null;

  const activeCount = reports.filter((r) => !["Rescued", "Closed"].includes(r.rescue_status || "")).length;
  const assignedCount = reports.filter((r) => r.assigned_rescue_team_id).length;
  const emergencyCount = reports.filter((r) => ["Emergency", "Critical"].includes(r.severity)).length;
  const rescuedCount = reports.filter((r) => ["Rescued", "Closed"].includes(r.rescue_status || "")).length;
  const teamWorkload = useMemo(() => {
    return teams.map((team) => {
      const assignedReports = reports.filter((report) => assignedTeamId(report) === team._id);
      const activeReports = assignedReports.filter((report) => !["Rescued", "Closed"].includes(report.rescue_status || ""));
      const urgentReports = activeReports.filter((report) => ["Emergency", "Critical"].includes(report.severity));
      const nextMission = [...activeReports].sort((a, b) => {
        const severityDiff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
        if (severityDiff !== 0) return severityDiff;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      })[0];
      const loadLabel = activeReports.length >= 3 ? "High load" : activeReports.length >= 1 ? "Available" : "Standby";
      return {
        team,
        assigned: assignedReports.length,
        active: activeReports.length,
        urgent: urgentReports.length,
        completed: assignedReports.filter((report) => ["Rescued", "Closed"].includes(report.rescue_status || "")).length,
        nextMission,
        loadLabel,
      };
    });
  }, [reports, teams]);
  const visibleReports = mapViewMode === "all" ? filteredReports : selectedReport ? [selectedReport] : [];
  const mapRoutes = mapViewMode === "current" && selectedRoute ? [selectedRoute] : [];
  const selectedMapPoints: [number, number][] = [
    ...visibleReports.map((report) => [report.latitude, report.longitude] as [number, number]),
    ...(mapViewMode === "current" && selectedRescueCenter ? [[selectedRescueCenter.item.latitude, selectedRescueCenter.item.longitude] as [number, number]] : []),
    ...(mapViewMode === "current" && selectedCamp ? [[selectedCamp.item.latitude, selectedCamp.item.longitude] as [number, number]] : []),
    ...(mapViewMode === "current" && selectedSafeZone ? [[selectedSafeZone.item.latitude, selectedSafeZone.item.longitude] as [number, number]] : []),
    ...mapRoutes.flatMap((route) => (route.route_coordinates || []).map((coord) => [coord[0], coord[1]] as [number, number])),
  ];
  const selectedRescueDispatchLine: [number, number][] =
    mapViewMode === "current" && selectedReport && selectedRescueCenter
      ? [
          [selectedRescueCenter.item.latitude, selectedRescueCenter.item.longitude],
          [selectedReport.latitude, selectedReport.longitude],
        ]
      : [];

  const recommendedTransportMode = (report: NeedReport) => {
    return (report as any).rescue_transport_mode || "truck";
  };

  const selectedTransportMode = (report: NeedReport) =>
    transportByReport[report._id] || (report as any).rescue_transport_mode || recommendedTransportMode(report);

  const assignTeam = async (reportId: string, teamId: string) => {
    const report = reports.find((item) => item._id === reportId);
    setBusyId(reportId);
    try {
      const mode = report ? selectedTransportMode(report) : "truck";
      const body = {
        assigned_rescue_team_id: teamId || null,
        rescue_transport_mode: mode,
        note: teamId ? `Assigned from rescue operations dashboard by ${mode}` : "Assignment cleared",
      };
      if (!navigator.onLine) {
        enqueueOfflineAction({
          label: "Rescue team assignment",
          path: `/need-reports/${reportId}/rescue-assignment`,
          method: "PUT",
          body,
        });
        setOfflineQueueCount(getOfflineQueue().length);
        setOfflineNotice("Rescue assignment saved offline and will sync when internet returns.");
        return;
      }
      await api.assignRescueTeam(reportId, body);
      await load(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setBusyId("");
    }
  };

  const updateStatus = async (reportId: string, status: RescueStatus) => {
    const report = reports.find((item) => item._id === reportId);
    setBusyId(reportId);
    try {
      const mode = report ? selectedTransportMode(report) : "truck";
      const body = {
        rescue_status: status,
        rescue_transport_mode: mode,
        note: noteByReport[reportId] || "",
      };
      if (!navigator.onLine) {
        enqueueOfflineAction({
          label: `Rescue status update: ${status}`,
          path: `/need-reports/${reportId}/rescue-status`,
          method: "PUT",
          body,
        });
        setNoteByReport((current) => ({ ...current, [reportId]: "" }));
        setOfflineQueueCount(getOfflineQueue().length);
        setOfflineNotice("Rescue status saved offline and will sync when internet returns.");
        return;
      }
      await api.updateRescueStatus(reportId, body);
      setNoteByReport((current) => ({ ...current, [reportId]: "" }));
      await load(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setBusyId("");
    }
  };

  const createRescueTeam = async () => {
    setTeamFormError("");
    if (!teamForm.name.trim()) {
      setTeamFormError("Team name is required.");
      return;
    }
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(teamForm.username.trim())) {
      setTeamFormError("Username must be 3-40 characters using letters, numbers, dot, underscore, or dash.");
      return;
    }
    if (teamForm.password.length < 6) {
      setTeamFormError("Password must be at least 6 characters.");
      return;
    }

    try {
      await api.createUser({
        ...teamForm,
        role: "rescue_team",
      });
      setTeamForm({
        name: "",
        username: "",
        email: "",
        password: "Team@123",
      });
      setShowTeamForm(false);
      await load(false);
    } catch (error: any) {
      setTeamFormError(error.message || "Failed to create rescue team.");
    }
  };

  const shareMyLocation = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not available in this browser.");
      return;
    }
    setSharingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await api.updateMyRescueLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy_meters: position.coords.accuracy,
            status: "available",
            source: "browser_gps",
          });
          await load(false);
        } catch (error: any) {
          alert(error.message || "Failed to share location.");
        } finally {
          setSharingLocation(false);
        }
      },
      (error) => {
        alert(error.message || "Could not read GPS location.");
        setSharingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
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
          <FormSelect
            label="Rescue Center"
            value={rescueCenterFilter}
            onChange={setRescueCenterFilter}
            options={[
              { value: "", label: "All rescue centers" },
              ...rescueCenters
                .filter((center) => center.operating_status !== "Closed")
                .map((center) => ({ value: center._id, label: center.name })),
            ]}
          />
          <div className="flex items-end">
            <PrimaryButton onClick={() => void load(false)} icon="refresh">
              Refresh
            </PrimaryButton>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <button
            onClick={() => setShowLiveRoadIncidents((current) => !current)}
            className={`rounded-lg border px-3 py-2 font-semibold ${
              showLiveRoadIncidents
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            RDA road incidents ({liveRoadIncidents.length})
          </button>
          <span>Used to visually verify road hazards near rescue movement.</span>
          <button
            onClick={() => setShowTeamLocations((current) => !current)}
            className={`rounded-lg border px-3 py-2 font-semibold ${
              showTeamLocations
                ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            Team GPS ({teamLocations.filter((item) => item.location).length})
          </button>
          {userRole.toLowerCase() === "rescue_team" && (
            <button
              onClick={shareMyLocation}
              disabled={sharingLocation}
              className="rounded-lg bg-slate-900 px-3 py-2 font-bold text-white disabled:opacity-60"
            >
              {sharingLocation ? "Sharing..." : "Share my GPS"}
            </button>
          )}
          {offlineQueueCount > 0 && (
            <button
              onClick={async () => {
                const result = await syncOfflineQueue();
                setOfflineQueueCount(getOfflineQueue().length);
                setOfflineNotice(result.online ? `${result.synced} offline update(s) synced.` : "Still offline. Updates remain queued.");
                if (result.synced > 0) await load(false);
              }}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-800"
            >
              Sync offline updates ({offlineQueueCount})
            </button>
          )}
        </div>
        {offlineNotice && <p className="mt-2 text-xs font-bold text-amber-700">{offlineNotice}</p>}
      </div>

      {teamWorkload.length > 0 && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <span className="material-icons text-cyan-600">groups</span>
                Rescue Team Workload
              </h3>
              <p className="text-xs text-slate-500">Click a team to filter missions and show operational readiness.</p>
            </div>
            <span className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700">
              {teamWorkload.reduce((sum, item) => sum + item.active, 0)} active assigned mission(s)
            </span>
            {canManageTeams && (
              <button
                type="button"
                onClick={() => setShowTeamForm((current) => !current)}
                className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-cyan-700"
              >
                <span className="material-icons text-sm">{showTeamForm ? "close" : "add"}</span>
                {showTeamForm ? "Close" : "Add Rescue Team"}
              </button>
            )}
          </div>
          {showTeamForm && canManageTeams && (
            <div className="mb-4 rounded-lg border border-cyan-200 bg-cyan-50 p-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <input
                  value={teamForm.name}
                  onChange={(event) => setTeamForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Team name"
                  className="rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                />
                <input
                  value={teamForm.username}
                  onChange={(event) => setTeamForm((current) => ({ ...current, username: event.target.value }))}
                  placeholder="username"
                  className="rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                />
                <input
                  value={teamForm.email}
                  onChange={(event) => setTeamForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="team email"
                  className="rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                />
                <input
                  value={teamForm.password}
                  onChange={(event) => setTeamForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="temporary password"
                  className="rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-cyan-800">
                  New teams are created as users with role <b>rescue_team</b> and appear in assignment dropdowns immediately.
                </p>
                <button
                  type="button"
                  onClick={createRescueTeam}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <span className="material-icons text-sm">save</span>
                  Save Team
                </button>
              </div>
              {teamFormError && <p className="mt-2 text-xs font-bold text-rose-700">{teamFormError}</p>}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {teamWorkload.map((item) => (
              <button
                key={item.team._id}
                type="button"
                onClick={() => setTeamFilter((current) => current === item.team._id ? "" : item.team._id)}
                className={`rounded-lg border p-3 text-left transition-all ${
                  teamFilter === item.team._id
                    ? "border-cyan-400 bg-cyan-50 ring-2 ring-cyan-100"
                    : "border-slate-200 bg-slate-50 hover:border-cyan-200 hover:bg-cyan-50/60"
                }`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900">{item.team.name || item.team.username}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    item.loadLabel === "High load"
                      ? "bg-rose-100 text-rose-700"
                      : item.loadLabel === "Available"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                  }`}>
                    {item.loadLabel}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md bg-white p-2">
                    <b className="block text-slate-900">{item.active}</b>
                    <span className="text-slate-500">Active</span>
                  </div>
                  <div className="rounded-md bg-white p-2">
                    <b className="block text-rose-700">{item.urgent}</b>
                    <span className="text-slate-500">Urgent</span>
                  </div>
                  <div className="rounded-md bg-white p-2">
                    <b className="block text-emerald-700">{item.completed}</b>
                    <span className="text-slate-500">Done</span>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-slate-600">
                  <b>Next:</b>{" "}
                  {item.nextMission
                    ? `${item.nextMission.severity} rescue for ${item.nextMission.people_count} people`
                    : "No active assignment"}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

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
              const recommendedMode = recommendedTransportMode(report);
              const rescueMode = selectedTransportMode(report);
              const reportRescueCenter = getRescueCenterForReport(report);

              return (
                <div
                  key={report._id}
                  className={`rounded-lg border bg-white p-4 shadow-sm transition-all ${
                    selected ? "border-cyan-400 ring-2 ring-cyan-100" : "border-slate-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(report._id);
                      setMapViewMode("current");
                      setSelectedRouteId("");
                    }}
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
                        <GoogleMapActions latitude={report.latitude} longitude={report.longitude} compact />
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
                      <span>
                        <b>Nearest rescue center:</b>{" "}
                        {reportRescueCenter
                          ? `${reportRescueCenter.item.name} (${reportRescueCenter.distance.toFixed(1)} km)`
                          : "Not available"}
                      </span>
                      <span>
                        <b>Response mode:</b>{" "}
                        <span className={rescueMode === "boat" ? "font-bold text-blue-700" : "font-bold text-slate-700"}>
                          {rescueMode === "boat" ? "Boat rescue" : "Road vehicle"}
                        </span>
                      </span>
                    </div>
                  </button>

                  <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
                    <FormSelect
                      label="Dispatch Rescue Center"
                      value={rescueCenterByReport[report._id] || reportRescueCenter?.item?._id || ""}
                      onChange={(centerId) => {
                        setRescueCenterByReport((current) => ({
                          ...current,
                          [report._id]: centerId,
                        }));
                        setSelectedId(report._id);
                        setMapViewMode("current");
                      }}
                      options={[
                        { value: "", label: "Nearest available center" },
                        ...usableRescueCenters.map((center) => ({ value: center._id, label: center.name })),
                      ]}
                    />
                    <FormSelect
                      label="Rescue Mode"
                      value={rescueMode}
                      onChange={(mode) =>
                        setTransportByReport((current) => ({
                          ...current,
                          [report._id]: mode as "truck" | "boat",
                        }))
                      }
                      options={[
                        { value: "truck", label: recommendedMode === "truck" ? "Road Vehicle (Recommended)" : "Road Vehicle" },
                        { value: "boat", label: "Boat" },
                      ]}
                    />
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-800">
                      Select Boat only when field teams confirm road movement is not possible or flood access is safer.
                    </div>
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
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-3">
                    <div>
                      <div className="text-sm font-bold text-slate-800">
                        {mapViewMode === "all" ? "All rescue missions map" : "Selected rescue map"}
                      </div>
                      <p className="text-xs text-slate-500">
                        {mapViewMode === "all"
                          ? `${visibleReports.length} mission(s) visible from current filters`
                          : `${selectedReport.reporter_name} | ${selectedReport.latitude.toFixed(4)}, ${selectedReport.longitude.toFixed(4)}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={mapViewMode}
                        onChange={(event) => setMapViewMode(event.target.value as "current" | "all")}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-cyan-400"
                      >
                        <option value="current">Current mission</option>
                        <option value="all">All filtered missions</option>
                      </select>
                      <select
                        value={selectedReport._id}
                        onChange={(event) => {
                          setSelectedId(event.target.value);
                          setMapViewMode("current");
                          setSelectedRouteId("");
                        }}
                        className="max-w-[220px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-cyan-400"
                      >
                        {filteredReports.map((report) => (
                          <option key={report._id} value={report._id}>
                            {report.reporter_name} | {report.severity} | {report.people_count} people
                          </option>
                        ))}
                      </select>
                      {mapViewMode === "current" && currentRouteOptions.length > 0 && (
                        <select
                          value={selectedRouteId}
                          onChange={(event) => setSelectedRouteId(event.target.value)}
                          className="max-w-[210px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-cyan-400"
                        >
                          <option value="">Select camp route</option>
                          {currentRouteOptions.map((route, index) => (
                            <option key={route._id} value={route._id}>
                              {index + 1}. Camp route | {route.distance ?? "N/A"} km | safety {route.safety_score ?? "N/A"}
                            </option>
                          ))}
                        </select>
                      )}
                      {mapViewMode === "current" && (
                        <select
                          value={rescueCenterByReport[selectedReport._id] || selectedRescueCenter?.item?._id || ""}
                          onChange={(event) =>
                            setRescueCenterByReport((current) => ({
                              ...current,
                              [selectedReport._id]: event.target.value,
                            }))
                          }
                          className="max-w-[220px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-cyan-400"
                        >
                          <option value="">Nearest rescue center</option>
                          {usableRescueCenters.map((center) => (
                            <option key={center._id} value={center._id}>
                              {center.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <GoogleMapActions latitude={selectedReport.latitude} longitude={selectedReport.longitude} compact />
                      {mapViewMode === "current" && selectedRoute?.route_coordinates?.length ? (
                        <a
                          href={getGoogleMapsRouteUrl(selectedRoute.route_coordinates.map((coord) => [coord[0], coord[1]] as [number, number]))}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-cyan-50 px-2 py-1 text-xs font-bold text-cyan-700 hover:bg-cyan-100"
                        >
                          <span className="material-icons text-xs">route</span>
                          Open Camp Route
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <MapContainer
                    center={[selectedReport.latitude, selectedReport.longitude]}
                    zoom={12}
                    style={{ height: 360, width: "100%" }}
                    key={`${mapViewMode}-${selectedReport._id}`}
                  >
                    <TileLayer
                      attribution="&copy; OpenStreetMap contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <FitMapToPoints points={selectedMapPoints} />
                    {showLiveRoadIncidents && <LiveRoadIncidentLayer incidents={liveRoadIncidents} maxItems={120} />}
                    {showTeamLocations && teamLocations
                      .filter((item) => item.location)
                      .map((item) => (
                        <Marker
                          key={`team-location-${item.team?._id}`}
                          position={[item.location.latitude, item.location.longitude]}
                          icon={teamLocationIcon}
                          zIndexOffset={1900}
                        >
                          <Popup>
                            <div className="text-xs">
                              <p className="font-bold">{item.team?.name || item.team?.username || "Rescue team"}</p>
                              <p>{item.is_online ? "Online" : "Last known location"}</p>
                              <p>{new Date(item.location.recorded_at).toLocaleString()}</p>
                              <GoogleMapActions latitude={item.location.latitude} longitude={item.location.longitude} compact />
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                    {visibleReports.map((report) => (
                      <Marker
                        key={`rescue-${report._id}`}
                        position={[report.latitude, report.longitude]}
                        icon={rescueLocationIcon}
                        zIndexOffset={selectedReport._id === report._id ? 1900 : 1800}
                      >
                        <Popup>
                          <div className="text-xs">
                            <p className="font-bold">Rescue location: {report.reporter_name}</p>
                            <p>{report.severity} | {report.people_count} people | {report.rescue_status || "Unassigned"}</p>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedId(report._id);
                                setMapViewMode("current");
                                setSelectedRouteId("");
                              }}
                              className="mt-2 rounded-md bg-cyan-600 px-2 py-1 text-xs font-bold text-white"
                            >
                              Focus mission
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                    {mapViewMode === "current" && selectedCamp && (
                      <Marker position={[selectedCamp.item.latitude, selectedCamp.item.longitude]} icon={reliefCampIcon} zIndexOffset={1700}>
                        <Popup>
                          <div className="text-xs">
                            <p className="font-bold">Nearest relief distribution camp: {selectedCamp.item.camp_name}</p>
                            <a href={getGoogleMapsRouteUrl([[selectedCamp.item.latitude, selectedCamp.item.longitude]])} target="_blank" rel="noreferrer">
                              Open exact pin in Google Maps
                            </a>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                    {mapViewMode === "current" && selectedRescueCenter && (
                      <Marker position={[selectedRescueCenter.item.latitude, selectedRescueCenter.item.longitude]} icon={rescueCenterIcon} zIndexOffset={1750}>
                        <Popup>
                          <div className="text-xs">
                            <p className="font-bold">Nearest rescue center: {selectedRescueCenter.item.name}</p>
                            <p>{selectedRescueCenter.distance.toFixed(1)} km from rescue location</p>
                            <GoogleMapActions latitude={selectedRescueCenter.item.latitude} longitude={selectedRescueCenter.item.longitude} compact />
                          </div>
                        </Popup>
                      </Marker>
                    )}
                    {selectedRescueDispatchLine.length === 2 && (
                      <Polyline
                        positions={selectedRescueDispatchLine}
                        pathOptions={{
                          color: "#7c3aed",
                          weight: 4,
                          opacity: 0.75,
                          dashArray: "8 8",
                        }}
                      />
                    )}
                    {mapViewMode === "current" && selectedSafeZone && (
                      <Marker position={[selectedSafeZone.item.latitude, selectedSafeZone.item.longitude]} icon={safeZoneIcon} zIndexOffset={1600}>
                        <Popup>
                          <div className="text-xs">
                            <p className="font-bold">Nearest safe zone: {selectedSafeZone.item.name}</p>
                            <a href={getGoogleMapsRouteUrl([[selectedSafeZone.item.latitude, selectedSafeZone.item.longitude]])} target="_blank" rel="noreferrer">
                              Open exact pin in Google Maps
                            </a>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                    {mapRoutes.map((route, index) => (
                      <Polyline
                        key={`rescue-route-${route._id}`}
                        positions={route.route_coordinates.map((coord) => [coord[0], coord[1]] as [number, number])}
                        pathOptions={{
                          color: route.route_status === "Blocked" ? "#e11d48" : index % 2 === 0 ? "#0891b2" : "#16a34a",
                          weight: mapViewMode === "current" ? 5 : 4,
                          opacity: mapViewMode === "current" ? 0.85 : 0.58,
                          dashArray: route.route_source === "road_network" ? undefined : "10 8",
                        }}
                      />
                    ))}
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
                      {selectedCamp && (
                        <GoogleMapActions latitude={selectedCamp.item.latitude} longitude={selectedCamp.item.longitude} compact />
                      )}
                      <p>
                        <b>Nearest safe zone:</b>{" "}
                        {selectedSafeZone ? `${selectedSafeZone.item.name} (${selectedSafeZone.distance.toFixed(1)} km)` : "Not available"}
                      </p>
                      {selectedSafeZone && (
                        <GoogleMapActions latitude={selectedSafeZone.item.latitude} longitude={selectedSafeZone.item.longitude} compact />
                      )}
                      <p>
                        <b>Nearest rescue center:</b>{" "}
                        {selectedRescueCenter ? `${selectedRescueCenter.item.name} (${selectedRescueCenter.distance.toFixed(1)} km)` : "Not available"}
                      </p>
                      {selectedRescueCenter && (
                        <GoogleMapActions latitude={selectedRescueCenter.item.latitude} longitude={selectedRescueCenter.item.longitude} compact />
                      )}
                      <p>
                        <b>Selected camp route:</b>{" "}
                        {selectedRoute
                          ? `${selectedRoute.route_type} | ${selectedRoute.distance} km | safety ${selectedRoute.safety_score}`
                          : suggestedRoute
                            ? `Route available (${suggestedRoute.distance} km, safety ${suggestedRoute.safety_score}). Select it from the map route dropdown to display.`
                            : "Generate a route to the nearest camp for road guidance"}
                      </p>
                      <p>
                        <b>Recommended response mode:</b>{" "}
                        {selectedReport && selectedTransportMode(selectedReport) === "boat"
                          ? "Boat rescue"
                          : "Road vehicle"}
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
