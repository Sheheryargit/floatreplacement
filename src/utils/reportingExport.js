/**
 * CSV export utilities for reporting page
 */

function escapeCSV(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function arrayToCSV(rows) {
  return rows.map(row => row.map(escapeCSV).join(",")).join("\n");
}

function downloadCSV(data, filename) {
  const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function formatDateDDMmmYY(date) {
  if (!date) return "";
  return date.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "2-digit" });
}

export { escapeCSV, arrayToCSV, downloadCSV, formatDateDDMmmYY };
