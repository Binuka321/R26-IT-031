import React, { useEffect, useState } from "react";
import PublicHome from "./PublicHome";
import MainDashboard from "./MainDashboard";
import HelpGuide from "./HelpGuide";
import PostFloodApp from "./PostFloodRationDistribution/PostFloodApp";
import OperationsCenter from "./pages/OperationsCenter";
// @ts-ignore
import FloodMapApp from "./FloodMap/FloodMapApp";
import { Dashboard } from "./Drain_management/Dashboard";
import DiseaseDetectionForm from "./Disease-detection/Form";
import AppHeader from "./components/AppHeader";

export type ViewMode =
  | "main-dashboard"
  | "operations-center"
  | "post-flood"
  | "drain-management"
  | "disease-management"
  | "map"
  | "help-guide";

export default function App() {
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

  if (viewMode === "drain-management" && user.role === "admin") {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-3">
        <AppHeader
          user={user}
          onLogout={logout}
          onBack={() => setViewMode("main-dashboard")}
          backLabel="Dashboard"
        />
        <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/85 px-4 py-3 text-white">
          <div>
            <p className="text-sm font-semibold text-white">Drain Management & Flood Level Monitor</p>
            <p className="text-xs text-slate-400">Manage sensor packages, water levels, and flood warning thresholds.</p>
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
          <FloodMapApp authToken={user.token} embedded />
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
        <div className="mt-3 rounded-lg border border-sky-300/20 bg-slate-950/55 px-4 py-3 text-white shadow-xl shadow-black/20 backdrop-blur">
          <div>
            <p className="text-sm font-semibold text-white">Disease Detection</p>
            <p className="text-xs text-slate-400">Open the post-flood disease detection and health risk form.</p>
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
