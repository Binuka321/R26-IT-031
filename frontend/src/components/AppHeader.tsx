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
    ? "border-sky-300/20 bg-slate-950/55 text-white shadow-2xl shadow-black/25"
    : "border-slate-200/80 bg-white/88 text-slate-950 shadow-lg shadow-slate-300/30";
  const subtleButtonClass = isDark
    ? "border-white/10 bg-white/8 text-slate-100 hover:bg-white/12"
    : "border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-100";
  const timeClass = isDark
    ? "border-white/10 bg-white/8 text-slate-200"
    : "border-slate-200 bg-slate-50 text-slate-700 shadow-sm";
  const logoutClass = isDark
    ? "border-red-300/30 bg-red-500/12 text-red-100 hover:bg-red-500/20"
    : "border-red-200 bg-red-50 text-red-700 shadow-sm hover:bg-red-100";

  return (
    <header className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border px-5 py-4 backdrop-blur-xl sm:px-8 ${headerClass}`}>
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
    </header>
  );
}
