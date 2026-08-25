import React from "react";
import { Download, Phone, ShieldCheck, WifiOff } from "lucide-react";
import AppHeader from "./components/AppHeader";
import { useLanguage } from "./LanguageContext";

interface OfflineEmergencyCardProps {
  user: { name: string; role: string };
  onBack: () => void;
  onLogout: () => void;
}

const offlineCard = {
  contacts: [
    ["Disaster Management Centre", "117"],
    ["Police Emergency", "119"],
    ["Ambulance / Fire & Rescue", "110"],
    ["Suwa Seriya Ambulance", "1990"],
  ],
  safety: [
    "Move to higher ground if flood water rises.",
    "Do not walk, swim, or drive through flood water.",
    "Avoid electrical wires, switches, and flooded buildings.",
    "Use boiled or bottled water after a flood.",
    "Call emergency services if anyone is trapped, injured, or missing.",
  ],
};

const STORAGE_KEY = "floodguard-offline-emergency-card";

export default function OfflineEmergencyCard({ user, onBack, onLogout }: OfflineEmergencyCardProps) {
  const { t } = useLanguage();
  const [savedAt, setSavedAt] = React.useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return "";
    try {
      return JSON.parse(stored).savedAt || "";
    } catch {
      return "";
    }
  });

  React.useEffect(() => {
    if (!savedAt) {
      const timestamp = new Date().toLocaleString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...offlineCard, savedAt: timestamp }));
      setSavedAt(timestamp);
    }
  }, [savedAt]);

  const saveCard = () => {
    const timestamp = new Date().toLocaleString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...offlineCard, savedAt: timestamp }));
    setSavedAt(timestamp);
  };

  return (
    <main className="min-h-screen bg-[#07120f] text-white">
      <div className="min-h-screen bg-[radial-gradient(circle_at_18%_10%,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_86%_76%,rgba(34,197,94,0.16),transparent_30%),linear-gradient(135deg,#061815,#082f49_58%,#07120f)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
          <AppHeader user={user} onLogout={onLogout} onBack={onBack} />

          <section className="py-8">
            <div className="mb-6 rounded-lg border border-sky-300/20 bg-slate-950/45 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-8">
              <p className="mb-3 inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                <WifiOff className="h-4 w-4" />
                {t("Offline Emergency Card", "Offline හදිසි කාඩ්පත")}
              </p>
              <h1 className="text-3xl font-bold text-white sm:text-4xl">{t("Keep emergency info available offline", "හදිසි තොරතුරු offline තබාගන්න")}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                {t("This card saves essential contacts and safety tips in this browser using localStorage.", "මෙම කාඩ්පත හදිසි සම්බන්ධතා සහ ආරක්ෂක උපදෙස් මෙම browser එකේ localStorage වල save කරයි.")}
              </p>
              <button
                type="button"
                onClick={saveCard}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-200"
              >
                <Download className="h-4 w-4" />
                {t("Save / Refresh Offline Card", "Offline කාඩ්පත save / refresh කරන්න")}
              </button>
              {savedAt && <p className="mt-3 text-xs text-slate-400">{t("Saved on this browser:", "මෙම browser එකේ save කළ වේලාව:")} {savedAt}</p>}
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <section className="rounded-lg border border-sky-300/20 bg-slate-950/45 p-6 shadow-xl shadow-black/20">
                <div className="mb-5 flex items-center gap-3">
                  <Phone className="h-5 w-5 text-amber-200" />
                  <h2 className="text-xl font-bold text-white">{t("Emergency contacts", "හදිසි සම්බන්ධතා")}</h2>
                </div>
                <div className="space-y-3">
                  {offlineCard.contacts.map(([label, number]) => (
                    <a
                      key={number}
                      href={`tel:${number}`}
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm hover:bg-white/[0.08]"
                    >
                      <span className="font-semibold text-white">{label}</span>
                      <span className="rounded-md bg-white px-3 py-1.5 font-black text-slate-950">{number}</span>
                    </a>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-sky-300/20 bg-slate-950/45 p-6 shadow-xl shadow-black/20">
                <div className="mb-5 flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-300" />
                  <h2 className="text-xl font-bold text-white">{t("Safety tips", "ආරක්ෂක උපදෙස්")}</h2>
                </div>
                <ul className="space-y-3 text-sm leading-7 text-slate-300">
                  {offlineCard.safety.map((tip, index) => (
                    <li key={tip} className="rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3">
                      {index + 1}. {t(tip, [
                        "ජල මට්ටම ඉහළ යන විට ඉහළ භූමියකට යන්න.",
                        "ගංවතුර ජලය හරහා ඇවිදින්න, පීනන්න හෝ රිය පදවන්න එපා.",
                        "විදුලි වයර්, switches සහ ජලයෙන් පිරුණු ගොඩනැගිලි වලින් ඉවත්ව සිටින්න.",
                        "ගංවතුරෙන් පසු උතුරවාගත් හෝ bottled water භාවිත කරන්න.",
                        "කෙනෙක් සිරවී, තුවාල වී හෝ අතුරුදහන් වී ඇත්නම් හදිසි සේවාවන් අමතන්න.",
                      ][index])}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
