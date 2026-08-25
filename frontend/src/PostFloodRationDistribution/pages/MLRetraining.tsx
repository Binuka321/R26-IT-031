import React, { useEffect, useState } from "react";
import { EmptyState, Loading, PageHeader, PrimaryButton, StatCard } from "../components/UIComponents";
import * as api from "../services/api";
import { useLiveRefresh } from "../utils/useLiveRefresh";

const emptyFeedbackForm = {
  camp_id: "",
  distribution_id: "",
  actual_priority_after_response: "Medium",
  response_outcome: "successful",
  response_time_minutes: "",
  food_priority: "Medium",
  water_priority: "Medium",
  medicine_priority: "Medium",
  sanitary_priority: "Medium",
  notes: "",
};

function getCampIdFromDistribution(distribution: any) {
  return typeof distribution?.camp_id === "object"
    ? distribution.camp_id?._id || ""
    : distribution?.camp_id || "";
}

export default function MLRetraining() {
  const [feedback, setFeedback] = useState<any[]>([]);
  const [camps, setCamps] = useState<any[]>([]);
  const [distributions, setDistributions] = useState<any[]>([]);
  const [status, setStatus] = useState<any>({ status: "idle" });
  const [loading, setLoading] = useState(true);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(emptyFeedbackForm);

  const load = () => {
    Promise.allSettled([
      api.getTrainingFeedback(),
      api.getRetrainingStatus(),
      api.getCamps({ include_seed: "true", include_demo: "true" }),
      api.getDistributions({ include_demo: "true" }),
    ])
      .then(([feedbackResult, statusResult, campsResult, distributionsResult]) => {
        if (feedbackResult.status === "fulfilled") setFeedback(feedbackResult.value.data || []);
        if (statusResult.status === "fulfilled") setStatus(statusResult.value.data || { status: "idle" });
        if (campsResult.status === "fulfilled") setCamps(campsResult.value.data || []);
        if (distributionsResult.status === "fulfilled") setDistributions(distributionsResult.value.data || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useLiveRefresh(load, [], 10000);

  const exportDataset = async () => {
    setMessage("");
    try {
      const result = await api.exportTrainingDataset();
      setMessage(`Feedback dataset exported with ${result.data?.rows || 0} row(s).`);
    } catch (error: any) {
      setMessage(error.message || "Dataset export failed.");
    }
  };

  const startRetraining = async () => {
    setMessage("");
    if (!confirm("Start model retraining now? This runs the Python training script on the backend machine.")) return;
    try {
      await api.startRetraining();
      setMessage("Retraining started. Status will refresh automatically.");
      load();
    } catch (error: any) {
      setMessage(error.message || "Failed to start retraining.");
    }
  };

  const updateForm = (key: string, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "camp_id" ? { distribution_id: "" } : {}),
    }));
  };

  const saveFeedback = async () => {
    setMessage("");
    if (!form.camp_id) {
      setMessage("Select a camp before saving feedback.");
      return;
    }
    setSavingFeedback(true);
    try {
      await api.createTrainingFeedback({
        ...form,
        distribution_id: form.distribution_id || null,
        response_time_minutes: form.response_time_minutes === "" ? null : Number(form.response_time_minutes),
      });
      setMessage("Training feedback saved. This record can be exported for future model retraining.");
      setForm(emptyFeedbackForm);
      load();
    } catch (error: any) {
      setMessage(error.message || "Failed to save training feedback.");
    } finally {
      setSavingFeedback(false);
    }
  };

  if (loading) return <Loading message="Loading ML retraining pipeline..." />;

  const usedCount = feedback.filter((item) => item.used_for_training).length;
  const pendingCount = feedback.length - usedCount;
  const relatedDistributions = distributions.filter(
    (distribution) => !form.camp_id || getCampIdFromDistribution(distribution) === form.camp_id,
  );

  return (
    <div>
      <PageHeader
        title="ML Retraining Pipeline"
        subtitle="Collect real response outcomes, export training feedback, and run controlled model retraining"
        icon="model_training"
        actions={
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={exportDataset} icon="download">Export Dataset</PrimaryButton>
            <PrimaryButton onClick={startRetraining} icon="play_arrow">Start Retraining</PrimaryButton>
          </div>
        }
      />

      {message && <div className="mb-4 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm font-bold text-cyan-800">{message}</div>}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Feedback Records" value={feedback.length} icon="fact_check" color="blue" />
        <StatCard title="Pending Feedback" value={pendingCount} icon="pending_actions" color="amber" />
        <StatCard title="Used for Training" value={usedCount} icon="verified" color="emerald" />
        <StatCard title="Job Status" value={status.status || "idle"} icon="memory" color={status.status === "failed" ? "rose" : "purple"} />
      </div>

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
              <span className="material-icons text-cyan-600">add_task</span>
              Add Field Feedback
            </h3>
            <p className="text-sm text-slate-500">
              Record actual delivery or rescue outcomes so future retraining uses real operational results.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm font-semibold text-slate-700">
            Camp
            <select
              value={form.camp_id}
              onChange={(event) => updateForm("camp_id", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-500"
            >
              <option value="">Select camp</option>
              {camps.map((camp) => (
                <option key={camp._id} value={camp._id}>{camp.camp_name}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Related Distribution
            <select
              value={form.distribution_id}
              onChange={(event) => updateForm("distribution_id", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-500"
            >
              <option value="">No linked distribution</option>
              {relatedDistributions.map((distribution) => (
                <option key={distribution._id} value={distribution._id}>
                  {distribution.status || "Distribution"} | {new Date(distribution.created_at || distribution.createdAt || Date.now()).toLocaleDateString()}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Actual Priority After Response
            <select
              value={form.actual_priority_after_response}
              onChange={(event) => updateForm("actual_priority_after_response", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-500"
            >
              {["Low", "Medium", "High"].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Response Outcome
            <select
              value={form.response_outcome}
              onChange={(event) => updateForm("response_outcome", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-500"
            >
              <option value="successful">Successful</option>
              <option value="partial">Partial</option>
              <option value="failed">Failed</option>
              <option value="pending_review">Pending review</option>
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Response Time Minutes
            <input
              type="number"
              min="0"
              value={form.response_time_minutes}
              onChange={(event) => updateForm("response_time_minutes", event.target.value)}
              placeholder="e.g. 180"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-500"
            />
          </label>

          {(["food_priority", "water_priority", "medicine_priority", "sanitary_priority"] as const).map((key) => (
            <label key={key} className="block text-sm font-semibold text-slate-700">
              {key.replace("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())}
              <select
                value={form[key]}
                onChange={(event) => updateForm(key, event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-500"
              >
                {["Low", "Medium", "High"].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          ))}

          <label className="block text-sm font-semibold text-slate-700 md:col-span-2 xl:col-span-4">
            Notes
            <textarea
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              placeholder="What happened in the field? What was missing? Why did delivery fail or succeed?"
              className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-500"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <PrimaryButton onClick={saveFeedback} icon="save" disabled={savingFeedback}>
            {savingFeedback ? "Saving..." : "Save Feedback"}
          </PrimaryButton>
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-2 flex items-center gap-2 text-base font-black text-slate-900">
          <span className="material-icons text-cyan-600">settings_suggest</span>
          Current Retraining Job
        </h3>
        <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-3">
          <p><b>Status:</b> {status.status || "idle"}</p>
          <p><b>Started:</b> {status.started_at ? new Date(status.started_at).toLocaleString() : "N/A"}</p>
          <p><b>Finished:</b> {status.finished_at ? new Date(status.finished_at).toLocaleString() : "N/A"}</p>
        </div>
        {(status.output || status.error) && (
          <pre className="mt-4 max-h-64 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
            {[status.output, status.error].filter(Boolean).join("\n")}
          </pre>
        )}
      </section>

      {feedback.length === 0 ? (
        <EmptyState icon="model_training" title="No feedback recorded yet" subtitle="Confirm completed deliveries and rescue outcomes, then add feedback records for future training." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Camp</th>
                <th className="px-4 py-3">Predicted</th>
                <th className="px-4 py-3">Actual</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Used</th>
              </tr>
            </thead>
            <tbody>
              {feedback.slice(0, 80).map((item) => (
                <tr key={item._id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-bold text-slate-900">{item.camp_id?.camp_name || item.camp_id}</td>
                  <td className="px-4 py-3">{item.predicted_priority_level} ({item.predicted_priority_score || 0})</td>
                  <td className="px-4 py-3">{item.actual_priority_after_response || "N/A"}</td>
                  <td className="px-4 py-3 capitalize">{String(item.response_outcome || "").replace("_", " ")}</td>
                  <td className="px-4 py-3">{item.used_for_training ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
