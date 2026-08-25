import React, { useEffect, useState } from "react";
import {
  PageHeader,
  PrimaryButton,
  Modal,
  FormInput,
  FormSelect,
  Loading,
  EmptyState,
  SearchFilter,
  FormErrorSummary,
} from "../components/UIComponents";
import * as api from "../services/api";
import { filterOutSeedResources } from "../utils/filterSeedData";
import { Permissions } from "../utils/permissions";
import { useLiveRefresh } from "../utils/useLiveRefresh";

interface ResourceInventoryProps {
  userRole?: string;
}
export default function ResourceInventory({
  userRole = "admin",
}: ResourceInventoryProps) {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    resource_name: "",
    resource_type: "food",
    total_quantity: 0,
    allocated_quantity: 0,
    unit: "units",
    low_stock_threshold: 50,
    description: "",
    batch_number: "",
    expiry_date: "",
    supplier: "",
    storage_location: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");

  const canManage = Permissions.canManageResources(userRole);
  const canDelete = Permissions.canDeleteData(userRole);

  const load = (showLoading = false) => {
    if (showLoading) setLoading(true);
    api
      .getResources()
      .then(async (r) => {
        try {
          setResources(filterOutSeedResources(r.data || []));
        } catch (e) {
          setResources(r.data || []);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (showLoading) setLoading(false);
      });
  };
  useEffect(() => {
    load(true);
  }, []);
  useLiveRefresh(() => load(false), [], 30000, !showModal);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const validTypes = ["food", "water", "medicine", "sanitary", "clothes", "baby_care", "emergency"];

    if (!form.resource_name.trim()) newErrors.resource_name = "Name is required";
    else if (form.resource_name.trim().length < 3) newErrors.resource_name = "Name must be at least 3 characters";
    else if (form.resource_name.trim().length > 80) newErrors.resource_name = "Name is too long";
    if (!validTypes.includes(form.resource_type)) newErrors.resource_type = "Select a valid resource type";
    if (!Number.isFinite(form.total_quantity) || form.total_quantity <= 0) newErrors.total_quantity = "Total qty must be > 0";
    if (form.total_quantity > 1000000) newErrors.total_quantity = "Total quantity looks too large";
    if (!Number.isFinite(form.allocated_quantity) || form.allocated_quantity < 0) newErrors.allocated_quantity = "Cannot be negative";
    if (form.allocated_quantity > form.total_quantity) newErrors.allocated_quantity = "Exceeds total stock";
    if (!form.unit.trim()) newErrors.unit = "Unit is required";
    else if (form.unit.trim().length > 30) newErrors.unit = "Unit is too long";
    if (!Number.isFinite(form.low_stock_threshold) || form.low_stock_threshold < 0) {
      newErrors.low_stock_threshold = "Threshold cannot be negative";
    } else if (form.low_stock_threshold > form.total_quantity) {
      newErrors.low_stock_threshold = "Threshold cannot exceed total stock";
    }
    if (form.description.trim().length > 300) newErrors.description = "Description is too long";
    
    setErrors(newErrors);
    setSubmitError(
      Object.keys(newErrors).length > 0
        ? "Please correct the highlighted fields before saving."
        : ""
    );
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    setSubmitError("");
    if (!validate()) return;
    try {
      if (editId) await api.updateResource(editId, form);
      else await api.createResource(form);
      setErrors({});
      setSubmitError("");
      setShowModal(false);
      load(false);
    } catch (err: any) {
      setSubmitError(api.getFriendlyErrorMessage(err));
    }
  };

  const handleEdit = (r: any) => {
    setForm({
      resource_name: r.resource_name,
      resource_type: r.resource_type,
      total_quantity: r.total_quantity,
      allocated_quantity: r.allocated_quantity,
      unit: r.unit,
      low_stock_threshold: r.low_stock_threshold,
      description: r.description || "",
      batch_number: r.batch_number || "",
      expiry_date: r.expiry_date ? String(r.expiry_date).slice(0, 10) : "",
      supplier: r.supplier || "",
      storage_location: r.storage_location || "",
    });
    setEditId(r._id);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this resource?")) return;
    await api.deleteResource(id);
    load(false);
  };

  const filtered = resources.filter((r) => {
    const matchSearch = r.resource_name
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchType = !filterType || r.resource_type === filterType;
    return matchSearch && matchType;
  });

  const typeIcons: Record<string, { icon: string; color: string }> = {
    food: { icon: "restaurant", color: "from-amber-400 to-orange-500" },
    water: { icon: "water_drop", color: "from-cyan-400 to-blue-500" },
    medicine: { icon: "medical_services", color: "from-rose-400 to-pink-500" },
    sanitary: { icon: "sanitizer", color: "from-purple-400 to-indigo-500" },
    clothes: { icon: "checkroom", color: "from-teal-400 to-emerald-500" },
    baby_care: { icon: "child_care", color: "from-pink-400 to-rose-500" },
    emergency: { icon: "emergency", color: "from-red-400 to-rose-600" },
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Resource Inventory"
        subtitle="Manage relief supplies and stock levels"
        icon="warehouse"
        actions={
          canManage && (
            <PrimaryButton
              onClick={() => {
                setEditId(null);
                setErrors({});
                setSubmitError("");
                setForm({
                  resource_name: "",
                  resource_type: "food",
                  total_quantity: 0,
                  allocated_quantity: 0,
                  unit: "units",
                  low_stock_threshold: 50,
                  description: "",
                  batch_number: "",
                  expiry_date: "",
                  supplier: "",
                  storage_location: "",
                });
                setShowModal(true);
              }}
              icon="add"
            >
              Add Resource
            </PrimaryButton>
          )
        }
      />

      <SearchFilter
        searchTerm={search}
        onSearch={setSearch}
        placeholder="Search resources..."
      >
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm"
        >
          <option value="">All Types</option>
          <option value="food">Food</option>
          <option value="water">Water</option>
          <option value="medicine">Medicine</option>
          <option value="sanitary">Sanitary</option>
          <option value="clothes">Clothes</option>
          <option value="baby_care">Baby Care</option>
          <option value="emergency">Emergency</option>
        </select>
      </SearchFilter>

      {filtered.length === 0 ? (
        <EmptyState
          icon="warehouse"
          title="No resources found"
          subtitle="Add resource stock to get started"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => {
            const t = typeIcons[r.resource_type] || {
              icon: "inventory",
              color: "from-gray-400 to-gray-500",
            };
            const isLow = r.available_quantity <= r.low_stock_threshold;
            const usagePercent =
              r.total_quantity > 0
                ? Math.round((r.allocated_quantity / r.total_quantity) * 100)
                : 0;
            return (
              <div
                key={r._id}
                className={`rounded-lg bg-white p-5 shadow-sm border ${isLow ? "border-rose-300 ring-2 ring-rose-100" : "border-slate-200"} transition-all hover:-translate-y-0.5 hover:shadow-md`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-lg bg-gradient-to-br p-2.5 ${t.color} text-white`}
                    >
                      <span className="material-icons">{t.icon}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm">
                        {r.resource_name}
                      </h3>
                      <p className="text-xs text-gray-500 capitalize">
                        {r.resource_type.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                  {isLow && (
                    <span className="flex items-center gap-1 rounded-md bg-rose-100 px-2 py-1 text-xs font-bold text-rose-700">
                      <span className="material-icons text-xs">warning</span>LOW
                    </span>
                  )}
                </div>
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total</span>
                    <span className="font-bold">
                      {r.total_quantity.toLocaleString()} {r.unit}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Allocated</span>
                    <span className="font-medium text-blue-600">
                      {r.allocated_quantity.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Available</span>
                    <span
                      className={`font-bold ${isLow ? "text-rose-600" : "text-emerald-600"}`}
                    >
                      {r.available_quantity.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full transition-all ${usagePercent > 80 ? "bg-rose-500" : usagePercent > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${usagePercent}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  {usagePercent}% allocated
                </p>
                {(r.expiry_date || r.batch_number || r.storage_location) && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    {r.batch_number && <p><b>Batch:</b> {r.batch_number}</p>}
                    {r.expiry_date && (
                      <p>
                        <b>Expiry:</b> {new Date(r.expiry_date).toLocaleDateString()}
                        {new Date(r.expiry_date).getTime() - Date.now() <= 30 * 24 * 60 * 60 * 1000 && (
                          <span className="ml-1 font-black text-rose-700">FIFO priority</span>
                        )}
                      </p>
                    )}
                    {r.storage_location && <p><b>Storage:</b> {r.storage_location}</p>}
                  </div>
                )}
                {canManage && (
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleEdit(r)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-cyan-50 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-100"
                    >
                      <span className="material-icons text-sm">edit</span>Edit
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(r._id)}
                        className="py-2 px-3 rounded-lg bg-rose-50 text-rose-600 text-sm hover:bg-rose-100"
                      >
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

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setErrors({}); setSubmitError(""); }}
        title={editId ? "Edit Resource" : "Add Resource"}
        size="md"
      >
        <FormErrorSummary message={submitError} errors={errors} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Resource Name"
            value={form.resource_name}
            onChange={(v) => setForm({ ...form, resource_name: v })}
            error={errors.resource_name}
            required
          />
          <FormSelect
            label="Type"
            value={form.resource_type}
            onChange={(v) => setForm({ ...form, resource_type: v })}
            error={errors.resource_type}
            required
            options={[
              { value: "food", label: "Food" },
              { value: "water", label: "Water" },
              { value: "medicine", label: "Medicine" },
              { value: "sanitary", label: "Sanitary" },
              { value: "clothes", label: "Clothes" },
              { value: "baby_care", label: "Baby Care" },
              { value: "emergency", label: "Emergency" },
            ]}
          />
          <FormInput
            label="Total Quantity"
            value={form.total_quantity}
            onChange={(v) => setForm({ ...form, total_quantity: Number(v) })}
            error={errors.total_quantity}
            type="number"
            min={0}
          />
          <FormInput
            label="Allocated Quantity"
            value={form.allocated_quantity}
            onChange={(v) => setForm({ ...form, allocated_quantity: Number(v) })}
            error={errors.allocated_quantity}
            type="number"
            min={0}
          />
          <FormInput
            label="Unit"
            value={form.unit}
            onChange={(v) => setForm({ ...form, unit: v })}
            error={errors.unit}
          />
          <FormInput
            label="Low Stock Threshold"
            value={form.low_stock_threshold}
            onChange={(v) => setForm({ ...form, low_stock_threshold: Number(v) })}
            error={errors.low_stock_threshold}
            type="number"
          />
          <FormInput
            label="Batch Number"
            value={form.batch_number}
            onChange={(v) => setForm({ ...form, batch_number: v })}
          />
          <FormInput
            label="Expiry Date"
            value={form.expiry_date}
            onChange={(v) => setForm({ ...form, expiry_date: v })}
            type="date"
          />
          <FormInput
            label="Supplier"
            value={form.supplier}
            onChange={(v) => setForm({ ...form, supplier: v })}
          />
          <FormInput
            label="Storage Location"
            value={form.storage_location}
            onChange={(v) => setForm({ ...form, storage_location: v })}
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
