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

  const logout = () => {
    setUser(null);
    setViewMode("main-dashboard");
  };

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
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-3">
        <AppHeader
          user={user}
          onLogout={logout}
          onBack={() => setViewMode("main-dashboard")}
          backLabel="Dashboard"
        />
        <div className="mt-3 overflow-hidden rounded-xl border border-cyan-300/20 bg-gradient-to-r from-slate-950/85 via-sky-950/65 to-emerald-950/55 px-5 py-4 text-white shadow-xl shadow-black/20 backdrop-blur">
          <div className="mb-3 h-px bg-gradient-to-r from-cyan-300/55 via-emerald-300/25 to-transparent" />
          <div>
            <p className="text-sm font-semibold text-white">{t("Drain Management & Flood Level Monitor", "ජල බැසයෑම් කළමනාකරණය සහ ගංවතුර මට්ටම් නිරීක්ෂණය")}</p>
            <p className="text-xs text-slate-400">{t("Manage sensor packages, water levels, and flood warning thresholds.", "සෙන්සර්, ජල මට්ටම් සහ අනතුරු ඇඟවීම් සීමා නිරීක්ෂණය කරන්න.")}</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <Dashboard authToken={user.token} />
        </div>
      </div>
    );
  }

  if (viewMode === "post-flood") {
    return (
      <div className="min-h-screen bg-slate-950 p-3">
        <AppHeader
          user={user}
          onLogout={logout}
          onBack={() => setViewMode("main-dashboard")}
          backLabel="Dashboard"
        />
        <PostFloodApp userRole={user.role} />
      </div>
    );
  }

  if (viewMode === "map") {
    return (
      <div className="min-h-screen bg-slate-950 p-3">
        <AppHeader
          user={user}
          onLogout={logout}
          onBack={() => setViewMode("main-dashboard")}
          backLabel="Dashboard"
        />
        <div className="mt-3 overflow-hidden rounded-lg">
          <FloodMapApp authToken={user.token} embedded height="calc(100vh - 158px)" />
        </div>
      </div>
    );
  }

  if (viewMode === "disease-management") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-3">
        <AppHeader
          user={user}
          onLogout={logout}
          onBack={() => setViewMode("main-dashboard")}
          backLabel="Dashboard"
        />
        <div className="mt-3 overflow-hidden rounded-xl border border-fuchsia-300/20 bg-gradient-to-r from-slate-950/85 via-indigo-950/62 to-fuchsia-950/45 px-5 py-4 text-white shadow-xl shadow-black/20 backdrop-blur">
          <div className="mb-3 h-px bg-gradient-to-r from-fuchsia-300/55 via-sky-300/25 to-transparent" />
          <div>
            <p className="text-sm font-semibold text-white">{t("Disease Detection", "රෝග අවදානම් පරීක්ෂාව")}</p>
            <p className="text-xs text-slate-400">{t("Open the post-flood disease detection and health risk form.", "ගංවතුරෙන් පසු රෝග අවදානම් පරීක්ෂණ පෝරමය විවෘත කරන්න.")}</p>
          </div>
        </div>
        <DiseaseDetectionForm />
      </div>
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
