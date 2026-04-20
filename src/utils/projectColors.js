/** Golden-angle hue stepping yields ~evenly spaced hues on the circle. */
const GOLDEN_ANGLE = 137.508;
const ALLOCATION_PALETTE_SIZE = 200;

function hashString(s) {
  let h = 0;
  const str = String(s ?? "");
  for (let i = 0; i < str.length; i++) {
    h = str.charCodeAt(i) + ((h << 5) - h);
  }
  return h >>> 0;
}

function hslToHex(h, s, l) {
  const hh = ((h % 360) + 360) % 360;
  const ss = s / 100;
  const ll = l / 100;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n) => {
    const k = (n + hh / 30) % 12;
    const c = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c);
  };
  return `#${[f(0), f(8), f(4)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function buildGoldenPalette(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * GOLDEN_ANGLE) % 360;
    const sat = 52 + (i % 7) * 3.15;
    const light = 46 + (i % 6) * 2.1;
    out.push(hslToHex(hue, sat, light));
  }
  return out;
}

/**
 * Large palette: project picker + allocations for labels without a registry match.
 * ~200 visually distinct hues (golden-angle spacing).
 */
export const PROJECT_COLOR_PALETTE = buildGoldenPalette(ALLOCATION_PALETTE_SIZE);

/** Avatar / initials gradient: two distinct hues from the same large palette. */
export function avatarGradientFromName(name) {
  if (!name || !String(name).trim()) return "linear-gradient(135deg,#3a3f4b,#2a2e38)";
  const h = hashString(`avatar:\x00${name}`);
  const n = PROJECT_COLOR_PALETTE.length;
  const i = h % n;
  let j = (h >>> 11) % n;
  if (j === i) j = (i + 37) % n;
  const a = PROJECT_COLOR_PALETTE[i];
  const b = PROJECT_COLOR_PALETTE[j];
  return `linear-gradient(135deg,${a},${b})`;
}

export function projectToAllocationLabel(p) {
  const code = (p.code || "").trim();
  const name = (p.name || "").trim();
  if (code && name) return `${code} / ${name}`;
  return name || code || `Project #${p.id}`;
}

/** Distinct accent for tag chips (different salt than allocation hashing). */
export function tagAccentHexFromLabel(label) {
  const h = hashString(`tag:\x00${label}`);
  const hue = (h % 360) + ((h >>> 10) % 24) * 0.35;
  const sat = 56 + ((h >>> 6) % 17);
  const light = 50 + ((h >>> 14) % 9);
  return hslToHex(hue, sat, light);
}

/** Color for a schedule allocation label: registry project match, else stable hash into large palette. */
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

/**
 * Pill behind project code (ARTC, Internal, …) on schedule bars — tints with project bar color per theme.
 * @param {string} barHex
 * @param {"light" | "dark"} theme
 */
export function projectCodeChipStyles(barHex, theme) {
  const hex = (barHex || "#6366f1").trim();
  const isLight = theme === "light";
  const fg = contrastingTextColor(hex);
  return {
    background: isLight
      ? `color-mix(in srgb, ${hex} 20%, #ffffff)`
      : `color-mix(in srgb, ${hex} 38%, rgba(12, 14, 20, 0.94))`,
    border: `1px solid color-mix(in srgb, ${hex} 58%, ${isLight ? "#0f172a" : "#f8fafc"})`,
    color: fg,
    boxShadow: isLight
      ? "0 1px 0 rgba(255,255,255,0.65) inset, 0 1px 2px rgba(15,22,40,0.08)"
      : "0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
  };
}

