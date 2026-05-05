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
} from "../components/UIComponents";
import * as api from "../services/api";
import { filterOutSeedResources } from "../utils/filterSeedData";

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
  });

  const role = userRole?.toLowerCase() || "user";
  const isAdmin =
    role === "admin" ||
    role === "disaster_officer" ||
    role === "camp_coordinator";

  const load = () => {
    setLoading(true);
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
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSave = async () => {
    try {
      if (editId) await api.updateResource(editId, form);
      else await api.createResource(form);
      setShowModal(false);
      setEditId(null);
      load();
    } catch (err: any) {
      alert(err.message);
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
    });
    setEditId(r._id);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this resource?")) return;
    await api.deleteResource(id);
    load();
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
          isAdmin && (
            <PrimaryButton
              onClick={() => {
                setEditId(null);
                setForm({
                  resource_name: "",
                  resource_type: "food",
                  total_quantity: 0,
                  allocated_quantity: 0,
                  unit: "units",
                  low_stock_threshold: 50,
                  description: "",
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
          className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm"
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
                className={`bg-white rounded-2xl p-5 shadow-lg border ${isLow ? "border-rose-300 ring-2 ring-rose-100" : "border-gray-100"} hover:shadow-xl transition-shadow`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl bg-gradient-to-br ${t.color} text-white`}
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
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 flex items-center gap-1">
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
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${usagePercent > 80 ? "bg-rose-500" : usagePercent > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${usagePercent}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  {usagePercent}% allocated
                </p>
                {isAdmin && (
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleEdit(r)}
                      className="flex-1 py-2 rounded-lg bg-cyan-50 text-cyan-700 text-sm font-medium hover:bg-cyan-100 flex items-center justify-center gap-1"
                    >
                      <span className="material-icons text-sm">edit</span>Edit
                    </button>
                    <button
                      onClick={() => handleDelete(r._id)}
                      className="py-2 px-3 rounded-lg bg-rose-50 text-rose-600 text-sm hover:bg-rose-100"
                    >
                      <span className="material-icons text-sm">delete</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? "Edit Resource" : "Add Resource"}
        size="md"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Resource Name"
            value={form.resource_name}
            onChange={(v) => setForm({ ...form, resource_name: v })}
            required
          />
          <FormSelect
            label="Type"
            value={form.resource_type}
            onChange={(v) => setForm({ ...form, resource_type: v })}
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
            onChange={(v) => setForm({ ...form, total_quantity: v })}
            type="number"
            min={0}
          />
          <FormInput
            label="Allocated Quantity"
            value={form.allocated_quantity}
            onChange={(v) => setForm({ ...form, allocated_quantity: v })}
            type="number"
            min={0}
          />
          <FormInput
            label="Unit"
            value={form.unit}
            onChange={(v) => setForm({ ...form, unit: v })}
          />
          <FormInput
            label="Low Stock Threshold"
            value={form.low_stock_threshold}
            onChange={(v) => setForm({ ...form, low_stock_threshold: v })}
            type="number"
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
