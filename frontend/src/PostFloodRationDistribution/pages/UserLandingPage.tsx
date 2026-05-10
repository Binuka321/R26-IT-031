import React, { useEffect, useState } from 'react';
import { PageHeader, Loading } from '../components/UIComponents';
import * as api from '../services/api';

interface UserLandingPageProps {
  onNavigate: (page: any) => void;
}

export default function UserLandingPage({ onNavigate }: UserLandingPageProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboardStats()
      .then(res => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading message="Preparing your safety overview..." />;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader 
        title="Public Safety & Relief Portal" 
        subtitle="Access information about safe zones, camps, and ongoing relief efforts."
        icon="volunteer_activism"
      />

      {/* Hero Section */}
      <div className="mb-8 rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-500 p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex-1">
            <h2 className="text-3xl font-bold mb-4">Stay Informed, Stay Safe</h2>
            <p className="text-blue-50 mb-6 text-lg">
              Our automated system helps you find the nearest safe zones and provides real-time updates on relief operations in your area.
            </p>
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => onNavigate('map')}
                className="px-6 py-3 bg-white text-blue-600 rounded-xl font-bold shadow-lg hover:bg-blue-50 transition-all flex items-center gap-2"
              >
                <span className="material-icons">map</span> Open Safety Map
              </button>
              <button 
                onClick={() => onNavigate('safe-zones')}
                className="px-6 py-3 bg-blue-700/30 backdrop-blur-md text-white border border-blue-400/30 rounded-xl font-bold hover:bg-blue-700/40 transition-all flex items-center gap-2"
              >
                <span className="material-icons">shield</span> Find Safe Zones
              </button>
              <button 
                onClick={() => onNavigate('need-reports')}
                className="px-6 py-3 bg-rose-500 text-white rounded-xl font-bold shadow-lg hover:bg-rose-600 transition-all flex items-center gap-2"
              >
                <span className="material-icons">volunteer_activism</span> Report Urgent Need
              </button>
            </div>
          </div>
          <div className="hidden md:block">
            <span className="material-icons text-[160px] opacity-20">emergency</span>
          </div>
        </div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-cyan-400/20 rounded-full blur-3xl"></div>
      </div>

      {/* Emergency Quick Actions */}
      <div className="mb-12">
        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span className="material-icons text-rose-500">flash_on</span>
          Emergency Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Request Food', icon: 'restaurant', color: 'bg-orange-500', type: 'Food' },
            { label: 'Medical Help', icon: 'medical_services', color: 'bg-rose-500', type: 'Medical' },
            { label: 'Rescue Team', icon: 'emergency', color: 'bg-red-600', type: 'Rescue' },
            { label: 'Report Hazard', icon: 'warning', color: 'bg-amber-500', type: 'Road Blockage' },
          ].map(action => (
            <button
              key={action.type}
              onClick={() => onNavigate('need-reports', { type: action.type })}
              className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
            >
              <div className={`p-3 rounded-xl ${action.color} text-white group-hover:scale-110 transition-transform`}>
                <span className="material-icons text-2xl">{action.icon}</span>
              </div>
              <span className="text-sm font-bold text-gray-700">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Status Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-md border border-emerald-100 flex items-center gap-4">
          <div className="p-4 rounded-xl bg-emerald-50 text-emerald-600">
            <span className="material-icons text-3xl">shield</span>
          </div>
          <div>
            <h4 className="text-2xl font-bold text-gray-800">{stats?.totalSafeZones || 0}</h4>
            <p className="text-gray-500 text-sm font-medium">Active Safe Zones</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-md border border-blue-100 flex items-center gap-4">
          <div className="p-4 rounded-xl bg-blue-50 text-blue-600">
            <span className="material-icons text-3xl">holiday_village</span>
          </div>
          <div>
            <h4 className="text-2xl font-bold text-gray-800">{stats?.totalCamps || 0}</h4>
            <p className="text-gray-500 text-sm font-medium">Relief Camps</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-md border border-purple-100 flex items-center gap-4">
          <div className="p-4 rounded-xl bg-purple-50 text-purple-600">
            <span className="material-icons text-3xl">local_shipping</span>
          </div>
          <div>
            <h4 className="text-2xl font-bold text-gray-800">{stats?.totalDistributions || 0}</h4>
            <p className="text-gray-500 text-sm font-medium">Relief Shipments</p>
          </div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="group bg-white p-1 rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer border border-gray-100" onClick={() => onNavigate('map')}>
          <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="material-icons text-4xl text-cyan-500 group-hover:scale-110 transition-transform">explore</span>
              <span className="material-icons text-gray-300 group-hover:text-cyan-500">arrow_forward</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Interactive Risk Map</h3>
            <p className="text-gray-500 flex-grow">Visualize flood risks, safe zone boundaries, and camp locations in real-time using our AI-powered mapping system.</p>
          </div>
        </div>

        <div className="group bg-white p-1 rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer border border-gray-100" onClick={() => onNavigate('notifications')}>
          <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="material-icons text-4xl text-rose-500 group-hover:scale-110 transition-transform">notifications_active</span>
              <span className="material-icons text-gray-300 group-hover:text-rose-500">arrow_forward</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Real-time Alerts</h3>
            <p className="text-gray-500 flex-grow">Get immediate notifications about high-priority areas, stock levels, and emergency evacuations.</p>
          </div>
        </div>

        <div className="group bg-white p-1 rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer border border-gray-100" onClick={() => onNavigate('need-reports')}>
          <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="material-icons text-4xl text-emerald-500 group-hover:scale-110 transition-transform">volunteer_activism</span>
              <span className="material-icons text-gray-300 group-hover:text-emerald-500">arrow_forward</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Request Assistance</h3>
            <p className="text-gray-500 flex-grow">Directly report your location and needs (food, water, medical) to the relief coordination teams.</p>
          </div>
        </div>

        <div className="group bg-white p-1 rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer border border-gray-100" onClick={() => onNavigate('safe-zones')}>
          <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="material-icons text-4xl text-blue-500 group-hover:scale-110 transition-transform">shield</span>
              <span className="material-icons text-gray-300 group-hover:text-blue-500">arrow_forward</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Safe Zone Directory</h3>
            <p className="text-gray-500 flex-grow">Browse verified safe zones with capacity information and road access status.</p>
          </div>
        </div>
      </div>
      
      {/* Footer Support */}
      <div className="mt-12 p-8 rounded-3xl bg-gray-100 border border-gray-200 text-center">
        <h3 className="font-bold text-gray-800 mb-2">Need Direct Assistance?</h3>
        <p className="text-gray-600 mb-4">Please contact the disaster management center or visit your nearest relief camp coordinator.</p>
        <div className="flex justify-center gap-6 text-sm font-bold text-blue-600">
          <span className="flex items-center gap-1"><span className="material-icons text-sm">phone</span> Emergency: 117</span>
          <span className="flex items-center gap-1"><span className="material-icons text-sm">email</span> help@floodrelief.lk</span>
        </div>
      </div>
    </div>
  );
}
