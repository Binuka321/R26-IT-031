import React, { Suspense } from "react";
import {
  Boxes,
  Bell,
  ClipboardPlus,
  Droplets,
  HelpCircle,
  LockKeyhole,
  Map,
  Menu,
  Phone,
  PackageCheck,
  Radio,
  CloudRain,
  Truck,
  UserRound,
  WifiOff,
  X,
} from "lucide-react";
import type { ViewMode } from "./App";
import AppHeader from "./components/AppHeader";
import { useLanguage } from "./LanguageContext";
import { useTheme } from "./ThemeContext";

const FloodMapApp = React.lazy(() => import("./FloodMap/FloodMapApp"));
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3002/api";

interface MainDashboardProps {
  user: { username: string; name: string; role: string; token: string };
  isAdmin: boolean;
  onLogout: () => void;
  onNavigate: (view: ViewMode) => void;
}

const modules = [
  {
    title: "Drain Management",
    titleSi: "ජල බැසයෑම්",
    description: "Manage sensor packages, water levels, and flood warning thresholds.",
    descriptionSi: "සෙන්සර්, ජල මට්ටම් සහ ගංවතුර අනතුරු ඇඟවීම් නිරීක්ෂණය කරන්න.",
    icon: Droplets,
    view: "drain-management" as const,
    accent: "cyan",
    adminOnly: true,
  },
  {
    title: "Flood Map",
    titleSi: "ගංවතුර සිතියම",
    description: "Open district flood map visualization and risk layers.",
    descriptionSi: "දිස්ත්‍රික්ක අනුව ගංවතුර අවදානම් සිතියම සහ layers බලන්න.",
    icon: Map,
    view: "map" as const,
    accent: "amber",
  },
  {
    title: "Rescue & Ration",
    titleSi: "ගලවාගැනීම් සහ ආධාර",
    description: "Access camps, safe zones, resources, routes, and distribution plans.",
    descriptionSi: "කඳවුරු, ආරක්ෂිත ස්ථාන, සම්පත්, මාර්ග සහ බෙදාහැරීම් බලන්න.",
    icon: PackageCheck,
    view: "post-flood" as const,
    accent: "sky",
  },
  {
    title: "Disease Detection",
    titleSi: "රෝග පරීක්ෂාව",
    description: "Open the post-flood disease detection and health risk form.",
    descriptionSi: "ගංවතුරෙන් පසු රෝග අවදානම් පෝරමය භාවිත කරන්න.",
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

type WeatherSummary = {
  rainfallMm: number | null;
  warning: "Low" | "Moderate" | "High" | "No data";
  updatedAt: Date | null;
  nextRefreshAt: Date | null;
  loading: boolean;
};

const warningFromRainfall = (rainfall: number | null): WeatherSummary["warning"] => {
  if (rainfall === null) return "No data";
  if (rainfall >= 100) return "High";
  if (rainfall >= 50) return "Moderate";
  return "Low";
};

const formatRelativeTime = (date: Date | null) => {
  if (!date || Number.isNaN(date.getTime())) return "--";
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr`;
  return `${Math.floor(diffHours / 24)} day`;
};

export default function MainDashboard({ user, isAdmin, onLogout, onNavigate }: MainDashboardProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [showMapPreview, setShowMapPreview] = React.useState(false);
  const [weatherSummary, setWeatherSummary] = React.useState<WeatherSummary>({
    rainfallMm: null,
    warning: "No data",
    updatedAt: null,
    nextRefreshAt: null,
    loading: true,
  });
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
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
  const navigateAndClose = (view: ViewMode) => {
    setMobileSidebarOpen(false);
    onNavigate(view);
  };

  React.useEffect(() => {
    const loadPreview = () => setShowMapPreview(true);
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(loadPreview, { timeout: 1800 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timeoutId = window.setTimeout(loadPreview, 900);
    return () => window.clearTimeout(timeoutId);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;

    const loadWeatherSummary = async () => {
      controller?.abort();
      controller = new AbortController();

      try {
        const sensorResponse = await fetch(`${API_BASE}/sensor-packages`, {
          headers: { Authorization: `Bearer ${user.token}` },
          signal: controller.signal,
        });

        if (sensorResponse.ok) {
          const packages = await sensorResponse.json();
          const readings = (Array.isArray(packages) ? packages : [])
            .map((pkg) => ({
              rainfall: Number(pkg?.currentReadings?.rainfall),
              updatedAt: new Date(pkg?.lastUpdate || pkg?.updatedAt || Date.now()),
            }))
            .filter((item) => Number.isFinite(item.rainfall));

          if (readings.length > 0) {
            const avgRainfall =
              readings.reduce((sum, item) => sum + item.rainfall, 0) / readings.length;
            const latestUpdate = readings.reduce(
              (latest, item) =>
                item.updatedAt.getTime() > latest.getTime() ? item.updatedAt : latest,
              readings[0].updatedAt,
            );

            if (!cancelled) {
              setWeatherSummary({
                rainfallMm: Math.round(avgRainfall * 10) / 10,
                warning: warningFromRainfall(avgRainfall),
                updatedAt: latestUpdate,
                nextRefreshAt: new Date(Date.now() + 60000),
                loading: false,
              });
            }
            return;
          }
        }

        const rainfallResponse = await fetch(`${API_BASE}/rainfall`, {
          signal: controller.signal,
        });
        const rainfallRows = rainfallResponse.ok ? await rainfallResponse.json() : [];
        const latestRainfall = Array.isArray(rainfallRows) ? rainfallRows[0] : null;
        const rainfall = Number(latestRainfall?.rainfall);
        const updatedAt = latestRainfall?.timestamp ? new Date(latestRainfall.timestamp) : null;

        if (!cancelled) {
          setWeatherSummary({
            rainfallMm: Number.isFinite(rainfall) ? Math.round(rainfall * 10) / 10 : null,
            warning: warningFromRainfall(Number.isFinite(rainfall) ? rainfall : null),
            updatedAt,
            nextRefreshAt: new Date(Date.now() + 60000),
            loading: false,
          });
        }
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === "AbortError")) {
          setWeatherSummary((current) => ({
            ...current,
            nextRefreshAt: new Date(Date.now() + 60000),
            loading: false,
          }));
        }
      }
    };

    loadWeatherSummary();
    const intervalId = window.setInterval(loadWeatherSummary, 60000);
    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(intervalId);
    };
  }, [user.token]);

  const rainfallValue =
    weatherSummary.rainfallMm === null
      ? weatherSummary.loading
        ? "Loading"
        : "--"
      : `${weatherSummary.rainfallMm} mm`;
  const warningValue =
    weatherSummary.warning === "No data"
      ? t("No data", "දත්ත නැත")
      : weatherSummary.warning === "High"
        ? t("High", "ඉහළ")
        : weatherSummary.warning === "Moderate"
          ? t("Moderate", "මධ්‍යම")
          : t("Low", "අඩු");
  const updatedValue = formatRelativeTime(weatherSummary.updatedAt);

  return (
    <main className={pageClass}>
      <div className={backgroundClass}>
        <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-3 py-3 sm:px-5">
          <AppHeader
            user={user}
            onLogout={onLogout}
            theme={theme}
            onToggleTheme={toggleTheme}
          />

          <div className="mt-3 px-4 sm:px-8 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className={isDark
                ? "inline-flex w-full items-center justify-between rounded-lg border border-cyan-300/25 bg-slate-950/55 px-4 py-3 text-sm font-bold text-cyan-50 shadow-lg shadow-black/20"
                : "inline-flex w-full items-center justify-between rounded-lg border border-sky-200 bg-white/85 px-4 py-3 text-sm font-bold text-slate-900 shadow-sm"}
            >
              <span className="inline-flex items-center gap-2">
                <Menu className="h-5 w-5" />
                {t("Open modules", "මොඩියුල විවෘත කරන්න")}
              </span>
              <span className="text-xs opacity-75">{t("Menu", "මෙනු")}</span>
            </button>
          </div>

          {mobileSidebarOpen && (
            <button
              type="button"
              aria-label="Close menu overlay"
              className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}

          <section className="flex-1 px-4 py-5 sm:px-8 lg:py-8">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[270px_1fr]">
              <aside className={`${panelClass} fixed inset-y-0 left-0 z-50 h-full w-[min(21rem,88vw)] overflow-y-auto rounded-none border-y-0 border-l-0 p-4 transition-transform duration-300 lg:sticky lg:top-5 lg:z-auto lg:h-fit lg:w-auto lg:translate-x-0 lg:overflow-visible lg:rounded-lg lg:border ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
                  <div className={isDark ? "text-sm font-bold text-white" : "text-sm font-bold text-slate-950"}>
                    {t("Navigation", "මෙනු")}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(false)}
                    className={isDark
                      ? "grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/10 text-white"
                      : "grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-900"}
                    aria-label="Close menu"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className={isDark ? "mb-4 px-2 text-xs font-bold uppercase tracking-wide text-slate-400" : "mb-4 px-2 text-xs font-bold uppercase tracking-wide text-slate-500"}>
                  {t("Modules", "මොඩියුල")}
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
                        onClick={() => navigateAndClose(module.view)}
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
                        <span className="min-w-0 flex-1 truncate">{t(module.title, module.titleSi)}</span>
                        {isFloodMap && <span className="h-2 w-2 rounded-full bg-amber-300" />}
                      </button>
                    );
                  })}
                </nav>
                <div className="mt-4 border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => navigateAndClose("status-tracker")}
                    className={isDark
                      ? "mb-2 flex w-full items-center gap-3 rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-3 py-3 text-left text-sm font-semibold text-emerald-100 hover:bg-emerald-400/15"
                      : "mb-2 flex w-full items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-left text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100"}
                  >
                    <Truck className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{t("Status Tracker", "තත්ත්වය")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateAndClose("flood-alerts")}
                    className={isDark
                      ? "mb-2 flex w-full items-center gap-3 rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-3 text-left text-sm font-semibold text-amber-100 hover:bg-amber-400/15"
                      : "mb-2 flex w-full items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-left text-sm font-semibold text-amber-800 shadow-sm hover:bg-amber-100"}
                  >
                    <Bell className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{t("Flood Alerts", "ගංවතුර අනතුරු")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateAndClose("offline-card")}
                    className={isDark
                      ? "mb-2 flex w-full items-center gap-3 rounded-lg border border-sky-300/25 bg-sky-400/10 px-3 py-3 text-left text-sm font-semibold text-sky-100 hover:bg-sky-400/15"
                      : "mb-2 flex w-full items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-left text-sm font-semibold text-sky-800 shadow-sm hover:bg-sky-100"}
                  >
                    <WifiOff className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{t("Offline Card", "Offline කාඩ්පත")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateAndClose("emergency-contacts")}
                    className={isDark
                      ? "mb-2 flex w-full items-center gap-3 rounded-lg border border-red-300/25 bg-red-400/10 px-3 py-3 text-left text-sm font-semibold text-red-100 hover:bg-red-400/15"
                      : "mb-2 flex w-full items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-left text-sm font-semibold text-red-800 shadow-sm hover:bg-red-100"}
                  >
                    <Phone className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{t("Emergency Contacts", "හදිසි සම්බන්ධතා")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateAndClose("help-guide")}
                    className={isDark
                      ? "flex w-full items-center gap-3 rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-3 py-3 text-left text-sm font-semibold text-emerald-100 hover:bg-emerald-400/15"
                      : "flex w-full items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-left text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100"}
                  >
                    <HelpCircle className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{t("Help / User Guide", "උදව් / භාවිත මාර්ගෝපදේශය")}</span>
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
                        {t("Select a module", "මොඩියුලයක් තෝරන්න")}
                      </div>
                      <p className={isDark ? "mb-3 text-xl font-semibold text-slate-300" : "mb-3 text-xl font-semibold text-slate-600"}>
                        {t("Welcome back", "නැවත සාදරයෙන් පිළිගනිමු")}, {user.name}
                      </p>
                      <h1 className={isDark ? "text-3xl font-bold leading-tight text-white sm:text-4xl" : "text-3xl font-bold leading-tight text-slate-950 sm:text-4xl"}>
                        {t("Emergency response workspace", "හදිසි ප්‍රතිචාර වැඩ පුවරුව")}
                      </h1>
                    </div>

                    <div className="grid grid-cols-3 gap-4 lg:min-w-[430px]">
                      {[
                        { value: "4", label: t("Modules", "මොඩියුල"), icon: Boxes },
                        { value: user.role.replace(/_/g, " "), label: t("Role", "භූමිකාව"), icon: UserRound },
                        { value: isAdmin ? t("Full", "සම්පූර්ණ") : t("Limited", "සීමිත"), label: t("Access", "ප්‍රවේශය"), icon: LockKeyhole },
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

                <div className={`${panelClass} mb-7 p-5`}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <div className={isDark
                        ? "grid h-12 w-12 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-400/10 text-cyan-200"
                        : "grid h-12 w-12 place-items-center rounded-lg border border-sky-100 bg-sky-50 text-sky-700"}
                      >
                        <CloudRain className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className={isDark ? "text-lg font-bold text-white" : "text-lg font-bold text-slate-950"}>
                          {t("Weather / Rainfall Summary", "කාලගුණ / වැසි සාරාංශය")}
                        </h2>
                        <p className={isDark ? "text-sm text-slate-400" : "text-sm text-slate-500"}>
                          {t("Updates automatically every 60 seconds", "තත්පර 60කට වරක් ස්වයංක්‍රීයව යාවත්කාලීන වේ")}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        [t("Rainfall", "වැසි"), rainfallValue],
                        [t("Warning", "අනතුරු ඇඟවීම"), warningValue],
                        [t("Updated", "යාවත්කාලීන"), updatedValue],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className={isDark
                            ? "rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-center"
                            : "rounded-lg border border-slate-200 bg-white/80 px-4 py-3 text-center shadow-sm"}
                        >
                          <p className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>{label}</p>
                          <p className={isDark ? "mt-1 text-sm font-bold text-white" : "mt-1 text-sm font-bold text-slate-950"}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={`${panelClass} overflow-hidden p-3`}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 className={isDark ? "text-lg font-bold text-white" : "text-lg font-bold text-slate-950"}>
                        {t("Flood Map", "ගංවතුර සිතියම")}
                      </h2>
                      <p className={isDark ? "text-sm text-slate-400" : "text-sm text-slate-500"}>
                        {t("Click the button to open the complete map page.", "සම්පූර්ණ සිතියම් පිටුව විවෘත කිරීමට button එක click කරන්න.")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate("map")}
                      className={isDark
                        ? "rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-2.5 text-sm font-bold text-amber-100 hover:bg-amber-300/15"
                        : "rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 shadow-sm hover:bg-amber-100"}
                    >
                      {t("Open Full Map", "සම්පූර්ණ සිතියම විවෘත කරන්න")}
                    </button>
                  </div>
                  {showMapPreview ? (
                    <Suspense
                      fallback={
                        <div className={isDark
                          ? "grid h-[560px] place-items-center rounded-lg border border-sky-300/20 bg-slate-950/55 text-sm font-semibold text-slate-300"
                          : "grid h-[560px] place-items-center rounded-lg border border-sky-200 bg-sky-50 text-sm font-semibold text-slate-600"}
                        >
                          {t("Loading map preview...", "සිතියම් පෙරදසුන පූරණය වෙමින්...")}
                        </div>
                      }
                    >
                      <FloodMapApp authToken={user.token} embedded hideSidebar height="560px" onBack={() => onNavigate("main-dashboard")} />
                    </Suspense>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowMapPreview(true)}
                      className={isDark
                        ? "grid h-[360px] w-full place-items-center rounded-lg border border-sky-300/20 bg-slate-950/55 text-center text-sm font-semibold text-slate-300 hover:border-cyan-300/35"
                        : "grid h-[360px] w-full place-items-center rounded-lg border border-sky-200 bg-sky-50 text-center text-sm font-semibold text-slate-600 hover:border-sky-300"}
                    >
                      <span>
                        {t("Map preview will load after the dashboard is ready.", "Dashboard එක පළමුව පූරණය වූ පසු සිතියම් පෙරදසුන පූරණය වේ.")}
                        <br />
                        <span className={isDark ? "text-cyan-200" : "text-sky-700"}>
                          {t("Tap to load now", "දැන් පූරණය කිරීමට tap කරන්න")}
                        </span>
                      </span>
                    </button>
                  )}
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
