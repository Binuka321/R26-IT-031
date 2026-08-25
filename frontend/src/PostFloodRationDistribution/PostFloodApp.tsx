import React, { Suspense, lazy, useState, useEffect, useRef } from "react";
import type { PageName } from "./types";
import Sidebar from "./components/Sidebar";
import { Loading } from "./components/UIComponents";
import * as api from "./services/api";
import { Permissions } from "./utils/permissions";
import {
  filterOutSeedCamps,
  filterOutSeedSafeZones,
  filterOutSeedResources,
} from "./utils/filterSeedData";
import { getOfflineQueue, syncOfflineQueue } from "./utils/offlineQueue";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const SafeZones = lazy(() => import("./pages/SafeZones"));
const Camps = lazy(() => import("./pages/Camps"));
const CampPriority = lazy(() => import("./pages/CampPriority"));
const ItemPrioritization = lazy(() => import("./pages/ItemPrioritization"));
const ResourceInventory = lazy(() => import("./pages/ResourceInventory"));
const DistributionCenters = lazy(() => import("./pages/DistributionCenters"));
const RescueCenters = lazy(() => import("./pages/RescueCenters"));
const RoutePlanning = lazy(() => import("./pages/RoutePlanning"));
const RescueOperations = lazy(() => import("./pages/RescueOperations"));
const DistributionPlans = lazy(() => import("./pages/DistributionPlans"));
const MLRetraining = lazy(() => import("./pages/MLRetraining"));
const Reports = lazy(() => import("./pages/Reports"));
const Notifications = lazy(() => import("./pages/Notifications"));
const MapVisualization = lazy(() => import("./pages/MapVisualization"));
const UserLandingPage = lazy(() => import("./pages/UserLandingPage"));
const NeedReports = lazy(() => import("./pages/NeedReports"));

interface PostFloodAppProps {
  userRole?: string;
}

type NavEntry = {
  page: PageName;
  data: any;
};

