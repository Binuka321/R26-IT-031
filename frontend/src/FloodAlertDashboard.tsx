import React, { useState } from "react";
import OperationsCenter from "./pages/OperationsCenter";
// @ts-ignore
import FloodMapApp from "./FloodMap/FloodMapApp.jsx";
import PostFloodRationDistribution from "./PostFloodRationDistribution/PostFloodRationDistribution";
import { Dashboard } from "./Drain_management/Dashboard";

export interface FloodAlertDashboardProps {
  /** Drain management is available only for admin accounts */
  isAdmin?: boolean;
  /** JWT for sensor-package API calls */
  authToken: string;
}

export default function FloodAlertDashboard({ isAdmin = false, authToken }: FloodAlertDashboardProps) {
  const [currentView, setCurrentView] = useState<'operations' | 'map' | 'ration' | 'drain'>('operations');

  // Legacy view: Flood Map
  if (currentView === 'map') {
    return <FloodMapApp onBack={() => setCurrentView('operations')} authToken={authToken} />;
  }

  // Legacy view: Ration Distribution
  if (currentView === 'ration') {
    return <PostFloodRationDistribution />;
  }

  // Legacy view: Drain Management (Admin Only)
  if (currentView === 'drain' && isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <header className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-slate-900 px-4 py-3 text-white">
          <button
            type="button"
            onClick={() => setCurrentView('operations')}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-600"
          >
            ← Back to Operations Center
          </button>
          <span className="text-sm text-slate-300">
            Drain management & flood level monitor
          </span>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <Dashboard authToken={authToken} />
        </div>
      </div>
    );
  }

  // Main view: Modern Emergency Operations Center
  return (
    <OperationsCenter
      authToken={authToken}
      isAdmin={isAdmin}
      onNavigate={(page) => {
        if (page === 'map') setCurrentView('map');
        else if (page === 'ration-distribution') setCurrentView('ration');
        else if (page === 'drain-management' && isAdmin) setCurrentView('drain');
        else setCurrentView('operations');
      }}
    />
  );
}
