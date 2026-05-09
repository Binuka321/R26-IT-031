import React, { useEffect, useState } from 'react';
import { StatCard, Loading, PageHeader } from '../components/UIComponents';
import * as api from '../services/api';
import type { DashboardStats } from '../types';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboardStats()
      .then(res => setStats(res.data))
      .catch(() => setStats({
        totalSafeZones: 0, totalCamps: 0, highPriority: 0, medPriority: 0,
        lowPriority: 0, totalPopulation: 0, totalDistributions: 0,
        pendingDistributions: 0, completedDistributions: 0,
        totalFood: 0, totalWater: 0, totalMedicine: 0, totalSanitary: 0,
        criticalFoodCamps: 0, criticalWaterCamps: 0, criticalMedicineCamps: 0,
        criticalSanitaryCamps: 0, generatedRoutes: 0, activeRoutes: 0,
        blockedRoutes: 0
      }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading message="Loading dashboard..." />;
  if (!stats) return null;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Post-Flood Rescue & Ration Distribution Overview" icon="dashboard" />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Safe Zones" value={stats.totalSafeZones} icon="shield" color="emerald" />
        <StatCard title="Total Camps" value={stats.totalCamps} icon="holiday_village" color="blue" />
        <StatCard title="Total Population" value={stats.totalPopulation.toLocaleString()} icon="people" color="purple" />
        <StatCard title="Total Distributions" value={stats.totalDistributions} icon="local_shipping" color="indigo" />
      </div>

      {/* Priority Cards */}
      <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
        <span className="material-icons text-amber-500">analytics</span>ML Camp Priority Overview
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard title="High Priority Camps" value={stats.highPriority} icon="warning" color="rose" subtitle="Immediate support required" />
        <StatCard title="Medium Priority Camps" value={stats.medPriority} icon="priority_high" color="amber" subtitle="Support required soon" />
        <StatCard title="Low Priority Camps" value={stats.lowPriority} icon="check_circle" color="emerald" subtitle="Stable condition" />
      </div>

      <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
        <span className="material-icons text-cyan-500">psychology</span> ML Relief Priority Overview
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Critical Food Camps" value={stats.criticalFoodCamps || 0} icon="restaurant" color="amber" subtitle="ML predicted High" />
        <StatCard title="Critical Water Camps" value={stats.criticalWaterCamps || 0} icon="water_drop" color="cyan" subtitle="ML predicted High" />
        <StatCard title="Critical Medicine Camps" value={stats.criticalMedicineCamps || 0} icon="medical_services" color="rose" subtitle="ML predicted High" />
        <StatCard title="Critical Sanitary Camps" value={stats.criticalSanitaryCamps || 0} icon="sanitizer" color="purple" subtitle="ML predicted High" />
      </div>

      {/* Distribution Status */}
      <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
        <span className="material-icons text-blue-500">local_shipping</span> Distribution Status
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <StatCard title="Pending Distributions" value={stats.pendingDistributions} icon="schedule" color="amber" />
        <StatCard title="Completed Distributions" value={stats.completedDistributions} icon="check_circle" color="emerald" />
      </div>

      <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
        <span className="material-icons text-emerald-500">route</span> Algorithmic Route Planning
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard title="Generated Routes" value={stats.generatedRoutes || 0} icon="route" color="blue" subtitle="A* / Dijkstra" />
        <StatCard title="Active Routes" value={stats.activeRoutes || 0} icon="check_circle" color="emerald" />
        <StatCard title="Blocked Routes" value={stats.blockedRoutes || 0} icon="block" color="rose" />
      </div>

      {/* Resource Availability */}
      <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
        <span className="material-icons text-purple-500">warehouse</span> Resource Availability
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Food Packs" value={stats.totalFood.toLocaleString()} icon="restaurant" color="amber" />
        <StatCard title="Water Bottles" value={stats.totalWater.toLocaleString()} icon="water_drop" color="cyan" />
        <StatCard title="Medicine Kits" value={stats.totalMedicine.toLocaleString()} icon="medical_services" color="rose" />
        <StatCard title="Sanitary Kits" value={stats.totalSanitary.toLocaleString()} icon="sanitizer" color="purple" />
      </div>
    </div>
  );
}
