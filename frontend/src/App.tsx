import React, { useEffect, useState } from "react";
import FloodAlertDashboard from "./FloodAlertDashboard";
import LoginPage from "./LoginPage";
import AdminFloodMapCreator from "./AdminFloodMapCreator";
import PostFloodApp from "./PostFloodRationDistribution/PostFloodApp";

type ViewMode = 'dashboard' | 'admin' | 'post-flood';

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

  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');

  useEffect(() => {
    if (!user) {
      localStorage.removeItem('flood-user');
      localStorage.removeItem('flood-user-token');
    }
  }, [user]);

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  // Post-Flood system renders full-screen with its own layout
  if (viewMode === 'post-flood') {
    return (
      <div className="min-h-screen">
        {/* Minimal top bar for returning */}
        <div className="bg-slate-900 text-white px-4 py-2 flex justify-between items-center text-sm">
          <button
            onClick={() => setViewMode('dashboard')}
            className="flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-1.5 hover:bg-slate-600 transition-colors"
          >
            ← Back to Main
          </button>
          <div className="flex items-center gap-3">
            <span>Logged in as: <strong>{user.name}</strong> ({user.role})</span>
            <button
              onClick={() => { setUser(null); setViewMode('dashboard'); }}
              className="rounded-lg bg-red-600 px-3 py-1.5 hover:bg-red-500"
            >
              Logout
            </button>
          </div>
        </div>
        <PostFloodApp key={user.role} userRole={user.role} />
      </div>
    );
  }

  return (
    <div>
      <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
        <div>
          Logged in as: <strong>{user.name}</strong> ({user.role})
        </div>
        <div className="flex gap-2">
          {/* Post-Flood System Button */}
          <button
            onClick={() => setViewMode('post-flood')}
            className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 hover:from-cyan-500 hover:to-blue-500 font-medium shadow-lg"
          >
            🏥 Post-Flood Rescue & Ration
          </button>
          {user.role === 'admin' && (
            <button
              onClick={() => setViewMode(viewMode === 'admin' ? 'dashboard' : 'admin')}
              className="rounded-lg bg-blue-600 px-4 py-2 hover:bg-blue-500"
            >
              {viewMode === 'admin' ? 'View Dashboard' : 'Admin Flood Map Creator'}
            </button>
          )}
          <button
            onClick={() => setUser(null)}
            className="rounded-lg bg-red-600 px-4 py-2 hover:bg-red-500"
          >
            Logout
          </button>
        </div>
      </div>
      <div className="p-4">
        {viewMode === 'admin' && user.role === 'admin' ? (
          <AdminFloodMapCreator token={user.token} />
        ) : (
          <FloodAlertDashboard isAdmin={user.role === "admin"} authToken={user.token} />
        )}
      </div>
    </div>
  );
}
