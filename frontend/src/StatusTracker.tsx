import React from "react";
import { CheckCircle2, Clock3, MapPin, Truck } from "lucide-react";
import AppHeader from "./components/AppHeader";
import { useLanguage } from "./LanguageContext";

interface StatusTrackerProps {
  user: { name: string; role: string };
  onBack: () => void;
  onLogout: () => void;
}

const steps = [
  { key: "received", en: "Received", si: "ලැබී ඇත", icon: CheckCircle2, done: true },
  { key: "assigned", en: "Assigned", si: "පවරා ඇත", icon: Clock3, done: true },
  { key: "on-way", en: "On the way", si: "මාර්ගයේ", icon: Truck, done: false },
  { key: "completed", en: "Completed", si: "සම්පූර්ණයි", icon: CheckCircle2, done: false },
];

export default function StatusTracker({ user, onBack, onLogout }: StatusTrackerProps) {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-[#07120f] text-white">
      <div className="min-h-screen bg-[radial-gradient(circle_at_18%_10%,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_86%_76%,rgba(34,197,94,0.16),transparent_30%),linear-gradient(135deg,#061815,#082f49_58%,#07120f)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
          <AppHeader user={user} onLogout={onLogout} onBack={onBack} />

          <section className="py-8">
            <div className="mb-6 rounded-lg border border-sky-300/20 bg-slate-950/45 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-8">
              <p className="mb-3 inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200">
                <Truck className="h-4 w-4" />
                {t("Status Tracker", "තත්ත්වය පරීක්ෂා කිරීම")}
              </p>
              <h1 className="text-3xl font-bold text-white sm:text-4xl">
                {t("Track your emergency request", "ඔබගේ හදිසි ඉල්ලීමේ තත්ත්වය බලන්න")}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                {t(
                  "A simple timeline for rescue, ration, or support requests.",
                  "ගලවාගැනීම්, ආහාර/සම්පත් හෝ සහාය ඉල්ලීම් සඳහා සරල timeline එකක්."
                )}
              </p>
            </div>

            <section className="rounded-lg border border-sky-300/20 bg-slate-950/45 p-6 shadow-xl shadow-black/20">
              <div className="mb-6 rounded-lg border border-white/10 bg-white/[0.05] p-4">
                <p className="text-sm text-slate-400">{t("Request ID", "ඉල්ලීම් අංකය")}</p>
                <p className="mt-1 text-xl font-bold text-white">FG360-REQ-1024</p>
                <p className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                  <MapPin className="h-4 w-4 text-cyan-300" />
                  {t("Colombo district support request", "කොළඹ දිස්ත්‍රික් සහාය ඉල්ලීම")}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.key}
                      className={step.done
                        ? "rounded-lg border border-emerald-300/25 bg-emerald-400/10 p-5"
                        : "rounded-lg border border-white/10 bg-white/[0.05] p-5"}
                    >
                      <div className={step.done
                        ? "mb-4 grid h-12 w-12 place-items-center rounded-lg bg-emerald-300 text-slate-950"
                        : "mb-4 grid h-12 w-12 place-items-center rounded-lg border border-white/10 text-slate-300"}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        {t("Step", "අදියර")} {index + 1}
                      </p>
                      <h2 className="mt-2 text-lg font-bold text-white">{t(step.en, step.si)}</h2>
                    </div>
                  );
                })}
              </div>
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
