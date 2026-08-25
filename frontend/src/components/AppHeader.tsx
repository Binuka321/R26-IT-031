import React from "react";
import { ArrowLeft, Clock, LogOut, Moon, Sun } from "lucide-react";
import BrandLogo from "./BrandLogo";

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

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const timeText = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateText = now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const isDark = theme === "dark";

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-sky-300/20 bg-slate-950/55 px-5 py-4 text-white shadow-2xl shadow-black/25 backdrop-blur-xl sm:px-8">
      <div className="flex items-center gap-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/8 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-white/12"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </button>
        )}
        <BrandLogo surface="light" markClassName="h-24 w-80 sm:h-28 sm:w-96" />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-slate-200 md:flex">
          <Clock className="h-4 w-4 text-cyan-300" />
          <div className="leading-tight">
            <p className="text-sm font-semibold">{timeText}</p>
            <p className="text-[11px] text-slate-400">{dateText}</p>
          </div>
        </div>

        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-white">{user.name}</p>
          <p className="text-xs capitalize text-slate-400">{user.role}</p>
        </div>

        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/8 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-white/12"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-200" /> : <Moon className="h-4 w-4 text-sky-300" />}
            {isDark ? "Light" : "Dark"}
          </button>
        )}

        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 rounded-lg border border-red-300/30 bg-red-500/12 px-4 py-2.5 text-sm font-semibold text-red-100 hover:bg-red-500/20"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </header>
  );
}
