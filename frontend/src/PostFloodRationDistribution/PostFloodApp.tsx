import React, { useState, useEffect } from 'react';
import type { PageName } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import SafeZones from './pages/SafeZones';
import Camps from './pages/Camps';
import CampPriority from './pages/CampPriority';
import ItemPrioritization from './pages/ItemPrioritization';
import ResourceInventory from './pages/ResourceInventory';
import RoutePlanning from './pages/RoutePlanning';
import DistributionPlans from './pages/DistributionPlans';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';
import MapVisualization from './pages/MapVisualization';
import * as api from './services/api';

interface PostFloodAppProps {
  userRole?: string;
}

export default function PostFloodApp({ userRole = 'admin' }: PostFloodAppProps) {
  const [currentPage, setCurrentPage] = useState<PageName>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load Material Icons
  useEffect(() => {
    if (!document.querySelector('link[href*="Material+Icons"]')) {
      const link = document.createElement('link');
      link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }

    // Load unread notification count
    api.getUnreadCount()
      .then(r => setUnreadCount(r.count || 0))
      .catch(() => {});
  }, []);

  // Refresh unread count when navigating away from notifications
  useEffect(() => {
    if (currentPage !== 'notifications') {
      api.getUnreadCount().then(r => setUnreadCount(r.count || 0)).catch(() => {});
    } else {
      setUnreadCount(0);
    }
  }, [currentPage]);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'map': return <MapVisualization />;
      case 'safe-zones': return <SafeZones />;
      case 'camps': return <Camps />;
      case 'camp-priority': return <CampPriority />;
      case 'item-priority': return <ItemPrioritization />;
      case 'resources': return <ResourceInventory />;
      case 'route-planning': return <RoutePlanning />;
      case 'distributions': return <DistributionPlans />;
      case 'reports': return <Reports />;
      case 'notifications': return <Notifications />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        userRole={userRole}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-800 capitalize">{currentPage.replace(/-/g, ' ')}</h2>
          </div>
          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <button
              onClick={() => setCurrentPage('notifications')}
              className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <span className="material-icons text-gray-500">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* User Role Badge */}
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-cyan-100 to-blue-100 text-cyan-800 border border-cyan-200">
              {userRole.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
