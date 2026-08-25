import React from "react";
import {
  ClipboardPlus,
  Droplets,
  LogOut,
  Map,
  Moon,
  PackageCheck,
  Radio,
  Sun,
} from "lucide-react";
import type { ViewMode } from "./App";
import BrandLogo from "./components/BrandLogo";

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
    tone: "border-sky-300/25 bg-sky-500/10 text-sky-100",
    lightTone: "border-slate-200 bg-white/90 text-sky-800",
    adminOnly: true,
  },
  {
    title: "Flood Map",
    description: "Open district flood map visualization and risk layers.",
    icon: Map,
    view: "map" as const,
    tone: "border-amber-300/25 bg-amber-500/10 text-amber-100",
    lightTone: "border-slate-200 bg-white/90 text-amber-800",
  },
  {
    title: "Rescue & Ration",
    description: "Access camps, safe zones, resources, routes, and distribution plans.",
    icon: PackageCheck,
    view: "post-flood" as const,
    tone: "border-violet-300/25 bg-violet-500/10 text-violet-100",
    lightTone: "border-slate-200 bg-white/90 text-emerald-800",
  },
  {
    title: "Disease Detection",
    description: "Open the post-flood disease detection and health risk form.",
    icon: ClipboardPlus,
    view: "disease-management" as const,
    tone: "border-rose-300/25 bg-rose-500/10 text-rose-100",
    lightTone: "border-slate-200 bg-white/90 text-cyan-800",
  },
];

export default function MainDashboard({ user, isAdmin, onLogout, onNavigate }: MainDashboardProps) {
  const [theme, setTheme] = React.useState<"dark" | "light">("dark");
  const isDark = theme === "dark";
  const pageClass = isDark
    ? "min-h-screen bg-[#07120f] text-white"
    : "min-h-screen bg-[#eef5f3] text-slate-950";
  const backgroundClass = isDark
    ? "min-h-screen bg-[radial-gradient(circle_at_18%_10%,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_86%_76%,rgba(34,197,94,0.16),transparent_30%),linear-gradient(135deg,#061815,#082f49_58%,#07120f)]"
    : "min-h-screen bg-[radial-gradient(circle_at_18%_12%,rgba(14,165,233,0.08),transparent_28%),radial-gradient(circle_at_86%_76%,rgba(34,197,94,0.08),transparent_30%),linear-gradient(135deg,#f4f8f7,#edf6f4_56%,#eaf3f1)]";

  return (
    <main className={pageClass}>
      <div className={backgroundClass}>
        <header className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <BrandLogo surface={isDark ? "light" : "none"} markClassName="h-20 w-72 sm:h-24 sm:w-80" textClassName={isDark ? "" : "[&_p:first-child]:text-slate-950 [&_p:last-child]:text-slate-500"} />

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className={isDark ? "text-sm font-semibold text-white" : "text-sm font-semibold text-slate-950"}>{user.name}</p>
              <p className={isDark ? "text-xs capitalize text-slate-400" : "text-xs capitalize text-slate-500"}>{user.role}</p>
            </div>
            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className={isDark
                ? "flex items-center gap-2 rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-sm text-slate-100 hover:bg-white/12"
                : "flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-100"}
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-200" /> : <Moon className="h-4 w-4 text-sky-700" />}
              {isDark ? "Light" : "Dark"}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className={isDark
                ? "flex items-center gap-2 rounded-lg border border-red-300/30 bg-red-500/12 px-3 py-2 text-sm text-red-100 hover:bg-red-500/20"
                : "flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm hover:bg-red-100"}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </header>

        <section className="mx-auto w-full max-w-7xl px-5 pb-8 pt-8 sm:px-8">
          <div className={isDark
            ? "mb-6 rounded-lg border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6"
            : "mb-6 rounded-lg border border-slate-200/80 bg-white/80 p-5 shadow-lg shadow-slate-300/30 backdrop-blur-xl sm:p-6"}
          >
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div className="max-w-3xl">
                <div className={isDark
                  ? "mb-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-sm text-slate-200"
                  : "mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"}
                >
                  <Radio className={isDark ? "h-4 w-4 text-emerald-300" : "h-4 w-4 text-sky-700"} />
                  Select a module
                </div>
                <h2 className={isDark ? "text-3xl font-semibold leading-tight text-white sm:text-4xl" : "text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl"}>
                  Emergency response workspace
                </h2>
                <p className={isDark ? "mt-3 text-base leading-7 text-slate-300" : "mt-3 text-base leading-7 text-slate-600"}>
                  Choose one of the four operational modules. Access follows the same role rules as the main branch.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:min-w-[360px]">
                {[
                  ["4", "Modules"],
                  [user.role.replace(/_/g, " "), "Role"],
                  [isAdmin ? "Full" : "Limited", "Access"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className={isDark
                      ? "rounded-lg border border-white/10 bg-slate-950/40 p-3 text-center"
                      : "rounded-lg border border-slate-200 bg-white/70 p-3 text-center shadow-sm"}
                  >
                    <p className={isDark ? "text-lg font-semibold capitalize text-white" : "text-lg font-semibold capitalize text-slate-950"}>{value}</p>
                    <p className={isDark ? "mt-1 text-xs text-slate-400" : "mt-1 text-xs text-slate-500"}>{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {modules.map((module) => {
              const Icon = module.icon;
              const locked = module.adminOnly && !isAdmin;

              return (
                <button
                  key={module.title}
                  type="button"
                  disabled={locked}
                  onClick={() => onNavigate(module.view)}
                  className={`group relative min-h-[250px] overflow-hidden rounded-lg border p-5 text-left shadow-sm transition ${
                    isDark ? module.tone : module.lightTone
                  } ${locked ? "cursor-not-allowed opacity-55" : isDark ? "hover:-translate-y-1 hover:bg-white/12 hover:shadow-2xl hover:shadow-sky-950/20" : "hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-300/40"}`}
                >
                  <div className={isDark ? "absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-300 via-emerald-300 to-amber-300 opacity-70" : "absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500/70 via-emerald-500/70 to-amber-400/70"} />
                  <div className="mb-8 flex items-start justify-between gap-3">
                    <div className={isDark
                      ? "flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-slate-950/45 transition group-hover:scale-105"
                      : "flex h-12 w-12 items-center justify-center rounded-lg border border-white bg-white/80 shadow-sm transition group-hover:scale-105"}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    {locked && (
                      <span className={isDark
                        ? "rounded-md border border-red-300/25 bg-red-500/10 px-2 py-1 text-xs text-red-100"
                        : "rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"}
                      >
                        Admin only
                      </span>
                    )}
                  </div>
                  <h3 className={isDark ? "text-xl font-semibold text-white" : "text-xl font-semibold text-slate-950"}>{module.title}</h3>
                  <p className={isDark ? "mt-3 text-sm leading-6 text-slate-300" : "mt-3 text-sm leading-6 text-slate-600"}>{module.description}</p>
                  <p className={isDark ? "mt-6 text-xs font-semibold uppercase text-sky-200" : "mt-6 text-xs font-semibold uppercase text-sky-700"}>
                    {locked ? "Requires admin role" : "Open module"}
                  </p>
                </button>
              );
            })}
          </div>

        </section>
      </div>
    </main>
  );
}
