import { tagAccentHexFromLabel } from "./projectColors.js";

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return { r: 108, g: 140, b: 255 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Stable, high-variety tag chip colors (200+ effective hues via hash → HSL).
 * @param {string} label
 * @param {boolean} isDark — match app theme (People / Schedule / Projects)
 * @param {string} [extraClass] — e.g. "lp-schedule-tag"
 * @returns {{ className: string, style: Record<string, string> }}
 */
export function tagChromaProps(label, isDark, extraClass = "") {
  const hex = tagAccentHexFromLabel(label);
  const { r, g, b } = hexToRgb(hex);
  const base = `${r},${g},${b}`;

  if (isDark) {
    return {
      className: ["float-tag-chroma", extraClass].filter(Boolean).join(" "),
      style: {
        background: `rgba(${base},0.18)`,
        color: `rgb(${Math.min(255, r + 78)},${Math.min(255, g + 78)},${Math.min(255, b + 82)})`,
        borderColor: `rgba(${base},0.38)`,
        boxShadow: `0 0 16px rgba(${base},0.12)`,
      },
    };
  }

  return {
    className: ["float-tag-chroma", extraClass].filter(Boolean).join(" "),
    style: {
      background: `rgba(${base},0.11)`,
      color: `rgb(${Math.max(0, r - 52)},${Math.max(0, g - 48)},${Math.max(0, b - 48)})`,
      borderColor: `rgba(${base},0.24)`,
      boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
    },
  };
}

/** @deprecated Prefer tagChromaProps(label, isDark); class-only variant defaults to dark. */
export function tagChromaClass(label) {
  return tagChromaProps(label, true).className;
}
