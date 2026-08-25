import React from "react";
import {
  Boxes,
  ClipboardPlus,
  Droplets,
  HelpCircle,
  LockKeyhole,
  Map,
  PackageCheck,
  Radio,
  UserRound,
} from "lucide-react";
import type { ViewMode } from "./App";
import AppHeader from "./components/AppHeader";
// @ts-ignore
import FloodMapApp from "./FloodMap/FloodMapApp";

interface MainDashboardProps {
  user: { username: string; name: string; role: string; token: string };
  isAdmin: boolean;
  onLogout: () => void;
  onNavigate: (view: ViewMode) => void;
}

const modules = [
  {
    title: "Drain Management",
    description: "Manage sensor packages, water levels, and flood warning thresholds.",
    icon: Droplets,
    view: "drain-management" as const,
    accent: "cyan",
    adminOnly: true,
  },
  {
    title: "Flood Map",
    description: "Open district flood map visualization and risk layers.",
    icon: Map,
    view: "map" as const,
    accent: "amber",
  },
  {
    title: "Rescue & Ration",
    description: "Access camps, safe zones, resources, routes, and distribution plans.",
    icon: PackageCheck,
    view: "post-flood" as const,
    accent: "sky",
  },
  {
    title: "Disease Detection",
    description: "Open the post-flood disease detection and health risk form.",
    icon: ClipboardPlus,
    view: "disease-management" as const,
    accent: "violet",
  },
];

const accentClasses = {
  cyan: {
    card: "border-cyan-400/35 bg-cyan-500/10 shadow-cyan-950/25 hover:border-cyan-300/70",
    icon: "border-cyan-300/35 bg-cyan-400/10 text-cyan-200",
    action: "border-cyan-300/20 bg-cyan-400/10 text-cyan-200",
  },
  amber: {
    card: "border-amber-300/35 bg-amber-400/10 shadow-amber-950/20 hover:border-amber-200/70",
    icon: "border-amber-300/35 bg-amber-300/10 text-amber-200",
    action: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  },
  sky: {
    card: "border-sky-300/35 bg-sky-500/10 shadow-sky-950/25 hover:border-sky-200/70",
    icon: "border-sky-300/35 bg-sky-400/10 text-sky-200",
    action: "border-sky-300/20 bg-sky-400/10 text-sky-200",
  },
  violet: {
    card: "border-violet-300/35 bg-violet-500/10 shadow-violet-950/25 hover:border-violet-200/70",
    icon: "border-violet-300/35 bg-violet-400/10 text-violet-200",
    action: "border-violet-300/20 bg-violet-400/10 text-violet-200",
  },
};

