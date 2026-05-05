import React from 'react';
import type { PageName } from '../types';

const menuItems: { page: PageName; label: string; icon: string; roles: string[] }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['admin', 'disaster_officer', 'camp_coordinator', 'rescue_team', 'user'] },
  { page: 'map', label: 'Map View', icon: 'map', roles: ['admin', 'disaster_officer', 'camp_coordinator', 'rescue_team', 'user'] },
  { page: 'safe-zones', label: 'Safe Zones', icon: 'shield', roles: ['admin', 'disaster_officer', 'camp_coordinator', 'rescue_team', 'user'] },
  { page: 'camps', label: 'Camps', icon: 'holiday_village', roles: ['admin', 'disaster_officer', 'camp_coordinator', 'rescue_team', 'user'] },
  { page: 'camp-priority', label: 'Priority Prediction', icon: 'analytics', roles: ['admin', 'disaster_officer'] },
  { page: 'item-priority', label: 'Item Prioritization', icon: 'inventory', roles: ['admin', 'disaster_officer'] },
  { page: 'resources', label: 'Resource Inventory', icon: 'warehouse', roles: ['admin', 'disaster_officer', 'camp_coordinator'] },
  { page: 'route-planning', label: 'Route Planning', icon: 'route', roles: ['admin', 'disaster_officer'] },
  { page: 'distributions', label: 'Distributions', icon: 'local_shipping', roles: ['admin', 'disaster_officer', 'camp_coordinator', 'rescue_team'] },
  { page: 'reports', label: 'Reports', icon: 'assessment', roles: ['admin', 'disaster_officer'] },
  { page: 'notifications', label: 'Notifications', icon: 'notifications', roles: ['admin', 'disaster_officer', 'camp_coordinator', 'rescue_team', 'user'] },
];

interface SidebarProps {
  currentPage: PageName;
  onNavigate: (page: PageName) => void;
  userRole: string;
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ currentPage, onNavigate, userRole, collapsed, onToggle }: SidebarProps) {
  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} transition-all duration-300 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col min-h-screen border-r border-cyan-500/10`}>
      {/* Header */}
      <div className="p-4 border-b border-cyan-500/20">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div>
              <h2 className="text-sm font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Post-Flood Rescue</h2>
              <p className="text-xs text-slate-400">& Ration Distribution</p>
            </div>
          )}
          <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors">
            <span className="material-icons text-lg text-slate-400">{collapsed ? 'chevron_right' : 'chevron_left'}</span>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {menuItems.filter(i => i.roles.includes(userRole?.toLowerCase())).map(item => {
          const isActive = currentPage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${isActive
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
            >
              <span className={`material-icons text-lg ${isActive ? 'text-cyan-400' : ''}`}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-cyan-500/20">
          <div className="text-xs text-slate-500 text-center">
            Post Flood Rescue & Ration Distribution management System<br />
            <span className="text-cyan-500/60"> 2026 </span>
          </div>
        </div>
      )}
    </aside>
  );
}
