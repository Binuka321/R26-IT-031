import React, { useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  Loading,
  PageHeader,
  PrimaryButton,
} from "../components/UIComponents";
import * as api from "../services/api";
import jsPDF from "jspdf";

type ReportSection = {
  id: string;
  title: string;
  icon: string;
  rows: any[];
  summary?: Record<string, any>;
};

const reportOptions = [
  {
    id: "complete",
    label: "Complete Report",
    icon: "summarize",
    color: "from-cyan-500 to-blue-600",
  },
  {
    id: "camp-priority",
    label: "Camp Priority",
    icon: "analytics",
    color: "from-rose-500 to-pink-600",
  },
  {
    id: "resources",
    label: "Resources",
    icon: "warehouse",
    color: "from-amber-500 to-orange-600",
  },
  {
    id: "distributions",
    label: "Distributions",
    icon: "local_shipping",
    color: "from-blue-500 to-indigo-600",
  },
  {
    id: "routes",
    label: "Routes",
    icon: "route",
    color: "from-emerald-500 to-teal-600",
  },
];

const importantKeys: Record<string, string[]> = {
  "camp-priority": [
    "camp_name",
    "safe_zone",
    "population",
    "priority_level",
    "priority_score",
    "confidence_score",
    "food_priority",
    "water_priority",
    "medicine_priority",
    "sanitary_priority",
    "disease_risk",
    "food",
    "water",
    "medicine",
    "sanitary",
  ],
  resources: [
    "name",
    "type",
    "total",
    "allocated",
    "available",
    "unit",
    "low_stock",
  ],
  distributions: [
    "camp_id",
    "status",
    "priority_level",
    "items",
    "assigned_team_id",
    "createdAt",
    "updatedAt",
  ],
  routes: [
    "camp_name",
    "route_type",
    "route_algorithm",
    "distance",
    "estimated_time",
    "safety_score",
    "route_status",
    "warnings",
  ],
};

const formatHeader = (key: string) =>
  key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const formatValue = (value: any): string => {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (value.length === 0) return "None";
    return value
      .map((item) => {
        if (typeof item !== "object" || item === null) return String(item);
        return Object.entries(item)
          .map(([key, val]) => `${formatHeader(key)}: ${formatValue(val)}`)
          .join("; ");
      })
      .join(" | ");
  }
  if (typeof value === "object") {
    if (value.camp_name) return value.camp_name;
    if (value.name) return value.name;
    if (value.username) return value.username;
    return Object.entries(value)
      .filter(([key]) => !key.startsWith("_"))
      .map(([key, val]) => `${formatHeader(key)}: ${formatValue(val)}`)
      .join("; ");
  }
  return String(value);
};

const getRowsFromResponse = (type: string, response: any) => {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (type === "routes" && Array.isArray(data?.routes)) return data.routes;
  if (type === "distributions" && Array.isArray(data?.distributions)) {
    return data.distributions;
  }
  if (data && typeof data === "object") return [data];
  return [];
};

const getKeys = (sectionId: string, rows: any[]) => {
  const discovered = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row || {}))),
  ).filter((key) => !key.startsWith("_") && key !== "__v");
  const preferred = importantKeys[sectionId] || [];
  return [
    ...preferred.filter((key) => discovered.includes(key)),
    ...discovered.filter((key) => !preferred.includes(key)),
  ];
};

const downloadBlob = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
};

