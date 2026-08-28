import React, { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  ShieldCheck,
  UserPlus,
  Waves,
} from "lucide-react";
import BrandLogo from "./components/BrandLogo";
import { useLanguage } from "./LanguageContext";

interface PublicHomeProps {
  onLogin: (user: { username: string; name: string; role: string; token: string }) => void;
}

type AuthMode = "login" | "register";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api";

export default function PublicHome({ onLogin }: PublicHomeProps) {
  const { language, setLanguage, t } = useLanguage();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    const path = mode === "login" ? "auth/login" : "auth/register";
    const body = mode === "login" ? { username, password } : { name, username, password };

    try {
      const resp = await fetch(`${API_BASE}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setMessage(data.message || t("Request failed. Please check your details.", "ඉල්ලීම අසාර්ථකයි. ඔබගේ විස්තර පරීක්ෂා කරන්න."));
        return;
      }

      if (mode === "register") {
        setMessage(t("Account created. Please sign in.", "ගිණුම සාදන ලදි. කරුණාකර පුරනය වන්න."));
        setMode("login");
        setPassword("");
        return;
      }

      if (data.token && data.user) {
        localStorage.setItem("flood-user-token", data.token);
        localStorage.setItem("flood-user", JSON.stringify(data.user));
        onLogin({ ...data.user, token: data.token });
      }
    } catch {
      setMessage(t("Cannot reach the API server. Start the backend and try again.", "API server එකට සම්බන්ධ විය නොහැක. backend එක ආරම්භ කර නැවත උත්සාහ කරන්න."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#07120f] text-white">
      <div className="min-h-screen bg-[radial-gradient(circle_at_18%_12%,rgba(56,189,248,0.22),transparent_28%),radial-gradient(circle_at_86%_72%,rgba(34,197,94,0.18),transparent_30%),linear-gradient(135deg,#061815,#082f49_55%,#07120f)]">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <BrandLogo surface="light" markClassName="h-24 w-80 sm:h-28 sm:w-96" />
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-100 shadow-lg shadow-black/10 backdrop-blur sm:flex">
              <Activity className="h-4 w-4 text-emerald-300" />
              {t("Secure access", "ආරක්ෂිත ප්‍රවේශය")}
            </div>
            <button
              type="button"
              onClick={() => setLanguage(language === "en" ? "si" : "en")}
              className="rounded-lg border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-slate-100 shadow-lg shadow-black/10 backdrop-blur hover:bg-white/15"
            >
              {language === "en" ? "සිංහල" : "English"}
            </button>
          </div>
        </header>

        <section className="mx-auto grid min-h-[calc(100vh-104px)] w-full max-w-6xl grid-cols-1 items-center gap-8 px-5 pb-8 sm:px-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="max-w-2xl space-y-7">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-sm text-amber-100 shadow-lg shadow-amber-950/10">
              <AlertTriangle className="h-4 w-4" />
              {t("Login required before accessing the application", "යෙදුමට පිවිසීමට පෙර පුරනය වීම අවශ්‍යයි")}
              </div>
              <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
                {t("Smart flood response starts with a secure sign in", "බුද්ධිමත් ගංවතුර ප්‍රතිචාරය ආරක්ෂිත පුරනය වීමකින් ආරම්භ වේ")}
              </h1>
              <p className="mt-5 text-base leading-7 text-slate-300 sm:text-lg">
                {t("Access drainage monitoring, flood maps, rescue coordination, and post-flood health tools from one controlled web app.", "ජල බැසයෑම් නිරීක්ෂණය, ගංවතුර සිතියම්, ගලවාගැනීම් සම්බන්ධීකරණය සහ ගංවතුරෙන් පසු සෞඛ්‍ය මෙවලම් එකම web app එකකින් භාවිත කරන්න.")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { label: t("Live Monitoring", "සජීවී නිරීක්ෂණය"), icon: Waves },
                { label: t("Role Based Access", "භූමිකා අනුව ප්‍රවේශය"), icon: ShieldCheck },
                { label: t("Field Ready", "ක්ෂේත්‍ර භාවිතයට සූදානම්"), icon: CheckCircle2 },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-lg border border-white/10 bg-white/8 p-4 shadow-xl shadow-black/10 backdrop-blur">
                    <Icon className="mb-3 h-5 w-5 text-emerald-300" />
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <section className="w-full rounded-lg border border-white/15 bg-slate-950/75 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-6">
            <div className="mb-6 rounded-lg border border-sky-300/15 bg-gradient-to-r from-sky-500/10 to-emerald-500/10 p-4">
              <p className="text-sm font-semibold text-sky-100">{t("FloodGuard360 Access Portal", "FloodGuard360 ප්‍රවේශ ද්වාරය")}</p>
              <p className="mt-1 text-xs text-slate-400">{t("Smart drainage & flood prediction system", "බුද්ධිමත් ජල බැසයෑම් සහ ගංවතුර අනාවැකි පද්ධතිය")}</p>
            </div>

            <div className="mb-5 grid grid-cols-2 rounded-lg border border-white/10 bg-slate-900/90 p-1">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm transition ${
                  mode === "login" ? "bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-950/20" : "text-slate-300 hover:bg-white/8"
                }`}
              >
                <LogIn className="h-4 w-4" />
                {t("Sign in", "පුරනය වන්න")}
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm transition ${
                  mode === "register" ? "bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-950/20" : "text-slate-300 hover:bg-white/8"
                }`}
              >
                <UserPlus className="h-4 w-4" />
                {t("Sign up", "ලියාපදිංචි වන්න")}
              </button>
            </div>

            <div className="mb-5">
              <h2 className="text-2xl font-semibold text-white">
                {mode === "login" ? t("Welcome back", "නැවත සාදරයෙන් පිළිගනිමු") : t("Create operator access", "ක්‍රියාකරු ප්‍රවේශය සාදන්න")}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {t(
                  mode === "login"
                    ? "Use your system credentials to enter the app."
                    : "Register a new account, then sign in to continue.",
                  mode === "login"
                    ? "යෙදුමට පිවිසීමට ඔබගේ පද්ධති credentials භාවිත කරන්න."
                    : "නව ගිණුමක් ලියාපදිංචි කර, ඉදිරියට යාමට පුරනය වන්න.",
                )}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <label className="block text-sm text-slate-200">
                  {t("Full name", "සම්පූර්ණ නම")}
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nimal Perera"
                    className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300 focus:bg-slate-900"
                    required
                  />
                </label>
              )}

              <label className="block text-sm text-slate-200">
                {t("Username", "පරිශීලක නාමය")}
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="operator01"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300 focus:bg-slate-900"
                  required
                />
              </label>

              <label className="block text-sm text-slate-200">
                {t("Password", "මුරපදය")}
                <div className="mt-2 flex rounded-lg border border-white/10 bg-slate-900/80 focus-within:border-emerald-300 focus-within:bg-slate-900">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("Enter password", "මුරපදය ඇතුළත් කරන්න")}
                    className="min-w-0 flex-1 rounded-lg bg-transparent px-4 py-3 text-white outline-none placeholder:text-slate-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="flex w-12 items-center justify-center rounded-lg text-slate-400 hover:text-white"
                    title={showPassword ? t("Hide password", "මුරපදය සඟවන්න") : t("Show password", "මුරපදය පෙන්වන්න")}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-400 to-sky-400 px-4 py-3 font-semibold text-slate-950 shadow-lg shadow-emerald-950/20 transition hover:from-emerald-300 hover:to-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {mode === "login" ? <LogIn className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                {loading ? t("Please wait...", "කරුණාකර රැඳී සිටින්න...") : mode === "login" ? t("Sign in", "පුරනය වන්න") : t("Create account", "ගිණුම සාදන්න")}
              </button>
            </form>

            {message && (
              <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                {message}
              </p>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
