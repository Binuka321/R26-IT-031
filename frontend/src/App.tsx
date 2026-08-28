import React, { useEffect, useState } from "react";
import PublicHome from "./PublicHome";
import MainDashboard from "./MainDashboard";
import HelpGuide from "./HelpGuide";
import SafetyInstructions from "./SafetyInstructions";
import EmergencyContacts from "./EmergencyContacts";
import FloodAlertNotifications from "./FloodAlertNotifications";
import OfflineEmergencyCard from "./OfflineEmergencyCard";
import StatusTracker from "./StatusTracker";
import PostFloodApp from "./PostFloodRationDistribution/PostFloodApp";
import OperationsCenter from "./pages/OperationsCenter";
// @ts-ignore
import FloodMapApp from "./FloodMap/FloodMapApp";
import { Dashboard } from "./Drain_management/Dashboard";
import DiseaseDetectionForm from "./Disease-detection/Form";
import AppHeader from "./components/AppHeader";
import { LanguageProvider, useLanguage } from "./LanguageContext";
import { ThemeProvider, useTheme } from "./ThemeContext";
import { ClipboardPlus, Droplets, Map, PackageCheck } from "lucide-react";

export type ViewMode =
  | "main-dashboard"
  | "operations-center"
  | "post-flood"
  | "drain-management"
  | "disease-management"
  | "map"
  | "help-guide"
  | "safety-instructions"
  | "emergency-contacts"
  | "flood-alerts"
  | "offline-card"
  | "status-tracker";

type ModuleFrameProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  contentClassName?: string;
  user: { username: string; name: string; role: string; token: string } | null;
  onLogout: () => void;
  onBack: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
};

function ModuleFrame({
  icon: Icon,
  title,
  subtitle,
  children,
  contentClassName = "",
  user,
  onLogout,
  onBack,
  theme,
  onToggleTheme,
}: ModuleFrameProps) {
  const isDark = theme === "dark";
  const moduleShellClass = isDark
    ? "min-h-screen bg-[radial-gradient(circle_at_18%_10%,rgba(56,189,248,0.16),transparent_28%),radial-gradient(circle_at_86%_76%,rgba(34,197,94,0.14),transparent_30%),linear-gradient(135deg,#061815,#082f49_58%,#07120f)] p-3"
    : "min-h-screen bg-[radial-gradient(circle_at_18%_12%,rgba(14,165,233,0.08),transparent_28%),radial-gradient(circle_at_86%_76%,rgba(34,197,94,0.08),transparent_30%),linear-gradient(135deg,#f4f8f7,#edf6f4_56%,#eaf3f1)] p-3";
  const moduleHeaderClass = isDark
    ? "module-page-header mt-3 rounded-xl border border-sky-300/20 bg-slate-950/50 px-4 py-4 text-white shadow-xl shadow-black/20 backdrop-blur sm:px-5"
    : "module-page-header mt-3 rounded-xl border border-slate-200/80 bg-white/82 px-4 py-4 text-slate-950 shadow-lg shadow-slate-300/30 backdrop-blur sm:px-5";
  const moduleIconClass = isDark
    ? "grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-400/10 text-cyan-100"
    : "grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-sky-100 bg-sky-50 text-sky-700";

  return (
    <div className={moduleShellClass}>
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1440px] flex-col">
        <AppHeader
          user={user}
          onLogout={onLogout}
          onBack={onBack}
          backLabel="Dashboard"
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
        <section className={moduleHeaderClass}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className={moduleIconClass}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className={isDark ? "text-lg font-bold leading-tight text-white sm:text-xl" : "text-lg font-bold leading-tight text-slate-950 sm:text-xl"}>
                  {title}
                </h1>
                <p className={isDark ? "mt-1 max-w-3xl text-sm leading-6 text-slate-300" : "mt-1 max-w-3xl text-sm leading-6 text-slate-600"}>
                  {subtitle}
                </p>
              </div>
            </div>
            <div className="hidden h-12 w-1 rounded-full bg-gradient-to-b from-cyan-300 via-sky-400 to-emerald-400 sm:block" />
          </div>
        </section>
        <div className={`min-h-0 flex-1 ${contentClassName}`}>{children}</div>
      </div>
    </div>
  );
}

