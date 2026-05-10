import React, { useEffect, useState } from "react";
import {
  PageHeader,
  PrimaryButton,
  StatusBadge,
  Modal,
  FormInput,
  FormSelect,
  Loading,
  EmptyState,
  SearchFilter,
} from "../components/UIComponents";
import * as api from "../services/api";
import { filterOutSeedSafeZones } from "../utils/filterSeedData";
import { Permissions } from "../utils/permissions";
import type { SafeZone } from "../types";

interface SafeZonesProps {
  userRole?: string;
}
export default function SafeZones({ userRole = "admin" }: SafeZonesProps) {
  const [zones, setZones] = useState<SafeZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    latitude: 0,
    longitude: 0,
    radius_km: 2,
    capacity: 0,
    nearby_road_access: "",
    safety_status: "Safe",
    description: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const canManage = Permissions.canManageSafeZones(userRole);
  const canDelete = Permissions.canDeleteData(userRole);
  const [editId, setEditId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
      api
        .getSafeZones()
      .then(async (r) => {
        try {
          setZones(filterOutSeedSafeZones(r.data || []));
        } catch (e) {
          setZones(r.data || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Name is required";
    if (form.latitude < 5 || form.latitude > 10) newErrors.latitude = "Invalid latitude for Sri Lanka";
    if (form.longitude < 79 || form.longitude > 82) newErrors.longitude = "Invalid longitude for Sri Lanka";
    if (form.radius_km <= 0) newErrors.radius_km = "Radius must be > 0";
    if (form.capacity <= 0) newErrors.capacity = "Capacity must be > 0";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      if (editId) await api.updateSafeZone(editId, form);
      else await api.createSafeZone(form);
      setShowModal(false);
      setEditId(null);
      setForm({
        name: "",
        latitude: 0,
        longitude: 0,
        radius_km: 2,
        capacity: 0,
        nearby_road_access: "",
        safety_status: "Safe",
        description: "",
      });
      setErrors({});
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEdit = (z: SafeZone) => {
    setForm({
      name: z.name,
      latitude: z.latitude,
      longitude: z.longitude,
      radius_km: z.radius_km,
      capacity: z.capacity,
      nearby_road_access: z.nearby_road_access,
      safety_status: z.safety_status,
      description: z.description,
    });
    setEditId(z._id);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this safe zone?")) return;
    await api.deleteSafeZone(id);
    load();
  };

  const filtered = zones.filter((z) =>
    z.name.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Safe Zones"
        subtitle="Manage identified safe areas for refugee camps"
        icon="shield"
        actions={
          canManage && (
            <PrimaryButton
              onClick={() => {
                setEditId(null);
                setErrors({});
                setForm({
                  name: "",
                  latitude: 0,
                  longitude: 0,
                  radius_km: 2,
                  capacity: 0,
                  nearby_road_access: "",
                  safety_status: "Safe",
                  description: "",
                });
                setShowModal(true);
              }}
              icon="add"
            >
              Add Safe Zone
            </PrimaryButton>
          )
        }
      />

      <SearchFilter
        searchTerm={search}
        onSearch={setSearch}
        placeholder="Search safe zones..."
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon="shield"
          title="No safe zones found"
          subtitle="Create your first safe zone to get started"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((z) => (
            <div
              key={z._id}
              className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-gray-800">{z.name}</h3>
                <StatusBadge status={z.safety_status} />
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <p className="flex items-center gap-2">
                  <span className="material-icons text-sm text-cyan-500">
                    location_on
                  </span>
                  {z.latitude.toFixed(4)}, {z.longitude.toFixed(4)}
                </p>
                <p className="flex items-center gap-2">
                  <span className="material-icons text-sm text-purple-500">
                    people
                  </span>
                  {z.current_population} / {z.capacity} capacity
                </p>
                <p className="flex items-center gap-2">
                  <span className="material-icons text-sm text-amber-500">
                    straighten
                  </span>
                  Radius: {z.radius_km} km
                </p>
                {z.nearby_road_access && (
                  <p className="flex items-center gap-2">
                    <span className="material-icons text-sm text-emerald-500">
                      directions
                    </span>
                    {z.nearby_road_access}
                  </p>
                )}
              </div>
              {canManage && (
                <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleEdit(z)}
                    className="flex-1 py-2 rounded-lg bg-cyan-50 text-cyan-700 text-sm font-medium hover:bg-cyan-100 flex items-center justify-center gap-1"
                  >
                    <span className="material-icons text-sm">edit</span>Edit
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(z._id)}
                      className="py-2 px-3 rounded-lg bg-rose-50 text-rose-600 text-sm hover:bg-rose-100"
                    >
                      <span className="material-icons text-sm">delete</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setErrors({}); }}
        title={editId ? "Edit Safe Zone" : "Add Safe Zone"}
        size="md"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            error={errors.name}
            required
          />
          <FormSelect
            label="Safety Status"
            value={form.safety_status}
            onChange={(v) => setForm({ ...form, safety_status: v })}
            error={errors.safety_status}
            options={[
              { value: "Safe", label: "Safe" },
              { value: "At Risk", label: "At Risk" },
              { value: "Compromised", label: "Compromised" },
            ]}
          />
          <FormInput
            label="Latitude"
            value={form.latitude}
            onChange={(v) => setForm({ ...form, latitude: Number(v) })}
            error={errors.latitude}
            type="number"
            required
          />
          <FormInput
            label="Longitude"
            value={form.longitude}
            onChange={(v) => setForm({ ...form, longitude: Number(v) })}
            error={errors.longitude}
            type="number"
            required
          />
          <FormInput
            label="Radius (km)"
            value={form.radius_km}
            onChange={(v) => setForm({ ...form, radius_km: Number(v) })}
            error={errors.radius_km}
            type="number"
          />
          <FormInput
            label="Capacity"
            value={form.capacity}
            onChange={(v) => setForm({ ...form, capacity: Number(v) })}
            error={errors.capacity}
            type="number"
          />
          <FormInput
            label="Nearby Road Access"
            value={form.nearby_road_access}
            onChange={(v) => setForm({ ...form, nearby_road_access: v })}
          />
          <FormInput
            label="Description"
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowModal(false)}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
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
