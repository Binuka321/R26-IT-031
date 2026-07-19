import React, { useState } from "react";
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
  const [showFloodMap, setShowFloodMap] = useState(false);
  const [showRationDistribution, setShowRationDistribution] = useState(false);
  const [showDrainManagement, setShowDrainManagement] = useState(false);

  if (showFloodMap) {
    return <FloodMapApp onBack={() => setShowFloodMap(false)} authToken={authToken} />;
  }

  if (showRationDistribution) {
    return <PostFloodRationDistribution />;
  }

  if (showDrainManagement && isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <header className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-slate-900 px-4 py-3 text-white">
          <button
            type="button"
            onClick={() => setShowDrainManagement(false)}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-600"
          >
            ← Main menu
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-screen blur-3xl opacity-20 animate-pulse" style={{animationDuration: '4s'}}></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-screen blur-3xl opacity-20 animate-pulse" style={{animationDuration: '6s'}}></div>
        <div className="absolute top-1/2 right-0 w-80 h-80 bg-cyan-500 rounded-full mix-blend-screen blur-3xl opacity-15 animate-pulse" style={{animationDuration: '5s'}}></div>
      </div>

      <div className="relative z-10 text-center mb-20">
        <div className="inline-block mb-6">
          <h1 className="text-7xl font-black mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-lg">
            FLOOD MANAGER
          </h1>
        </div>
        <p className="text-gray-300 text-xl max-w-lg mx-auto font-light tracking-wide">
          Advanced flood monitoring and management system
        </p>
        <div className="h-1 w-32 mx-auto mt-6 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full"></div>
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-8 lg:gap-10 max-w-2xl w-full px-4 mb-12">
        <button 
          onClick={() => setShowFloodMap(true)}
          className="group relative w-full aspect-square rounded-3xl font-bold text-2xl transition-all duration-500 transform hover:scale-110 bg-gradient-to-br from-blue-600 to-blue-800 shadow-2xl flex items-center justify-center border border-blue-300/50 overflow-hidden cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="absolute inset-0 bg-blue-500 opacity-0 group-hover:opacity-30 blur-2xl transition-opacity duration-500"></div>
          <span className="relative z-10 group-hover:drop-shadow-lg transition-all duration-500">Flood map</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowDrainManagement(true)}
            className="group relative w-full aspect-square rounded-3xl font-bold text-xl sm:text-2xl transition-all duration-500 transform hover:scale-110 bg-gradient-to-br from-green-600 to-green-800 shadow-2xl flex items-center justify-center border border-green-300/50 overflow-hidden cursor-pointer px-2 text-center leading-tight"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-green-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute inset-0 bg-green-500 opacity-0 group-hover:opacity-30 blur-2xl transition-opacity duration-500"></div>
            <span className="relative z-10 group-hover:drop-shadow-lg transition-all duration-500">Drain management and flood level monitor</span>
          </button>
        )}

        <button className="group relative w-full aspect-square rounded-3xl font-bold text-2xl transition-all duration-500 transform hover:scale-110 bg-gradient-to-br from-purple-600 to-purple-800 shadow-2xl flex items-center justify-center border border-purple-300/50 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="absolute inset-0 bg-purple-500 opacity-0 group-hover:opacity-30 blur-2xl transition-opacity duration-500"></div>
          <span className="relative z-10 group-hover:drop-shadow-lg transition-all duration-500">Disease management</span>
        </button>

        <button
          onClick={() => setShowRationDistribution(true)}
          className={`group relative w-full aspect-square rounded-3xl font-bold text-2xl transition-all duration-500 transform hover:scale-110 bg-gradient-to-br from-orange-600 to-orange-800 shadow-2xl flex items-center justify-center border border-orange-300/50 overflow-hidden ${!isAdmin ? "col-span-2 justify-self-center max-w-sm w-full" : ""}`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="absolute inset-0 bg-orange-500 opacity-0 group-hover:opacity-30 blur-2xl transition-opacity duration-500"></div>
          <span className="relative z-10 group-hover:drop-shadow-lg transition-all duration-500">Post flood ration distribution</span>
        </button>
      </div>

      <footer className="relative z-10 text-gray-400 text-sm tracking-widest">© 2026 SMART FLOOD MANAGEMENT</footer>
    </div>
  );
}
