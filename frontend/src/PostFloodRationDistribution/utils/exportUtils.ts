import jsPDF from "jspdf";

export type ExportColumn<T = any> = {
  key: string;
  label: string;
  value?: (row: T) => any;
};

const escapeCsv = (value: any) => {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const valueFor = <T,>(row: T, column: ExportColumn<T>) =>
  column.value ? column.value(row) : (row as any)[column.key];

export function exportRowsToCsv<T>(
  title: string,
  filename: string,
  rows: T[],
  columns: ExportColumn<T>[],
) {
  const lines = [
    [title].map(escapeCsv).join(","),
    ["Generated", new Date().toLocaleString()].map(escapeCsv).join(","),
    "",
    columns.map((column) => escapeCsv(column.label)).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsv(valueFor(row, column))).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

export function exportRowsToPdf<T>(
  title: string,
  filename: string,
  rows: T[],
  columns: ExportColumn<T>[],
  summary: string[] = [],
) {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  let y = 18;

  const addPageIfNeeded = (height = 10) => {
    if (y + height <= pageHeight - 12) return;
    doc.addPage();
    y = 18;
  };

  doc.setFillColor(8, 126, 170);
  doc.rect(0, 0, pageWidth, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, margin, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 24);
  y = 42;

  if (summary.length) {
    doc.setTextColor(8, 63, 115);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    summary.forEach((line) => {
      addPageIfNeeded(7);
      doc.text(line, margin, y);
      y += 6;
    });
    y += 4;
  }

  const usableWidth = pageWidth - margin * 2;
  const colWidth = usableWidth / columns.length;
  const rowHeight = 9;

  const drawHeader = () => {
    addPageIfNeeded(rowHeight);
    doc.setFillColor(6, 47, 88);
    doc.rect(margin, y - 6, usableWidth, rowHeight, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    columns.forEach((column, index) => {
      doc.text(column.label, margin + index * colWidth + 2, y);
    });
    y += rowHeight;
  };

  drawHeader();
  rows.forEach((row, rowIndex) => {
    addPageIfNeeded(rowHeight);
    if (y < 22) drawHeader();
    doc.setFillColor(rowIndex % 2 === 0 ? 245 : 235, rowIndex % 2 === 0 ? 251 : 247, rowIndex % 2 === 0 ? 253 : 251);
    doc.rect(margin, y - 6, usableWidth, rowHeight, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    columns.forEach((column, index) => {
      const text = String(valueFor(row, column) ?? "");
      doc.text(doc.splitTextToSize(text, colWidth - 4).slice(0, 1), margin + index * colWidth + 2, y);
    });
    y += rowHeight;
  });

  doc.save(`${filename}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
