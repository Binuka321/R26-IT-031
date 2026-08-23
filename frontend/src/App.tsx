import React, { useEffect, useState } from "react";
import LoginPage from "./LoginPage";
import AdminFloodMapCreator from "./AdminFloodMapCreator";
import PostFloodApp from "./PostFloodRationDistribution/PostFloodApp";
import OperationsCenter from "./pages/OperationsCenter";
// @ts-ignore
import FloodMapApp from "./FloodMap/FloodMapApp";
import { Dashboard } from "./Drain_management/Dashboard";

type ViewMode = 'operations-center' | 'admin' | 'post-flood' | 'drain-management' | 'disease-management' | 'map';

export default function App() {
  const [user, setUser] = useState<{ username: string; name: string; role: string; token: string } | null>(() => {
    const parsed = localStorage.getItem('flood-user');
    const token = localStorage.getItem('flood-user-token');
    if (parsed && token) {
      const userObj = JSON.parse(parsed);
      return { ...userObj, token };
    }
    return null;
  });

  const [viewMode, setViewMode] = useState<ViewMode>('operations-center');

  useEffect(() => {
    if (!user) {
      localStorage.removeItem('flood-user');
      localStorage.removeItem('flood-user-token');
    }
  }, [user]);

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  // Drain Management (Admin Only)
  if (viewMode === 'drain-management' && user.role === 'admin') {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
        <header className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-4 py-3 text-white">
          <button
            type="button"
            onClick={() => setViewMode('operations-center')}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-600"
          >
            ← Back to Operations Center
          </button>
          <span className="text-sm text-slate-300">Drain Management & Flood Level Monitor</span>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <Dashboard authToken={user.token} />
        </div>
      </div>
    );
  }

  // Post-Flood Rescue & Ration Distribution
  if (viewMode === 'ration-distribution' || viewMode === 'post-flood') {
    return (
      <div className="min-h-screen">
        <div className="bg-slate-900 text-white px-4 py-2 flex justify-between items-center text-sm">
          <button
            onClick={() => setViewMode('operations-center')}
            className="flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-1.5 hover:bg-slate-600 transition-colors"
          >
            ← Back to Operations Center
          </button>
          <div className="flex items-center gap-3">
            <span>Logged in as: <strong>{user.name}</strong> ({user.role})</span>
            <button
              onClick={() => { setUser(null); setViewMode('operations-center'); }}
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

  // Flood Map Full Screen
  if (viewMode === 'map') {
    return (
      <FloodMapApp
        onBack={() => setViewMode('operations-center')}
        authToken={user.token}
      />
    );
  }

  // Main Operations Center
  return (
    <OperationsCenter
      authToken={user.token}
      isAdmin={user.role === 'admin'}
      onLogout={() => setUser(null)}
      onNavigate={(page) => {
        if (page === 'drain-management') setViewMode('drain-management');
        else if (page === 'ration-distribution') setViewMode('ration-distribution');
        else if (page === 'disease-management') setViewMode('disease-management');
        else if (page === 'map') setViewMode('map');
        else setViewMode('operations-center');
      }}
    />
  );
}
