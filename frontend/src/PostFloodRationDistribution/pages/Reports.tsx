import React, { useEffect, useState } from 'react';
import { PageHeader, PrimaryButton, Loading, EmptyState } from '../components/UIComponents';
import * as api from '../services/api';
import jsPDF from 'jspdf';

export default function Reports() {
  const [activeReport, setActiveReport] = useState<string>('camp-priority');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const reports = [
    { id: 'camp-priority', label: 'Camp Priority', icon: 'analytics', color: 'from-rose-500 to-pink-600' },
    { id: 'resources', label: 'Resources', icon: 'warehouse', color: 'from-amber-500 to-orange-600' },
    { id: 'distributions', label: 'Distributions', icon: 'local_shipping', color: 'from-blue-500 to-indigo-600' },
    { id: 'routes', label: 'Route Efficiency', icon: 'route', color: 'from-emerald-500 to-teal-600' },
  ];

  const loadReport = (type: string) => {
    setActiveReport(type);
    setLoading(true);
    const apiFn = type === 'camp-priority' ? api.getCampPriorityReport
      : type === 'resources' ? api.getResourceReport
      : type === 'distributions' ? api.getDistributionReport
      : api.getRouteReport;
    apiFn().then(r => setReportData(r)).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => loadReport('camp-priority'), []);

  const getReportRows = () => {
    const data = reportData?.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.routes)) return data.routes;
    if (Array.isArray(data?.distributions)) return data.distributions;
    if (data && typeof data === 'object') return [data];
    return [];
  };

  const getReportTitle = () => reports.find(r => r.id === activeReport)?.label || 'Report';

  const formatHeader = (key: string) =>
    key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value instanceof Date) return value.toLocaleString();
    if (typeof value === 'object') {
      if (value.camp_name) return value.camp_name;
      if (value.name) return value.name;
      return JSON.stringify(value);
    }
    return String(value);
  };

  const getPrintableKeys = (rows: any[]) => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).filter(key => {
      const value = rows[0][key];
      return typeof value !== 'object' || value === null || key === 'camp_id';
    });
  };

  const downloadBlob = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportCSV = () => {
    const data = getReportRows();
    if (data.length === 0) return alert('No data to export');
    const keys = getPrintableKeys(data);
    const title = getReportTitle();
    const generated = new Date().toLocaleString();
    const headerRow = keys.map(formatHeader).join(',');
    const rows = data.map((row: any) =>
      keys
        .map(k => `"${formatValue(row[k]).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [
      `"Post-Flood Rescue and Ration Distribution Management System"`,
      `"${title} Report"`,
      `"Generated","${generated}"`,
      '',
      headerRow,
      ...rows,
    ].join('\n');

    downloadBlob(
      csv,
      `post_flood_${activeReport}_report_${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv;charset=utf-8;',
    );
  };

  const exportPDF = () => {
    const rows = getReportRows();
    if (rows.length === 0) return alert('No data to export');

    const doc = new jsPDF();
    const title = getReportTitle();
    const generated = new Date().toLocaleString();
    const keys = getPrintableKeys(rows).slice(0, activeReport === 'camp-priority' ? 9 : 7);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const tableWidth = pageWidth - margin * 2;
    const colWidth = tableWidth / Math.max(keys.length, 1);
    let y = 18;

    const drawHeader = () => {
      doc.setFillColor(8, 145, 178);
      doc.rect(0, 0, pageWidth, 34, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.text('Post-Flood Rescue and Ration Distribution', margin, 14);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`${title} Report`, margin, 24);
      doc.setFontSize(8);
      doc.text(`Generated: ${generated}`, pageWidth - margin, 24, { align: 'right' });

      y = 44;
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(240, 249, 255);
      doc.roundedRect(margin, y - 7, tableWidth, 12, 2, 2, 'F');
      doc.text(`Report Type: ${title}`, margin + 4, y);
      doc.text(`Total Records: ${rows.length}`, pageWidth - margin - 4, y, { align: 'right' });
      y += 16;

      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, tableWidth, 9, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      keys.forEach((key, index) => {
        const label = formatHeader(key);
        doc.text(label.substring(0, 16), margin + index * colWidth + 2, y + 6);
      });
      y += 9;
    };

    drawHeader();

    rows.forEach((row: any, rowIndex: number) => {
      if (y > pageHeight - 22) {
        doc.addPage();
        drawHeader();
      }

      doc.setFillColor(rowIndex % 2 === 0 ? 248 : 255, rowIndex % 2 === 0 ? 250 : 255, rowIndex % 2 === 0 ? 252 : 255);
      doc.rect(margin, y, tableWidth, 10, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y + 10, pageWidth - margin, y + 10);
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);

      keys.forEach((key, index) => {
        const value = formatValue(row[key]).substring(0, 18);
        doc.text(value, margin + index * colWidth + 2, y + 6.5);
      });

      y += 10;
    });

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${page} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
      doc.text('Generated for rescue and ration distribution planning', margin, pageHeight - 8);
    }

    doc.save(`post_flood_${activeReport}_report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div>
      <PageHeader title="Reports" subtitle="Generate and export system reports" icon="assessment"
        actions={
          <div className="flex gap-2">
            <PrimaryButton onClick={exportCSV} icon="download">Export CSV</PrimaryButton>
            <PrimaryButton onClick={exportPDF} icon="picture_as_pdf">Export PDF</PrimaryButton>
          </div>
        } />

      {/* Report Type Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {reports.map(r => (
          <button key={r.id} onClick={() => loadReport(r.id)}
            className={`p-4 rounded-2xl text-left transition-all ${activeReport === r.id ? 'ring-2 ring-cyan-400 shadow-lg' : 'shadow-md hover:shadow-lg'}`}>
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${r.color} text-white flex items-center justify-center mb-2`}>
              <span className="material-icons text-lg">{r.icon}</span>
            </div>
            <p className="font-semibold text-gray-800 text-sm">{r.label}</p>
          </button>
        ))}
      </div>

      {/* Report Content */}
      {loading ? <Loading message="Generating report..." /> : (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-slate-50 to-gray-50 border-b">
            <h3 className="font-semibold text-gray-700">{reports.find(r => r.id === activeReport)?.label} Report</h3>
            <p className="text-xs text-gray-500">Generated: {reportData?.generated_at ? new Date(reportData.generated_at).toLocaleString() : 'N/A'}</p>
          </div>
          <div className="p-4 overflow-x-auto">
            {reportData?.data && (
              (() => {
                const data = getReportRows();
                if (data.length === 0) return <EmptyState icon="info" title="No data available" />;
                const keys = getPrintableKeys(data);
                return (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {keys.map(k => <th key={k} className="text-left py-2 px-3 font-semibold text-gray-600">{formatHeader(k)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((row: any, i: number) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-cyan-50/30">
                          {keys.map(k => <td key={k} className="py-2 px-3 text-gray-700">{formatValue(row[k])}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
}
