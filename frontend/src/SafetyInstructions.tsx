import React from "react";
import { AlertTriangle, CheckCircle2, Droplets, HeartPulse, ShieldCheck, Zap } from "lucide-react";
import AppHeader from "./components/AppHeader";
import { useLanguage } from "./LanguageContext";

interface SafetyInstructionsProps {
  user: { name: string; role: string };
  onBack: () => void;
  onLogout: () => void;
}

const sections = [
  {
    title: "Before a flood",
    icon: ShieldCheck,
    tips: [
      "Keep phone charged and save emergency numbers.",
      "Prepare drinking water, dry food, medicine, torch, power bank, and important documents.",
      "Move valuables and electrical items to higher places.",
      "Know the nearest safe zone, camp, or higher ground.",
    ],
    tipsSi: [
      "දුරකථනය charge කර තබා හදිසි අංක save කරගන්න.",
      "පානීය ජලය, වියළි ආහාර, ඖෂධ, torch, power bank සහ වැදගත් ලේඛන සූදානම් කරගන්න.",
      "වටිනා දේවල් සහ විදුලි උපකරණ ඉහළ ස්ථානවලට ගෙන යන්න.",
      "ළඟම ආරක්ෂිත ස්ථානය, කඳවුර හෝ ඉහළ භූමිය දැනගන්න.",
    ],
  },
  {
    title: "During a flood",
    icon: Droplets,
    tips: [
      "Do not walk, swim, or drive through flood water.",
      "Avoid bridges, drains, canals, and fast-moving water.",
      "Switch off electricity if water enters your house and it is safe to do so.",
      "Call emergency services if someone is trapped, injured, missing, or in immediate danger.",
    ],
    tipsSi: [
      "ගංවතුර ජලය හරහා ඇවිදින්න, පීනන්න හෝ රිය පදවන්න එපා.",
      "පාලම්, කාණු, ඇළ මාර්ග සහ වේගයෙන් ගලායන ජලයෙන් ඉවත්ව සිටින්න.",
      "නිවසට ජලය ඇතුළු වුවහොත් ආරක්ෂිත නම් විදුලිය අක්‍රිය කරන්න.",
      "කෙනෙක් සිරවී, තුවාල වී, අතුරුදහන් වී හෝ තත්ක්ෂණික අවදානමක සිටී නම් හදිසි සේවාවන් අමතන්න.",
    ],
  },
  {
    title: "After a flood",
    icon: HeartPulse,
    tips: [
      "Do not drink flood-contaminated water. Boil or use safe bottled water.",
      "Clean wounds quickly and seek medical help for fever, diarrhea, skin infections, or breathing issues.",
      "Avoid damaged buildings, fallen wires, and unstable roads.",
      "Use Disease Detection if symptoms appear after flood exposure.",
    ],
    tipsSi: [
      "ගංවතුරෙන් දූෂිත වූ ජලය බොන්න එපා. උතුරවා හෝ ආරක්ෂිත bottled water භාවිත කරන්න.",
      "තුවාල ඉක්මනින් පිරිසිදු කර උණ, පාචනය, සමේ ආසාදන හෝ හුස්ම ගැනීමේ ගැටලු තිබේ නම් වෛද්‍ය සහාය ලබාගන්න.",
      "හානි වූ ගොඩනැගිලි, වැටී ඇති වයර් සහ අස්ථිර මාර්ග වලින් ඉවත්ව සිටින්න.",
      "ගංවතුරට නිරාවරණය වීමෙන් පසු රෝග ලක්ෂණ තිබේ නම් Disease Detection භාවිත කරන්න.",
    ],
  },
];

const warnings = [
  "Never touch electrical switches or wires while standing in water.",
  "Children and elderly people should not be left near flood water.",
  "Do not eat food that touched flood water.",
  "Follow official evacuation instructions immediately.",
];

export default function SafetyInstructions({ user, onBack, onLogout }: SafetyInstructionsProps) {
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
                {t("Safety Instructions", "ආරක්ෂක උපදෙස්")}
              </p>
              <h1 className="text-3xl font-bold text-white sm:text-4xl">{t("Stay safe before, during, and after floods", "ගංවතුරට පෙර, අතරතුර සහ පසු ආරක්ෂිතව සිටින්න")}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                {t("Quick safety steps for victims and users. In immediate danger, call emergency services first.", "වින්දිතයින්ට සහ පරිශීලකයින්ට වැදගත් ආරක්ෂක පියවර. තත්ක්ෂණික අවදානමකදී මුලින්ම හදිසි සේවාවන් අමතන්න.")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <section key={section.title} className="rounded-lg border border-sky-300/20 bg-slate-950/45 p-6 shadow-xl shadow-black/20">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-400/10 text-cyan-200">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h2 className="text-xl font-bold text-white">
                        {section.title === "Before a flood" ? t(section.title, "ගංවතුරට පෙර") : section.title === "During a flood" ? t(section.title, "ගංවතුර අතරතුර") : t(section.title, "ගංවතුරෙන් පසු")}
                      </h2>
                    </div>
                    <ul className="space-y-3">
                  {section.tips.map((tip, index) => (
                        <li key={tip} className="flex gap-3 text-sm leading-7 text-slate-300">
                          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                          <span>{t(tip, section.tipsSi[index])}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>

            <section className="mt-6 rounded-lg border border-red-300/25 bg-red-500/10 p-6 shadow-xl shadow-black/20">
              <div className="mb-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-200" />
                <h2 className="text-xl font-bold text-white">{t("Important warnings", "වැදගත් අනතුරු ඇඟවීම්")}</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {warnings.map((warning) => (
                  <div key={warning} className="flex gap-3 rounded-lg border border-red-200/15 bg-slate-950/25 p-4 text-sm leading-6 text-red-50">
                    <Zap className="mt-1 h-4 w-4 shrink-0 text-amber-200" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
