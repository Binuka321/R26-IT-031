// API Service Layer for Post-Flood Rescue & Ration Distribution System
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api";

function getHeaders() {
  const token = localStorage.getItem("flood-user-token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers as any) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
}

// Dashboard
export const getDashboardStats = () => request("/reports/dashboard");

// Safe Zones
export const getSafeZones = (params?: Record<string, string>) => {
  const q = params ? "?" + new URLSearchParams(params).toString() : "";
  return request(`/safe-zones${q}`);
};
export const getSafeZoneById = (id: string) => request(`/safe-zones/${id}`);
export const createSafeZone = (data: any) =>
  request("/safe-zones", { method: "POST", body: JSON.stringify(data) });
export const updateSafeZone = (id: string, data: any) =>
  request(`/safe-zones/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteSafeZone = (id: string) =>
  request(`/safe-zones/${id}`, { method: "DELETE" });
export const checkLocation = (lat: number, lng: number) =>
  request("/safe-zones/check-location", {
    method: "POST",
    body: JSON.stringify({ latitude: lat, longitude: lng }),
  });

// Camps
export const getCamps = (params?: Record<string, string>) => {
  const q = params ? "?" + new URLSearchParams(params).toString() : "";
  return request(`/camps${q}`);
};
export const getCampById = (id: string) => request(`/camps/${id}`);
export const createCamp = (data: any) =>
  request("/camps", { method: "POST", body: JSON.stringify(data) });
export const updateCamp = (id: string, data: any) =>
  request(`/camps/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteCamp = (id: string) =>
  request(`/camps/${id}`, { method: "DELETE" });
export const getCampNeeds = (id: string) => request(`/camps/${id}/needs`);
export const getCampPriority = (id: string) => request(`/camps/${id}/priority`);
export const getCampStats = () => request("/camps/stats/summary");

// Disease Results
export const getDiseaseResults = (params?: Record<string, string>) => {
  const q = params ? "?" + new URLSearchParams(params).toString() : "";
  return request(`/disease-results${q}`);
};
export const getDiseaseBycamp = (campId: string) =>
  request(`/disease-results/camp/${campId}`);
export const getDiseaseAlerts = () => request("/disease-results/alerts");
export const createDiseaseResult = (data: any) =>
  request("/disease-results", { method: "POST", body: JSON.stringify(data) });

// Resources
export const getResources = (params?: Record<string, string>) => {
  const q = params ? "?" + new URLSearchParams(params).toString() : "";
  return request(`/resources${q}`);
};
export const createResource = (data: any) =>
  request("/resources", { method: "POST", body: JSON.stringify(data) });
export const updateResource = (id: string, data: any) =>
  request(`/resources/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const allocateResource = (resourceId: string, qty: number) =>
  request("/resources/allocate", {
    method: "POST",
    body: JSON.stringify({ resource_id: resourceId, quantity: qty }),
  });
export const getLowStock = () => request("/resources/low-stock");
export const deleteResource = (id: string) =>
  request(`/resources/${id}`, { method: "DELETE" });

// Priority Predictions
export const predictCampPriority = (campId: string) =>
  request("/predictions/camp-priority", {
    method: "POST",
    body: JSON.stringify({ camp_id: campId }),
  });
export const getPrediction = (campId: string) =>
  request(`/predictions/camp/${campId}`);
export const recalculateAll = () =>
  request("/predictions/recalculate-all", { method: "POST" });
export const getAllPredictions = () => request("/predictions");

// Item Priority
export const generateItemPriority = (campId: string) =>
  request(`/item-priority/generate/${campId}`, { method: "POST" });
export const getItemPriority = (campId: string) =>
  request(`/item-priority/camp/${campId}`);
export const getAllItemPriorities = () => request("/item-priority");

// Route Planning
export const generateRoute = (data: any) =>
  request("/routes/generate", { method: "POST", body: JSON.stringify(data) });
export const getRoutesByCamp = (campId: string) =>
  request(`/routes/camp/${campId}`);
export const getRouteById = (id: string) => request(`/routes/${id}`);
export const getAllRoutes = () => request("/routes");

// Distributions
export const createDistribution = (data: any) =>
  request("/distributions", { method: "POST", body: JSON.stringify(data) });
export const getDistributions = (params?: Record<string, string>) => {
  const q = params ? "?" + new URLSearchParams(params).toString() : "";
  return request(`/distributions${q}`);
};
export const getDistributionById = (id: string) =>
  request(`/distributions/${id}`);
export const updateDistributionStatus = (id: string, status: string) =>
  request(`/distributions/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
export const assignTeam = (id: string, teamId: string) =>
  request(`/distributions/${id}/assign-team`, {
    method: "PUT",
    body: JSON.stringify({ team_id: teamId }),
  });
export const deleteDistribution = (id: string) =>
  request(`/distributions/${id}`, { method: "DELETE" });
export const getDistributionStats = () =>
  request("/distributions/stats/summary");

// Reports
export const getCampPriorityReport = () => request("/reports/camp-priority");
export const getResourceReport = () => request("/reports/resources");
export const getDistributionReport = () => request("/reports/distributions");
export const getRouteReport = () => request("/reports/routes");

// Notifications
export const getNotifications = (params?: Record<string, string>) => {
  const q = params ? "?" + new URLSearchParams(params).toString() : "";
  return request(`/notifications${q}`);
};
export const getUnreadCount = () => request("/notifications/unread-count");
export const markAsRead = (id: string) =>
  request(`/notifications/${id}/read`, { method: "PUT" });
export const markAllRead = () =>
  request("/notifications/mark-all-read", { method: "PUT" });

// Users
export const getUsers = () => request("/users");
export const getUsersByRole = (role: string) => request(`/users/role/${role}`);
