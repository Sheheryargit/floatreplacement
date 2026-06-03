/**
 * Shared visuals for schedule allocation tiles (Landing + Settings preview).
 */
import { BAR_H_NORM } from "./renderModel/index.js";

export function hexToRgba(hex, alpha) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return `rgba(108, 140, 255, ${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}

function hexToRgbTriplet(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return { r: 108, g: 140, b: 255 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Linear mix toward `target` (0–255 per channel). `amount` 0–1. */
function mixRgbHex(hex, target, amount) {
  const { r, g, b } = hexToRgbTriplet(hex);
  const t = Math.max(0, Math.min(1, amount));
  const R = r + (target - r) * t;
  const G = g + (target - g) * t;
  const B = b + (target - b) * t;
  return `#${clampByte(R).toString(16).padStart(2, "0")}${clampByte(G).toString(16).padStart(2, "0")}${clampByte(B).toString(16).padStart(2, "0")}`;
}

export function allocationBarChromeStyles(barColor, hours, theme, { thin = false, boxStyle = "classic" } = {}) {
  const light = theme === "light";
  const hnorm = Math.min(1, Math.max(0, hours) / BAR_H_NORM);
  const borderPxClassic = thin ? 1 : 3;

  if (boxStyle === "minimal") {
    const borderPx = thin ? 1 : 1;
    return {
      boxShadow: light
        ? `inset 0 1px 0 ${hexToRgba(barColor, 0.14)}`
        : `inset 0 1px 0 ${hexToRgba("#ffffff", 0.07)}`,
      border: `${borderPx}px solid ${hexToRgba(barColor, light ? 0.42 : 0.5)}`,
    };
  }
  if (boxStyle === "outline") {
    const borderPx = thin ? 1 : 2;
    return {
      boxShadow: "none",
      border: `${borderPx}px solid ${barColor}`,
    };
  }
  if (boxStyle === "pill") {
    const sheen = light
      ? "inset 0 1px 0 rgba(255,255,255,0.42)"
      : "inset 0 1px 0 rgba(255,255,255,0.18)";
    const drop = light
      ? `0 1px 8px ${hexToRgba(barColor, 0.16 + hnorm * 0.07)}`
      : `0 2px 10px rgba(0,0,0,0.38)`;
    const borderPx = thin ? 1 : 2;
    return {
      boxShadow: `${sheen}, ${drop}`,
      border: `${borderPx}px solid ${hexToRgba(barColor, light ? 0.82 : 0.88)}`,
    };
  }
  if (boxStyle === "center") {
    const borderPx = thin ? 1 : 2;
    return {
      boxShadow: light
        ? `0 2px 14px ${hexToRgba(barColor, 0.2)}, inset 0 1px 0 rgba(255,255,255,0.55)`
        : `0 4px 20px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.12)`,
      border: `${borderPx}px solid ${hexToRgba(barColor, light ? 0.5 : 0.62)}`,
    };
  }
  if (boxStyle === "neon") {
    const borderPx = thin ? 1 : 2;
    const g = hexToRgba(barColor, light ? 0.42 : 0.48);
    return {
      boxShadow: light
        ? `0 0 0 1px ${hexToRgba(barColor, 0.28)}, 0 0 18px ${hexToRgba(barColor, 0.32)}, 0 4px 14px ${hexToRgba(barColor, 0.12)}, inset 0 1px 0 rgba(255,255,255,0.55)`
        : `0 0 0 1px ${hexToRgba(barColor, 0.35)}, 0 0 22px ${g}, 0 0 40px ${hexToRgba(barColor, 0.2)}, inset 0 1px 0 rgba(255,255,255,0.14)`,
      border: `${borderPx}px solid ${hexToRgba(barColor, light ? 0.65 : 0.82)}`,
    };
  }
  if (boxStyle === "glass") {
    return {
      boxShadow: light
        ? `inset 0 1px 0 rgba(255,255,255,0.92), inset 0 -1px 0 rgba(0,0,0,0.05), 0 2px 10px rgba(15,23,42,0.07)`
        : `inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.28), 0 2px 12px rgba(0,0,0,0.38)`,
      border: `1px solid ${hexToRgba(barColor, light ? 0.32 : 0.42)}`,
    };
  }
  if (boxStyle === "rail") {
    const borderPx = thin ? 1 : 2;
    return {
      boxShadow: light ? "2px 3px 0 rgba(15,23,42,0.07)" : "3px 4px 0 rgba(0,0,0,0.45)",
      border: `${borderPx}px solid ${hexToRgba(barColor, light ? 0.26 : 0.32)}`,
      borderLeft: `5px solid ${barColor}`,
    };
  }
  if (boxStyle === "velvet") {
    const borderPx = thin ? 1 : 1;
    return {
      boxShadow: light
        ? `inset 0 1px 0 rgba(255,255,255,0.38), inset 0 -3px 10px ${hexToRgba(barColor, 0.14)}, 0 4px 18px ${hexToRgba(barColor, 0.16 + hnorm * 0.06)}, 0 1px 3px rgba(15,23,42,0.07)`
        : `inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -4px 12px rgba(0,0,0,0.42), 0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px ${hexToRgba(barColor, 0.2)}`,
      border: `${borderPx}px solid ${hexToRgba(barColor, light ? 0.2 : 0.26)}`,
    };
  }
  if (boxStyle === "luxe") {
    const borderPx = thin ? 1 : 1;
    const glow = hexToRgba(barColor, light ? 0.2 + hnorm * 0.08 : 0.28 + hnorm * 0.1);
    return {
      boxShadow: light
        ? `0 0 0 1px rgba(255,255,255,0.82), 0 0 0 2px ${hexToRgba(barColor, 0.24)}, 0 12px 32px ${glow}, inset 0 2px 0 rgba(255,255,255,0.72), inset 0 -1px 0 ${hexToRgba(barColor, 0.1)}`
        : `0 0 0 1px ${hexToRgba(barColor, 0.42)}, 0 0 0 2px rgba(255,255,255,0.07), 0 14px 36px ${glow}, inset 0 2px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.45)`,
      border: `${borderPx}px solid ${hexToRgba(barColor, light ? 0.58 : 0.72)}`,
    };
  }
  if (boxStyle === "aurora") {
    const borderPx = thin ? 1 : 1;
    const bloom = hexToRgba(barColor, light ? 0.22 + hnorm * 0.08 : 0.32 + hnorm * 0.1);
    return {
      boxShadow: light
        ? `0 0 0 1px ${hexToRgba(barColor, 0.18)}, 0 6px 28px ${bloom}, 0 14px 44px ${hexToRgba(barColor, 0.1)}, inset 0 1px 0 rgba(255,255,255,0.58)`
        : `0 0 0 1px ${hexToRgba(barColor, 0.32)}, 0 8px 32px ${bloom}, 0 18px 52px ${hexToRgba(barColor, 0.14)}, inset 0 1px 0 rgba(255,255,255,0.14)`,
      border: `${borderPx}px solid ${hexToRgba(barColor, light ? 0.48 : 0.58)}`,
    };
  }
  if (boxStyle === "satin") {
    const borderPx = thin ? 1 : 1;
    return {
      boxShadow: light
        ? `inset 0 2px 0 rgba(255,255,255,0.78), inset 0 -2px 0 ${hexToRgba(barColor, 0.12)}, 0 10px 26px ${hexToRgba(barColor, 0.2 + hnorm * 0.08)}, 0 3px 8px rgba(15,23,42,0.09)`
        : `inset 0 2px 0 rgba(255,255,255,0.24), inset 0 -2px 0 rgba(0,0,0,0.38), 0 12px 30px rgba(0,0,0,0.52), 0 4px 12px ${hexToRgba(barColor, 0.22)}`,
      border: `${borderPx}px solid ${hexToRgba(barColor, light ? 0.36 : 0.46)}`,
    };
  }

  const sheen = light
    ? "inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.05)"
    : "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.35)";
  const drop = light
    ? `0 2px 10px ${hexToRgba(barColor, 0.2 + hnorm * 0.08)}`
    : `0 2px 12px rgba(0,0,0,0.42)`;
  return {
    boxShadow: `${sheen}, ${drop}`,
    border: `${borderPxClassic}px solid ${barColor}`,
  };
}

