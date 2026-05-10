import React, { useState, useEffect, useRef } from "react";
import type { PageName } from "./types";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import SafeZones from "./pages/SafeZones";
import Camps from "./pages/Camps";
import CampPriority from "./pages/CampPriority";
import ItemPrioritization from "./pages/ItemPrioritization";
import ResourceInventory from "./pages/ResourceInventory";
import RoutePlanning from "./pages/RoutePlanning";
import DistributionPlans from "./pages/DistributionPlans";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import MapVisualization from "./pages/MapVisualization";
import UserLandingPage from "./pages/UserLandingPage";
import NeedReports from "./pages/NeedReports";
import * as api from "./services/api";
import { Permissions } from "./utils/permissions";
import {
  filterOutSeedCamps,
  filterOutSeedSafeZones,
  filterOutSeedResources,
} from "./utils/filterSeedData";

interface PostFloodAppProps {
  userRole?: string;
}

export default function PostFloodApp({ userRole: rawRole }: PostFloodAppProps) {
  const [userRole, setUserRole] = useState(rawRole || "user");

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

  console.log("PostFloodApp actual role:", userRole);
  const [currentPage, setCurrentPage] = useState<PageName>(
    userRole.toLowerCase() === 'user' ? 'user-home' : 'dashboard'
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  // Refresh unread count when navigating away from notifications
  useEffect(() => {
    if (currentPage !== "notifications") {
      api
        .getUnreadCount()
        .then((r) => setUnreadCount(r.count || 0))
        .catch(() => {});
    } else {
      setUnreadCount(0);
    }
  }, [currentPage]);

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

  const navigateWithData = (page: PageName, data: any = null) => {
    setNavData(data);
    setCurrentPage(page);
  };

  const renderPage = () => {
    const isAllowed = Permissions.canAccessPage(userRole, currentPage);

    if (!isAllowed) {
      return userRole.toLowerCase() === 'user' ? <UserLandingPage onNavigate={navigateWithData} /> : <Dashboard />;
    }

    switch (currentPage) {
      case "user-home":
        return <UserLandingPage onNavigate={navigateWithData} />;
      case "dashboard":
        return <Dashboard />;
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
      case "route-planning":
        return <RoutePlanning />;
      case "distributions":
        return <DistributionPlans userRole={userRole} />;
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
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={(p) => navigateWithData(p)}
        userRole={userRole}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden relative">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm relative z-20">
          <div className="flex items-center gap-3 min-w-[150px]">
            <h2 className="text-lg font-semibold text-gray-800 capitalize">
              {currentPage.replace(/-/g, " ")}
            </h2>
          </div>

          {/* Global Search Bar */}
          <div className="flex-1 max-w-xl mx-8 relative" ref={searchRef}>
            <div className="relative group">
              <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-cyan-500 transition-colors">
                search
              </span>
              <input
                type="text"
                placeholder="Search camps, safe zones, resources..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full pl-10 pr-10 py-2 bg-gray-100/80 border-transparent rounded-xl focus:bg-white focus:border-cyan-300 focus:ring-2 focus:ring-cyan-200 outline-none transition-all shadow-sm text-sm"
              />
              {globalSearch && (
                <button
                  onClick={() => setGlobalSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <span className="material-icons text-sm">close</span>
                </button>
              )}
            </div>

            {/* Search Dropdown */}
            {globalSearch.trim() !== "" && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-[400px] overflow-y-auto">
                {isSearching ? (
                  <div className="p-4 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
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
                          setCurrentPage(res.type as PageName);
                          setGlobalSearch("");
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-cyan-50 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0"
                      >
                        <div className="p-2 rounded-lg bg-gray-100 text-gray-500">
                          <span className="material-icons text-sm">
                            {res.icon}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-800">
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

          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <button
              onClick={() => setCurrentPage("notifications")}
              className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <span className="material-icons text-gray-500">
                notifications
              </span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* User Role Badge */}
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border transition-all shadow-sm hidden sm:inline-block ${
                userRole.toLowerCase() === "admin"
                  ? "bg-rose-500 text-white border-rose-600 ring-2 ring-rose-100"
                  : "bg-gradient-to-r from-cyan-100 to-blue-100 text-cyan-800 border-cyan-200"
              }`}
            >
              {userRole.replace(/_/g, " ").toUpperCase()}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-y-auto relative z-10">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
