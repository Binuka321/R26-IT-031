import React, { useEffect, useState } from "react";
import {
  EmptyState,
  FormInput,
  FormSelect,
  Loading,
  Modal,
  PageHeader,
  PrimaryButton,
  SearchFilter,
  StatusBadge,
} from "../components/UIComponents";
import * as api from "../services/api";
import { Permissions } from "../utils/permissions";
import { GoogleMapActions } from "../utils/googleMaps";
import { useLiveRefresh } from "../utils/useLiveRefresh";

const emptyForm = {
  name: "",
  latitude: 7.8731,
  longitude: 80.7718,
  address: "",
  commander_name: "",
  contact_phone: "",
  rescue_team_capacity: 0,
  boat_capacity: 0,
  ambulance_capacity: 0,
  operating_status: "Open",
  notes: "",
};

const phoneRegex = /^(?:\+94|0)[0-9]{9}$/;

export default function RescueCenters({ userRole = "admin" }: { userRole?: string }) {
  const [centers, setCenters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  const canManage = Permissions.canManageRescueCenters(userRole);
  const canDelete = Permissions.canDeleteData(userRole);

  const load = (showLoading = false) => {
    if (showLoading) setLoading(true);
    api.getRescueCenters()
      .then((response) => setCenters(response.data || []))
      .catch(console.error)
      .finally(() => {
        if (showLoading) setLoading(false);
      });
  };

  useEffect(() => load(true), []);
  useLiveRefresh(() => load(false), [], 30000, !showModal);

  const filtered = centers.filter((center) => {
    const q = search.toLowerCase();
    return (
      center.name?.toLowerCase().includes(q) ||
      center.address?.toLowerCase().includes(q) ||
      center.commander_name?.toLowerCase().includes(q)
    );
  });

  const openCreate = () => {
    setEditId("");
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  };

  const openEdit = (center: any) => {
    setEditId(center._id);
    setForm({
      name: center.name || "",
      latitude: center.latitude || 7.8731,
      longitude: center.longitude || 80.7718,
      address: center.address || "",
      commander_name: center.commander_name || "",
      contact_phone: center.contact_phone || "",
      rescue_team_capacity: center.rescue_team_capacity || 0,
      boat_capacity: center.boat_capacity || 0,
      ambulance_capacity: center.ambulance_capacity || 0,
      operating_status: center.operating_status || "Open",
      notes: center.notes || "",
    });
    setError("");
    setShowModal(true);
  };

  const save = async () => {
    setError("");
    if (!form.name.trim()) {
      setError("Rescue center name is required.");
      return;
    }
    if (form.contact_phone.trim() && !phoneRegex.test(form.contact_phone.replace(/\s/g, ""))) {
      setError("Contact phone must be valid (e.g. 0771234567 or +94771234567).");
      return;
    }
    try {
      if (editId) await api.updateRescueCenter(editId, form);
      else await api.createRescueCenter(form);
      setShowModal(false);
      load(false);
    } catch (err: any) {
      setError(err.message || "Failed to save rescue center.");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this rescue center?")) return;
    await api.deleteRescueCenter(id);
    load(false);
  };

  if (loading) return <Loading message="Loading rescue centers..." />;

  return (
    <div>
      <PageHeader
        title="Rescue Centers"
        subtitle="Manage rescue bases, commanders, team capacity, boats, and ambulance readiness"
        icon="local_police"
        actions={canManage && <PrimaryButton onClick={openCreate} icon="add">Add Rescue Center</PrimaryButton>}
      />

      <SearchFilter searchTerm={search} onSearch={setSearch} placeholder="Search rescue centers..." />

      {filtered.length === 0 ? (
        <EmptyState icon="local_police" title="No rescue centers found" subtitle="Add main rescue bases so rescue missions can be filtered and coordinated by command center." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((center) => (
            <div key={center._id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900">{center.name}</h3>
                  <p className="text-sm text-slate-500">{center.address || "No address recorded"}</p>
                </div>
                <StatusBadge status={center.operating_status} />
              </div>
              <div className="space-y-2 text-sm text-slate-600">
                <p><b>Commander:</b> {center.commander_name || "N/A"}</p>
                <p><b>Phone:</b> {center.contact_phone || "N/A"}</p>
                <p><b>Team capacity:</b> {Number(center.rescue_team_capacity || 0).toLocaleString()}</p>
                <p><b>Boats:</b> {Number(center.boat_capacity || 0).toLocaleString()}</p>
                <p><b>Ambulances:</b> {Number(center.ambulance_capacity || 0).toLocaleString()}</p>
                <GoogleMapActions latitude={center.latitude} longitude={center.longitude} compact />
              </div>
              {canManage && (
                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                  <button onClick={() => openEdit(center)} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-cyan-50 py-2 text-sm font-bold text-cyan-700 hover:bg-cyan-100">
                    <span className="material-icons text-sm">edit</span>Edit
                  </button>
                  {canDelete && (
                    <button onClick={() => remove(center._id)} className="rounded-lg bg-rose-50 px-3 py-2 text-rose-600 hover:bg-rose-100">
                      <span className="material-icons text-sm">delete</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? "Edit Rescue Center" : "Add Rescue Center"} size="lg">
        {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormInput label="Center Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <FormSelect label="Operating Status" value={form.operating_status} onChange={(v) => setForm({ ...form, operating_status: v })} options={[
            { value: "Open", label: "Open" },
            { value: "Limited", label: "Limited" },
            { value: "Closed", label: "Closed" },
          ]} />
          <FormInput label="Latitude" type="number" value={form.latitude} onChange={(v) => setForm({ ...form, latitude: Number(v) })} />
          <FormInput label="Longitude" type="number" value={form.longitude} onChange={(v) => setForm({ ...form, longitude: Number(v) })} />
          <FormInput label="Commander Name" value={form.commander_name} onChange={(v) => setForm({ ...form, commander_name: v })} />
          <FormInput label="Contact Phone" value={form.contact_phone} onChange={(v) => setForm({ ...form, contact_phone: v })} />
          <FormInput label="Team Capacity" type="number" value={form.rescue_team_capacity} onChange={(v) => setForm({ ...form, rescue_team_capacity: Number(v) })} />
          <FormInput label="Boat Capacity" type="number" value={form.boat_capacity} onChange={(v) => setForm({ ...form, boat_capacity: Number(v) })} />
          <FormInput label="Ambulance Capacity" type="number" value={form.ambulance_capacity} onChange={(v) => setForm({ ...form, ambulance_capacity: Number(v) })} />
          <div className="md:col-span-2">
            <FormInput label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setShowModal(false)} className="rounded-lg border px-4 py-2 text-gray-600 hover:bg-gray-50">Cancel</button>
          <PrimaryButton onClick={save} icon="save">{editId ? "Update" : "Create"}</PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
