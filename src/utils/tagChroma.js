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
        background: `rgba(${base},0.28)`,
        color: `rgb(${Math.min(255, r + 92)},${Math.min(255, g + 88)},${Math.min(255, b + 94)})`,
        border: `1px solid rgba(${base},0.52)`,
        boxShadow: `0 0 20px rgba(${base},0.14), inset 0 1px 0 rgba(255,255,255,0.07)`,
      },
    };
  }

  return {
    className: ["float-tag-chroma", extraClass].filter(Boolean).join(" "),
    style: {
      background: `rgba(${base},0.16)`,
      color: `rgb(${Math.max(0, r - 38)},${Math.max(0, g - 34)},${Math.max(0, b - 34)})`,
      border: `1px solid rgba(${base},0.38)`,
      boxShadow: "0 1px 0 rgba(255,255,255,0.75) inset, 0 1px 2px rgba(15,22,40,0.06)",
    },
  };
}

/** @deprecated Prefer tagChromaProps(label, isDark); class-only variant defaults to dark. */
function tagChromaClass(label) {
  return tagChromaProps(label, true).className;
}
