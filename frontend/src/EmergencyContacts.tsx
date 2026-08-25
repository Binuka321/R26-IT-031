import React from "react";
import { Ambulance, Building2, Flame, Phone, ShieldAlert } from "lucide-react";
import AppHeader from "./components/AppHeader";
import { useLanguage } from "./LanguageContext";

interface EmergencyContactsProps {
  user: { name: string; role: string };
  onBack: () => void;
  onLogout: () => void;
}

const primaryContacts = [
  {
    title: "Disaster Management Centre",
    number: "117",
    note: "Floods, landslides, evacuation, disaster assistance",
    icon: ShieldAlert,
    tone: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  },
  {
    title: "Police Emergency",
    number: "119",
    note: "Immediate police support and emergency reporting",
    icon: Phone,
    tone: "border-sky-300/30 bg-sky-400/10 text-sky-100",
  },
  {
    title: "Ambulance / Fire & Rescue",
    number: "110",
    note: "Medical emergency, fire, and rescue support",
    icon: Flame,
    tone: "border-red-300/30 bg-red-400/10 text-red-100",
  },
  {
    title: "Suwa Seriya Ambulance",
    number: "1990",
    note: "Free emergency medical ambulance service",
    icon: Ambulance,
    tone: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
  },
];

const districts = [
  "Ampara",
  "Anuradhapura",
  "Badulla",
  "Batticaloa",
  "Colombo",
  "Galle",
  "Gampaha",
  "Hambantota",
  "Jaffna",
  "Kalutara",
  "Kandy",
  "Kegalle",
  "Kilinochchi",
  "Kurunegala",
  "Mannar",
  "Matale",
  "Matara",
  "Moneragala",
  "Mullaitivu",
  "Nuwara Eliya",
  "Polonnaruwa",
  "Puttalam",
  "Ratnapura",
  "Trincomalee",
  "Vavuniya",
];

export default function EmergencyContacts({ user, onBack, onLogout }: EmergencyContactsProps) {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-[#07120f] text-white">
      <div className="min-h-screen bg-[radial-gradient(circle_at_18%_10%,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_86%_76%,rgba(34,197,94,0.16),transparent_30%),linear-gradient(135deg,#061815,#082f49_58%,#07120f)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
          <AppHeader user={user} onLogout={onLogout} onBack={onBack} />

          <section className="py-8">
            <div className="mb-6 rounded-lg border border-sky-300/20 bg-slate-950/45 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-8">
              <p className="mb-3 inline-flex items-center gap-2 rounded-lg border border-red-300/25 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-100">
                <Phone className="h-4 w-4" />
                {t("Emergency Contacts", "හදිසි සම්බන්ධතා")}
              </p>
              <h1 className="text-3xl font-bold text-white sm:text-4xl">{t("Call for urgent help", "හදිසි උදව් සඳහා අමතන්න")}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                {t("Use one-click calling during an emergency. If you are unsure who to call during flood danger, start with DMC 117 or Police 119.", "හදිසි අවස්ථාවක එක් click එකකින් අමතන්න. ගංවතුර අවදානමකදී කාට අමතන්නද නොදන්නා නම් DMC 117 හෝ Police 119 අමතන්න.")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              {primaryContacts.map((contact) => {
                const Icon = contact.icon;
                return (
                  <article key={contact.number} className={`rounded-lg border p-5 shadow-xl shadow-black/20 ${contact.tone}`}>
                    <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg border border-white/10 bg-slate-950/35">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h2 className="text-lg font-bold text-white">{contact.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{contact.note}</p>
                    <a
                      href={`tel:${contact.number}`}
                      className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-base font-black text-slate-950 hover:bg-slate-100"
                    >
                      <Phone className="h-4 w-4" />
                      {t("Call", "අමතන්න")} {contact.number}
                    </a>
                  </article>
                );
              })}
            </div>

            <section className="mt-6 rounded-lg border border-sky-300/20 bg-slate-950/45 p-6 shadow-xl shadow-black/20">
              <div className="mb-5 flex items-center gap-3">
                <Building2 className="h-5 w-5 text-cyan-300" />
                <h2 className="text-xl font-bold text-white">{t("District-wise quick list", "දිස්ත්‍රික්ක අනුව ලැයිස්තුව")}</h2>
              </div>
              <p className="mb-5 text-sm leading-7 text-slate-300">
                {t("Select your district name when speaking to emergency services. For disaster assistance, call DMC 117 and clearly state your district, town, landmark, and urgent need.", "හදිසි සේවාවන් සමඟ කතා කරන විට ඔබේ දිස්ත්‍රික්කය කියන්න. ආපදා සහාය සඳහා DMC 117 අමතා දිස්ත්‍රික්කය, නගරය, සලකුණ සහ අවශ්‍ය උදව් පැහැදිලිව කියන්න.")}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {districts.map((district) => (
                  <div key={district} className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
                    <p className="font-semibold text-white">{district}</p>
                    <div className="mt-3 flex gap-2">
                      <a href="tel:117" className="rounded-md bg-amber-300 px-3 py-1.5 text-xs font-bold text-slate-950">DMC 117</a>
                      <a href="tel:119" className="rounded-md bg-sky-300 px-3 py-1.5 text-xs font-bold text-slate-950">Police 119</a>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-xs leading-6 text-slate-400">
                Sources: Sri Lanka Disaster Management Centre, Sri Lanka Police, Sri Lanka Tourism emergency services, and 1990 Suwa Seriya.
              </p>
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
