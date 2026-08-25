import React, { useEffect, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  PageHeader,
  PrimaryButton,
  StatusBadge,
  PriorityBadge,
  Modal,
  FormInput,
  FormSelect,
  Loading,
  EmptyState,
  FormErrorSummary,
} from "../components/UIComponents";
import * as api from "../services/api";
import type { NeedReport } from "../types";
import { getGoogleMapsPinUrl, getGoogleMapsDirectionsUrl } from "../utils/googleMaps";
import { Permissions } from "../utils/permissions";
import { useLiveRefresh } from "../utils/useLiveRefresh";

interface NeedReportsProps {
  userRole: string;
  initialType?: string;
}

function formatAccuracy(accuracy?: number | null) {
  if (!accuracy || !Number.isFinite(accuracy)) return "";
  return accuracy >= 1000
    ? `${(accuracy / 1000).toFixed(1)} km`
    : `${Math.round(accuracy)} m`;
}

async function reverseGeocode(latitude: number, longitude: number) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );
  if (!response.ok) return "";
  const data = await response.json();
  const address = data?.address || {};
  const compactName = [
    address.road || address.neighbourhood || address.suburb || address.village || address.town || address.city,
    address.city_district || address.county || address.state_district,
    address.state,
  ]
    .filter(Boolean)
    .join(", ");
  return compactName || data?.display_name || "";
}

function MapRecenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, map, zoom]);
  return null;
}

function LocationMapClickHandler({
  onSelect,
}: {
  onSelect: (latitude: number, longitude: number) => void;
}) {
  useMapEvents({
    click(event) {
      onSelect(
        Number(event.latlng.lat.toFixed(8)),
        Number(event.latlng.lng.toFixed(8)),
      );
    },
  });
  return null;
}

function LocationMapPicker({
  latitude,
  longitude,
  onSelect,
}: {
  latitude: number;
  longitude: number;
  onSelect: (latitude: number, longitude: number) => void;
}) {
  const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude) && !(latitude === 0 && longitude === 0);
  const center: [number, number] = hasLocation ? [latitude, longitude] : [7.8731, 80.7718];
  const zoom = hasLocation ? 16 : 8;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "260px", width: "100%" }}
      className="z-0 rounded-xl border border-gray-200"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapRecenter center={center} zoom={zoom} />
      <LocationMapClickHandler onSelect={onSelect} />
      {hasLocation && (
        <CircleMarker
          center={center}
          radius={9}
          pathOptions={{
            color: "#2563eb",
            fillColor: "#2563eb",
            fillOpacity: 0.8,
            weight: 3,
          }}
        />
      )}
    </MapContainer>
  );
}

