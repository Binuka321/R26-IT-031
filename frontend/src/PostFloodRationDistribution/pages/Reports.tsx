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

  const exportCSV = () => {
    if (!reportData?.data) return;
    const data = Array.isArray(reportData.data) ? reportData.data : (reportData.data.distributions || []);
    if (data.length === 0) return alert('No data to export');
    const keys = Object.keys(data[0]);
    const csv = [keys.join(','), ...data.map((row: any) => keys.map(k => `"${String(row[k] || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `report_${activeReport}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.setTextColor(6, 182, 212);
    doc.text(`${reports.find(r => r.id === activeReport)?.label} Report`, 14, 20);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

    let y = 40;
    doc.setFontSize(11); doc.setTextColor(33);
    const data = Array.isArray(reportData?.data) ? reportData.data : [];
    data.forEach((item: any, i: number) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const line = Object.entries(item).map(([k, v]) => `${k}: ${v}`).join(' | ');
      doc.text(`${i + 1}. ${line.substring(0, 120)}`, 14, y);
      y += 7;
    });
    doc.save(`report_${activeReport}_${new Date().toISOString().slice(0, 10)}.pdf`);
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
                const data = Array.isArray(reportData.data) ? reportData.data : [];
                if (data.length === 0) return <EmptyState icon="info" title="No data available" />;
                const keys = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object');
                return (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {keys.map(k => <th key={k} className="text-left py-2 px-3 font-semibold text-gray-600 capitalize">{k.replace(/_/g, ' ')}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((row: any, i: number) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-cyan-50/30">
                          {keys.map(k => <td key={k} className="py-2 px-3 text-gray-700">{String(row[k] ?? '')}</td>)}
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
