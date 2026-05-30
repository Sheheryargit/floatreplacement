const PAGE_LABELS = [
  { prefix: "/people", label: "People" },
  { prefix: "/projects", label: "Projects" },
  { prefix: "/report", label: "Report" },
  { prefix: "/dept-dashboard", label: "Department dashboard" },
  { prefix: "/access", label: "Access" },
  { prefix: "/settings", label: "Settings" },
];

/** Human-readable label for presence tooltips. */
export function presencePageLabel(pathname) {
  const path = String(pathname || "/");
  if (path === "/" || path.startsWith("/?")) return "Schedule";
  for (const { prefix, label } of PAGE_LABELS) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return label;
  }
  return "Alloc8";
}
