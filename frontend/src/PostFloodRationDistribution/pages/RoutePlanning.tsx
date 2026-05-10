import React, { useEffect, useState } from "react";
import {
  PageHeader,
  PrimaryButton,
  Loading,
  EmptyState,
  FormSelect,
} from "../components/UIComponents";
import * as api from "../services/api";
import { filterOutSeedCamps } from "../utils/filterSeedData";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function RoutePlanning() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [camps, setCamps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedCamp, setSelectedCamp] = useState("");
  const [startLat, setStartLat] = useState(6.9145);
  const [startLng, setStartLng] = useState(79.9738);
  const [routeType, setRouteType] = useState("Safest");
  const [routeMessage, setRouteMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [allRoutes, setAllRoutes] = useState<any[]>([]);

  const load = () => {
    setLoading(true);
    api.getCamps()
      .then(async (c) => {
        try {
          const campsFiltered = filterOutSeedCamps(c.data || []);
          setCamps(campsFiltered);
        } catch (e) {
          setCamps(c.data || []);
        }
      })
      .catch(console.error);

    api.getAllRoutes()
      .then((r) => setAllRoutes(r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  useEffect(() => {
    if (!selectedCamp) {
      setRoutes(allRoutes);
      return;
    }

    const campRoutes = allRoutes.filter(r => {
        const campId = typeof r.camp_id === 'object' ? r.camp_id._id : r.camp_id;
        return campId === selectedCamp;
    });
    setRoutes(campRoutes);
  }, [selectedCamp, allRoutes]);

  const handleGenerate = async () => {
    if (!selectedCamp) return alert("Select a camp");
    setRouteMessage("");
    setGenerating(true);
    try {
      const response = await api.generateRoute({
        camp_id: selectedCamp,
        start_latitude: startLat,
        start_longitude: startLng,
        route_type: routeType,
      });
      if (response.already_exists) {
        setRouteMessage("This route already exists for the selected camp and criteria.");
      } else {
        setRouteMessage("Route generated successfully.");
      }
      const campRoutes = await api.getRoutesByCamp(selectedCamp);
      setRoutes(campRoutes.data || []);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!confirm("Remove this generated route?")) return;

    try {
      await api.deleteRoute(routeId);
      load(); // Refresh everything
      setRouteMessage("Route removed successfully.");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getSafetyColor = (score: number) =>
    score >= 70
      ? "text-emerald-600"
      : score >= 40
        ? "text-amber-600"
        : "text-rose-600";
  const getSafetyBg = (score: number) =>
    score >= 70
      ? "from-emerald-50 to-green-50 border-emerald-200"
      : score >= 40
        ? "from-amber-50 to-yellow-50 border-amber-200"
        : "from-rose-50 to-pink-50 border-rose-200";

  if (loading) return <Loading />;

  const selectedCampName =
    camps.find((camp) => camp._id === selectedCamp)?.camp_name || "selected camp";
  const selectedCampData = camps.find((camp) => camp._id === selectedCamp);
  const visibleRoutes = routes.filter((route) => !statusFilter || route.route_status === statusFilter);
  const mapCenter =
    selectedCampData?.latitude && selectedCampData?.longitude
      ? [selectedCampData.latitude, selectedCampData.longitude]
      : [7.8731, 80.7718];

  return (
    <div>
      <PageHeader
        title="Route Planning"
        subtitle="Algorithmic route planning using A* and Dijkstra"
        icon="route"
      />

      <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        Routes start from SLIIT Malabe Campus by default. Safest and Alternative routes use A*. Shortest routes use Dijkstra.
      </div>

      {/* Global Route Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Routes", count: allRoutes.length, icon: "route", color: "bg-blue-100 text-blue-700" },
          { label: "Active", count: allRoutes.filter(r => r.route_status === "Active").length, icon: "check_circle", color: "bg-emerald-100 text-emerald-700" },
          { label: "Blocked", count: allRoutes.filter(r => r.route_status === "Blocked").length, icon: "block", color: "bg-rose-100 text-rose-700" },
          { label: "Avg Safety", count: allRoutes.length ? Math.round(allRoutes.reduce((acc, r) => acc + (r.safety_score || 0), 0) / allRoutes.length) : 0, icon: "security", color: "bg-purple-100 text-purple-700" },
        ].map(stat => (
          <div key={stat.label} className={`${stat.color} p-4 rounded-2xl flex items-center gap-3 shadow-sm`}>
            <span className="material-icons">{stat.icon}</span>
            <div>
              <p className="text-xl font-bold">{stat.count}</p>
              <p className="text-xs opacity-80">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Route Generator */}
      <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 mb-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="material-icons text-cyan-500">add_road</span>Generate
          New Route
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <FormSelect
            label="Destination Camp"
            value={selectedCamp}
            onChange={setSelectedCamp}
            options={[
              { value: "", label: "All Destination Camps" },
              ...camps.map((c) => ({ value: c._id, label: c.camp_name }))
            ]}
          />
          <FormSelect
            label="Route Type"
            value={routeType}
            onChange={setRouteType}
            options={[
              { value: "Safest", label: "Safest - A*" },
              { value: "Shortest", label: "Shortest - Dijkstra" },
              { value: "Alternative", label: "Alternative - A*" },
            ]}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Latitude - SLIIT
            </label>
            <input
              type="number"
              value={startLat}
              onChange={(e) => setStartLat(Number(e.target.value))}
              step="0.0001"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-300 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Longitude - SLIIT
            </label>
            <input
              type="number"
              value={startLng}
              onChange={(e) => setStartLng(Number(e.target.value))}
              step="0.0001"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-300 outline-none"
            />
          </div>
          <PrimaryButton
            onClick={handleGenerate}
            icon="route"
            disabled={generating}
          >
            {generating ? "Generating..." : "Generate Route"}
          </PrimaryButton>
        </div>
        {routeMessage && (
          <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-700">
            {routeMessage}
          </div>
        )}
      </div>

      {/* Routes List */}
      {routes.length === 0 ? (
        <EmptyState
          icon="route"
          title="No routes generated"
          subtitle={`Generate a route for ${selectedCampName}`}
        />
      ) : (
        <div>
          <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm font-medium text-gray-600">
              Routes for {selectedCampName}
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm"
            >
              <option value="">All route statuses</option>
              <option value="Active">Active</option>
              <option value="Alternative">Alternative</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>

          <div className="mb-4 overflow-hidden rounded-2xl border border-gray-100 shadow-lg">
            <MapContainer
              center={mapCenter as [number, number]}
              zoom={11}
              style={{ height: 320, width: "100%" }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {selectedCampData && (
                <Marker position={[selectedCampData.latitude, selectedCampData.longitude]}>
                  <Popup>{selectedCampName}</Popup>
                </Marker>
              )}
              {visibleRoutes.map((route) => {
                const positions = (route.route_coordinates || []).map((coord: number[]) => [coord[0], coord[1]]);
                return (
                  <Polyline
                    key={route._id}
                    positions={positions}
                    pathOptions={{
                      color: route.route_status === "Blocked" ? "#e11d48" : route.route_status === "Alternative" ? "#f59e0b" : "#059669",
                      weight: 5,
                    }}
                  />
                );
              })}
            </MapContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visibleRoutes.map((r) => {
            const campName =
              typeof r.camp_id === "object" ? r.camp_id.camp_name : "Unknown";
            return (
              <div
                key={r._id}
                className={`rounded-2xl p-5 shadow-lg border bg-gradient-to-br ${getSafetyBg(r.safety_score)} hover:shadow-xl transition-shadow`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-800">
                      {r.route_name || `Route to ${campName}`}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {r.route_type} Route | {r.route_algorithm || (r.route_type === "Shortest" ? "Dijkstra" : "A*")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-2xl font-bold ${getSafetyColor(r.safety_score)}`}
                    >
                      {r.safety_score}
                    </p>
                    <p className="text-xs text-gray-500">Safety Score</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center p-2 bg-white/60 rounded-xl">
                    <span className="material-icons text-sm text-blue-500">
                      straighten
                    </span>
                    <p className="text-sm font-bold text-gray-800">
                      {r.distance} km
                    </p>
                    <p className="text-xs text-gray-500">Distance</p>
                  </div>
                  <div className="text-center p-2 bg-white/60 rounded-xl">
                    <span className="material-icons text-sm text-purple-500">
                      schedule
                    </span>
                    <p className="text-sm font-bold text-gray-800">
                      {r.estimated_time}
                    </p>
                    <p className="text-xs text-gray-500">Est. Time</p>
                  </div>
                  <div className="text-center p-2 bg-white/60 rounded-xl">
                    <span className="material-icons text-sm text-cyan-500">
                      pin_drop
                    </span>
                    <p className="text-sm font-bold text-gray-800">
                      {r.route_coordinates?.length || 0}
                    </p>
                    <p className="text-xs text-gray-500">Waypoints</p>
                  </div>
                </div>
                {r.warnings && r.warnings.length > 0 && (
                  <div className="space-y-1">
                    {r.warnings.map((w: string, i: number) => (
                      <p
                        key={i}
                        className="text-xs text-amber-700 flex items-center gap-1"
                      >
                        <span className="material-icons text-xs">warning</span>
                        {w}
                      </p>
                    ))}
                  </div>
                )}
                <div className="mt-3 pt-2 border-t border-gray-200/50">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${r.route_status === "Active" ? "bg-emerald-100 text-emerald-700" : r.route_status === "Blocked" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}
                    >
                      {r.route_status}
                    </span>
                    <button
                      onClick={() => handleDeleteRoute(r._id)}
                      className="px-2 py-1 rounded-lg text-xs font-medium bg-rose-100 text-rose-700 hover:bg-rose-200"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