/** Softer interior wash behind text — slightly lifted toward white / mid-tones for calmer UI. */
export function allocationBarInnerWash(barColor, theme, boxStyle = "classic") {
  const light = theme === "light";
  if (boxStyle === "minimal") {
    const hi = mixRgbHex(barColor, 255, light ? 0.55 : 0.38);
    const mid = mixRgbHex(barColor, light ? 255 : 32, light ? 0.28 : 0.22);
    const lo = mixRgbHex(barColor, light ? 240 : 0, light ? 0.08 : 0.28);
    return `linear-gradient(168deg, ${hi} 0%, ${mid} 50%, ${lo} 100%)`;
  }
  if (boxStyle === "outline") {
    const hi = mixRgbHex(barColor, 255, light ? 0.82 : 0.55);
    const mid = mixRgbHex(barColor, light ? 255 : 40, light ? 0.45 : 0.32);
    const lo = mixRgbHex(barColor, light ? 252 : 0, light ? 0.2 : 0.38);
    return `linear-gradient(168deg, ${hi} 0%, ${mid} 55%, ${lo} 100%)`;
  }
  if (boxStyle === "pill") {
    const hi = mixRgbHex(barColor, 255, light ? 0.68 : 0.44);
    const mid = mixRgbHex(barColor, light ? 255 : 0, light ? 0.34 : 0.26);
    const lo = mixRgbHex(barColor, 0, light ? 0.12 : 0.32);
    return `linear-gradient(168deg, ${hi} 0%, ${mid} 42%, ${lo} 100%)`;
  }
  if (boxStyle === "center") {
    const hi = mixRgbHex(barColor, 255, light ? 0.78 : 0.52);
    const mid = mixRgbHex(barColor, light ? 255 : 24, light ? 0.4 : 0.3);
    const lo = mixRgbHex(barColor, light ? 248 : 0, light ? 0.14 : 0.36);
    return `linear-gradient(180deg, ${hi} 0%, ${mid} 48%, ${lo} 100%)`;
  }
  if (boxStyle === "neon") {
    const hi = mixRgbHex(barColor, 255, light ? 0.62 : 0.4);
    const mid = mixRgbHex(barColor, light ? 255 : 20, light ? 0.32 : 0.26);
    const lo = mixRgbHex(barColor, 0, light ? 0.08 : 0.4);
    return `linear-gradient(145deg, ${hi} 0%, ${mid} 45%, ${lo} 100%)`;
  }
  if (boxStyle === "glass") {
    const hi = mixRgbHex(barColor, 255, light ? 0.88 : 0.58);
    const mid = mixRgbHex(barColor, light ? 255 : 48, light ? 0.52 : 0.34);
    const lo = mixRgbHex(barColor, light ? 255 : 0, light ? 0.28 : 0.42);
    return `linear-gradient(195deg, ${hi} 0%, ${mid} 40%, ${lo} 100%)`;
  }
  if (boxStyle === "rail") {
    const hi = mixRgbHex(barColor, 255, light ? 0.92 : 0.48);
    const mid = mixRgbHex(barColor, light ? 255 : 28, light ? 0.46 : 0.24);
    const lo = mixRgbHex(barColor, light ? 250 : 0, light ? 0.22 : 0.32);
    return `linear-gradient(90deg, ${mixRgbHex(barColor, 0, light ? 0.06 : 0.2)} 0%, ${mid} 18%, ${hi} 52%, ${lo} 100%)`;
  }
  if (boxStyle === "velvet") {
    const hi = mixRgbHex(barColor, light ? 255 : 200, light ? 0.58 : 0.42);
    const mid = mixRgbHex(barColor, light ? 255 : 16, light ? 0.32 : 0.28);
    const lo = mixRgbHex(barColor, 0, light ? 0.14 : 0.44);
    return `linear-gradient(175deg, ${hi} 0%, ${mid} 46%, ${lo} 100%)`;
  }
  if (boxStyle === "luxe") {
    const hi = mixRgbHex(barColor, 255, light ? 0.9 : 0.62);
    const mid = mixRgbHex(barColor, light ? 255 : 40, light ? 0.52 : 0.34);
    const lo = mixRgbHex(barColor, light ? 248 : 0, light ? 0.24 : 0.38);
    return `linear-gradient(160deg, ${hi} 0%, ${mid} 38%, ${lo} 100%)`;
  }
  if (boxStyle === "aurora") {
    const hi = mixRgbHex(barColor, 255, light ? 0.74 : 0.48);
    const mid = mixRgbHex(barColor, light ? 255 : 80, light ? 0.38 : 0.3);
    const lo = mixRgbHex(barColor, 0, light ? 0.1 : 0.42);
    const flare = mixRgbHex(barColor, light ? 255 : 120, light ? 0.52 : 0.34);
    return `linear-gradient(128deg, ${flare} 0%, ${hi} 22%, ${mid} 55%, ${lo} 100%)`;
  }
  if (boxStyle === "satin") {
    const hi = mixRgbHex(barColor, 255, light ? 0.86 : 0.54);
    const mid = mixRgbHex(barColor, light ? 255 : 0, light ? 0.44 : 0.28);
    const lo = mixRgbHex(barColor, light ? 240 : 0, light ? 0.16 : 0.36);
    return `linear-gradient(180deg, ${hi} 0%, ${mid} 35%, ${lo} 100%)`;
  }
  const hi = mixRgbHex(barColor, 255, light ? 0.72 : 0.46);
  const mid = mixRgbHex(barColor, light ? 255 : 0, light ? 0.36 : 0.28);
  const lo = mixRgbHex(barColor, 0, light ? 0.1 : 0.34);
  return `linear-gradient(168deg, ${hi} 0%, ${mid} 42%, ${lo} 100%)`;
}

