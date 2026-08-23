import { motion } from 'framer-motion';
import { MapPinned, Radar, Waves } from 'lucide-react';

interface OperationsMapPanelProps {
  onOpenMap: () => void;
  isAdmin: boolean;
}

export function OperationsMapPanel({ onOpenMap, isAdmin }: OperationsMapPanelProps) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 shadow-[0_30px_100px_rgba(15,23,42,0.25)]">
      <div className="border-b border-white/10 bg-gradient-to-r from-slate-900 via-cyan-950/70 to-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-cyan-200">Operational map</p>
            <h3 className="text-xl font-semibold text-white">Live flood intelligence canvas</h3>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-200">
            <Radar className="h-4 w-4" />
            Sensor + ML overlay active
          </div>
        </div>
      </div>

      <div className="relative h-[320px] p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(167,139,250,0.22),_transparent_35%)]" />
        <div className="absolute inset-5 rounded-[24px] border border-white/10 bg-slate-900/70" />
        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <div>
              <p className="text-sm text-slate-400">Coverage status</p>
              <p className="text-lg font-semibold text-white">District heatmap • sensor clusters • risk markers</p>
            </div>
            <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-200">
              <Waves className="h-6 w-6" />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 backdrop-blur">
            <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
              <MapPinned className="h-4 w-4 text-cyan-300" />
              District-level coverage, active sensors, and ML-triggered hot spots remain live.
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={onOpenMap}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                Open live map workspace
              </button>
              {isAdmin && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
                  Admin flood control tools enabled
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
