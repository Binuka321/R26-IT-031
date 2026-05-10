import React, { useEffect, useState } from "react";
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
} from "../components/UIComponents";
import * as api from "../services/api";
import type { NeedReport } from "../types";
import { Permissions } from "../utils/permissions";

interface NeedReportsProps {
  userRole: string;
  initialType?: string;
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
  });

  useEffect(() => {
    if (initialType) {
      setForm(f => ({ ...f, need_type: initialType }));
      setShowModal(true);
    }
  }, [initialType]);

  const isPublicUser = Permissions.isPublicUser(userRole);
  const isStaff = Permissions.isStaff(userRole);

  const load = () => {
    setLoading(true);
    const apiCall = isPublicUser ? api.getMyNeedReports() : api.getNeedReports();
    
    apiCall
      .then((res: any) => setReports(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, [userRole]);

  const handleSubmit = async () => {
    try {
      await api.submitNeedReport(form);
      setShowModal(false);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await api.updateNeedReportStatus(id, status);
      load();
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
                    {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
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
                {!isPublicUser && (
                   <button
                   onClick={async () => {
                     if(confirm("Delete report?")) {
                       await api.deleteNeedReport(r._id);
                       load();
                     }
                   }}
                   className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 ml-auto md:ml-0"
                 >
                   <span className="material-icons text-sm">delete</span>
                 </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Submit Assistance Request"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-4">
            <p className="text-sm text-blue-800">
              Please provide accurate information. This data is sent directly to
              rescue teams and distribution officers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Your Name"
              value={form.reporter_name}
              onChange={(v) => setForm({ ...form, reporter_name: v })}
              required
            />
            <FormInput
              label="Contact Phone"
              value={form.contact_phone}
              onChange={(v) => setForm({ ...form, contact_phone: v })}
              required
            />
            <FormInput
              label="Latitude"
              value={form.latitude}
              onChange={(v) => setForm({ ...form, latitude: Number(v) })}
              type="number"
              required
            />
            <FormInput
              label="Longitude"
              value={form.longitude}
              onChange={(v) => setForm({ ...form, longitude: Number(v) })}
              type="number"
              required
            />
            <FormSelect
              label="Type of Need"
              value={form.need_type}
              onChange={(v) => setForm({ ...form, need_type: v })}
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
