import React, { useEffect, useState } from "react";
import {
  PageHeader,
  PrimaryButton,
  PriorityBadge,
  Loading,
  EmptyState,
} from "../components/UIComponents";
import * as api from "../services/api";
import { filterOutSeedCamps } from "../utils/filterSeedData";

export default function ItemPrioritization() {
  const [items, setItems] = useState<any[]>([]);
  const [camps, setCamps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.getAllItemPriorities(), api.getCamps()])
      .then(async ([i, c]) => {
        try {
          setItems(i.data || []);
          setCamps(filterOutSeedCamps(c.data || []));
        } catch (e) {
          setItems(i.data || []);
          setCamps(c.data || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleGenerate = async (campId: string) => {
    setGenerating(campId);
    try {
      await api.generateItemPriority(campId);
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateAll = async () => {
    setGenerating("all");
    try {
      for (const c of camps) {
        await api.generateItemPriority(c._id);
      }
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGenerating(null);
    }
  };

  if (loading) return <Loading />;

  const getPriorityColor = (p: string) =>
    p === "High"
      ? "text-rose-600 bg-rose-50"
      : p === "Medium"
        ? "text-amber-600 bg-amber-50"
        : "text-emerald-600 bg-emerald-50";

  return (
    <div>
      <PageHeader
        title="Relief Item Prioritization"
        subtitle="ML item urgency prediction per camp"
        icon="inventory"
        actions={
          <PrimaryButton
            onClick={handleGenerateAll}
            icon="autorenew"
            disabled={generating === "all"}
          >
            {generating === "all" ? "Generating..." : "Generate All"}
          </PrimaryButton>
        }
      />

      {items.length === 0 ? (
        <div>
          <EmptyState
            icon="inventory"
            title="No item priorities generated"
            subtitle="Generate priorities for camps below"
          />
          {camps.length > 0 && (
            <div className="mt-6 bg-white rounded-2xl p-5 shadow-lg">
              <h3 className="font-semibold mb-3">Available Camps</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {camps.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => handleGenerate(c._id)}
                    disabled={generating === c._id}
                    className="p-3 rounded-xl border border-gray-200 hover:border-cyan-300 hover:bg-cyan-50 text-left transition-all"
                  >
                    <p className="font-medium text-gray-800">{c.camp_name}</p>
                    <p className="text-xs text-gray-500">
                      Pop: {c.population} | Click to generate
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((item) => {
            const campName =
              typeof item.camp_id === "object"
                ? item.camp_id.camp_name
                : "Unknown";
            return (
              <div
                key={item._id}
                className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800">{campName}</h3>
                  <PriorityBadge level={item.overall_urgency} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: "Food",
                      priority: item.food_priority,
                      qty: item.recommended_food_qty,
                      icon: "restaurant",
                      unit: "packs",
                    },
                    {
                      label: "Water",
                      priority: item.water_priority,
                      qty: item.recommended_water_qty,
                      icon: "water_drop",
                      unit: "liters",
                    },
                    {
                      label: "Medicine",
                      priority: item.medicine_priority,
                      qty: item.recommended_medicine_qty,
                      icon: "medical_services",
                      unit: "kits",
                    },
                    {
                      label: "Sanitary",
                      priority: item.sanitary_priority,
                      qty: item.recommended_sanitary_qty,
                      icon: "sanitizer",
                      unit: "kits",
                    },
                  ].map((r) => (
                    <div
                      key={r.label}
                      className={`rounded-xl p-3 ${getPriorityColor(r.priority)}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-icons text-sm">{r.icon}</span>
                        <span className="font-medium text-sm">{r.label}</span>
                      </div>
                      <p className="text-lg font-bold">{r.priority}</p>
                      <p className="text-xs opacity-75">
                        Need: {r.qty} {r.unit}
                      </p>
                    </div>
                  ))}
                </div>
                {item.notes && (
                  <p className="text-xs text-gray-500 mt-3 italic">
                    {item.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
