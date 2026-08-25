import React, { useEffect, useState } from "react";
import PublicHome from "./PublicHome";
import MainDashboard from "./MainDashboard";
import PostFloodApp from "./PostFloodRationDistribution/PostFloodApp";
import OperationsCenter from "./pages/OperationsCenter";
// @ts-ignore
import FloodMapApp from "./FloodMap/FloodMapApp";
import { Dashboard } from "./Drain_management/Dashboard";
import DiseaseDetectionForm from "./Disease-detection/Form";
import BrandLogo from "./components/BrandLogo";

export type ViewMode =
  | "main-dashboard"
  | "operations-center"
  | "post-flood"
  | "drain-management"
  | "disease-management"
  | "map";

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

  if (viewMode === "drain-management" && user.role === "admin") {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
        <header className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setViewMode("main-dashboard")}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-600"
            >
              Back to Dashboard
            </button>
            <span className="text-sm text-slate-300">Drain Management & Flood Level Monitor</span>
          </div>
          <BrandLogo compact surface="light" markClassName="h-14 w-44" />
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <Dashboard authToken={user.token} />
        </div>
      </div>
    );
  }

  if (viewMode === "post-flood") {
    return (
      <div className="min-h-screen">
        <div className="bg-slate-900 text-white px-4 py-2 flex justify-between items-center text-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewMode("main-dashboard")}
              className="flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-1.5 hover:bg-slate-600 transition-colors"
            >
              Back to Dashboard
            </button>
            <BrandLogo compact surface="light" markClassName="h-14 w-44" />
          </div>
          <div className="flex items-center gap-3">
            <span>Logged in as: <strong>{user.name}</strong> ({user.role})</span>
            <button
              onClick={logout}
              className="rounded-lg bg-red-600 px-3 py-1.5 hover:bg-red-500"
            >
              Logout
            </button>
          </div>
        </div>
        <PostFloodApp userRole={user.role} />
      </div>
    );
  }

  if (viewMode === "map") {
    return (
      <FloodMapApp
        onBack={() => setViewMode("main-dashboard")}
        authToken={user.token}
      />
    );
  }

  if (viewMode === "disease-management") {
    return (
      <div className="min-h-screen bg-slate-100">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 text-slate-900">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setViewMode("main-dashboard")}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Back to Dashboard
            </button>
            <span className="text-sm text-slate-600">Disease Detection</span>
          </div>
          <BrandLogo compact markClassName="h-14 w-44" />
        </header>
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
