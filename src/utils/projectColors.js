/** Shared palette: project creation + allocations for labels without a registry match. */
export const PROJECT_COLOR_PALETTE = [
  "#6c8cff",
  "#34d399",
  "#f59e0b",
  "#ff4d6a",
  "#a78bfa",
  "#f093fb",
  "#4facfe",
  "#fcb69f",
  "#fa709a",
  "#43e97b",
  "#48c6ef",
  "#667eea",
  "#ff6b6b",
  "#feca57",
  "#54a0ff",
  "#5f27cd",
];

export function projectToAllocationLabel(p) {
  const code = (p.code || "").trim();
  const name = (p.name || "").trim();
  if (code && name) return `${code} / ${name}`;
  return name || code || `Project #${p.id}`;
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = s.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h);
}

/** Color for a schedule allocation label: registry project match, else stable hash into palette. */
export function resolveColorForProjectLabel(label, projects) {
  const t = (label || "").trim();
  if (!t) return PROJECT_COLOR_PALETTE[0];
  const match = projects.find((p) => projectToAllocationLabel(p) === t);
  if (match?.color && typeof match.color === "string" && /^#([0-9A-Fa-f]{6})$/.test(match.color.trim())) {
    return match.color.trim();
  }
  const idx = hashString(t) % PROJECT_COLOR_PALETTE.length;
  return PROJECT_COLOR_PALETTE[idx];
}

/**
 * Bar fill: live project registry color when the label matches a project (stays in sync with Projects),
 * else persisted snapshot, else stable hash for ad-hoc labels.
 */
export function colorForAllocationBar(alloc, projects) {
  const label = (alloc.project || "").trim();
  if (label) {
    const match = projects.find((p) => projectToAllocationLabel(p) === label);
    const mc = match?.color;
    if (mc && typeof mc === "string" && /^#([0-9A-Fa-f]{6})$/i.test(mc.trim())) {
      return mc.trim();
    }
  }
  const snap = alloc.projectColor;
  if (snap && typeof snap === "string" && /^#([0-9A-Fa-f]{6})$/i.test(snap.trim())) {
    return snap.trim();
  }
  return resolveColorForProjectLabel(alloc.project, projects);
}

export function contrastingTextColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.62 ? "#151922" : "#fff";
}

/** Default color for a new registry project id (stable, not random). */
export function colorForNewProjectId(projectId) {
  const id = Math.max(1, Number(projectId) || 1);
  return PROJECT_COLOR_PALETTE[(id - 1) % PROJECT_COLOR_PALETTE.length];
}
