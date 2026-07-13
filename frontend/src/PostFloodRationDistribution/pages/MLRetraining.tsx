import React, { useEffect, useState } from "react";
import { EmptyState, Loading, PageHeader, PrimaryButton, StatCard } from "../components/UIComponents";
import * as api from "../services/api";
import { useLiveRefresh } from "../utils/useLiveRefresh";

export default function MLRetraining() {
  const [feedback, setFeedback] = useState<any[]>([]);
  const [status, setStatus] = useState<any>({ status: "idle" });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = () => {
    Promise.allSettled([api.getTrainingFeedback(), api.getRetrainingStatus()])
      .then(([feedbackResult, statusResult]) => {
        if (feedbackResult.status === "fulfilled") setFeedback(feedbackResult.value.data || []);
        if (statusResult.status === "fulfilled") setStatus(statusResult.value.data || { status: "idle" });
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

  if (loading) return <Loading message="Loading ML retraining pipeline..." />;

  const usedCount = feedback.filter((item) => item.used_for_training).length;
  const pendingCount = feedback.length - usedCount;

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
