import { Permissions } from '../utils/permissions';
import { useLanguage } from '../../LanguageContext';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Boxes,
  ChevronLeft,
  ChevronRight,
  X,
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
  Building2,
  TrendingUp,
  Truck,
  Warehouse,
  Waves,
} from 'lucide-react';

const menuItems: { page: PageName; label: string; labelSi: string; icon: LucideIcon }[] = [
  { page: 'user-home', label: 'Safety Portal', labelSi: 'ආරක්ෂක ද්වාරය', icon: LifeBuoy },
  { page: 'dashboard', label: 'Dashboard', labelSi: 'ප්‍රධාන පුවරුව', icon: LayoutDashboard },
  { page: 'map', label: 'Map View', labelSi: 'සිතියම් දර්ශනය', icon: Map },
  { page: 'safe-zones', label: 'Safe Zones', labelSi: 'ආරක්ෂිත ස්ථාන', icon: Shield },
  { page: 'camps', label: 'Camps', labelSi: 'කඳවුරු', icon: Home },
  { page: 'camp-priority', label: 'Priority Prediction', labelSi: 'ප්‍රමුඛතා පුරෝකථනය', icon: TrendingUp },
  { page: 'item-priority', label: 'Item Prioritization', labelSi: 'අයිතම ප්‍රමුඛතා', icon: Boxes },
  { page: 'resources', label: 'Resource Inventory', labelSi: 'සම්පත් ලේඛනය', icon: Warehouse },
  { page: 'distribution-centers', label: 'Distribution Centers', labelSi: 'බෙදාහැරීම් මධ්‍යස්ථාන', icon: Store },
  { page: 'rescue-centers', label: 'Rescue Centers', labelSi: 'ගලවාගැනීම් මධ්‍යස්ථාන', icon: Building2 },
  { page: 'route-planning', label: 'Route Planning', labelSi: 'මාර්ග සැලසුම්', icon: Route },
  { page: 'rescue-operations', label: 'Rescue Operations', labelSi: 'ගලවාගැනීම් මෙහෙයුම්', icon: Siren },
  { page: 'distributions', label: 'Distributions', labelSi: 'බෙදාහැරීම්', icon: Truck },
  { page: 'ml-retraining', label: 'ML Retraining', labelSi: 'ML නැවත පුහුණු කිරීම', icon: RadioTower },
  { page: 'reports', label: 'Reports', labelSi: 'වාර්තා', icon: ClipboardList },
  { page: 'notifications', label: 'Notifications', labelSi: 'දැනුම්දීම්', icon: Bell },
  { page: 'need-reports', label: 'Need Reports', labelSi: 'අවශ්‍යතා වාර්තා', icon: PackageCheck },
];

interface SidebarProps {
  currentPage: PageName;
  onNavigate: (page: PageName) => void;
  userRole: string;
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ currentPage, onNavigate, userRole, collapsed, onToggle, mobileOpen = false, onMobileClose }: SidebarProps) {
  const { t } = useLanguage();
  const filteredMenuItems = menuItems.filter(i => Permissions.canAccessPage(userRole, i.page));

  return (
    <aside className={`post-flood-sidebar fixed inset-y-0 left-0 z-50 w-72 max-w-[84vw] transform transition-all duration-300 md:sticky md:top-0 md:z-auto md:max-w-none md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'md:w-16' : 'md:w-64'} bg-slate-950 text-white flex flex-col min-h-screen border-r border-slate-800`}>
      {/* Header */}
      <div className="border-b border-slate-800 p-4">
        <div className="flex items-center justify-between gap-2">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="post-flood-sidebar-brand grid h-9 w-9 place-items-center rounded-lg bg-cyan-500 text-slate-950">
                <Waves className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-bold leading-tight text-white">{t('Relief Command', 'සහන මෙහෙයුම්')}</h2>
                <p className="text-xs text-slate-400">{t('Aid distribution', 'ආධාර බෙදාදීම')}</p>
              </div>
            </div>
          )}
          <button onClick={onMobileClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white md:hidden">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <button onClick={onToggle} className="hidden rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white md:block">
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
          let label = t(item.label, item.labelSi);
          if (item.page === 'need-reports') {
            label = Permissions.isPublicUser(userRole)
              ? t('My Reports', 'මගේ වාර්තා')
              : t('Citizen Reports', 'පුරවැසි වාර්තා');
          }
          return (
            <button
              key={item.page}
              onClick={() => {
                onNavigate(item.page);
                onMobileClose?.();
              }}
              title={collapsed ? label : undefined}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
                ${isActive
                  ? 'post-flood-sidebar-active bg-cyan-500 text-slate-950 shadow-sm'
                  : 'post-flood-sidebar-item text-slate-400 hover:bg-slate-800 hover:text-white'}`}
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
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('System Status', 'පද්ධති තත්ත්වය')}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {t('Post-flood module active', 'ගංවතුරෙන් පසු මොඩියුලය සක්‍රීයයි')}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