export default function MainDashboard({ user, isAdmin, onLogout, onNavigate }: MainDashboardProps) {
  const [theme, setTheme] = React.useState<"dark" | "light">("dark");
  const isDark = theme === "dark";

  const pageClass = isDark
    ? "min-h-screen bg-[#07120f] text-white"
    : "min-h-screen bg-[#eef5f3] text-slate-950";
  const backgroundClass = isDark
    ? "min-h-screen bg-[radial-gradient(circle_at_18%_10%,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_86%_76%,rgba(34,197,94,0.16),transparent_30%),linear-gradient(135deg,#061815,#082f49_58%,#07120f)]"
    : "min-h-screen bg-[radial-gradient(circle_at_18%_12%,rgba(14,165,233,0.08),transparent_28%),radial-gradient(circle_at_86%_76%,rgba(34,197,94,0.08),transparent_30%),linear-gradient(135deg,#f4f8f7,#edf6f4_56%,#eaf3f1)]";
  const panelClass = isDark
    ? "rounded-lg border border-sky-300/20 bg-slate-950/45 shadow-2xl shadow-black/25 backdrop-blur-xl"
    : "rounded-lg border border-slate-200/80 bg-white/82 shadow-lg shadow-slate-300/30 backdrop-blur-xl";

  return (
    <main className={pageClass}>
      <div className={backgroundClass}>
        <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-3 py-3 sm:px-5">
          <AppHeader
            user={user}
            onLogout={onLogout}
            theme={theme}
            onToggleTheme={() => setTheme(isDark ? "light" : "dark")}
          />

          <section className="flex-1 px-4 py-8 sm:px-8">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[270px_1fr]">
              <aside className={`${panelClass} h-fit p-4 lg:sticky lg:top-5`}>
                <div className={isDark ? "mb-4 px-2 text-xs font-bold uppercase tracking-wide text-slate-400" : "mb-4 px-2 text-xs font-bold uppercase tracking-wide text-slate-500"}>
                  Modules
                </div>
                <nav className="space-y-2">
                  {modules.map((module) => {
                    const Icon = module.icon;
                    const locked = module.adminOnly && !isAdmin;
                    const isFloodMap = module.view === "map";
                    return (
                      <button
                        key={module.title}
                        type="button"
                        disabled={locked}
                        onClick={() => onNavigate(module.view)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm font-semibold transition ${
                          isDark
                            ? isFloodMap
                              ? "border-amber-300/35 bg-amber-300/10 text-amber-100 shadow-lg shadow-amber-950/20"
                              : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                            : isFloodMap
                              ? "border-amber-200 bg-amber-50 text-amber-800 shadow-sm"
                              : "border-slate-200 bg-white/70 text-slate-700 hover:bg-white"
                        } ${locked ? "cursor-not-allowed opacity-75" : ""}`}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{module.title}</span>
                        {isFloodMap && <span className="h-2 w-2 rounded-full bg-amber-300" />}
                      </button>
                    );
                  })}
                </nav>
                <div className="mt-4 border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => onNavigate("help-guide")}
                    className={isDark
                      ? "flex w-full items-center gap-3 rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-3 py-3 text-left text-sm font-semibold text-emerald-100 hover:bg-emerald-400/15"
                      : "flex w-full items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-left text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100"}
                  >
                    <HelpCircle className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">Help / User Guide</span>
                  </button>
                </div>
              </aside>

              <div>
                <div className={`${panelClass} mb-7 p-6 sm:p-8`}>
                  <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-center">
                    <div className="max-w-3xl">
                      <div className={isDark
                        ? "mb-6 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/8 px-4 py-3 text-sm text-slate-200"
                        : "mb-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"}
                      >
                        <Radio className={isDark ? "h-4 w-4 text-emerald-300" : "h-4 w-4 text-sky-700"} />
                        Select a module
                      </div>
                      <p className={isDark ? "mb-3 text-xl font-semibold text-slate-300" : "mb-3 text-xl font-semibold text-slate-600"}>
                        Welcome back, {user.name}
                      </p>
                      <h1 className={isDark ? "text-3xl font-bold leading-tight text-white sm:text-4xl" : "text-3xl font-bold leading-tight text-slate-950 sm:text-4xl"}>
                        Emergency response workspace
                      </h1>
                    </div>

                    <div className="grid grid-cols-3 gap-4 lg:min-w-[430px]">
                      {[
                        { value: "4", label: "Modules", icon: Boxes },
                        { value: user.role.replace(/_/g, " "), label: "Role", icon: UserRound },
                        { value: isAdmin ? "Full" : "Limited", label: "Access", icon: LockKeyhole },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <div
                            key={item.label}
                            className={isDark
                              ? "rounded-lg border border-sky-200/15 bg-slate-900/55 p-5 text-center"
                              : "rounded-lg border border-slate-200 bg-white/75 p-5 text-center shadow-sm"}
                          >
                            <div className={isDark
                              ? "mx-auto mb-4 grid h-12 w-12 place-items-center rounded-lg border border-emerald-300/15 bg-emerald-400/10 text-emerald-300"
                              : "mx-auto mb-4 grid h-12 w-12 place-items-center rounded-lg border border-sky-100 bg-sky-50 text-sky-700"}
                            >
                              <Icon className="h-6 w-6" />
                            </div>
                            <p className={isDark ? "text-xl font-bold capitalize text-white" : "text-xl font-bold capitalize text-slate-950"}>{item.value}</p>
                            <p className={isDark ? "mt-2 text-sm text-slate-400" : "mt-2 text-sm text-slate-500"}>{item.label}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className={`${panelClass} overflow-hidden p-3`}>
                  <FloodMapApp authToken={user.token} embedded onBack={() => onNavigate("main-dashboard")} />
                </div>
              </div>
            </div>
          </section>

          <footer className={isDark ? "pb-4 text-center text-sm text-slate-400" : "pb-4 text-center text-sm text-slate-500"}>
            © 2025 FloodGuard360. All rights reserved.
          </footer>
        </div>
      </div>
    </main>
  );
}
