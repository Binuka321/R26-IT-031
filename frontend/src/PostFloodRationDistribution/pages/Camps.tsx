import React, { useEffect, useState } from "react";
import {
  PageHeader,
  PrimaryButton,
  PriorityBadge,
  StatusBadge,
  Modal,
  FormInput,
  Loading,
  EmptyState,
  SearchFilter,
} from "../components/UIComponents";
import * as api from "../services/api";
import {
  filterOutSeedCamps,
  filterOutSeedSafeZones,
} from "../utils/filterSeedData";
import type { Camp, SafeZone } from "../types";

interface CampsProps {
  onViewCamp?: (id: string) => void;
  userRole?: string;
}

type RiskLevel = "Low" | "Medium" | "High";
type RoadAccessStatus = "Good" | "Limited" | "Blocked";

export default function Camps({ onViewCamp, userRole = "admin" }: CampsProps) {
  const [camps, setCamps] = useState<Camp[]>([]);
  const [zones, setZones] = useState<SafeZone[]>([]);
  const [diseaseResults, setDiseaseResults] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterZone, setFilterZone] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  const role = userRole?.toLowerCase() || "user";
  const isAdmin = role === "admin" || role === "disaster_officer";

  const [form, setForm] = useState({
    camp_name: "",
    latitude: 0,
    longitude: 0,
    population: 0,
    children_count: 0,
    elderly_count: 0,
    food_available: 0,
    water_available: 0,
    medicine_available: 0,
    sanitary_available: 0,
    road_access_status: "Good" as RoadAccessStatus,
    disease_risk_level: "Low" as RiskLevel,
    distance_from_distribution_center: 0,
    camp_capacity: 1,
    contact_person: "",
    contact_phone: "",
  });

  const toNumber = (value: any) => {
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? 0 : numberValue;
  };

  const extractArray = (response: any): any[] => {
    const data = response?.data ?? response;

    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.diseaseResults)) return data.diseaseResults;
    if (Array.isArray(data?.detections)) return data.detections;

    return [];
  };

  const callFirstAvailableApi = async (functionNames: string[]) => {
    for (const functionName of functionNames) {
      const apiFunction = (api as any)[functionName];

      if (typeof apiFunction === "function") {
        try {
          const response = await apiFunction();
          return extractArray(response);
        } catch (error) {
          console.warn(`${functionName} failed:`, error);
        }
      }
    }

    return [];
  };

  const getCoordinates = (item: any) => {
    const lat =
      item?.latitude ??
      item?.lat ??
      item?.location?.latitude ??
      item?.location?.lat ??
      item?.coordinates?.latitude ??
      item?.coordinates?.lat;

    const lng =
      item?.longitude ??
      item?.lng ??
      item?.lon ??
      item?.location?.longitude ??
      item?.location?.lng ??
      item?.location?.lon ??
      item?.coordinates?.longitude ??
      item?.coordinates?.lng ??
      item?.coordinates?.lon;

    return {
      lat: Number(lat),
      lng: Number(lng),
    };
  };

  const hasValidSriLankaCoordinates = (item: any) => {
    const { lat, lng } = getCoordinates(item);

    return (
      !Number.isNaN(lat) &&
      !Number.isNaN(lng) &&
      lat >= 5.5 &&
      lat <= 10.1 &&
      lng >= 79.0 &&
      lng <= 82.2
    );
  };

  const normalizeRiskLevel = (value: any): RiskLevel => {
    const text = String(value || "").toLowerCase();

    if (
      text.includes("high") ||
      text.includes("critical") ||
      text.includes("danger") ||
      text.includes("severe")
    ) {
      return "High";
    }

    if (
      text.includes("medium") ||
      text.includes("moderate") ||
      text.includes("warning")
    ) {
      return "Medium";
    }

    return "Low";
  };

  const riskScore = (risk: RiskLevel) => {
    if (risk === "High") return 3;
    if (risk === "Medium") return 2;
    return 1;
  };

  const getDistanceKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const earthRadiusKm = 6371;

    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKm * c;
  };

  const getRiskFromDiseaseResult = (result: any): RiskLevel => {
    const rawRisk =
      result?.disease_risk_level ||
      result?.risk_level ||
      result?.riskLevel ||
      result?.diseaseRiskLevel ||
      result?.disease_risk ||
      result?.severity ||
      result?.status ||
      result?.prediction;

    if (rawRisk) return normalizeRiskLevel(rawRisk);

    const cases = Number(
      result?.cases ||
        result?.case_count ||
        result?.reported_cases ||
        result?.infected_count ||
        0
    );

    if (cases >= 20) return "High";
    if (cases >= 5) return "Medium";

    return "Low";
  };

  const getAutoDiseaseRiskForCamp = (
    latitude: number,
    longitude: number
  ): RiskLevel => {
    const campPoint = { latitude, longitude };

    if (!hasValidSriLankaCoordinates(campPoint)) return "Low";

    const nearbyDiseaseResults = diseaseResults.filter((result) => {
      if (!hasValidSriLankaCoordinates(result)) return false;

      const point = getCoordinates(result);
      const distance = getDistanceKm(latitude, longitude, point.lat, point.lng);

      return distance <= 10;
    });

    if (nearbyDiseaseResults.length === 0) return "Low";

    const highestScore = Math.max(
      ...nearbyDiseaseResults.map((result) =>
        riskScore(getRiskFromDiseaseResult(result))
      )
    );

    if (highestScore >= 3) return "High";
    if (highestScore >= 2) return "Medium";
    return "Low";
  };

  const getAutoSafeZoneForCamp = (latitude: number, longitude: number) => {
    const campPoint = { latitude, longitude };

    if (!hasValidSriLankaCoordinates(campPoint)) return null;

    const matchingZones = zones
      .filter((zone: any) => hasValidSriLankaCoordinates(zone))
      .map((zone: any) => {
        const zonePoint = getCoordinates(zone);
        const radiusKm = Number(zone.radius_km || zone.radius || 2);

        const distanceKm = getDistanceKm(
          latitude,
          longitude,
          zonePoint.lat,
          zonePoint.lng
        );

        return {
          zone,
          distanceKm,
          radiusKm,
        };
      })
      .filter((item) => item.distanceKm <= item.radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return matchingZones[0]?.zone || null;
  };

  const getSafeZoneName = (safeZone: any) => {
    if (!safeZone) return "N/A";

    if (typeof safeZone === "object") {
      return safeZone.name || "N/A";
    }

    const foundZone = zones.find((zone) => zone._id === safeZone);
    return foundZone?.name || "N/A";
  };

  const load = () => {
    setLoading(true);

    Promise.all([
      api.getCamps(),
      api.getSafeZones(),
      callFirstAvailableApi([
        "getDiseaseResults",
        "getDiseaseDetections",
        "getDiseaseRiskResults",
        "getPostFloodDiseaseResults",
      ]),
    ])
      .then(([c, z, diseaseData]) => {
        try {
          setCamps(filterOutSeedCamps(c.data || []));
          setZones(filterOutSeedSafeZones(z.data || []));
        } catch (e) {
          setCamps(c.data || []);
          setZones(z.data || []);
        }

        setDiseaseResults(diseaseData || []);
        console.log("Member 3 disease detection results:", diseaseData || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const previewSafeZone = getAutoSafeZoneForCamp(
    Number(form.latitude),
    Number(form.longitude)
  );

  const previewDiseaseRisk = getAutoDiseaseRiskForCamp(
    Number(form.latitude),
    Number(form.longitude)
  );

  const validateForm = () => {
    if (!form.camp_name.trim()) {
      alert("Please enter camp name.");
      return false;
    }

    if (!hasValidSriLankaCoordinates(form)) {
      alert("Please enter valid Sri Lanka latitude and longitude.");
      return false;
    }

    if (!previewSafeZone) {
      alert(
        "This camp is not inside any safe zone. Please enter coordinates inside a registered safe zone."
      );
      return false;
    }

    if (form.population <= 0) {
      alert("Population must be greater than 0.");
      return false;
    }

    if (form.children_count + form.elderly_count > form.population) {
      alert("Children count and elderly count cannot exceed total population.");
      return false;
    }

    if (form.camp_capacity <= 0) {
      alert("Camp capacity must be greater than 0.");
      return false;
    }

    if (form.distance_from_distribution_center < 0) {
      alert("Distance from distribution center cannot be negative.");
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    try {
      if (!validateForm()) return;

      const autoDiseaseRisk = getAutoDiseaseRiskForCamp(
        Number(form.latitude),
        Number(form.longitude)
      );

      const autoSafeZone = getAutoSafeZoneForCamp(
        Number(form.latitude),
        Number(form.longitude)
      );

      const payload = {
        ...form,
        safe_zone_id: autoSafeZone?._id,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        population: Number(form.population),
        children_count: Number(form.children_count),
        elderly_count: Number(form.elderly_count),
        food_available: Number(form.food_available),
        water_available: Number(form.water_available),
        medicine_available: Number(form.medicine_available),
        sanitary_available: Number(form.sanitary_available),
        road_access_status: form.road_access_status,
        distance_from_distribution_center: Number(
          form.distance_from_distribution_center
        ),
        camp_capacity: Number(form.camp_capacity),
        disease_risk_level: autoDiseaseRisk,
      };

      if (editId) await api.updateCamp(editId, payload);
      else await api.createCamp(payload);

      setShowModal(false);
      setEditId(null);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEdit = (c: Camp) => {
    setForm({
      camp_name: c.camp_name,
      latitude: c.latitude,
      longitude: c.longitude,
      population: c.population,
      children_count: c.children_count,
      elderly_count: c.elderly_count,
      food_available: c.food_available,
      water_available: c.water_available,
      medicine_available: c.medicine_available,
      sanitary_available: c.sanitary_available,
      road_access_status: c.road_access_status || "Good",
      disease_risk_level: normalizeRiskLevel(c.disease_risk_level),
      distance_from_distribution_center: c.distance_from_distribution_center,
      camp_capacity: c.camp_capacity,
      contact_person: c.contact_person,
      contact_phone: c.contact_phone,
    });

    setEditId(c._id);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this camp?")) return;

    await api.deleteCamp(id);
    load();
  };

  const openNewForm = () => {
    setEditId(null);

    setForm({
      camp_name: "",
      latitude: 0,
      longitude: 0,
      population: 0,
      children_count: 0,
      elderly_count: 0,
      food_available: 0,
      water_available: 0,
      medicine_available: 0,
      sanitary_available: 0,
      road_access_status: "Good",
      disease_risk_level: "Low",
      distance_from_distribution_center: 0,
      camp_capacity: 1,
      contact_person: "",
      contact_phone: "",
    });

    setShowModal(true);
  };

  const filtered = camps.filter((c) => {
    const matchSearch = c.camp_name
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchPriority =
      !filterPriority || c.priority_level === filterPriority;

    const zoneId =
      typeof c.safe_zone_id === "object" ? c.safe_zone_id._id : c.safe_zone_id;

    const matchZone = !filterZone || zoneId === filterZone;

    return matchSearch && matchPriority && matchZone;
  });

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Camp Management"
        subtitle={`${camps.length} camps across ${zones.length} safe zones`}
        icon="holiday_village"
        actions={
          isAdmin && (
            <PrimaryButton onClick={openNewForm} icon="add">
              Add Camp
            </PrimaryButton>
          )
        }
      />

      <SearchFilter
        searchTerm={search}
        onSearch={setSearch}
        placeholder="Search camps..."
      >
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm"
        >
          <option value="">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <select
          value={filterZone}
          onChange={(e) => setFilterZone(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm"
        >
          <option value="">All Zones</option>
          {zones.map((z) => (
            <option key={z._id} value={z._id}>
              {z.name}
            </option>
          ))}
        </select>
      </SearchFilter>

      {filtered.length === 0 ? (
        <EmptyState
          icon="holiday_village"
          title="No camps found"
          subtitle="Add camps inside safe zones"
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Camp Name
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Auto Safe Zone
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">
                    Population
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">
                    Priority
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">
                    Disease Risk
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((c) => {
                  const zoneName = getSafeZoneName(c.safe_zone_id);

                  return (
                    <tr
                      key={c._id}
                      className="border-b border-gray-50 hover:bg-cyan-50/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-gray-800">
                        <div className="flex items-center gap-2">
                          {c.safe_zone_id && (
                            <span className="text-blue-500" title="Safe Camp">
                              <span className="material-icons text-sm">
                                star
                              </span>
                            </span>
                          )}
                          {c.camp_name}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-gray-600">{zoneName}</td>

                      <td className="py-3 px-4 text-center">
                        {c.population}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <PriorityBadge level={c.priority_level} />
                      </td>

                      <td className="py-3 px-4 text-center">
                        <PriorityBadge level={c.disease_risk_level} />
                      </td>

                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={c.status} />
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center gap-1">
                          {onViewCamp && (
                            <button
                              onClick={() => onViewCamp(c._id)}
                              title="View Details"
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"
                            >
                              <span className="material-icons text-sm">
                                visibility
                              </span>
                            </button>
                          )}

                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleEdit(c)}
                                title="Edit"
                                className="p-1.5 rounded-lg hover:bg-cyan-50 text-cyan-600"
                              >
                                <span className="material-icons text-sm">
                                  edit
                                </span>
                              </button>

                              <button
                                onClick={() => handleDelete(c._id)}
                                title="Delete"
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600"
                              >
                                <span className="material-icons text-sm">
                                  delete
                                </span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? "Edit Camp" : "Add Camp"}
        size="lg"
      >
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-green-50 border border-green-100">
            <h4 className="font-bold text-gray-800">Safe Zone Auto Detection</h4>
            <p className="text-sm text-gray-600 mt-1">
              Safe zone is automatically assigned using camp latitude and
              longitude.
            </p>
            <div className="mt-3 text-sm font-semibold text-green-900">
              {previewSafeZone ? previewSafeZone.name : "No safe zone detected"}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
            <h4 className="font-bold text-gray-800">
              Disease Risk Auto Detection
            </h4>
            <p className="text-sm text-gray-600 mt-1">
              Disease risk is automatically assigned using Member 3 disease
              detection results.
            </p>
            <div className="mt-3">
              <PriorityBadge level={previewDiseaseRisk} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormInput
            label="Camp Name"
            value={form.camp_name}
            onChange={(v) => setForm({ ...form, camp_name: v })}
            required
          />

          <FormInput
            label="Latitude"
            value={form.latitude}
            onChange={(v) => setForm({ ...form, latitude: toNumber(v) })}
            type="number"
            required
          />

          <FormInput
            label="Longitude"
            value={form.longitude}
            onChange={(v) => setForm({ ...form, longitude: toNumber(v) })}
            type="number"
            required
          />

          <FormInput
            label="Population"
            value={form.population}
            onChange={(v) => setForm({ ...form, population: toNumber(v) })}
            type="number"
            min={0}
          />

          <FormInput
            label="Children Count"
            value={form.children_count}
            onChange={(v) =>
              setForm({ ...form, children_count: toNumber(v) })
            }
            type="number"
            min={0}
          />

          <FormInput
            label="Elderly Count"
            value={form.elderly_count}
            onChange={(v) =>
              setForm({ ...form, elderly_count: toNumber(v) })
            }
            type="number"
            min={0}
          />

          <FormInput
            label="Food Available"
            value={form.food_available}
            onChange={(v) =>
              setForm({ ...form, food_available: toNumber(v) })
            }
            type="number"
            min={0}
          />

          <FormInput
            label="Water Available"
            value={form.water_available}
            onChange={(v) =>
              setForm({ ...form, water_available: toNumber(v) })
            }
            type="number"
            min={0}
          />

          <FormInput
            label="Medicine Available"
            value={form.medicine_available}
            onChange={(v) =>
              setForm({ ...form, medicine_available: toNumber(v) })
            }
            type="number"
            min={0}
          />

          <FormInput
            label="Sanitary Available"
            value={form.sanitary_available}
            onChange={(v) =>
              setForm({ ...form, sanitary_available: toNumber(v) })
            }
            type="number"
            min={0}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Road Access Status
            </label>
            <select
              value={form.road_access_status}
              onChange={(e) =>
                setForm({
                  ...form,
                  road_access_status: e.target.value as RoadAccessStatus,
                })
              }
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="Good">Good</option>
              <option value="Limited">Limited</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>

          <FormInput
            label="Distance from Center (km)"
            value={form.distance_from_distribution_center}
            onChange={(v) =>
              setForm({
                ...form,
                distance_from_distribution_center: toNumber(v),
              })
            }
            type="number"
          />

          <FormInput
            label="Camp Capacity"
            value={form.camp_capacity}
            onChange={(v) => setForm({ ...form, camp_capacity: toNumber(v) })}
            type="number"
          />

          <FormInput
            label="Contact Person"
            value={form.contact_person}
            onChange={(v) => setForm({ ...form, contact_person: v })}
          />

          <FormInput
            label="Contact Phone"
            value={form.contact_phone}
            onChange={(v) => setForm({ ...form, contact_phone: v })}
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowModal(false)}
            className="px-4 py-2 rounded-lg border text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>

          <PrimaryButton onClick={handleSave} icon="save">
            {editId ? "Update" : "Create"}
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