export function allocationBarBorderRadiusPx(widthPct, boxStyle = "classic") {
  let r;
  if (widthPct < 4) r = 6;
  else if (widthPct < 9) r = 8;
  else if (widthPct < 16) r = 10;
  else r = 12;
  if (boxStyle === "pill") return Math.min(999, r + 10);
  if (boxStyle === "minimal") return Math.max(4, r - 1);
  if (boxStyle === "center") return Math.min(999, r + 4);
  if (boxStyle === "neon") return r + 2;
  if (boxStyle === "glass") return r + 3;
  if (boxStyle === "rail") return Math.max(3, r - 2);
  if (boxStyle === "velvet") return r + 3;
  if (boxStyle === "luxe") return r + 2;
  if (boxStyle === "aurora") return Math.min(999, r + 8);
  if (boxStyle === "satin") return Math.min(999, r + 11);
  return r;
}

/** Hours line size for the “Center hrs” layout — scales with tile height. */
export function allocationCenterHoursHeroPx(calculatedHeight) {
  const raw = Math.round(calculatedHeight * 0.36);
  return Math.max(11, Math.min(26, raw));
}

/** Vertical “hours” fill inside work tiles — alpha scales with box style. */
export function allocationLoadFillTopAlpha(theme, boxStyle) {
  const light = theme === "light";
  if (boxStyle === "minimal") return light ? 0.22 : 0.3;
  if (boxStyle === "outline") return light ? 0.26 : 0.36;
  if (boxStyle === "pill") return light ? 0.3 : 0.38;
  if (boxStyle === "center") return light ? 0.28 : 0.36;
  if (boxStyle === "neon") return light ? 0.36 : 0.46;
  if (boxStyle === "glass") return light ? 0.24 : 0.32;
  if (boxStyle === "rail") return light ? 0.3 : 0.4;
  if (boxStyle === "velvet") return light ? 0.3 : 0.4;
  if (boxStyle === "luxe") return light ? 0.26 : 0.36;
  if (boxStyle === "aurora") return light ? 0.34 : 0.44;
  if (boxStyle === "satin") return light ? 0.24 : 0.32;
  return light ? 0.34 : 0.42;
}
