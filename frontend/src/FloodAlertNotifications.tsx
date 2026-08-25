import React from "react";
import { AlertTriangle, Bell, MapPin, Navigation, PackageX } from "lucide-react";
import AppHeader from "./components/AppHeader";
import { useLanguage } from "./LanguageContext";

interface FloodAlertNotificationsProps {
  user: { name: string; role: string };
  onBack: () => void;
  onLogout: () => void;
}

const alerts = [
  {
    title: "High risk in Colombo",
    area: "Colombo District",
    time: "Updated 10 min ago",
    level: "High",
    detail: "Avoid low-lying roads near canals and check the flood map before travelling.",
    icon: AlertTriangle,
    tone: "border-red-300/30 bg-red-500/10 text-red-100",
  },
  {
    title: "Route blocked",
    area: "Gampaha - Kelaniya road section",
    time: "Updated 18 min ago",
    level: "Warning",
    detail: "Use alternate routes and follow rescue team instructions if evacuation is needed.",
    icon: Navigation,
    tone: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  },
  {
    title: "Camp capacity warning",
    area: "Temporary shelter network",
    time: "Updated 25 min ago",
    level: "Notice",
    detail: "Some camps may be close to capacity. Check safe zones before moving.",
    icon: PackageX,
    tone: "border-sky-300/30 bg-sky-400/10 text-sky-100",
  },
];

export default function FloodAlertNotifications({ user, onBack, onLogout }: FloodAlertNotificationsProps) {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-[#07120f] text-white">
      <div className="min-h-screen bg-[radial-gradient(circle_at_18%_10%,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_86%_76%,rgba(34,197,94,0.16),transparent_30%),linear-gradient(135deg,#061815,#082f49_58%,#07120f)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
          <AppHeader user={user} onLogout={onLogout} onBack={onBack} />

          <section className="py-8">
            <div className="mb-6 rounded-lg border border-sky-300/20 bg-slate-950/45 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-8">
              <p className="mb-3 inline-flex items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100">
                <Bell className="h-4 w-4" />
                {t("Flood Alert Notifications", "ගංවතුර අනතුරු දැනුම්දීම්")}
              </p>
              <h1 className="text-3xl font-bold text-white sm:text-4xl">{t("Important warnings", "වැදගත් අනතුරු ඇඟවීම්")}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                {t("Check important flood warnings, route issues, and shelter notices before travelling or requesting help.", "ගමන් කිරීමට හෝ උදව් ඉල්ලීමට පෙර ගංවතුර අනතුරු, මාර්ග ගැටලු සහ කඳවුරු දැනුම්දීම් බලන්න.")}
              </p>
            </div>

            <div className="space-y-4">
              {alerts.map((alert) => {
                const Icon = alert.icon;
                return (
                  <article key={alert.title} className={`rounded-lg border p-5 shadow-xl shadow-black/20 ${alert.tone}`}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex gap-4">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-white/10 bg-slate-950/35">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-bold text-white">{t(alert.title, alert.title === "High risk in Colombo" ? "කොළඹ ඉහළ අවදානමක්" : alert.title === "Route blocked" ? "මාර්ගය අවහිර වී ඇත" : "කඳවුරු ධාරිතා අනතුරු ඇඟවීම")}</h2>
                            <span className="rounded-md border border-white/10 bg-white/[0.08] px-2.5 py-1 text-xs font-bold">
                              {alert.level}
                            </span>
                          </div>
                          <p className="flex items-center gap-2 text-sm text-slate-300">
                            <MapPin className="h-4 w-4" />
                          {t(alert.area, alert.area === "Colombo District" ? "කොළඹ දිස්ත්‍රික්කය" : alert.area === "Temporary shelter network" ? "තාවකාලික ආරක්ෂිත කඳවුරු" : "ගම්පහ - කැලණිය මාර්ග කොටස")}
                          </p>
                          <p className="mt-3 text-sm leading-7 text-slate-300">{t(alert.detail, alert.title === "High risk in Colombo" ? "ගමන් කිරීමට පෙර අඩු බිම් මාර්ග වලින් ඉවත්ව Flood Map පරීක්ෂා කරන්න." : alert.title === "Route blocked" ? "විකල්ප මාර්ග භාවිත කර අවශ්‍ය නම් rescue team උපදෙස් අනුගමනය කරන්න." : "සමහර කඳවුරු පිරී යා හැක. ගමන් කිරීමට පෙර safe zones පරීක්ෂා කරන්න.")}</p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-400">{alert.time}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
