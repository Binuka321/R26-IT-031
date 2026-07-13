import { Permissions } from '../utils/permissions';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Home,
  LayoutDashboard,
  LifeBuoy,
  Map,
  PackageCheck,
  RadioTower,
  Route,
  Shield,
  Siren,
  Store,
  TrendingUp,
  Truck,
  Warehouse,
  Waves,
} from 'lucide-react';

const menuItems: { page: PageName; label: string; icon: LucideIcon }[] = [
  { page: 'user-home', label: 'Safety Portal', icon: LifeBuoy },
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'map', label: 'Map View', icon: Map },
  { page: 'safe-zones', label: 'Safe Zones', icon: Shield },
  { page: 'camps', label: 'Camps', icon: Home },
  { page: 'camp-priority', label: 'Priority Prediction', icon: TrendingUp },
  { page: 'item-priority', label: 'Item Prioritization', icon: Boxes },
  { page: 'resources', label: 'Resource Inventory', icon: Warehouse },
  { page: 'distribution-centers', label: 'Distribution Centers', icon: Store },
  { page: 'route-planning', label: 'Route Planning', icon: Route },
  { page: 'rescue-operations', label: 'Rescue Operations', icon: Siren },
  { page: 'distributions', label: 'Distributions', icon: Truck },
  { page: 'ml-retraining', label: 'ML Retraining', icon: RadioTower },
  { page: 'reports', label: 'Reports', icon: ClipboardList },
  { page: 'notifications', label: 'Notifications', icon: Bell },
  { page: 'need-reports', label: 'Need Reports', icon: PackageCheck },
];

interface SidebarProps {
  currentPage: PageName;
  onNavigate: (page: PageName) => void;
  userRole: string;
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ currentPage, onNavigate, userRole, collapsed, onToggle }: SidebarProps) {
  const filteredMenuItems = menuItems.filter(i => Permissions.canAccessPage(userRole, i.page));

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} transition-all duration-300 bg-slate-950 text-white flex flex-col min-h-screen border-r border-slate-800`}>
      {/* Header */}
      <div className="border-b border-slate-800 p-4">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-500 text-slate-950">
                  <Waves className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-sm font-bold leading-tight text-white">Relief Command</h2>
                  <p className="text-xs text-slate-400">Ration distribution</p>
                </div>
              </div>
            </div>
          )}
          <button onClick={onToggle} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
            {collapsed ? (
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            ) : (
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {filteredMenuItems.map(item => {
          const isActive = currentPage === item.page;
          const Icon = item.icon;
          let label = item.label;
          if (item.page === 'need-reports') {
            label = Permissions.isPublicUser(userRole) ? 'My Reports' : 'Citizen Reports';
          }
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              title={collapsed ? label : undefined}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
                ${isActive
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-slate-800 p-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">System Status</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Post-flood module active
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
