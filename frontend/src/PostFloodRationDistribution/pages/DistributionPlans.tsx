import React, { useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  PrimaryButton,
  StatusBadge,
  PriorityBadge,
  Modal,
  FormSelect,
  Loading,
  EmptyState,
  SearchFilter,
  FormErrorSummary,
} from "../components/UIComponents";
import * as api from "../services/api";
import {
  filterOutSeedCamps,
  filterOutSeedResources,
} from "../utils/filterSeedData";
import { Permissions } from "../utils/permissions";
import {
  enqueueOfflineAction,
  getOfflineQueue,
  subscribeOfflineQueue,
  syncOfflineQueue,
} from "../utils/offlineQueue";
import { useLiveRefresh } from "../utils/useLiveRefresh";

interface DistributionPlansProps {
  userRole?: string;
}

function extractArray(response: any): any[] {
  const data = response?.data ?? response;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function getRouteMobilityPlan(route: any) {
  const plan = route?.mobility_plan || null;
  const hasDistance =
    Number(plan?.truck_distance_km || 0) > 0 ||
    Number(plan?.boat_distance_km || 0) > 0 ||
    Number(plan?.hand_delivery_distance_km || 0) > 0;

  if (hasDistance) return plan;
  const routeDistance = Number(route?.distance || 0);
  if (!route || routeDistance <= 0) return plan;

  return {
    truck_distance_km: Math.round(routeDistance * 100) / 100,
    boat_distance_km: 0,
    transfer_points: [],
  };
}

function getRouteAccessLabel(route: any, camp: any) {
  if (!route) return camp?.road_access_status || "Unknown";
  if (route.route_status === "Blocked") return "Blocked";
  if (Number(route.safety_score || 0) < 50) return "Limited";
  return "Open on selected route";
}

export default function DistributionPlans({
  userRole = "admin",
}: DistributionPlansProps) {
  const [distributions, setDistributions] = useState<any[]>([]);
  const [camps, setCamps] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [campNeeds, setCampNeeds] = useState<any>(null);
  const [campNeedsLoading, setCampNeedsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState(() => getOfflineQueue().length);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const emptyForm = {
    camp_id: "",
    route_id: "",
    priority_level: "Medium",
    delivery_method: "truck",
    notes: "",
    item_list: [
      { resource_id: "", item_name: "", item_type: "food", quantity: 0, unit: "units" },
    ],
  };
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [optimizing, setOptimizing] = useState(false);
  const [creatingOptimizedPlans, setCreatingOptimizedPlans] = useState(false);
  const [optimizerResult, setOptimizerResult] = useState<any>(null);
  const [optimizerForm, setOptimizerForm] = useState({
    trucks_available: 5,
    fuel_litres_available: 250,
    truck_capacity_units: 1000,
    max_camps: 10,
    min_route_safety_score: 25,
  });
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    distribution: any | null;
    items: { item_name: string; delivered_quantity: number }[];
    partial_reason: string;
  }>({
    open: false,
    distribution: null,
    items: [],
    partial_reason: "",
  });

  const canManage = Permissions.canManageDistributions(userRole);
  const canDelete = Permissions.canDeleteData(userRole);

  const load = (showLoading = false) => {
    if (showLoading) setLoading(true);
    Promise.all([
      api.getDistributions(),
      api.getCamps({ include_seed: "true", include_demo: "true" }),
      api.getResources({ include_seed: "true" }),
      api.getAllRoutes().catch(() => ({ data: [] })),
    ])
      .then(async ([d, c, r, routeResponse]) => {
        const distributionData = extractArray(d);
        const campData = extractArray(c);
        const resourceData = extractArray(r);
        const routeData = extractArray(routeResponse);
        const filteredCamps = filterOutSeedCamps(campData);
        const filteredResources = filterOutSeedResources(resourceData);

        setDistributions(distributionData);
        setCamps(filteredCamps.length || !campData.length ? filteredCamps : campData);
        setResources(filteredResources.length || !resourceData.length ? filteredResources : resourceData);
        setRoutes(routeData);
      })
      .catch(console.error)
      .finally(() => {
        if (showLoading) setLoading(false);
      });
  };
  useEffect(() => {
    load(true);
  }, []);
  useLiveRefresh(() => load(false), [], 30000, !showModal && !confirmModal.open);

  useEffect(() => {
    const refreshOfflineState = () => {
      setIsOnline(navigator.onLine);
      setOfflineQueueCount(getOfflineQueue().length);
    };
    const unsubscribe = subscribeOfflineQueue(refreshOfflineState);
    refreshOfflineState();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isOnline || offlineQueueCount === 0 || syncingOffline) return;
    setSyncingOffline(true);
    syncOfflineQueue()
      .then((result) => {
        if (result.synced > 0) load(false);
        setOfflineQueueCount(getOfflineQueue().length);
      })
      .finally(() => setSyncingOffline(false));
  }, [isOnline, offlineQueueCount]);

  const getRouteCampId = (route: any) =>
    route?.camp_id && typeof route.camp_id === "object" ? route.camp_id._id : route?.camp_id;

  const routesForSelectedCamp = useMemo(
    () => routes.filter((route) => form.camp_id && getRouteCampId(route) === form.camp_id),
    [routes, form.camp_id],
  );

  const recommendedRoute = useMemo(
    () =>
      [...routesForSelectedCamp]
        .filter((route) => route.route_status !== "Blocked")
        .sort((a, b) => {
          if ((b.safety_score || 0) !== (a.safety_score || 0)) return (b.safety_score || 0) - (a.safety_score || 0);
          return (a.distance || 9999) - (b.distance || 9999);
        })[0] || routesForSelectedCamp[0] || null,
    [routesForSelectedCamp],
  );

  useEffect(() => {
    if (!form.camp_id) return;
    const currentRouteStillValid = routesForSelectedCamp.some((route) => route._id === form.route_id);
    if (!currentRouteStillValid) {
      setForm((current) => ({ ...current, route_id: recommendedRoute?._id || "" }));
    }
  }, [form.camp_id, form.route_id, recommendedRoute?._id, routesForSelectedCamp]);

  useEffect(() => {
    if (!form.camp_id) {
      setCampNeeds(null);
      return;
    }

    setCampNeedsLoading(true);
    api.getCampNeeds(form.camp_id)
      .then((response) => setCampNeeds(response.data || null))
      .catch(() => setCampNeeds(null))
      .finally(() => setCampNeedsLoading(false));
  }, [form.camp_id]);

  const getSuggestedQuantity = (item: any) => {
    const resource = resources.find((entry) => entry.resource_name === item.item_name);
    const resourceType = resource?.resource_type || item.item_type;
    const need = campNeeds?.[resourceType];
    const shortage = Number(need?.shortage || 0);
    const available = Number(resource?.available_quantity || 0);
    if (!resource || shortage <= 0 || available <= 0) return 0;
    return Math.min(shortage, available);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const validPriorities = ["Low", "Medium", "High"];
    const validDeliveryMethods = ["truck", "boat", "hand-delivery"];

    if (!form.camp_id) newErrors.camp_id = "Camp is required";
    else if (!camps.some((camp) => camp._id === form.camp_id)) newErrors.camp_id = "Select a valid camp";
    if (routesForSelectedCamp.length > 0 && !form.route_id) {
      newErrors.route_id = "Select a safe route for this distribution";
    }
    if (form.route_id) {
      const selectedRoute = routesForSelectedCamp.find((route) => route._id === form.route_id);
      if (!selectedRoute) newErrors.route_id = "Select a valid route for this camp";
      else if (selectedRoute.route_status === "Blocked") newErrors.route_id = "Cannot dispatch through a blocked route";
    }
    if (!validPriorities.includes(form.priority_level)) newErrors.priority_level = "Select a valid priority";
    if (!validDeliveryMethods.includes(form.delivery_method)) newErrors.delivery_method = "Select a valid delivery method";
    if (form.notes.trim().length > 500) newErrors.notes = "Notes are too long";
    
    const selectedItems = new Set<string>();
    form.item_list.forEach((item, index) => {
      if (!item.item_name) newErrors[`item_${index}`] = "Select a resource";
      if (selectedItems.has(item.item_name)) newErrors[`item_${index}`] = "Duplicate resource";
      if (item.item_name) selectedItems.add(item.item_name);
      if (!Number.isFinite(Number(item.quantity)) || item.quantity <= 0) newErrors[`item_${index}`] = "Qty must be greater than 0";
      const res = resources.find(r => r._id === (item as any).resource_id || r.resource_name === item.item_name);
      if (item.item_name && !res) newErrors[`item_${index}`] = "Select a valid resource";
      const availableQuantity = Number(res?.available_quantity || 0);
      if (res && Number(item.quantity) > availableQuantity) {
        newErrors[`item_${index}`] = `Insufficient stock. Available: ${availableQuantity} ${res.unit || item.unit}`;
      }
    });

    setErrors(newErrors);
    setSubmitError(
      Object.keys(newErrors).length > 0
        ? "Please correct the highlighted fields before creating the plan."
        : ""
    );
    return Object.keys(newErrors).length === 0;
  };

  const validateOptimizer = () => {
    if (!Number.isFinite(optimizerForm.trucks_available) || optimizerForm.trucks_available <= 0) {
      alert("Trucks available must be greater than 0.");
      return false;
    }
    if (!Number.isFinite(optimizerForm.fuel_litres_available) || optimizerForm.fuel_litres_available <= 0) {
      alert("Fuel litres available must be greater than 0.");
      return false;
    }
    if (!Number.isFinite(optimizerForm.truck_capacity_units) || optimizerForm.truck_capacity_units <= 0) {
      alert("Truck capacity must be greater than 0.");
      return false;
    }
    if (!Number.isFinite(optimizerForm.max_camps) || optimizerForm.max_camps <= 0) {
      alert("Maximum camps must be greater than 0.");
      return false;
    }
    if (optimizerForm.max_camps > 100) {
      alert("Maximum camps looks too large for one optimization run.");
      return false;
    }
    if (!Number.isFinite(optimizerForm.min_route_safety_score) || optimizerForm.min_route_safety_score < 0 || optimizerForm.min_route_safety_score > 100) {
      alert("Minimum route safety score must be between 0 and 100.");
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    setSubmitError("");
    if (!validate()) return;
    try {
      await api.createDistribution({ ...form, route_id: form.route_id || null });
      setShowModal(false);
      setForm(emptyForm);
      load(false);
    } catch (err: any) {
      setSubmitError(api.getFriendlyErrorMessage(err));
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    const failureReason =
      status === "Failed"
        ? prompt("Reason for failed delivery? Mention road/bridge/flood blockage if applicable.") || ""
        : "";
    const body = { status, failure_reason: failureReason };
    const queueAction = () => {
      enqueueOfflineAction({
        label: `Delivery status update: ${status}`,
        path: `/distributions/${id}/status`,
        method: "PUT",
        body,
      });
      setOfflineQueueCount(getOfflineQueue().length);
      setOfflineNotice("Status update saved offline and will sync when internet returns.");
    };

    if (!navigator.onLine) {
      queueAction();
      return;
    }

    try {
      await api.updateDistributionStatus(id, status, failureReason);
      load(false);
    } catch (err: any) {
      if (err.name === "TypeError" || String(err.message || "").toLowerCase().includes("fetch")) {
        queueAction();
      } else {
        alert(err.message);
      }
    }
  };

  const handleApprovalUpdate = async (id: string, approvalStatus: string) => {
    const note =
      approvalStatus === "Rejected"
        ? prompt("Reason for rejecting this distribution plan?") || ""
        : "";
    try {
      await api.updateDistributionApproval(id, approvalStatus, note);
      load(false);
    } catch (err: any) {
      alert(err.message || "Failed to update approval");
    }
  };

  const openConfirmModal = (distribution: any) => {
    setConfirmModal({
      open: true,
      distribution,
      items: (distribution.item_list || []).map((item: any) => ({
        item_name: item.item_name,
        delivered_quantity: item.delivered_quantity || item.quantity || 0,
      })),
      partial_reason: distribution.partial_reason || "",
    });
  };

  const handleConfirmItems = async () => {
    if (!confirmModal.distribution) return;
    const body = {
      items: confirmModal.items,
      partial_reason: confirmModal.partial_reason,
    };
    const distributionId = confirmModal.distribution._id;
    const queueAction = () => {
      enqueueOfflineAction({
        label: "Item delivery confirmation",
        path: `/distributions/${distributionId}/confirm-items`,
        method: "PUT",
        body,
      });
      setConfirmModal({
        open: false,
        distribution: null,
        items: [],
        partial_reason: "",
      });
      setOfflineQueueCount(getOfflineQueue().length);
      setOfflineNotice("Item confirmation saved offline and will sync when internet returns.");
    };

    if (!navigator.onLine) {
      queueAction();
      return;
    }

    try {
      await api.confirmDistributionItems(distributionId, body);
      setConfirmModal({
        open: false,
        distribution: null,
        items: [],
        partial_reason: "",
      });
      load(false);
    } catch (err: any) {
      if (err.name === "TypeError" || String(err.message || "").toLowerCase().includes("fetch")) {
        queueAction();
      } else {
        alert(err.message);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this distribution plan?")) return;
    await api.deleteDistribution(id);
    load(false);
  };

  const handleOptimize = async () => {
    if (!validateOptimizer()) return;
    setOptimizing(true);
    try {
      const result = await api.optimizeAllocations(optimizerForm);
      setOptimizerResult(result.data);
    } catch (err: any) {
      alert(err.message || "Failed to optimize allocations");
    } finally {
      setOptimizing(false);
    }
  };

  const handleCreateOptimizedPlans = async () => {
    if (!optimizerResult?.plans?.length) return;
    if (!validateOptimizer()) return;
    if (!confirm("Create pending distribution plans from the current optimizer recommendations?")) return;

    setCreatingOptimizedPlans(true);
    try {
      const result = await api.createOptimizedDistributionPlans(optimizerForm);
      alert(`${result.data?.created?.length || 0} optimized distribution plan(s) created.`);
      setOptimizerResult(null);
      load(false);
    } catch (err: any) {
      alert(err.message || "Failed to create optimized distribution plans");
    } finally {
      setCreatingOptimizedPlans(false);
    }
  };

  const filtered = distributions.filter((d) => {
    const campName = typeof d.camp_id === "object" ? d.camp_id.camp_name : "";
    const matchSearch = campName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || d.status === filterStatus;
    return matchSearch && matchStatus;
  });
  const selectedCampForForm = camps.find((camp) => camp._id === form.camp_id);
  const selectedRouteForForm = routesForSelectedCamp.find((route) => route._id === form.route_id);
  const selectedRouteMobilityPlan = getRouteMobilityPlan(selectedRouteForForm);
  const selectedRouteAccessLabel = getRouteAccessLabel(selectedRouteForForm, selectedCampForForm);
  const selectedRouteNeedsBoat = Number(selectedRouteMobilityPlan?.boat_distance_km || 0) > 0;
  const showBoatOptionNotice =
    selectedRouteNeedsBoat ||
    selectedRouteForForm?.route_status === "Blocked" ||
    Number(selectedRouteForForm?.safety_score || 0) < 50;

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Distribution Management"
        subtitle="Create and track ration distributions"
        icon="local_shipping"
        actions={
          canManage && (
            <PrimaryButton
              onClick={() => {
                setErrors({});
                setSubmitError("");
                setForm(emptyForm);
                load(false);
                setShowModal(true);
              }}
              icon="add"
            >
              New Distribution
            </PrimaryButton>
          )
        }
      />

      <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
        isOnline
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
      }`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="material-icons text-base">
              {isOnline ? "wifi" : "wifi_off"}
            </span>
            <span className="font-semibold">
              {isOnline ? "Online field mode" : "Offline field mode"}
            </span>
            <span>
              {offlineQueueCount > 0
                ? `${offlineQueueCount} update(s) waiting to sync`
                : "No pending offline updates"}
            </span>
          </div>
          {offlineQueueCount > 0 && (
            <button
              onClick={async () => {
                setSyncingOffline(true);
                const result = await syncOfflineQueue();
                setSyncingOffline(false);
                setOfflineQueueCount(getOfflineQueue().length);
                if (result.synced > 0) {
                  setOfflineNotice(`${result.synced} offline update(s) synced successfully.`);
                  load(false);
                } else if (!result.online) {
                  setOfflineNotice("Still offline. Updates remain safely queued.");
                } else {
                  setOfflineNotice("Sync attempted. Some updates still need attention.");
                }
              }}
              disabled={!isOnline || syncingOffline}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold shadow-sm disabled:opacity-60"
            >
              {syncingOffline ? "Syncing..." : "Sync now"}
            </button>
          )}
        </div>
        {offlineNotice && (
          <p className="mt-2 text-xs font-medium">{offlineNotice}</p>
        )}
      </div>

      <SearchFilter
        searchTerm={search}
        onSearch={setSearch}
        placeholder="Search distributions..."
      >
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm"
        >
          <option value="">All Status</option>
          <option value="Pending">Pending</option>
          <option value="On the Way">On the Way</option>
          <option value="Delivered">Delivered</option>
          <option value="Partial">Partial</option>
          <option value="Failed">Failed</option>
        </select>
      </SearchFilter>

      {canManage && (
        <div className="mb-6 rounded-lg border border-cyan-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <span className="material-icons text-cyan-600">hub</span>
                Multi-Camp Allocation Optimizer
              </h3>
              <p className="text-sm text-slate-500">
                Allocate limited stock across high-urgency camps using route safety, truck capacity, fuel, and available inventory.
              </p>
            </div>
            <PrimaryButton onClick={handleOptimize} icon="auto_awesome" disabled={optimizing}>
              {optimizing ? "Optimizing..." : "Optimize"}
            </PrimaryButton>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              { key: "trucks_available", label: "Trucks" },
              { key: "fuel_litres_available", label: "Fuel litres" },
              { key: "truck_capacity_units", label: "Capacity" },
              { key: "max_camps", label: "Max camps" },
              { key: "min_route_safety_score", label: "Min safety" },
            ].map((field) => (
              <label key={field.key} className="text-xs font-semibold text-slate-500">
                {field.label}
                <input
                  type="number"
                  min={0}
                  value={(optimizerForm as any)[field.key]}
                  onChange={(event) =>
                    setOptimizerForm({
                      ...optimizerForm,
                      [field.key]: Number(event.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:ring-2 focus:ring-cyan-300"
                />
              </label>
            ))}
          </div>
          {optimizerResult && (
            <div className="mt-5 space-y-3">
              <div className="flex flex-col gap-2 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-bold">Optimizer recommendations ready</p>
                  <p className="text-xs">
                    Review the route-aware plan, then create pending distribution plans for dispatch tracking.
                  </p>
                </div>
                <button
                  onClick={handleCreateOptimizedPlans}
                  disabled={creatingOptimizedPlans || !(optimizerResult.plans || []).length}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60"
                >
                  {creatingOptimizedPlans ? "Creating..." : "Create Distribution Plans"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Camps allocated</p>
                  <p className="text-2xl font-black text-slate-900">{optimizerResult.summary?.camps_allocated || 0}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Trucks used</p>
                  <p className="text-2xl font-black text-slate-900">{optimizerResult.used?.trucks || 0}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Fuel used</p>
                  <p className="text-2xl font-black text-slate-900">{optimizerResult.used?.fuel_litres || 0}L</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Quantity allocated</p>
                  <p className="text-2xl font-black text-slate-900">{optimizerResult.summary?.total_allocated_quantity || 0}</p>
                </div>
              </div>
              {(optimizerResult.plans || []).map((plan: any) => (
                <div key={plan.camp_id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{plan.camp_name}</p>
                      <p className="text-xs text-slate-500">
                        Score {plan.priority_score}/100 | Route safety {plan.route_safety_score ?? "N/A"} | Fuel {plan.fuel_required_litres}L
                      </p>
                      {plan.delivery_recommendation && (
                        <p className="mt-1 text-xs font-semibold text-cyan-700">
                          {plan.delivery_recommendation.label}: {plan.delivery_recommendation.reason}
                        </p>
                      )}
                    </div>
                    <PriorityBadge level={plan.priority_level} />
                  </div>
                  <div className="grid gap-2 md:grid-cols-4">
                    {(plan.item_allocations || []).map((item: any) => (
                      <div key={item.resource_type} className="rounded-md border border-white bg-white px-3 py-2 text-xs">
                        <p className="font-bold capitalize text-slate-700">{item.resource_type}</p>
                        <p className="text-slate-500">
                          {item.allocated_quantity}/{item.requested_quantity} allocated
                        </p>
                        {item.unmet_quantity > 0 && (
                          <p className="font-semibold text-rose-600">{item.unmet_quantity} unmet</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {(optimizerResult.skipped || []).length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {optimizerResult.skipped.length} camp(s) skipped due to truck, fuel, route, or stock limits.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stats Row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          {
            label: "Total",
            count: distributions.length,
            color: "border-blue-200 bg-white text-blue-700",
            icon: "list",
          },
          {
            label: "Pending",
            count: distributions.filter((d) => d.status === "Pending").length,
            color: "border-amber-200 bg-white text-amber-700",
            icon: "schedule",
          },
          {
            label: "On the Way",
            count: distributions.filter((d) => d.status === "On the Way")
              .length,
            color: "border-cyan-200 bg-white text-cyan-700",
            icon: "local_shipping",
          },
          {
            label: "Delivered",
            count: distributions.filter((d) => d.status === "Delivered").length,
            color: "border-emerald-200 bg-white text-emerald-700",
            icon: "check_circle",
          },
          {
            label: "Partial",
            count: distributions.filter((d) => d.status === "Partial").length,
            color: "border-violet-200 bg-white text-violet-700",
            icon: "rule",
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`${s.color} flex items-center gap-3 rounded-lg border p-4 shadow-sm`}
          >
            <span className="material-icons text-2xl">{s.icon}</span>
            <div>
              <p className="text-xl font-bold">{s.count}</p>
              <p className="text-xs font-medium text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="local_shipping"
          title="No distributions found"
          subtitle="Create a new distribution plan"
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => {
            const campName =
              typeof d.camp_id === "object" ? d.camp_id.camp_name : "Unknown";
            const teamName =
              typeof d.assigned_team_id === "object"
                ? d.assigned_team_id?.name
                : "Unassigned";
            const routeInfo = typeof d.route_id === "object" ? d.route_id : null;
            const approvalStatus = d.approval_status || "Pending Approval";
            return (
              <div
                key={d._id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-lg bg-slate-900 text-white">
                      <span className="material-icons">local_shipping</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{campName}</h3>
                      <p className="text-sm text-gray-500">
                        Team: {teamName} | Method: {String(d.delivery_method).replace("-", " ")}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-600">
                        Approval: {approvalStatus}
                        {d.approved_at ? ` | ${new Date(d.approved_at).toLocaleString()}` : ""}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(d.created_at).toLocaleDateString()}
                      </p>
                      {routeInfo && (
                        <p className="mt-1 text-xs font-semibold text-cyan-700">
                          Route safety {routeInfo.safety_score ?? "N/A"}/100 | {routeInfo.distance ?? "N/A"} km | {routeInfo.route_status || "Unknown"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <PriorityBadge level={d.priority_level} />
                    <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                      approvalStatus === "Approved"
                        ? "bg-emerald-100 text-emerald-700"
                        : approvalStatus === "Rejected"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700"
                    }`}>
                      {approvalStatus}
                    </span>
                    <StatusBadge status={d.status} />
                  </div>
                </div>
                {d.item_list && d.item_list.length > 0 && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {d.item_list.map((item: any, i: number) => (
                      <span
                        key={i}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700"
                      >
                        <span className="font-semibold">{item.item_name}</span>
                        <span className="ml-1 text-gray-500">{item.quantity} {item.unit}</span>
                        {item.delivery_status && (
                          <span className="mt-1 block text-[11px] font-medium text-slate-500">
                            {item.delivery_status}
                            {item.delivered_quantity > 0 ? ` | delivered ${item.delivered_quantity}` : ""}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                {Array.isArray(d.audit_trail) && d.audit_trail.length > 0 && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <p className="mb-1 font-bold text-slate-800">Latest audit</p>
                    {d.audit_trail.slice(-2).map((entry: any, index: number) => (
                      <p key={`${entry.action}-${entry.updated_at}-${index}`}>
                        {entry.action}: {entry.from || "-"}{" -> "}{entry.to || "-"}
                        {entry.note ? ` | ${entry.note}` : ""}
                      </p>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                  {canManage && d.status === "Pending" && approvalStatus === "Pending Approval" && (
                    <>
                      <button
                        onClick={() => handleApprovalUpdate(d._id, "Approved")}
                        className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100"
                      >
                        <span className="material-icons text-sm">verified</span>
                        Approve
                      </button>
                      <button
                        onClick={() => handleApprovalUpdate(d._id, "Rejected")}
                        className="flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100"
                      >
                        <span className="material-icons text-sm">block</span>
                        Reject
                      </button>
                    </>
                  )}
                  {canManage && d.status === "Pending" && approvalStatus === "Approved" && (
                    <button
                      onClick={() => handleStatusUpdate(d._id, "On the Way")}
                      className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100"
                    >
                      <span className="material-icons text-sm">
                        local_shipping
                      </span>
                      Dispatch
                    </button>
                  )}
                  {canManage && d.status === "On the Way" && (
                    <>
                      <button
                        onClick={() => handleStatusUpdate(d._id, "Delivered")}
                        className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100"
                      >
                        <span className="material-icons text-sm">
                          check_circle
                        </span>
                        Full Delivered
                      </button>
                      <button
                        onClick={() => openConfirmModal(d)}
                        className="flex items-center gap-1 rounded-lg bg-violet-50 px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-100"
                      >
                        <span className="material-icons text-sm">rule</span>
                        Confirm Items
                      </button>
                    </>
                  )}
                  {canManage &&
                    (d.status === "Pending" || d.status === "On the Way") && (
                      <button
                        onClick={() => handleStatusUpdate(d._id, "Failed")}
                        className="flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100"
                      >
                        <span className="material-icons text-sm">cancel</span>
                        Failed
                      </button>
                    )}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(d._id)}
                      className="ml-auto rounded-lg bg-gray-50 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                    >
                      <span className="material-icons text-sm">delete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setErrors({}); setSubmitError(""); }}
        title="Create Distribution Plan"
        size="md"
      >
        <FormErrorSummary message={submitError} errors={errors} />
        <div className="space-y-4">
          {(camps.length === 0 || resources.length === 0) && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">
              {camps.length === 0 && <p>No camp records are available for distribution planning.</p>}
              {resources.length === 0 && <p>No resource inventory records are available for distribution planning.</p>}
              <button
                type="button"
                onClick={() => load(false)}
                className="mt-2 rounded-md border border-amber-300/40 px-3 py-1 text-xs font-bold text-amber-50 hover:bg-amber-500/20"
              >
                Reload form data
              </button>
            </div>
          )}
          <FormSelect
            label="Camp"
            value={form.camp_id}
            onChange={(v) => {
              const camp = camps.find((item) => item._id === v);
              setForm({
                ...form,
                camp_id: v,
                route_id: "",
                priority_level: camp?.priority_level || form.priority_level,
              });
              setErrors((current) => {
                const next = { ...current };
                delete next.camp_id;
                delete next.route_id;
                return next;
              });
            }}
            error={errors.camp_id}
            required
            options={[
              { value: "", label: camps.length ? "Select camp" : "No camps available" },
              ...camps.map((c) => ({ value: c._id, label: c.camp_name })),
            ]}
          />
          {selectedCampForForm && (
            <div className="grid gap-3 rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300 sm:grid-cols-3">
              <span><b className="text-white">Population:</b> {selectedCampForForm.population || 0}</span>
              <span><b className="text-white">Priority:</b> {selectedCampForForm.priority_level || "Medium"}</span>
              <span>
                <b className="text-white">Route access:</b> {selectedRouteAccessLabel}
                {selectedCampForForm.road_access_status && selectedCampForForm.road_access_status !== selectedRouteAccessLabel && (
                  <span className="text-slate-500"> (saved camp: {selectedCampForForm.road_access_status})</span>
                )}
              </span>
            </div>
          )}
          <FormSelect
            label="Safest Route"
            value={form.route_id}
            onChange={(v) => setForm({ ...form, route_id: v })}
            error={errors.route_id}
            options={[
              { value: "", label: routesForSelectedCamp.length ? "Select route" : "No generated route for this camp" },
              ...routesForSelectedCamp.map((route) => ({
                value: route._id,
                label: `${route.route_name || "Route"} | safety ${route.safety_score ?? "N/A"} | ${route.route_status}`,
              })),
            ]}
          />
          {selectedRouteForForm && (
            <div className={`rounded-lg border p-3 text-xs ${
              selectedRouteForForm.route_status === "Blocked"
                ? "border-rose-400/40 bg-rose-500/10 text-rose-100"
                : selectedRouteForForm.safety_score < 50
                  ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
                  : "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
            }`}>
              Route safety {selectedRouteForForm.safety_score ?? "N/A"}/100 | {selectedRouteForForm.distance ?? "N/A"} km | {selectedRouteForForm.estimated_time || "N/A"}
              {selectedRouteMobilityPlan && (
                <span>
                  {" "} | Truck {selectedRouteMobilityPlan.truck_distance_km ?? 0} km | Boat {selectedRouteMobilityPlan.boat_distance_km ?? 0} km
                </span>
              )}
            </div>
          )}
          {showBoatOptionNotice && (
            <div className="rounded-lg border border-blue-400/40 bg-blue-500/10 p-3 text-sm text-blue-100">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>Selected route includes boat distance or unsafe road status. Use Boat only for the affected segment confirmed by field teams.</span>
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...form, delivery_method: "boat" });
                    setErrors((current) => {
                      const next = { ...current };
                      delete next.delivery_method;
                      return next;
                    });
                  }}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500"
                >
                  Use Boat
                </button>
              </div>
            </div>
          )}
          <FormSelect
            label="Priority"
            value={form.priority_level}
            onChange={(v) => setForm({ ...form, priority_level: v })}
            error={errors.priority_level}
            options={[
              { value: "Low", label: "Low" },
              { value: "Medium", label: "Medium" },
              { value: "High", label: "High" },
            ]}
          />
          <FormSelect
            label="Delivery Method"
            value={form.delivery_method}
            onChange={(v) => setForm({ ...form, delivery_method: v })}
            error={errors.delivery_method}
            options={[
              { value: "truck", label: "Truck" },
              { value: "boat", label: "Boat" },
              { value: "hand-delivery", label: "Hand Delivery" },
            ]}
          />

          <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
            <h4 className="text-sm font-bold text-slate-100 mb-3 flex items-center gap-2">
              <span className="material-icons text-sm">inventory</span>{" "}
              Distribution Items
            </h4>
            {form.item_list.map((item, index) => {
              const selectedRes = resources.find(
                (r) => r._id === (item as any).resource_id || r.resource_name === item.item_name,
              );
              const suggestedQuantity = getSuggestedQuantity(item);
              const needInfo = selectedRes ? campNeeds?.[selectedRes.resource_type] : null;
              const availableQuantity = Number(selectedRes?.available_quantity || 0);
              const shortageQuantity = Number(needInfo?.shortage || 0);
              return (
                <div
                  key={index}
                  className="mb-4 space-y-3 border-b border-slate-700 pb-4 last:border-0 last:pb-0"
                >
                  <FormSelect
                    label="Select Resource"
                    value={(item as any).resource_id || selectedRes?._id || ""}
                    onChange={(v) => {
                      const res = resources.find((r) => r._id === v);
                      const newList = [...form.item_list];
                      newList[index] = {
                        ...item,
                        resource_id: res?._id || "",
                        item_name: res?.resource_name || "",
                        item_type: res?.resource_type || "food",
                        quantity: res
                          ? Math.min(Number(item.quantity || 0), Number(res.available_quantity || 0))
                          : 0,
                        unit: res?.unit || "units",
                      };
                      setForm({ ...form, item_list: newList });
                      setErrors((current) => {
                        const next = { ...current };
                        delete next[`item_${index}`];
                        return next;
                      });
                    }}
                    options={[
                      { value: "", label: resources.length ? "Select resource" : "No resources available" },
                      ...resources.map((r) => ({
                        value: r._id,
                        label: `${r.resource_name} (${r.available_quantity} ${r.unit} available)`,
                      })),
                    ]}
                  />
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_96px_260px]">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={selectedRes ? availableQuantity : undefined}
                        disabled={!!selectedRes && availableQuantity <= 0}
                        value={item.quantity || ""}
                        onChange={(e) => {
                          const rawQuantity = e.target.value === "" ? 0 : Number(e.target.value);
                          const quantity = selectedRes
                            ? Math.min(rawQuantity, availableQuantity)
                            : rawQuantity;
                          const newList = [...form.item_list];
                          newList[index] = {
                            ...newList[index],
                            quantity,
                          };
                          setForm({ ...form, item_list: newList });
                          setErrors((current) => {
                            const next = { ...current };
                            delete next[`item_${index}`];
                            return next;
                          });
                        }}
                        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Unit
                      </label>
                      <input
                        type="text"
                        value={item.unit}
                        readOnly
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-300 outline-none"
                      />
                    </div>
                    <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-3 text-xs text-cyan-100">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white">Suggested</span>
                        {campNeedsLoading && <span className="text-cyan-200">Loading...</span>}
                      </div>
                      {selectedRes ? (
                        <>
                          <p className="mt-1">Available: {selectedRes.available_quantity} {selectedRes.unit}</p>
                          <p>Camp shortage: {shortageQuantity} {selectedRes.unit}</p>
                          {availableQuantity <= 0 ? (
                            <p className="font-bold text-rose-200">Out of stock. Add inventory before creating this item.</p>
                          ) : shortageQuantity <= 0 ? (
                            <p className="font-bold text-emerald-200">No shortage detected for this resource.</p>
                          ) : (
                            <p className="font-bold">Recommended dispatch: {suggestedQuantity} {selectedRes.unit}</p>
                          )}
                          {suggestedQuantity > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newList = [...form.item_list];
                                newList[index] = {
                                  ...newList[index],
                                  quantity: suggestedQuantity,
                                };
                                setForm({ ...form, item_list: newList });
                                setErrors((current) => {
                                  const next = { ...current };
                                  delete next[`item_${index}`];
                                  return next;
                                });
                              }}
                              className="mt-2 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-cyan-500"
                            >
                              Use suggested
                            </button>
                          )}
                        </>
                      ) : (
                        <p className="mt-1 text-cyan-200/80">Select a resource to calculate stock suggestion.</p>
                      )}
                    </div>
                  </div>
                  {errors[`item_${index}`] && (
                    <p className="text-xs text-rose-500 font-medium">
                      {errors[`item_${index}`]}
                    </p>
                  )}
                  {suggestedQuantity > 0 && item.quantity > 0 && (
                    <p className={`text-xs font-semibold ${
                      item.quantity >= suggestedQuantity ? "text-emerald-300" : "text-amber-300"
                    }`}>
                      {item.quantity >= suggestedQuantity
                        ? "Entered quantity meets the suggested sufficient amount."
                        : `Below suggestion (${suggestedQuantity}), but you can still create if stock is available.`}
                    </p>
                  )}
                  {form.item_list.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          item_list: form.item_list.filter((_, itemIndex) => itemIndex !== index),
                        })
                      }
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                    >
                      Remove item
                    </button>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  item_list: [
                    ...form.item_list,
                    { resource_id: "", item_name: "", item_type: "food", quantity: 0, unit: "units" },
                  ],
                })
              }
              className="mt-2 flex items-center gap-1 rounded-lg border border-dashed border-cyan-300 bg-white px-3 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-50"
            >
              <span className="material-icons text-sm">add</span>
              Add another item
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-4 py-2.5 text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300"
              rows={2}
            />
            {errors.notes && (
              <p className="mt-1 text-xs text-rose-500">{errors.notes}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowModal(false)}
            className="px-4 py-2 rounded-lg border text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <PrimaryButton onClick={handleCreate} icon="add">
            Create
          </PrimaryButton>
        </div>
      </Modal>

      <Modal
        isOpen={confirmModal.open}
        onClose={() =>
          setConfirmModal({
            open: false,
            distribution: null,
            items: [],
            partial_reason: "",
          })
        }
        title="Confirm Delivered Items"
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Enter the actual delivered quantity for each item. The system will update inventory, camp stock, and partial delivery status.
          </div>
          {(confirmModal.distribution?.item_list || []).map((item: any, index: number) => (
            <div key={item.item_name} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{item.item_name}</p>
                  <p className="text-xs text-gray-500">
                    Planned: {item.quantity} {item.unit}
                  </p>
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  {item.item_type}
                </span>
              </div>
              <input
                type="number"
                min={0}
                max={item.quantity}
                value={confirmModal.items[index]?.delivered_quantity || 0}
                onChange={(event) => {
                  const nextItems = [...confirmModal.items];
                  nextItems[index] = {
                    item_name: item.item_name,
                    delivered_quantity: Number(event.target.value),
                  };
                  setConfirmModal({ ...confirmModal, items: nextItems });
                }}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300"
              />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Partial delivery reason
            </label>
            <textarea
              value={confirmModal.partial_reason}
              onChange={(event) =>
                setConfirmModal({
                  ...confirmModal,
                  partial_reason: event.target.value,
                })
              }
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-cyan-300"
              placeholder="Example: bridge blocked, vehicle capacity insufficient, item unavailable..."
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() =>
              setConfirmModal({
                open: false,
                distribution: null,
                items: [],
                partial_reason: "",
              })
            }
            className="rounded-lg border px-4 py-2 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <PrimaryButton onClick={handleConfirmItems} icon="rule">
            Confirm Delivery
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
