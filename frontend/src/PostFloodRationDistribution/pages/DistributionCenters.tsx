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
  manager_name: "",
  contact_phone: "",
  capacity_units: 0,
  vehicle_capacity_units: 0,
  operating_status: "Open",
  notes: "",
};

const phoneRegex = /^(?:\+94|0)[0-9]{9}$/;

export default function DistributionCenters({ userRole = "admin" }: { userRole?: string }) {
  const [centers, setCenters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  const canManage = Permissions.canManageDistributionCenters(userRole);
  const canDelete = Permissions.canDeleteData(userRole);

  const load = (showLoading = false) => {
    if (showLoading) setLoading(true);
    api.getDistributionCenters()
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
      center.manager_name?.toLowerCase().includes(q)
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
      manager_name: center.manager_name || "",
      contact_phone: center.contact_phone || "",
      capacity_units: center.capacity_units || 0,
      vehicle_capacity_units: center.vehicle_capacity_units || 0,
      operating_status: center.operating_status || "Open",
      notes: center.notes || "",
    });
    setError("");
    setShowModal(true);
  };

  const save = async () => {
    setError("");
    if (!form.name.trim()) {
      setError("Center name is required.");
      return;
    }
    if (form.contact_phone.trim() && !phoneRegex.test(form.contact_phone.replace(/\s/g, ""))) {
      setError("Contact phone must be valid (e.g. 0771234567 or +94771234567).");
      return;
    }
    try {
      if (editId) await api.updateDistributionCenter(editId, form);
      else await api.createDistributionCenter(form);
      setShowModal(false);
      load(false);
    } catch (err: any) {
      setError(err.message || "Failed to save distribution center.");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this distribution center?")) return;
    await api.deleteDistributionCenter(id);
    load(false);
  };

  if (loading) return <Loading message="Loading distribution centers..." />;

  return (
    <div>
      <PageHeader
        title="Distribution Centers"
        subtitle="Manage warehouse hubs, dispatch capacity, and center-wise stock visibility"
        icon="store"
        actions={canManage && <PrimaryButton onClick={openCreate} icon="add">Add Center</PrimaryButton>}
      />

      <SearchFilter searchTerm={search} onSearch={setSearch} placeholder="Search centers..." />

      {filtered.length === 0 ? (
        <EmptyState icon="store" title="No distribution centers found" subtitle="Add a center to support nearest-hub ration planning." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((center) => {
            const lowStock = (center.stock_items || []).filter((item: any) => Number(item.quantity_available || 0) <= Number(item.low_stock_threshold || 0)).length;
            return (
              <div key={center._id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{center.name}</h3>
                    <p className="text-sm text-slate-500">{center.address || "No address recorded"}</p>
                  </div>
                  <StatusBadge status={center.operating_status} />
                </div>
                <div className="space-y-2 text-sm text-slate-600">
                  <p><b>Manager:</b> {center.manager_name || "N/A"}</p>
                  <p><b>Phone:</b> {center.contact_phone || "N/A"}</p>
                  <p><b>Storage capacity:</b> {Number(center.capacity_units || 0).toLocaleString()} units</p>
                  <p><b>Vehicle capacity:</b> {Number(center.vehicle_capacity_units || 0).toLocaleString()} units</p>
                  <p><b>Stock lines:</b> {(center.stock_items || []).length} {lowStock > 0 && <span className="font-bold text-rose-600">({lowStock} low)</span>}</p>
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
            );
          })}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? "Edit Distribution Center" : "Add Distribution Center"} size="lg">
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
          <FormInput label="Manager Name" value={form.manager_name} onChange={(v) => setForm({ ...form, manager_name: v })} />
          <FormInput label="Contact Phone" value={form.contact_phone} onChange={(v) => setForm({ ...form, contact_phone: v })} />
          <FormInput label="Storage Capacity" type="number" value={form.capacity_units} onChange={(v) => setForm({ ...form, capacity_units: Number(v) })} />
          <FormInput label="Vehicle Capacity" type="number" value={form.vehicle_capacity_units} onChange={(v) => setForm({ ...form, vehicle_capacity_units: Number(v) })} />
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