export default function PostFloodApp({ userRole: rawRole }: PostFloodAppProps) {
  const [userRole, setUserRole] = useState(rawRole || "user");
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("post-flood-theme");
    return stored === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    if (!rawRole) {
      const stored = localStorage.getItem("flood-user");
      if (stored) {
        try {
          const user = JSON.parse(stored);
          if (user.role) setUserRole(user.role);
        } catch (e) {}
      }
    } else {
      setUserRole(rawRole);
    }
  }, [rawRole]);

  const [currentPage, setCurrentPage] = useState<PageName>(
    userRole.toLowerCase() === 'user' ? 'user-home' : 'dashboard'
  );
  const [pageHistory, setPageHistory] = useState<NavEntry[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Global Search State
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [navData, setNavData] = useState<any>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Load Material Icons & Notifications
  useEffect(() => {
    if (!document.querySelector('link[href*="Material+Icons"]')) {
      const link = document.createElement("link");
      link.href = "https://fonts.googleapis.com/icon?family=Material+Icons";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }

    api
      .getUnreadCount()
      .then((r) => setUnreadCount(r.count || 0))
      .catch(() => {});

    // Warm up the server
    api.getPostFloodMlStatus().catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem("post-flood-theme", themeMode);
  }, [themeMode]);

  useEffect(() => {
    const syncWhenOnline = () => {
      if (navigator.onLine && getOfflineQueue().length > 0) {
        syncOfflineQueue().catch(() => {});
      }
    };
    window.addEventListener("online", syncWhenOnline);
    syncWhenOnline();
    return () => window.removeEventListener("online", syncWhenOnline);
  }, []);

  const refreshUnreadCount = () => {
    api
      .getUnreadCount()
      .then((r) => setUnreadCount(r.count || 0))
      .catch(() => {});
  };

  // Refresh unread count when navigating away from notifications
  useEffect(() => {
    if (currentPage !== "notifications") {
      refreshUnreadCount();
    } else {
      setUnreadCount(0);
    }
  }, [currentPage]);

  useEffect(() => {
    const interval = window.setInterval(refreshUnreadCount, 30000);
    return () => window.clearInterval(interval);
  }, []);

  // Global Search Logic
  useEffect(() => {
    if (!globalSearch.trim()) {
      setSearchResults([]);
      return;
    }
    const delayFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const [campsRes, zonesRes, resourcesRes, distRes] = await Promise.all([
          api.getCamps().catch(() => ({ data: [] })),
          api.getSafeZones().catch(() => ({ data: [] })),
          api.getResources().catch(() => ({ data: [] })),
          api.getDistributions().catch(() => ({ data: [] })),
        ]);
        // filter demo seed data
        try {
          campsRes.data = campsRes.data
            ? filterOutSeedCamps(campsRes.data)
            : [];
          zonesRes.data = zonesRes.data
            ? filterOutSeedSafeZones(zonesRes.data)
            : [];
          resourcesRes.data = resourcesRes.data
            ? filterOutSeedResources(resourcesRes.data)
            : [];
        } catch (e) {
          // ignore and use raw data
        }

        const q = globalSearch.toLowerCase();
        const results: any[] = [];

        campsRes.data?.forEach((c: any) => {
          if (
            c.camp_name?.toLowerCase().includes(q) ||
            c.contact_person?.toLowerCase().includes(q)
          ) {
            results.push({
              id: c._id,
              title: c.camp_name,
              subtitle: `Camp - Pop: ${c.population}`,
              type: "camps",
              icon: "holiday_village",
            });
          }
        });

        zonesRes.data?.forEach((z: any) => {
          if (
            z.name?.toLowerCase().includes(q) ||
            z.location_description?.toLowerCase().includes(q)
          ) {
            results.push({
              id: z._id,
              title: z.name,
              subtitle: `Safe Zone - Cap: ${z.capacity}`,
              type: "safe-zones",
              icon: "shield",
            });
          }
        });

        resourcesRes.data?.forEach((r: any) => {
          if (r.item_name?.toLowerCase().includes(q)) {
            results.push({
              id: r._id,
              title: r.item_name,
              subtitle: `Resource - ${r.quantity_available} ${r.unit}`,
              type: "resources",
              icon: "warehouse",
            });
          }
        });

        distRes.data?.forEach((d: any) => {
          const campName =
            typeof d.camp_id === "object" ? d.camp_id.camp_name : "";
          if (
            campName?.toLowerCase().includes(q) ||
            d.status?.toLowerCase().includes(q)
          ) {
            results.push({
              id: d._id,
              title: `Distribution: ${campName}`,
              subtitle: `Status: ${d.status}`,
              type: "distributions",
              icon: "local_shipping",
            });
          }
        });

        setSearchResults(results.slice(0, 8));
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(delayFn);
  }, [globalSearch]);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setGlobalSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigateWithData = (page: PageName, data: any = null, replace = false) => {
    if (page === currentPage && data === navData) return;

    if (!replace) {
      setPageHistory((history) => [
        ...history,
        { page: currentPage, data: navData },
      ].slice(-12));
    }
    setNavData(data);
    setCurrentPage(page);
  };

  const goBack = () => {
    const previous = pageHistory[pageHistory.length - 1];
    if (!previous) return;

    setCurrentPage(previous.page);
    setNavData(previous.data);
    setPageHistory((history) => history.slice(0, -1));
  };

  const renderPage = () => {
    const isAllowed = Permissions.canAccessPage(userRole, currentPage);

    if (!isAllowed) {
      return userRole.toLowerCase() === 'user'
        ? <UserLandingPage onNavigate={navigateWithData} />
        : <Dashboard onNavigate={navigateWithData} />;
    }

    switch (currentPage) {
      case "user-home":
        return <UserLandingPage onNavigate={navigateWithData} />;
      case "dashboard":
        return <Dashboard onNavigate={navigateWithData} />;
      case "map":
        return <MapVisualization userRole={userRole} />;
      case "safe-zones":
        return <SafeZones userRole={userRole} />;
      case "camps":
        return <Camps userRole={userRole} />;
      case "camp-priority":
        return <CampPriority />;
      case "item-priority":
        return <ItemPrioritization />;
      case "resources":
        return <ResourceInventory userRole={userRole} />;
      case "distribution-centers":
        return <DistributionCenters userRole={userRole} />;
      case "rescue-centers":
        return <RescueCenters userRole={userRole} />;
      case "route-planning":
        return <RoutePlanning />;
      case "rescue-operations":
        return <RescueOperations userRole={userRole} />;
      case "distributions":
        return <DistributionPlans userRole={userRole} />;
      case "ml-retraining":
        return <MLRetraining />;
      case "reports":
        return <Reports />;
      case "notifications":
        return <Notifications />;
      case "need-reports":
        return <NeedReports userRole={userRole} initialType={navData?.type} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className={`post-flood-module post-flood-${themeMode} ${themeMode === "dark" ? "dark" : ""} flex min-h-screen bg-slate-100`}>
      {mobileSidebarOpen && (
        <button
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={(p) => navigateWithData(p)}
        userRole={userRole}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="relative flex min-h-screen min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="post-flood-topbar relative z-20 mx-3 mt-3 flex flex-col gap-3 rounded-xl border border-cyan-200/60 bg-gradient-to-r from-white via-sky-50/95 to-emerald-50/80 px-3 py-3 shadow-lg shadow-sky-100/60 backdrop-blur sm:mx-4 sm:mt-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 md:hidden"
              title="Open menu"
            >
              <span className="material-icons text-lg">menu</span>
            </button>
            {pageHistory.length > 0 && (
              <button
                onClick={goBack}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
                title="Go back"
              >
                <span className="material-icons text-lg">arrow_back</span>
              </button>
            )}
            <div className="post-flood-brand-bar hidden h-9 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-emerald-400 shadow-sm shadow-cyan-200 sm:block" />
            <h2 className="min-w-0 truncate text-base font-semibold capitalize text-slate-900 sm:text-lg">
              {currentPage.replace(/-/g, " ")}
            </h2>
          </div>

          {/* Global Search Bar */}
          <div className="relative w-full min-w-0 flex-1 lg:mx-6 lg:max-w-xl" ref={searchRef}>
            <div className="relative group">
              <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-cyan-600">
                search
              </span>
              <input
                type="text"
                placeholder="Search camps, safe zones, resources..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full rounded-lg border border-cyan-100 bg-white/85 py-2 pl-10 pr-10 text-sm shadow-sm shadow-sky-100/60 outline-none transition-all focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100"
              />
              {globalSearch && (
                <button
                  onClick={() => setGlobalSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  <span className="material-icons text-sm">close</span>
                </button>
              )}
            </div>

            {/* Search Dropdown */}
            {globalSearch.trim() !== "" && (
              <div className="absolute left-0 right-0 top-full mt-2 max-h-[400px] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                {isSearching ? (
                  <div className="flex items-center justify-center gap-2 p-4 text-center text-sm text-gray-500">
                    <span className="material-icons animate-spin text-cyan-500">
                      refresh
                    </span>{" "}
                    Searching...
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="py-2">
          {searchResults.map((res, i) => (
                      <button
                        key={`${res.type}-${res.id}-${i}`}
                        onClick={() => {
                          navigateWithData(res.type as PageName);
                          setGlobalSearch("");
                        }}
                        className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-cyan-50"
                      >
                        <div className="rounded-lg bg-slate-100 p-2 text-slate-500">
                          <span className="material-icons text-sm">
                            {res.icon}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">
                            {res.title}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {res.subtitle}
                          </p>
                        </div>
                        <span className="material-icons text-xs text-gray-300 ml-auto">
                          chevron_right
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-gray-500">
                    No results found for "{globalSearch}"
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
              className="theme-toggle-button relative rounded-lg border border-cyan-100 bg-white/85 p-2 shadow-sm shadow-sky-100/60 transition-colors hover:border-cyan-200 hover:bg-white"
              title={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              <span className="material-icons text-gray-500">
                {themeMode === "dark" ? "light_mode" : "dark_mode"}
              </span>
            </button>
            {/* Notification Bell */}
            <button
              onClick={() => navigateWithData("notifications")}
              className="relative rounded-lg border border-cyan-100 bg-white/85 p-2 shadow-sm shadow-sky-100/60 transition-colors hover:border-cyan-200 hover:bg-white"
            >
              <span className="material-icons text-gray-500">
                notifications
              </span>
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* User Role Badge */}
            <span
              className={`hidden rounded-md border px-3 py-1.5 text-xs font-bold shadow-sm transition-all sm:inline-block ${
                userRole.toLowerCase() === "admin"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-cyan-200 bg-cyan-50 text-cyan-800"
              }`}
            >
              {userRole.replace(/_/g, " ").toUpperCase()}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6">
          <Suspense fallback={<Loading message="Loading page..." />}>
            {renderPage()}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
