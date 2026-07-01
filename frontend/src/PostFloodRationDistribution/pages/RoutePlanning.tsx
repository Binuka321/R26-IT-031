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
import { useLiveRefresh } from "../utils/useLiveRefresh";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
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
  const [routeMode, setRouteMode] = useState("Safest");
  const [vehicleType, setVehicleType] = useState("truck");
  const [trafficLevel, setTrafficLevel] = useState("Clear");
  const [bridgeCondition, setBridgeCondition] = useState("Clear");
  const [minimumRoadWidth, setMinimumRoadWidth] = useState(3.5);
  const [restrictSelectedVehicle, setRestrictSelectedVehicle] = useState(false);
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
  useLiveRefresh(load, [], 15000, !generating);

  useEffect(() => {
    if (!selectedCamp) {
      setRoutes(allRoutes);
      return;
    }

    const campRoutes = allRoutes.filter(r => {
        const campId = r.camp_id && typeof r.camp_id === 'object' ? r.camp_id._id : r.camp_id;
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
        route_type:
          routeMode === "BackupSafest"
            ? "Safest"
            : routeMode === "BackupShortest"
              ? "Shortest"
              : routeMode,
        vehicle_type: vehicleType,
        road_constraints: {
          traffic_level: trafficLevel,
          bridge_condition: bridgeCondition,
          minimum_road_width_m: minimumRoadWidth,
          restricted_vehicle_types: restrictSelectedVehicle ? [vehicleType] : [],
        },
      });
      if (response.already_exists) {
        setRouteMessage("This route already exists for the selected camp and criteria.");
      } else {
        setRouteMessage("Route generated successfully.");
      }
      if (response.data) {
        setAllRoutes((currentRoutes) => {
          const withoutDuplicate = currentRoutes.filter((route) => route._id !== response.data._id);
          return [response.data, ...withoutDuplicate];
        });
      }
      const campRoutes = await api.getRoutesByCamp(selectedCamp);
      setRoutes(campRoutes.data || []);
      const refreshedRoutes = await api.getAllRoutes();
      setAllRoutes(refreshedRoutes.data || []);
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
      ? "bg-white border-emerald-200"
      : score >= 40
        ? "bg-white border-amber-200"
        : "bg-white border-rose-200";

  if (loading) return <Loading />;

  const selectedCampName =
    camps.find((camp) => camp._id === selectedCamp)?.camp_name || "selected camp";
  const selectedCampData = camps.find((camp) => camp._id === selectedCamp);
  const visibleRoutes = routes.filter((route) => !statusFilter || route.route_status === statusFilter);
  const routeTypeHelp: Record<string, string> = {
    Safest:
      "Recommended for relief delivery. It chooses the route with the best safety score after checking road data and danger areas.",
    Shortest:
      "Use only when roads are already confirmed safe. It prioritizes the lowest travel distance.",
    Alternative:
      "Use when the main route is risky, busy, or blocked. It gives another route option for comparison.",
    BackupSafest:
      "Backup option. It estimates a safer path using A* when road-network data is not enough or cannot be used.",
    BackupShortest:
      "Backup option. It estimates the shortest path using Dijkstra when road-network data is not enough or cannot be used.",
  };
  const routeModeDetails: Record<
    string,
    { title: string; when: string; how: string; note: string; icon: string; tone: string }
  > = {
    Safest: {
      title: "Emergency safest route",
      when: "Use this for real relief deliveries when people, food, water, or medicine must reach a camp safely.",
      how: "The system checks road data first, then selects the route with the best safety score after considering flood or blocked-road risk.",
      note: "Best default choice for disaster response. Field confirmation is still required before dispatch.",
      icon: "health_and_safety",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    },
    Shortest: {
      title: "Shortest distance route",
      when: "Use this only when officers already know the roads are safe and speed/distance is the main concern.",
      how: "The system prioritizes the shortest travel distance, even if another route may have a better safety score.",
      note: "Do not use as the first choice during active flooding unless road safety is confirmed.",
      icon: "straighten",
      tone: "border-blue-200 bg-blue-50 text-blue-900",
    },
    Alternative: {
      title: "Alternative backup route",
      when: "Use this when the main route is blocked, crowded, damaged, or too risky.",
      how: "The system provides another possible route so officers can compare it with the safest or shortest route.",
      note: "Useful for planning a second option before sending a rescue or ration team.",
      icon: "alt_route",
      tone: "border-violet-200 bg-violet-50 text-violet-900",
    },
    BackupSafest: {
      title: "Safety backup route (A*)",
      when: "Use this when road-network data is unavailable but the team still needs a safety-focused estimated route.",
      how: "A* estimates a path by giving higher cost to risky areas, helping the route avoid flood or blocked zones.",
      note: "This is an estimated backup route, not a verified road route. Confirm with field teams before dispatch.",
      icon: "security",
      tone: "border-amber-200 bg-amber-50 text-amber-900",
    },
    BackupShortest: {
      title: "Shortest backup route (Dijkstra)",
      when: "Use this when road-network data is unavailable and the team needs the shortest estimated path.",
      how: "Dijkstra estimates the lowest-distance path between the start point and the camp.",
      note: "This focuses on distance, not disaster safety. Use only after checking road conditions.",
      icon: "conversion_path",
      tone: "border-rose-200 bg-rose-50 text-rose-900",
    },
  };
  const routeMethodCards = [
    {
      title: "OSRM road route",
      subtitle: "Main method",
      icon: "alt_route",
      tone: "border-cyan-200 bg-cyan-50 text-cyan-800",
      description:
        "Uses OpenStreetMap road data to draw a route along actual roads. This is the best option when online road data is available.",
    },
    {
      title: "A* safety search",
      subtitle: "Backup safety method",
      icon: "security",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
      description:
        "Used as a local fallback to avoid risky flood or blocked areas when a road-network route cannot be received.",
    },
    {
      title: "Dijkstra distance search",
      subtitle: "Backup shortest method",
      icon: "straighten",
      tone: "border-amber-200 bg-amber-50 text-amber-800",
      description:
        "Used as a local fallback to estimate the shortest path. It should be used only after road safety is verified.",
    },
  ];
  const routePalette = ["#0891b2", "#7c3aed", "#f59e0b", "#059669", "#e11d48"];
  const getRouteColor = (route: any, index: number) => {
    if (route.route_status === "Blocked") return "#e11d48";
    if (route.route_status === "Alternative") return "#f59e0b";
    if (route.route_source !== "road_network") return "#f97316";
    return routePalette[index % routePalette.length];
  };
  const isEstimatedRoute = (route: any) =>
    route.route_source !== "road_network" || route.accuracy_level !== "High";
  const isStraightEstimate = (route: any) =>
    isEstimatedRoute(route) && (route.route_coordinates?.length || 0) <= 4;
  const getRouteLabel = (route: any, index: number) =>
    `${index + 1}. ${route.route_type || "Route"} route | ${route.distance || 0} km | Safety ${route.safety_score || 0}`;
  const getRouteMidpoint = (positions: [number, number][]) => {
    if (!positions.length) return null;
    return positions[Math.floor(positions.length / 2)];
  };
  const getCampNameFromRoute = (route: any) => {
    if (route?.camp_id && typeof route.camp_id === "object") {
      return route.camp_id.camp_name || "Unknown camp";
    }
    return "Unknown camp";
  };
  const mapCenter =
    selectedCampData?.latitude && selectedCampData?.longitude
      ? [selectedCampData.latitude, selectedCampData.longitude]
      : [7.8731, 80.7718];

  return (
    <div>
      <PageHeader
        title="Route Planning"
        subtitle="Road-aware relief route planning with safety scoring"
        icon="route"
      />

      <div className="mb-4 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
        <span className="font-semibold">How route planning works:</span>{" "}
        All route purposes first try real road data from OSRM. The route score is then adjusted using field inputs for traffic, bridge condition, road width, flood or blocked roads, and vehicle restrictions. If road data is unavailable, the system uses a clearly marked backup method.
      </div>

      {/* Global Route Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Routes", count: allRoutes.length, icon: "route", color: "border-blue-200 bg-white text-blue-700" },
          { label: "Road Network", count: allRoutes.filter(r => r.route_source === "road_network").length, icon: "alt_route", color: "border-cyan-200 bg-white text-cyan-700" },
          { label: "Blocked", count: allRoutes.filter(r => r.route_status === "Blocked").length, icon: "block", color: "border-rose-200 bg-white text-rose-700" },
          { label: "Avg Safety", count: allRoutes.length ? Math.round(allRoutes.reduce((acc, r) => acc + (r.safety_score || 0), 0) / allRoutes.length) : 0, icon: "security", color: "border-violet-200 bg-white text-violet-700" },
        ].map(stat => (
          <div key={stat.label} className={`${stat.color} flex items-center gap-3 rounded-lg border p-4 shadow-sm`}>
            <span className="material-icons">{stat.icon}</span>
            <div>
              <p className="text-xl font-bold">{stat.count}</p>
              <p className="text-xs opacity-80">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Route Generator */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
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
          <div>
            <FormSelect
              label="Route Purpose"
              value={routeMode}
              onChange={setRouteMode}
              options={[
                { value: "Safest", label: "Emergency safest route" },
                { value: "Shortest", label: "Shortest distance route" },
                { value: "Alternative", label: "Alternative backup route" },
                { value: "BackupSafest", label: "Safety backup route (A*)" },
                { value: "BackupShortest", label: "Shortest backup route (Dijkstra)" },
              ]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Latitude - SLIIT
            </label>
            <input
              type="number"
              value={startLat}
              onChange={(e) => setStartLat(Number(e.target.value))}
              step="0.0001"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-cyan-300"
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
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-cyan-300"
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
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
            <span className="material-icons text-cyan-600">traffic</span>
            Field Road Conditions
          </h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <FormSelect
              label="Vehicle Type"
              value={vehicleType}
              onChange={setVehicleType}
              options={[
                { value: "truck", label: "Truck" },
                { value: "ambulance", label: "Ambulance" },
                { value: "boat", label: "Boat" },
                { value: "helicopter", label: "Helicopter" },
                { value: "hand-delivery", label: "Hand Delivery" },
              ]}
            />
            <FormSelect
              label="Traffic Level"
              value={trafficLevel}
              onChange={setTrafficLevel}
              options={[
                { value: "Clear", label: "Clear" },
                { value: "Moderate", label: "Moderate" },
                { value: "Heavy", label: "Heavy" },
              ]}
            />
            <FormSelect
              label="Bridge Condition"
              value={bridgeCondition}
              onChange={setBridgeCondition}
              options={[
                { value: "Clear", label: "Clear" },
                { value: "Weak", label: "Weak" },
                { value: "Closed", label: "Closed" },
              ]}
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Min Road Width (m)
              </label>
              <input
                type="number"
                min={0}
                step="0.1"
                value={minimumRoadWidth}
                onChange={(e) => setMinimumRoadWidth(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-cyan-300"
              />
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={restrictSelectedVehicle}
                onChange={(e) => setRestrictSelectedVehicle(e.target.checked)}
                className="h-4 w-4"
              />
              Vehicle restricted
            </label>
          </div>
        </div>
        {routeMessage && (
          <div className="mt-4 rounded-lg border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-700">
            {routeMessage}
          </div>
        )}
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-start gap-2">
            <span className="material-icons text-cyan-600">info</span>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Selected purpose: {routeMode === "Safest" ? "Emergency safest route" : routeMode === "Shortest" ? "Shortest distance route" : routeMode === "Alternative" ? "Alternative backup route" : routeMode === "BackupSafest" ? "Safety backup route (A*)" : "Shortest backup route (Dijkstra)"}
              </p>
              <p className="mt-1 text-xs text-slate-600">{routeTypeHelp[routeMode]}</p>
            </div>
          </div>
        </div>
        <div className={`mt-3 rounded-lg border p-4 ${routeModeDetails[routeMode].tone}`}>
          <div className="flex items-start gap-3">
            <span className="material-icons mt-0.5">{routeModeDetails[routeMode].icon}</span>
            <div>
              <h4 className="text-sm font-bold">{routeModeDetails[routeMode].title}</h4>
              <div className="mt-3 grid gap-3 text-xs md:grid-cols-3">
                <div>
                  <p className="font-bold uppercase tracking-wide opacity-70">When to use</p>
                  <p className="mt-1 leading-relaxed">{routeModeDetails[routeMode].when}</p>
                </div>
                <div>
                  <p className="font-bold uppercase tracking-wide opacity-70">How it works</p>
                  <p className="mt-1 leading-relaxed">{routeModeDetails[routeMode].how}</p>
                </div>
                <div>
                  <p className="font-bold uppercase tracking-wide opacity-70">Important note</p>
                  <p className="mt-1 leading-relaxed">{routeModeDetails[routeMode].note}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {routeMethodCards.map((method) => (
            <div key={method.title} className={`rounded-lg border p-3 ${method.tone}`}>
              <div className="mb-2 flex items-center gap-2">
                <span className="material-icons text-lg">{method.icon}</span>
                <div>
                  <p className="text-sm font-bold">{method.title}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide opacity-75">
                    {method.subtitle}
                  </p>
                </div>
              </div>
              <p className="text-xs leading-relaxed">{method.description}</p>
            </div>
          ))}
        </div>
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
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm"
            >
              <option value="">All route statuses</option>
              <option value="Active">Active</option>
              <option value="Alternative">Alternative</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>

          <div className="relative mb-4 overflow-hidden rounded-lg border border-slate-200 shadow-sm">
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
              {visibleRoutes.map((route, index) => {
                const positions = (route.route_coordinates || []).map((coord: number[]) => [coord[0], coord[1]] as [number, number]);
                const midpoint = getRouteMidpoint(positions);
                const color = getRouteColor(route, index);
                return (
                  <React.Fragment key={route._id}>
                    <Polyline
                      positions={positions}
                      pathOptions={{
                        color,
                        weight: 5,
                        opacity: 0.9,
                        dashArray: isEstimatedRoute(route) ? "10 8" : undefined,
                      }}
                    >
                      <Popup>
                        <div className="text-xs">
                          <p className="font-bold">{getRouteLabel(route, index)}</p>
                          <p>{route.route_source === "road_network" ? "Road network route" : "Estimated backup route"}</p>
                          <p>Status: {route.route_status}</p>
                          {isStraightEstimate(route) && (
                            <p>This is not a verified road path.</p>
                          )}
                        </div>
                      </Popup>
                    </Polyline>
                    {midpoint && (
                      <Marker position={midpoint} opacity={0}>
                        <Tooltip permanent direction="center" className="route-label-tooltip">
                          <span className="font-bold">{index + 1}</span> {route.route_type}
                        </Tooltip>
                      </Marker>
                    )}
                  </React.Fragment>
                );
              })}
            </MapContainer>
            {visibleRoutes.length > 0 && (
              <div className="absolute bottom-3 left-3 z-[1000] max-w-[260px] rounded-lg border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur">
                <p className="mb-2 font-bold text-slate-900">Route Legend</p>
                <div className="space-y-2">
                  {visibleRoutes.map((route, index) => (
                    <div key={route._id} className="flex items-start gap-2">
                      <span
                        className="mt-1 h-2.5 w-8 rounded-full"
                        style={{ backgroundColor: getRouteColor(route, index) }}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">{getRouteLabel(route, index)}</p>
                        <p className="text-slate-500">
                          {route.route_source === "road_network" ? "Road network" : "Estimated backup"} | {route.route_status}
                        </p>
                        {isStraightEstimate(route) && (
                          <p className="mt-1 font-semibold text-orange-600">
                            Not road-accurate
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visibleRoutes.map((r) => {
            const campName = getCampNameFromRoute(r);
            return (
              <div
                key={r._id}
                className={`rounded-lg border p-5 shadow-sm ${getSafetyBg(r.safety_score)} transition-all hover:-translate-y-0.5 hover:shadow-md`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-800">
                      {r.route_name || `Route to ${campName}`}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {r.route_type} route ({r.route_algorithm || (r.route_type === "Shortest" ? "Dijkstra" : "A*")})
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${r.route_source === "road_network" ? "bg-cyan-100 text-cyan-700" : "bg-amber-100 text-amber-700"}`}>
                        {r.route_source === "road_network" ? "Road network" : "Estimated backup"}
                      </span>
                      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${r.accuracy_level === "High" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {r.accuracy_level || "Estimated"} accuracy
                      </span>
                      <span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                        {String(r.vehicle_type || "truck").replace("-", " ")}
                      </span>
                    </div>
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
                  <div className="rounded-lg bg-slate-50 p-2 text-center">
                    <span className="material-icons text-sm text-blue-500">
                      straighten
                    </span>
                    <p className="text-sm font-bold text-gray-800">
                      {r.distance} km
                    </p>
                    <p className="text-xs text-gray-500">Distance</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 text-center">
                    <span className="material-icons text-sm text-purple-500">
                      schedule
                    </span>
                    <p className="text-sm font-bold text-gray-800">
                      {r.estimated_time}
                    </p>
                    <p className="text-xs text-gray-500">Est. Time</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 text-center">
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
                {isStraightEstimate(r) && (
                  <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900">
                    <span className="font-semibold">Route accuracy warning:</span>{" "}
                    This route is drawn as an estimated backup path and may not follow real roads. Generate a road-network route or verify with field officers before dispatch.
                  </div>
                )}
                {r.accuracy_notes && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Accuracy note:</span>{" "}
                    {r.accuracy_notes}
                  </div>
                )}
                {r.road_constraints && (
                  <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 sm:grid-cols-3">
                    <span><b>Traffic:</b> {r.road_constraints.traffic_level || "Clear"}</span>
                    <span><b>Bridge:</b> {r.road_constraints.bridge_condition || "Clear"}</span>
                    <span><b>Road width:</b> {r.road_constraints.minimum_road_width_m || 0}m</span>
                  </div>
                )}
                <div className="mt-3 pt-2 border-t border-gray-200/50">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-medium ${r.route_status === "Active" ? "bg-emerald-100 text-emerald-700" : r.route_status === "Blocked" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}
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
