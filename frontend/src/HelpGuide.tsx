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
import { useLanguage } from "./LanguageContext";

interface HelpGuideProps {
  user: { username: string; name: string; role: string; token: string };
  onBack: () => void;
  onLogout: () => void;
  onNavigate: (view: ViewMode) => void;
}

const guideModules = [
  {
    title: "Flood Map",
    titleSi: "ගංවතුර සිතියම",
    icon: Map,
    action: "Find risky locations",
    actionSi: "අවදානම් ස්ථාන බලන්න",
    detail: "View district flood risk, IoT sensor markers, affected zones, heatmap layers, and prediction results.",
    detailSi: "දිස්ත්‍රික් ගංවතුර අවදානම, සෙන්සර් ලකුණු, බලපෑම් වූ ප්‍රදේශ සහ prediction results බලන්න.",
  },
  {
    title: "Rescue & Ration",
    titleSi: "ගලවාගැනීම් සහ ආධාර",
    icon: PackageCheck,
    action: "Coordinate aid",
    actionSi: "සහාය සම්බන්ධ කරන්න",
    detail: "Use camps, safe zones, resources, route planning, rescue operations, and ration distribution tools.",
    detailSi: "කඳවුරු, safe zones, සම්පත්, route planning, rescue operations සහ ration distribution tools භාවිත කරන්න.",
  },
  {
    title: "Disease Detection",
    titleSi: "රෝග පරීක්ෂාව",
    icon: ClipboardPlus,
    action: "Check health risk",
    actionSi: "සෞඛ්‍ය අවදානම බලන්න",
    detail: "Submit post-flood health symptoms and check possible disease risk after a flood event.",
    detailSi: "ගංවතුරෙන් පසු රෝග ලක්ෂණ ඇතුළත් කර සෞඛ්‍ය අවදානම පරීක්ෂා කරන්න.",
  },
];

export default function HelpGuide({ user, onBack, onLogout, onNavigate }: HelpGuideProps) {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-[#07120f] text-white">
      <div className="min-h-screen bg-[radial-gradient(circle_at_18%_10%,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_86%_76%,rgba(34,197,94,0.16),transparent_30%),linear-gradient(135deg,#061815,#082f49_58%,#07120f)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
          <AppHeader user={user} onLogout={onLogout} onBack={onBack} />

          <section className="py-8">
            <div className="mb-6 rounded-lg border border-sky-300/20 bg-slate-950/45 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-8">
              <p className="mb-3 inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200">
                <ShieldCheck className="h-4 w-4" />
                {t("Help / User Guide", "උදව් / භාවිත මාර්ගෝපදේශය")}
              </p>
              <h1 className="text-3xl font-bold text-white sm:text-4xl">{t("FloodGuard360 user guide", "FloodGuard360 භාවිත මාර්ගෝපදේශය")}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                {t("A simple guide for victims and users to check flood risk, request support, and use post-flood health tools.", "ගංවතුර අවදානම බලන්න, සහාය ඉල්ලන්න සහ ගංවතුරෙන් පසු සෞඛ්‍ය tools භාවිත කරන්න victims/users සඳහා සරල guide එකක්.")}
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
                        {t(item.action, item.actionSi)}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white">{t(item.title, item.titleSi)}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{t(item.detail, item.detailSi)}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <section className="rounded-lg border border-sky-300/20 bg-slate-950/45 p-6 shadow-xl shadow-black/20">
                <div className="mb-4 flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-cyan-300" />
                  <h2 className="text-xl font-bold text-white">{t("How to use the app", "App එක භාවිත කරන ආකාරය")}</h2>
                </div>
                <ol className="space-y-3 text-sm leading-7 text-slate-300">
                  <li>1. {t("Start from the dashboard and open Flood Map to check nearby risk areas.", "Dashboard එකෙන් Flood Map විවෘත කර ළඟ අවදානම් ප්‍රදේශ බලන්න.")}</li>
                  <li>2. {t("Use Rescue & Ration if you need safe zone, camp, rescue, or supply information.", "Safe zone, camp, rescue හෝ supply තොරතුරු අවශ්‍ය නම් Rescue & Ration භාවිත කරන්න.")}</li>
                  <li>3. {t("Use Disease Detection after flood exposure if symptoms or health risks appear.", "ගංවතුරට නිරාවරණය වීමෙන් පසු ලක්ෂණ තිබේ නම් Disease Detection භාවිත කරන්න.")}</li>
                  <li>4. {t("Submit details carefully so response teams can understand the situation.", "Response teams වලට තත්ත්වය තේරුම්ගන්න විස්තර නිවැරදිව submit කරන්න.")}</li>
                </ol>
              </section>

              <section className="rounded-lg border border-sky-300/20 bg-slate-950/45 p-6 shadow-xl shadow-black/20">
                <div className="mb-4 flex items-center gap-3">
                  <Siren className="h-5 w-5 text-amber-200" />
                  <h2 className="text-xl font-bold text-white">{t("Emergency Workflow", "හදිසි ක්‍රියාවලිය")}</h2>
                </div>
                <ol className="space-y-3 text-sm leading-7 text-slate-300">
                  <li>1. {t("Check the Flood Map and avoid marked high-risk areas.", "Flood Map බලලා high-risk ලෙස ලකුණු කළ ප්‍රදේශ වලින් ඉවත්ව සිටින්න.")}</li>
                  <li>2. {t("Move toward a safe zone or camp shown in the system if evacuation is needed.", "Evacuation අවශ්‍ය නම් system එකේ පෙන්වන safe zone/camp වෙත යන්න.")}</li>
                  <li>3. {t("Request rescue/support or check ration distribution details in Rescue & Ration.", "Rescue & Ration තුළින් rescue/support ඉල්ලන්න හෝ ration details බලන්න.")}</li>
                  <li>4. {t("After the flood, use Disease Detection to check possible health risks.", "ගංවතුරෙන් පසු සෞඛ්‍ය අවදානම් බලන්න Disease Detection භාවිත කරන්න.")}</li>
                </ol>
              </section>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
