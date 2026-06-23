import React, { useEffect, useState } from "react";
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

interface DistributionPlansProps {
  userRole?: string;
}
export default function DistributionPlans({
  userRole = "admin",
}: DistributionPlansProps) {
  const [distributions, setDistributions] = useState<any[]>([]);
  const [camps, setCamps] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [form, setForm] = useState({
    camp_id: "",
    priority_level: "Medium",
    delivery_method: "truck",
    notes: "",
    item_list: [
      { item_name: "", item_type: "food", quantity: 0, unit: "units" },
    ],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
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

  const load = () => {
    setLoading(true);
    Promise.all([
      api.getDistributions(),
      api.getCamps(),
      api.getResources(),
    ])
      .then(async ([d, c, r]) => {
        try {
          setDistributions(d.data || []);
          setCamps(filterOutSeedCamps(c.data || []));
          setResources(filterOutSeedResources(r.data || []));
        } catch (e) {
          setDistributions(d.data || []);
          setCamps(c.data || []);
          setResources(r.data || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.camp_id) newErrors.camp_id = "Camp is required";
    
    form.item_list.forEach((item, index) => {
      if (item.quantity <= 0) newErrors[`item_${index}`] = "Qty must be > 0";
      const res = resources.find(r => r.resource_name === item.item_name);
      if (res && item.quantity > res.available_quantity) {
        newErrors[`item_${index}`] = "Insufficient stock";
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

  const handleCreate = async () => {
    setSubmitError("");
    if (!validate()) return;
    try {
      await api.createDistribution(form);
      setShowModal(false);
      load();
    } catch (err: any) {
      setSubmitError(api.getFriendlyErrorMessage(err));
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await api.updateDistributionStatus(id, status);
      load();
    } catch (err: any) {
      alert(err.message);
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
    try {
      await api.confirmDistributionItems(confirmModal.distribution._id, {
        items: confirmModal.items,
        partial_reason: confirmModal.partial_reason,
      });
      setConfirmModal({
        open: false,
        distribution: null,
        items: [],
        partial_reason: "",
      });
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this distribution plan?")) return;
    await api.deleteDistribution(id);
    load();
  };

  const filtered = distributions.filter((d) => {
    const campName = typeof d.camp_id === "object" ? d.camp_id.camp_name : "";
    const matchSearch = campName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

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
                setShowModal(true);
              }}
              icon="add"
            >
              New Distribution
            </PrimaryButton>
          )
        }
      />

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
                      <p className="text-xs text-gray-400">
                        {new Date(d.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <PriorityBadge level={d.priority_level} />
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
                <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                  {canManage && d.status === "Pending" && (
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
          <FormSelect
            label="Camp"
            value={form.camp_id}
            onChange={(v) => setForm({ ...form, camp_id: v })}
            error={errors.camp_id}
            required
            options={camps.map((c) => ({ value: c._id, label: c.camp_name }))}
          />
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
              { value: "helicopter", label: "Helicopter" },
              { value: "hand-delivery", label: "Hand Delivery" },
            ]}
          />

          <div className="rounded-lg border border-gray-200 bg-slate-50 p-4">
            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span className="material-icons text-sm">inventory</span>{" "}
              Distribution Items
            </h4>
            {form.item_list.map((item, index) => {
              const selectedRes = resources.find(
                (r) => r.resource_name === item.item_name,
              );
              return (
                <div
                  key={index}
                  className="mb-4 space-y-3 border-b border-gray-200 pb-4 last:border-0 last:pb-0"
                >
                  <FormSelect
                    label="Select Resource"
                    value={item.item_name}
                    onChange={(v) => {
                      const res = resources.find((r) => r.resource_name === v);
                      const newList = [...form.item_list];
                      newList[index] = {
                        ...item,
                        item_name: v,
                        item_type: res?.resource_type || "food",
                        unit: res?.unit || "units",
                      };
                      setForm({ ...form, item_list: newList });
                    }}
                    options={resources.map((r) => ({
                      value: r.resource_name,
                      label: `${r.resource_name} (${r.available_quantity} ${r.unit} available)`,
                    }))}
                  />
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => {
                          const newList = [...form.item_list];
                          newList[index].quantity = Number(e.target.value);
                          setForm({ ...form, item_list: newList });
                        }}
                        className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
                      />
                    </div>
                    <div className="w-24">
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Unit
                      </label>
                      <input
                        type="text"
                        value={item.unit}
                        readOnly
                        className="w-full rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm text-gray-500 outline-none"
                      />
                    </div>
                  </div>
                  {errors[`item_${index}`] && (
                    <p className="text-xs text-rose-500 font-medium">
                      {errors[`item_${index}`]}
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
                    { item_name: "", item_type: "food", quantity: 0, unit: "units" },
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-cyan-300"
              rows={2}
            />
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
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
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
