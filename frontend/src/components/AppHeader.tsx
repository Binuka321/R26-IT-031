import React from "react";
import { ArrowLeft, Clock, LogOut, Moon, Sun } from "lucide-react";
import BrandLogo from "./BrandLogo";
import { useLanguage } from "../LanguageContext";

interface AppHeaderProps {
  user: { name: string; role: string };
  onLogout: () => void;
  onBack?: () => void;
  backLabel?: string;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
}

export default function AppHeader({
  user,
  onLogout,
  onBack,
  backLabel = "Back",
  theme = "dark",
  onToggleTheme,
}: AppHeaderProps) {
  const [now, setNow] = React.useState(() => new Date());
  const { language, setLanguage, t } = useLanguage();

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const timeText = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateText = now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const isDark = theme === "dark";
  const headerClass = isDark
    ? "border-cyan-300/20 bg-gradient-to-r from-slate-950/92 via-sky-950/78 to-emerald-950/70 text-white shadow-2xl shadow-cyan-950/30"
    : "border-sky-100 bg-gradient-to-r from-white via-sky-50/95 to-emerald-50/90 text-slate-950 shadow-xl shadow-sky-100/70";
  const subtleButtonClass = isDark
    ? "border-cyan-200/15 bg-white/8 text-slate-100 shadow-sm shadow-black/10 hover:border-cyan-200/30 hover:bg-white/12"
    : "border-sky-100 bg-white/85 text-slate-700 shadow-sm shadow-sky-100/80 hover:border-sky-200 hover:bg-white";
  const timeClass = isDark
    ? "border-cyan-200/15 bg-cyan-300/8 text-slate-200 shadow-sm shadow-black/10"
    : "border-sky-100 bg-white/85 text-slate-700 shadow-sm shadow-sky-100/80";
  const logoutClass = isDark
    ? "border-red-300/30 bg-red-500/12 text-red-100 shadow-sm shadow-black/10 hover:bg-red-500/20"
    : "border-red-100 bg-red-50/90 text-red-700 shadow-sm hover:border-red-200 hover:bg-red-100";

  return (
    <header className={`relative overflow-hidden rounded-xl border px-5 py-4 backdrop-blur-xl sm:px-8 ${headerClass}`}>
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
      <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold ${subtleButtonClass}`}
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel === "Dashboard" ? t("Dashboard", "ප්‍රධාන පුවරුව") : t(backLabel, "ආපසු")}
          </button>
        )}
        <BrandLogo surface="light" markClassName="h-24 w-80 sm:h-28 sm:w-96" />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className={`hidden items-center gap-2 rounded-lg border px-3 py-2 md:flex ${timeClass}`}>
          <Clock className={isDark ? "h-4 w-4 text-cyan-300" : "h-4 w-4 text-sky-700"} />
          <div className="leading-tight">
            <p className="text-sm font-semibold">{timeText}</p>
            <p className={isDark ? "text-[11px] text-slate-400" : "text-[11px] text-slate-500"}>{dateText}</p>
          </div>
        </div>

        <div className="hidden text-right sm:block">
          <p className={isDark ? "text-sm font-semibold text-white" : "text-sm font-semibold text-slate-950"}>{user.name}</p>
          <p className={isDark ? "text-xs capitalize text-slate-400" : "text-xs capitalize text-slate-500"}>{user.role}</p>
        </div>

        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold ${subtleButtonClass}`}
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-200" /> : <Moon className="h-4 w-4 text-sky-700" />}
            {isDark ? t("Light", "ආලෝක") : t("Dark", "අඳුරු")}
          </button>
        )}

        <button
          type="button"
          onClick={() => setLanguage(language === "en" ? "si" : "en")}
          className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${subtleButtonClass}`}
        >
          {language === "en" ? "සිංහල" : "English"}
        </button>

        <button
          type="button"
          onClick={onLogout}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold ${logoutClass}`}
        >
          <LogOut className="h-4 w-4" />
          {t("Logout", "ඉවත් වන්න")}
        </button>
      </div>
      </div>
    </header>
  );
}
