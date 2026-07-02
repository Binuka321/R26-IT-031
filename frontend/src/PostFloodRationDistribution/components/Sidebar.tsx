import { Permissions } from '../utils/permissions';

const menuItems: { page: PageName; label: string; icon: string }[] = [
  { page: 'user-home', label: 'Safety Portal', icon: 'volunteer_activism' },
  { page: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { page: 'map', label: 'Map View', icon: 'map' },
  { page: 'safe-zones', label: 'Safe Zones', icon: 'shield' },
  { page: 'camps', label: 'Camps', icon: 'holiday_village' },
  { page: 'camp-priority', label: 'Priority Prediction', icon: 'analytics' },
  { page: 'item-priority', label: 'Item Prioritization', icon: 'inventory' },
  { page: 'resources', label: 'Resource Inventory', icon: 'warehouse' },
  { page: 'route-planning', label: 'Route Planning', icon: 'route' },
  { page: 'rescue-operations', label: 'Rescue Operations', icon: 'emergency_share' },
  { page: 'distributions', label: 'Distributions', icon: 'local_shipping' },
  { page: 'reports', label: 'Reports', icon: 'assessment' },
  { page: 'notifications', label: 'Notifications', icon: 'notifications' },
  { page: 'need-reports', label: 'Need Reports', icon: 'volunteer_activism' },
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
                  <span className="material-icons text-xl">flood</span>
                </div>
                <div>
                  <h2 className="text-sm font-bold leading-tight text-white">Relief Command</h2>
                  <p className="text-xs text-slate-400">Ration distribution</p>
                </div>
              </div>
            </div>
          )}
          <button onClick={onToggle} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
            <span className="material-icons text-lg text-slate-400">{collapsed ? 'chevron_right' : 'chevron_left'}</span>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {filteredMenuItems.map(item => {
          const isActive = currentPage === item.page;
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
              <span className="material-icons text-lg">{item.icon}</span>
              {!collapsed && <span>{label}</span>}
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