export default function NeedReports({ userRole, initialType }: NeedReportsProps) {
  const [reports, setReports] = useState<NeedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    reporter_name: "",
    latitude: 0,
    longitude: 0,
    need_type: "Food",
    severity: "Medium",
    people_count: 1,
    contact_phone: "",
    description: "",
    location_name: "",
    gps_accuracy_meters: null as number | null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [editingReport, setEditingReport] = useState<NeedReport | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [resolvingMapLocation, setResolvingMapLocation] = useState(false);
  const [mapLink, setMapLink] = useState("");
  const [resolvingMapLink, setResolvingMapLink] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");

  useEffect(() => {
    if (initialType) {
      setForm(f => ({ ...f, need_type: initialType }));
      setErrors({});
      setShowModal(true);
    }
  }, [initialType]);

  const isPublicUser = Permissions.isPublicUser(userRole);
  const isStaff = Permissions.isStaff(userRole);

  const load = (showLoading = false) => {
    if (showLoading) setLoading(true);
    const apiCall = isPublicUser ? api.getMyNeedReports() : api.getNeedReports();
    
    apiCall
      .then((res: any) => setReports(res.data || []))
      .catch(console.error)
      .finally(() => {
        if (showLoading) setLoading(false);
      });
  };

  useEffect(() => {
    load(true);
  }, [userRole]);
  useLiveRefresh(() => load(false), [userRole], 30000, !showModal);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setDetectingLocation(true);
    setLocationMessage("Detecting live location...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = Number(position.coords.latitude.toFixed(8));
        const longitude = Number(position.coords.longitude.toFixed(8));
        const accuracy = Math.round(position.coords.accuracy || 0);
        let locationName = "";

        try {
          locationName = await reverseGeocode(latitude, longitude);
        } catch (error) {
          locationName = "";
        }

        setForm((current) => ({
          ...current,
          latitude,
          longitude,
          location_name: locationName,
          gps_accuracy_meters: accuracy || null,
        }));
        setErrors((current) => {
          const next = { ...current };
          delete next.latitude;
          delete next.longitude;
          return next;
        });
        setLocationMessage(
          accuracy > 100
            ? `Approximate GPS fix. Accuracy about ${formatAccuracy(accuracy)}. Move outdoors or enable precise location if this is wrong.`
            : `Live location detected${locationName ? `: ${locationName}` : ""}. Accuracy about ${formatAccuracy(accuracy)}.`,
        );
        setDetectingLocation(false);
      },
      (error) => {
        setDetectingLocation(false);
        setLocationMessage("Unable to retrieve your location. Enable precise location/GPS permission and try again.");
        alert("Unable to retrieve your location. Please ensure location services are enabled.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  };

  const handleManualMapSelect = async (latitude: number, longitude: number) => {
    setResolvingMapLocation(true);
    let locationName = "";
    try {
      locationName = await reverseGeocode(latitude, longitude);
    } catch (error) {
      locationName = "";
    }

    setForm((current) => ({
      ...current,
      latitude,
      longitude,
      location_name: locationName,
      gps_accuracy_meters: null,
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next.latitude;
      delete next.longitude;
      return next;
    });
    setLocationMessage(
      locationName
        ? `Location corrected from map: ${locationName}.`
        : "Location corrected from map.",
    );
    setResolvingMapLocation(false);
  };

  const applyCoordinatesFromLink = async () => {
    const url = mapLink.trim();
    if (!url) {
      setLocationMessage("Paste a Google Maps link first.");
      return;
    }

    setResolvingMapLink(true);
    setLocationMessage("Reading Google Maps link...");
    try {
      const response = await api.resolveGoogleMapLink(url);
      const latitude = Number(response?.data?.latitude);
      const longitude = Number(response?.data?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("No coordinates found in that map link.");
      }

      let locationName = "";
      try {
        locationName = await reverseGeocode(latitude, longitude);
      } catch (error) {
        locationName = "";
      }

      setForm((current) => ({
        ...current,
        latitude: Number(latitude.toFixed(8)),
        longitude: Number(longitude.toFixed(8)),
        location_name: locationName,
        gps_accuracy_meters: null,
      }));
      setErrors((current) => {
        const next = { ...current };
        delete next.latitude;
        delete next.longitude;
        return next;
      });
      setLocationMessage(
        locationName
          ? `Location loaded from Google Maps link: ${locationName}.`
          : "Location loaded from Google Maps link.",
      );
    } catch (error: any) {
      setLocationMessage(error?.message || "Could not read that Google Maps link.");
    } finally {
      setResolvingMapLink(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingReport(null);
    setErrors({});
    setSubmitError("");
    setForm({
      reporter_name: "",
      latitude: 0,
      longitude: 0,
      need_type: "Food",
      severity: "Medium",
      people_count: 1,
      contact_phone: "",
      description: "",
      location_name: "",
      gps_accuracy_meters: null,
    });
    setLocationMessage("");
    setMapLink("");
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const validNeedTypes = ["Food", "Water", "Medical", "Rescue", "Shelter", "Road Blockage", "Flood Level", "Other"];
    const validSeverities = ["Low", "Medium", "High", "Emergency"];

    if (!form.reporter_name.trim()) newErrors.reporter_name = "Name is required";
    else if (form.reporter_name.trim().length < 3) newErrors.reporter_name = "Name must be at least 3 characters";
    else if (form.reporter_name.trim().length > 80) newErrors.reporter_name = "Name is too long";
    
    const phoneRegex = /^(?:\+94|0)[0-9]{9}$/;
    if (!form.contact_phone.trim()) {
      newErrors.contact_phone = "Phone is required";
    } else if (!phoneRegex.test(form.contact_phone.replace(/\s/g, ""))) {
      newErrors.contact_phone = "Invalid format (e.g. 0771234567)";
    }
    if (!Number.isFinite(form.latitude) || form.latitude < 5 || form.latitude > 10) newErrors.latitude = "Invalid latitude for Sri Lanka";
    if (!Number.isFinite(form.longitude) || form.longitude < 79 || form.longitude > 82) newErrors.longitude = "Invalid longitude for Sri Lanka";
    if (form.latitude === 0 && form.longitude === 0) newErrors.latitude = "Please specify location";
    if (!validNeedTypes.includes(form.need_type)) newErrors.need_type = "Select a valid need type";
    if (!validSeverities.includes(form.severity)) newErrors.severity = "Select a valid severity";
    if (!Number.isFinite(form.people_count) || form.people_count <= 0) newErrors.people_count = "Must be at least 1 person";
    else if (form.people_count > 1000) newErrors.people_count = "People count looks too large for one report";
    if (form.description.trim().length > 500) newErrors.description = "Description is too long";
    
    setErrors(newErrors);
    setSubmitError(
      Object.keys(newErrors).length > 0
        ? "Please correct the highlighted fields before submitting."
        : ""
    );
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    setSubmitError("");
    if (!validate()) return;
    try {
      if (editingReport) {
        await api.updateNeedReport(editingReport._id, form);
      } else {
        const response = await api.submitNeedReport(form);
        if (response?.duplicate_warning) {
          alert("Possible duplicate report detected. Staff will review it with the existing report.");
        }
      }
      closeModal();
      load(false);
    } catch (err: any) {
      setSubmitError(api.getFriendlyErrorMessage(err));
    }
  };

  const handleEdit = (report: NeedReport) => {
    setEditingReport(report);
    setForm({
      reporter_name: report.reporter_name,
      latitude: report.latitude,
      longitude: report.longitude,
      need_type: report.need_type,
      severity: report.severity,
      people_count: report.people_count,
      contact_phone: report.contact_phone,
      description: report.description,
      location_name: report.location_name || "",
      gps_accuracy_meters: report.gps_accuracy_meters ?? null,
    });
    setLocationMessage(
      report.location_name
        ? `Saved location: ${report.location_name}`
        : "Saved report has coordinates only.",
    );
    setShowModal(true);
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await api.updateNeedReportStatus(id, status);
      load(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title={isPublicUser ? "My Assistance Requests" : "Citizen Need Reports"}
        subtitle={
          isPublicUser
            ? "Track the status of your reported needs"
            : "Manage and respond to urgent assistance requests from the public"
        }
        icon="volunteer_activism"
        actions={
          isPublicUser && (
            <PrimaryButton onClick={() => setShowModal(true)} icon="add">
              New Report
            </PrimaryButton>
          )
        }
      />

      {reports.length === 0 ? (
        <EmptyState
          icon="volunteer_activism"
          title="No reports found"
          subtitle={
            isPublicUser
              ? "If you need food, water, or medical help, please submit a report."
              : "No incoming citizen reports at the moment."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {reports.map((r) => (
            <div
              key={r._id}
              className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 flex flex-col md:flex-row justify-between gap-6"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-xl bg-slate-100 text-slate-600`}>
                    <span className="material-icons">
                      {r.need_type === "Food"
                        ? "restaurant"
                        : r.need_type === "Water"
                        ? "water_drop"
                        : r.need_type === "Medical"
                        ? "medical_services"
                        : r.need_type === "Rescue"
                        ? "emergency"
                        : r.need_type === "Road Blockage"
                        ? "block"
                        : r.need_type === "Flood Level"
                        ? "tsunami"
                        : "help"}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-800 text-lg">
                    {r.need_type} Request
                  </h3>
                  <PriorityBadge level={r.severity} />
                  <StatusBadge status={r.status} />
                  {r.possible_duplicate && (
                    <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                      Possible Duplicate
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-600">
                  <p className="flex items-center gap-2">
                    <span className="material-icons text-xs text-blue-500">
                      person
                    </span>
                    {r.reporter_name} ({r.people_count} people)
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="material-icons text-xs text-green-500">
                      phone
                    </span>
                    {r.contact_phone}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="material-icons text-xs text-rose-500">
                      location_on
                    </span>
                    {r.location_name ? `${r.location_name} - ` : ""}
                    {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                    {r.gps_accuracy_meters ? ` (${formatAccuracy(r.gps_accuracy_meters)} accuracy)` : ""}
                    <a
                      href={getGoogleMapsPinUrl(r.latitude, r.longitude)}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100"
                    >
                      <span className="material-icons text-xs">map</span>
                      Exact Pin
                    </a>
                    <a
                      href={getGoogleMapsDirectionsUrl(r.latitude, r.longitude)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                    >
                      <span className="material-icons text-xs">directions</span>
                      Directions
                    </a>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="material-icons text-xs text-purple-500">
                      schedule
                    </span>
                    {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>

                {r.description && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-700 italic">
                    "{r.description}"
                  </div>
                )}
              </div>

              <div className="flex flex-row md:flex-col justify-end gap-2 shrink-0">
                {isStaff && r.status === "Pending" && (
                  <button
                    onClick={() => handleStatusUpdate(r._id, "In Progress")}
                    className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-bold hover:bg-blue-100 transition-colors"
                  >
                    Take Action
                  </button>
                )}
                {isStaff && r.status === "In Progress" && (
                  <button
                    onClick={() => handleStatusUpdate(r._id, "Responded")}
                    className="px-4 py-2 rounded-xl bg-cyan-50 text-cyan-700 text-sm font-bold hover:bg-cyan-100 transition-colors"
                  >
                    Mark Responded
                  </button>
                )}
                {isStaff && r.status === "Responded" && (
                  <button
                    onClick={() => handleStatusUpdate(r._id, "Resolved")}
                    className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition-colors"
                  >
                    Complete
                  </button>
                )}
                
                {isPublicUser && r.status === 'Pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(r)}
                      className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100"
                      title="Edit Report"
                    >
                      <span className="material-icons text-sm">edit</span>
                    </button>
                    <button
                      onClick={async () => {
                        if(confirm("Are you sure you want to delete this report?")) {
                          await api.deleteNeedReport(r._id);
                          load();
                        }
                      }}
                      className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100"
                      title="Delete Report"
                    >
                      <span className="material-icons text-sm">delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingReport ? "Edit Assistance Request" : "Submit Assistance Request"}
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-4">
            <p className="text-sm text-blue-800">
              Please provide accurate information. This data is sent directly to
              rescue teams and distribution officers.
            </p>
          </div>
          <FormErrorSummary message={submitError} errors={errors} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Your Name"
              value={form.reporter_name}
              onChange={(v) => setForm({ ...form, reporter_name: v })}
              error={errors.reporter_name}
              required
            />
            <FormInput
              label="Contact Phone"
              value={form.contact_phone}
              onChange={(v) => setForm({ ...form, contact_phone: v })}
              error={errors.contact_phone}
              required
            />
            <div className="md:col-span-2 p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-600">
                  <span className="material-icons text-xs align-middle mr-1">my_location</span>
                  Detect your current coordinates automatically
                </div>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={detectingLocation}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-sm"
                >
                  <span className="material-icons text-sm">gps_fixed</span>
                  {detectingLocation ? "Detecting..." : "Detect My Location"}
                </button>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                <label className="block text-sm font-semibold text-slate-800">
                  Or paste a Google Maps shared location link
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  For people who cannot use GPS: open Google Maps, drop/select the pin, tap Share, copy the link, and paste it here.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={mapLink}
                    onChange={(event) => setMapLink(event.target.value)}
                    placeholder="https://maps.app.goo.gl/... or https://www.google.com/maps/..."
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={applyCoordinatesFromLink}
                    disabled={resolvingMapLink}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    <span className="material-icons text-sm">link</span>
                    {resolvingMapLink ? "Reading..." : "Use Map Link"}
                  </button>
                </div>
              </div>
              {(locationMessage || form.location_name || form.gps_accuracy_meters) && (
                <div className="mt-3 rounded-xl border border-blue-100 bg-white p-3 text-sm text-gray-700">
                  <div className="flex items-start gap-2">
                    <span className="material-icons mt-0.5 text-base text-blue-600">place</span>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {form.location_name || "Detected coordinates"}
                      </p>
                      <p className="text-xs text-gray-600">
                        {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
                        {form.gps_accuracy_meters ? ` | accuracy ${formatAccuracy(form.gps_accuracy_meters)}` : ""}
                      </p>
                      {locationMessage && (
                        <p className={`mt-1 text-xs ${
                          Number(form.gps_accuracy_meters || 0) > 100 ? "text-amber-700" : "text-blue-700"
                        }`}>
                          {locationMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <FormInput
              label="Latitude"
              value={form.latitude}
              onChange={(v) => setForm({ ...form, latitude: Number(v), location_name: "", gps_accuracy_meters: null })}
              error={errors.latitude}
              type="number"
              required
            />
            <FormInput
              label="Longitude"
              value={form.longitude}
              onChange={(v) => setForm({ ...form, longitude: Number(v), location_name: "", gps_accuracy_meters: null })}
              error={errors.longitude}
              type="number"
              required
            />
            <div className="md:col-span-2">
              <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Correct Location on Map
                  </label>
                  <p className="text-xs text-gray-500">
                    If detected location is wrong, zoom the map and click your exact place.
                  </p>
                </div>
                {resolvingMapLocation && (
                  <span className="text-xs font-semibold text-blue-700">Reading place name...</span>
                )}
                {!(form.latitude === 0 && form.longitude === 0) && (
                  <a
                    href={getGoogleMapsPinUrl(form.latitude, form.longitude)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                  >
                    <span className="material-icons text-sm">map</span>
                    Open Exact Pin
                  </a>
                )}
              </div>
              <LocationMapPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onSelect={handleManualMapSelect}
              />
            </div>
            <FormSelect
              label="Type of Need"
              value={form.need_type}
              onChange={(v) => setForm({ ...form, need_type: v })}
              error={errors.need_type}
              options={[
                { value: "Food", label: "Food" },
                { value: "Water", label: "Water" },
                { value: "Medical", label: "Medical" },
                { value: "Rescue", label: "Rescue Required" },
                { value: "Shelter", label: "Shelter" },
                { value: "Road Blockage", label: "Road Blockage" },
                { value: "Flood Level", label: "Flood Level Report" },
                { value: "Other", label: "Other" },
              ]}
            />
            <FormInput
              label="Number of People"
              value={form.people_count}
              onChange={(v) => setForm({ ...form, people_count: Number(v) })}
              error={errors.people_count}
              type="number"
              min={1}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description / Special Requirements
            </label>
            <textarea
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-300 outline-none transition-all"
              rows={3}
              placeholder="e.g. Need baby food, 2 elderly people with us..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            {errors.description && (
              <p className="mt-1 text-xs text-rose-500">{errors.description}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <PrimaryButton onClick={handleSubmit} icon="send">
              Submit Report
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
