import React, { useEffect, useState } from "react";
import PublicHome from "./PublicHome";
import MainDashboard from "./MainDashboard";
import HelpGuide from "./HelpGuide";
import EmergencyContacts from "./EmergencyContacts";
import SafetyInstructions from "./SafetyInstructions";
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
import { ClipboardPlus, Droplets, Map, PackageCheck } from "lucide-react";

export type ViewMode =
  | "main-dashboard"
  | "operations-center"
  | "post-flood"
  | "drain-management"
  | "disease-management"
  | "map"
  | "help-guide"
  | "emergency-contacts"
  | "safety-instructions"
  | "flood-alerts"
  | "offline-card"
  | "status-tracker";

function AppContent() {
  const { t } = useLanguage();
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

  const ModuleFrame = ({
    icon: Icon,
    title,
    subtitle,
    children,
    contentClassName = "",
  }: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    subtitle: string;
    children: React.ReactNode;
    contentClassName?: string;
  }) => (
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_10%,rgba(56,189,248,0.16),transparent_28%),radial-gradient(circle_at_86%_76%,rgba(34,197,94,0.14),transparent_30%),linear-gradient(135deg,#061815,#082f49_58%,#07120f)] p-3">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1440px] flex-col">
        <AppHeader
          user={user}
          onLogout={logout}
          onBack={() => setViewMode("main-dashboard")}
          backLabel="Dashboard"
        />
        <section className="module-page-header mt-3 rounded-xl border border-sky-300/20 bg-slate-950/50 px-4 py-4 text-white shadow-xl shadow-black/20 backdrop-blur sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-400/10 text-cyan-100">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold leading-tight text-white sm:text-xl">
                  {title}
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
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

  if (!user) {
    return <PublicHome onLogin={setUser} />;
  }

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

  if (viewMode === "emergency-contacts") {
    return (
      <EmergencyContacts
        user={user}
        onBack={() => setViewMode("main-dashboard")}
        onLogout={logout}
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
      <AppContent />
    </LanguageProvider>
  );
}