function AppContent() {
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<{ username: string; name: string; role: string; token: string } | null>(() => {
    const parsed = localStorage.getItem("flood-user");
    const token = localStorage.getItem("flood-user-token");
    if (parsed && token) {
      const userObj = JSON.parse(parsed);
      return { ...userObj, token };
    }
    return null;
  });

  const [viewMode, setViewMode] = useState<ViewMode>("main-dashboard");

  useEffect(() => {
    if (!user) {
      localStorage.removeItem("flood-user");
      localStorage.removeItem("flood-user-token");
    }
  }, [user]);

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setViewMode("main-dashboard");
    };
    window.addEventListener("flood-auth-expired", handleAuthExpired);
    return () => window.removeEventListener("flood-auth-expired", handleAuthExpired);
  }, []);

  const logout = () => {
    setUser(null);
    setViewMode("main-dashboard");
  };

  if (!user) {
    return <PublicHome onLogin={setUser} />;
  }

  const moduleFrameProps = {
    user,
    onLogout: logout,
    onBack: () => setViewMode("main-dashboard"),
    theme,
    onToggleTheme: toggleTheme,
  };

  if (viewMode === "main-dashboard") {
    return (
      <MainDashboard
        user={user}
        isAdmin={user.role === "admin"}
        onLogout={logout}
        onNavigate={setViewMode}
      />
    );
  }

  if (viewMode === "help-guide") {
    return (
      <HelpGuide
        user={user}
        onBack={() => setViewMode("main-dashboard")}
        onLogout={logout}
        onNavigate={setViewMode}
      />
    );
  }

  if (viewMode === "safety-instructions") {
    return (
      <SafetyInstructions
        user={user}
        onBack={() => setViewMode("main-dashboard")}
        onLogout={logout}
      />
    );
  }

  if (viewMode === "emergency-contacts") {
    return (
      <EmergencyContacts
        user={user}
        onBack={() => setViewMode("main-dashboard")}
        onLogout={logout}
      />
    );
  }

  if (viewMode === "flood-alerts") {
    return (
      <FloodAlertNotifications
        user={user}
        onBack={() => setViewMode("main-dashboard")}
        onLogout={logout}
      />
    );
  }

  if (viewMode === "offline-card") {
    return (
      <OfflineEmergencyCard
        user={user}
        onBack={() => setViewMode("main-dashboard")}
        onLogout={logout}
      />
    );
  }

  if (viewMode === "status-tracker") {
    return (
      <StatusTracker
        user={user}
        onBack={() => setViewMode("main-dashboard")}
        onLogout={logout}
      />
    );
  }

  if (viewMode === "drain-management" && user.role === "admin") {
    return (
      <ModuleFrame
        {...moduleFrameProps}
        icon={Droplets}
        title={t("Drain Management & Flood Level Monitor", "ජල බැසයෑම් කළමනාකරණය සහ ගංවතුර මට්ටම් නිරීක්ෂණය")}
        subtitle={t("Manage sensor packages, live water levels, rainfall readings, and flood warning thresholds.", "සෙන්සර්, සජීවී ජල මට්ටම්, වර්ෂා දත්ත සහ අනතුරු ඇඟවීම් සීමා නිරීක්ෂණය කරන්න.")}
        contentClassName="mt-3 overflow-auto rounded-xl"
      >
          <Dashboard authToken={user.token} />
      </ModuleFrame>
    );
  }

  if (viewMode === "post-flood") {
    return (
      <ModuleFrame
        {...moduleFrameProps}
        icon={PackageCheck}
        title={t("Rescue & Aid Distribution", "ගලවාගැනීම් සහ ආධාර බෙදාදීම")}
        subtitle={t("Coordinate camps, safe zones, relief resources, route planning, rescue operations, and aid delivery status.", "කඳවුරු, ආරක්ෂිත ස්ථාන, ආධාර සම්පත්, මාර්ග සැලසුම්, ගලවාගැනීම් සහ ආධාර බෙදාදීමේ තත්ත්වය සම්බන්ධ කරන්න.")}
        contentClassName="mt-3 overflow-hidden rounded-xl"
      >
        <PostFloodApp userRole={user.role} />
      </ModuleFrame>
    );
  }

  if (viewMode === "map") {
    return (
      <ModuleFrame
        {...moduleFrameProps}
        icon={Map}
        title={t("Flood Map", "ගංවතුර සිතියම")}
        subtitle={t("View district risk layers, IoT sensor zones, live flood alerts, and ML prediction outputs on one map.", "දිස්ත්‍රික් අවදානම් layers, IoT sensor zones, සජීවී flood alerts සහ ML prediction outputs එකම සිතියමක බලන්න.")}
        contentClassName="mt-3 overflow-hidden rounded-xl"
      >
        <FloodMapApp authToken={user.token} embedded height="calc(100svh - 196px)" />
      </ModuleFrame>
    );
  }

  if (viewMode === "disease-management") {
    return (
      <ModuleFrame
        {...moduleFrameProps}
        icon={ClipboardPlus}
        title={t("Disease Detection", "රෝග අවදානම් පරීක්ෂාව")}
        subtitle={t("Open the post-flood health risk form and check symptoms for possible disease outbreaks.", "ගංවතුරෙන් පසු සෞඛ්‍ය අවදානම් පෝරමය භාවිත කර රෝග පැතිරීමේ අවදානම පරීක්ෂා කරන්න.")}
        contentClassName="mt-3 overflow-auto rounded-xl"
      >
        <DiseaseDetectionForm />
      </ModuleFrame>
    );
  }

  return (
    <OperationsCenter
      authToken={user.token}
      isAdmin={user.role === "admin"}
      onLogout={logout}
      onNavigate={(page) => {
        if (page === "drain-management") setViewMode("drain-management");
        else if (page === "ration-distribution") setViewMode("post-flood");
        else if (page === "disease-management") setViewMode("disease-management");
        else if (page === "map") setViewMode("map");
        else setViewMode("main-dashboard");
      }}
    />
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </LanguageProvider>
  );
}