export default function Reports() {
  const [activeReport, setActiveReport] = useState("complete");
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const loadReport = async (type: string) => {
    setActiveReport(type);
    setLoading(true);
    try {
      if (type === "complete") {
        const [dashboard, camps, resources, distributions, routes] =
          await Promise.all([
            api.getDashboardStats(),
            api.getCampPriorityReport(),
            api.getResourceReport(),
            api.getDistributionReport(),
            api.getRouteReport(),
          ]);

        setGeneratedAt(new Date().toISOString());
        setSections([
          {
            id: "dashboard",
            title: "Executive Summary",
            icon: "dashboard",
            rows: [],
            summary: dashboard.data || {},
          },
          {
            id: "camp-priority",
            title: "Camp Priority and ML Relief Needs",
            icon: "analytics",
            rows: getRowsFromResponse("camp-priority", camps),
          },
          {
            id: "resources",
            title: "Resource Availability",
            icon: "warehouse",
            rows: getRowsFromResponse("resources", resources),
          },
          {
            id: "distributions",
            title: "Distribution Plans and Delivery Status",
            icon: "local_shipping",
            rows: getRowsFromResponse("distributions", distributions),
            summary: distributions.data
              ? {
                  total: distributions.data.total,
                  pending: distributions.data.pending,
                  delivered: distributions.data.delivered,
                  failed: distributions.data.failed,
                }
              : undefined,
          },
          {
            id: "routes",
            title: "Route Planning and Safety",
            icon: "route",
            rows: getRowsFromResponse("routes", routes),
            summary: routes.data
              ? {
                  total_routes: routes.data.total_routes,
                  avg_safety_score: routes.data.avg_safety_score,
                  active: routes.data.active,
                  blocked: routes.data.blocked,
                }
              : undefined,
          },
        ]);
        return;
      }

      const apiFn =
        type === "camp-priority"
          ? api.getCampPriorityReport
          : type === "resources"
            ? api.getResourceReport
            : type === "distributions"
              ? api.getDistributionReport
              : api.getRouteReport;
      const response = await apiFn();
      const option = reportOptions.find((report) => report.id === type);
      setGeneratedAt(response.generated_at || new Date().toISOString());
      setSections([
        {
          id: type,
          title: option?.label || "Report",
          icon: option?.icon || "assessment",
          rows: getRowsFromResponse(type, response),
          summary:
            response.data && !Array.isArray(response.data)
              ? Object.fromEntries(
                  Object.entries(response.data).filter(
                    ([, value]) => !Array.isArray(value),
                  ),
                )
              : undefined,
        },
      ]);
    } catch (error) {
      console.error(error);
      setSections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport("complete");
  }, []);

  const reportTitle =
    reportOptions.find((report) => report.id === activeReport)?.label ||
    "Report";
  const totalRows = useMemo(
    () => sections.reduce((total, section) => total + section.rows.length, 0),
    [sections],
  );

  const summaryStats = useMemo(() => {
    const dashboard = sections.find((section) => section.id === "dashboard")
      ?.summary;
    if (!dashboard) return [];
    return [
      ["Safe Zones", dashboard.totalSafeZones],
      ["Camps", dashboard.totalCamps],
      ["Population", dashboard.totalPopulation],
      ["Distributions", dashboard.totalDistributions],
      ["High Priority", dashboard.highPriority],
      ["Routes", dashboard.generatedRoutes],
    ];
  }, [sections]);

  const exportCSV = () => {
    if (sections.length === 0) return alert("No data to export");
    const lines = [
      `"Post-Flood Rescue and Ration Distribution Management System"`,
      `"${reportTitle}"`,
      `"Generated","${new Date(generatedAt || Date.now()).toLocaleString()}"`,
      "",
    ];

    sections.forEach((section) => {
      lines.push(`"${section.title}"`);
      if (section.summary) {
        Object.entries(section.summary).forEach(([key, value]) => {
          if (Array.isArray(value)) return;
          lines.push(`"${formatHeader(key)}","${formatValue(value).replace(/"/g, '""')}"`);
        });
        lines.push("");
      }

      if (section.rows.length > 0) {
        const keys = getKeys(section.id, section.rows);
        lines.push(keys.map(formatHeader).map((label) => `"${label}"`).join(","));
        section.rows.forEach((row) => {
          lines.push(
            keys
              .map((key) => `"${formatValue(row[key]).replace(/"/g, '""')}"`)
              .join(","),
          );
        });
        lines.push("");
      }
    });

    downloadBlob(
      lines.join("\n"),
      `post_flood_${activeReport}_report_${new Date().toISOString().slice(0, 10)}.csv`,
      "text/csv;charset=utf-8;",
    );
  };

  const exportPDF = () => {
    if (sections.length === 0) return alert("No data to export");

    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    let y = 18;

    const addPageIfNeeded = (needed = 18) => {
      if (y + needed <= pageHeight - 14) return;
      doc.addPage();
      y = 18;
    };

    doc.setFillColor(8, 145, 178);
    doc.rect(0, 0, pageWidth, 34, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text("Post-Flood Rescue and Ration Distribution", margin, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(reportTitle, margin, 24);
    doc.text(
      `Generated: ${new Date(generatedAt || Date.now()).toLocaleString()}`,
      pageWidth - margin,
      24,
      { align: "right" },
    );
    y = 44;

    sections.forEach((section) => {
      addPageIfNeeded(24);
      doc.setFillColor(240, 249, 255);
      doc.roundedRect(margin, y - 7, pageWidth - margin * 2, 12, 2, 2, "F");
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(section.title, margin + 4, y);
      doc.text(`${section.rows.length} records`, pageWidth - margin - 4, y, {
        align: "right",
      });
      y += 13;

      if (section.summary) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        Object.entries(section.summary).forEach(([key, value]) => {
          if (Array.isArray(value)) return;
          addPageIfNeeded(6);
          const text = `${formatHeader(key)}: ${formatValue(value)}`;
          doc.text(doc.splitTextToSize(text, pageWidth - margin * 2), margin, y);
          y += 5;
        });
        y += 3;
      }

      section.rows.forEach((row, index) => {
        const keys = getKeys(section.id, [row]);
        const lines = keys.map(
          (key) => `${formatHeader(key)}: ${formatValue(row[key])}`,
        );
        const wrapped = doc.splitTextToSize(
          `${index + 1}. ${lines.join(" | ")}`,
          pageWidth - margin * 2,
        );
        addPageIfNeeded(wrapped.length * 4 + 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(51, 65, 85);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 4 + 4;
      });
      y += 5;
    });

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${page} of ${totalPages}`, pageWidth - margin, pageHeight - 7, {
        align: "right",
      });
      doc.text("Complete operational report", margin, pageHeight - 7);
    }

    doc.save(
      `post_flood_${activeReport}_report_${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Complete operational reports for camps, resources, routes, and distributions"
        icon="assessment"
        actions={
          <div className="flex gap-2">
            <PrimaryButton onClick={exportCSV} icon="download">
              Export CSV
            </PrimaryButton>
            <PrimaryButton onClick={exportPDF} icon="picture_as_pdf">
              Export PDF
            </PrimaryButton>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {reportOptions.map((report) => (
          <button
            key={report.id}
            onClick={() => loadReport(report.id)}
            className={`p-4 rounded-2xl text-left transition-all ${
              activeReport === report.id
                ? "ring-2 ring-cyan-400 shadow-lg bg-white"
                : "shadow-md hover:shadow-lg bg-white"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${report.color} text-white flex items-center justify-center mb-2`}
            >
              <span className="material-icons text-lg">{report.icon}</span>
            </div>
            <p className="font-semibold text-gray-800 text-sm">{report.label}</p>
          </button>
        ))}
      </div>

      {loading ? (
        <Loading message="Generating report..." />
      ) : sections.length === 0 ? (
        <EmptyState icon="info" title="No report data available" />
      ) : (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-cyan-900 text-white">
              <p className="text-xs uppercase tracking-wide text-cyan-100">
                Operational Report
              </p>
              <h3 className="text-2xl font-bold">{reportTitle}</h3>
              <p className="text-sm text-cyan-50 mt-1">
                Generated {new Date(generatedAt || Date.now()).toLocaleString()} |
                {" "}
                {totalRows} detailed records
              </p>
            </div>
            {summaryStats.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 p-4">
                {summaryStats.map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-xl font-bold text-gray-800">
                      {formatValue(value)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {sections.map((section) => (
            <div
              key={section.id}
              className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
            >
              <div className="p-4 bg-gradient-to-r from-slate-50 to-gray-50 border-b flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-icons text-cyan-600">
                    {section.icon}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {section.title}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {section.rows.length} records included
                    </p>
                  </div>
                </div>
              </div>

              {section.summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b border-gray-100">
                  {Object.entries(section.summary)
                    .filter(([, value]) => !Array.isArray(value))
                    .map(([key, value]) => (
                      <div key={key} className="rounded-xl bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">
                          {formatHeader(key)}
                        </p>
                        <p className="font-bold text-gray-800">
                          {formatValue(value)}
                        </p>
                      </div>
                    ))}
                </div>
              )}

              <div className="p-4 overflow-x-auto">
                {section.rows.length === 0 ? (
                  <EmptyState icon="info" title="No row data in this section" />
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {getKeys(section.id, section.rows).map((key) => (
                          <th
                            key={key}
                            className="text-left py-2 px-3 font-semibold text-gray-600 whitespace-nowrap"
                          >
                            {formatHeader(key)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row, index) => (
                        <tr
                          key={index}
                          className="border-b border-gray-50 hover:bg-cyan-50/30"
                        >
                          {getKeys(section.id, section.rows).map((key) => (
                            <td
                              key={key}
                              className="py-2 px-3 text-gray-700 align-top min-w-[120px]"
                            >
                              {formatValue(row[key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
