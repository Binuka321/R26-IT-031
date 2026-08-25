import React from "react";
import {
  ClipboardPlus,
  Map,
  PackageCheck,
  ShieldCheck,
  Siren,
} from "lucide-react";
import type { ViewMode } from "./App";
import AppHeader from "./components/AppHeader";

interface HelpGuideProps {
  user: { username: string; name: string; role: string; token: string };
  onBack: () => void;
  onLogout: () => void;
  onNavigate: (view: ViewMode) => void;
}

const guideModules = [
  {
    title: "Flood Map",
    icon: Map,
    action: "Find risky locations",
    detail: "View district flood risk, IoT sensor markers, affected zones, heatmap layers, and prediction results.",
  },
  {
    title: "Rescue & Ration",
    icon: PackageCheck,
    action: "Coordinate aid",
    detail: "Use camps, safe zones, resources, route planning, rescue operations, and ration distribution tools.",
  },
  {
    title: "Disease Detection",
    icon: ClipboardPlus,
    action: "Check health risk",
    detail: "Submit post-flood health symptoms and check possible disease risk after a flood event.",
  },
];

export default function HelpGuide({ user, onBack, onLogout, onNavigate }: HelpGuideProps) {
  return (
    <main className="min-h-screen bg-[#07120f] text-white">
      <div className="min-h-screen bg-[radial-gradient(circle_at_18%_10%,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_86%_76%,rgba(34,197,94,0.16),transparent_30%),linear-gradient(135deg,#061815,#082f49_58%,#07120f)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
          <AppHeader user={user} onLogout={onLogout} onBack={onBack} />

          <section className="py-8">
            <div className="mb-6 rounded-lg border border-sky-300/20 bg-slate-950/45 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-8">
              <p className="mb-3 inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200">
                <ShieldCheck className="h-4 w-4" />
                Help / User Guide
              </p>
              <h1 className="text-3xl font-bold text-white sm:text-4xl">FloodGuard360 user guide</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                A simple guide for victims and users to check flood risk, request support, and use post-flood health tools.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {guideModules.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => {
                      if (item.title === "Flood Map") onNavigate("map");
                      if (item.title === "Rescue & Ration") onNavigate("post-flood");
                      if (item.title === "Disease Detection") onNavigate("disease-management");
                    }}
                    className="rounded-lg border border-sky-300/20 bg-slate-950/45 p-5 text-left shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-sky-200/50"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-400/10 text-cyan-200">
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-200">
                        {item.action}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white">{item.title}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{item.detail}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <section className="rounded-lg border border-sky-300/20 bg-slate-950/45 p-6 shadow-xl shadow-black/20">
                <div className="mb-4 flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-cyan-300" />
                  <h2 className="text-xl font-bold text-white">How to use the app</h2>
                </div>
                <ol className="space-y-3 text-sm leading-7 text-slate-300">
                  <li>1. Start from the dashboard and open Flood Map to check nearby risk areas.</li>
                  <li>2. Use Rescue & Ration if you need safe zone, camp, rescue, or supply information.</li>
                  <li>3. Use Disease Detection after flood exposure if symptoms or health risks appear.</li>
                  <li>4. Submit details carefully so response teams can understand the situation.</li>
                </ol>
              </section>

              <section className="rounded-lg border border-sky-300/20 bg-slate-950/45 p-6 shadow-xl shadow-black/20">
                <div className="mb-4 flex items-center gap-3">
                  <Siren className="h-5 w-5 text-amber-200" />
                  <h2 className="text-xl font-bold text-white">Emergency Workflow</h2>
                </div>
                <ol className="space-y-3 text-sm leading-7 text-slate-300">
                  <li>1. Check the Flood Map and avoid marked high-risk areas.</li>
                  <li>2. Move toward a safe zone or camp shown in the system if evacuation is needed.</li>
                  <li>3. Request rescue/support or check ration distribution details in Rescue & Ration.</li>
                  <li>4. After the flood, use Disease Detection to check possible health risks.</li>
                </ol>
              </section>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
