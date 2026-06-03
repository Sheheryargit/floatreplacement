import {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
} from "react";
import {
  readSurfaceFinish,
  writeSurfaceFinish,
  SURFACE_FINISH_CHANGED_EVENT,
  SURFACE_FINISH_LS_KEY,
} from "../config/surfaceFinishPrefs.js";

/** Personal appearance only — browser localStorage, never written to workspace_settings or Supabase. */
const STORAGE_KEY = "float-replacement-theme";
const PALETTE_STORAGE_KEY = "alloc8-palette";
const CANVAS_TINT_STORAGE_KEY = "alloc8-custom-canvas-hex";

const ThemeContext = createContext(null);

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** @returns {"system" | "dark" | "light"} First visit: light (not system). */
function readStoredPreference() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "system" || s === "dark" || s === "light") return s;
  } catch {
    /* ignore */
  }
  return "light";
}

function resolveTheme(preference) {
  if (preference === "system") return getSystemTheme();
  return preference;
}

/** @returns {"default" | "studio"} First visit: Studio typography / palette. */
function readStoredPalette() {
  try {
    const s = localStorage.getItem(PALETTE_STORAGE_KEY);
    if (s === "default") return "default";
    if (s === "studio") return "studio";
  } catch {
    /* ignore */
  }
  return "studio";
}

/** @returns {string} normalized #rrggbb or "" */
function readStoredCanvasTint() {
  try {
    const s = localStorage.getItem(CANVAS_TINT_STORAGE_KEY)?.trim();
    if (s && /^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();
  } catch {
    /* ignore */
  }
  return "";
}

/** @param {string} hex */
function normalizeCanvasTintHex(hex) {
  const t = (hex || "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(t)) return t;
  return "";
}

/**
 * @param {"dark" | "light"} resolvedTheme
 * @param {string} hex #rrggbb
 */
export function computeShellBackground(resolvedTheme, hex) {
  const n = normalizeCanvasTintHex(hex);
  if (!n) return null;
  if (resolvedTheme === "light") {
    return `color-mix(in srgb, ${n} 16%, #f8fafc)`;
  }
  return `color-mix(in srgb, ${n} 38%, #0b0e14)`;
}

function syncAppearanceDom(resolvedTheme, palette, canvasTintHex, surfaceFinish) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.dataset.theme = resolvedTheme;
  if (surfaceFinish === "satin") {
    el.dataset.surfaceFinish = "satin";
  } else {
    delete el.dataset.surfaceFinish;
  }
  if (palette === "studio") {
    el.dataset.palette = "studio";
  } else {
    el.removeAttribute("data-palette");
  }
  el.style.colorScheme = resolvedTheme === "dark" ? "dark" : "light";

  const normalized = normalizeCanvasTintHex(canvasTintHex);
  if (normalized) {
    el.dataset.customCanvas = "on";
    el.style.setProperty("--alloc8-canvas-tint", normalized);
  } else {
    delete el.dataset.customCanvas;
    el.style.removeProperty("--alloc8-canvas-tint");
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    if (normalized) {
      meta.setAttribute("content", normalized);
    } else {
      const darkBg = palette === "studio" ? "#0b0e14" : "#0b0e14";
      const lightBg = "#f8fafc";
      meta.setAttribute("content", resolvedTheme === "dark" ? darkBg : lightBg);
    }
  }
}

export function ThemeProvider({ children }) {
  const [themePreference, setThemePreferenceState] = useState(() => readStoredPreference());
  const [palettePreference, setPalettePreferenceState] = useState(() => readStoredPalette());
  const [canvasTintHex, setCanvasTintHexState] = useState(() => readStoredCanvasTint());
  const [surfaceFinish, setSurfaceFinishState] = useState(() => readSurfaceFinish());

  const resolvedTheme = useMemo(
    () => resolveTheme(themePreference),
    [themePreference]
  );

  const shellBackground = useMemo(
    () => computeShellBackground(resolvedTheme, canvasTintHex),
    [resolvedTheme, canvasTintHex]
  );

  useLayoutEffect(() => {
    syncAppearanceDom(resolvedTheme, palettePreference, canvasTintHex, surfaceFinish);
  }, [resolvedTheme, palettePreference, canvasTintHex, surfaceFinish]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, themePreference);
    } catch {
      /* ignore */
    }
  }, [themePreference]);

  useEffect(() => {
    try {
      localStorage.setItem(
        PALETTE_STORAGE_KEY,
        palettePreference === "studio" ? "studio" : "default"
      );
    } catch {
      /* ignore */
    }
  }, [palettePreference]);

  useEffect(() => {
    try {
      const n = normalizeCanvasTintHex(canvasTintHex);
      if (n) {
        localStorage.setItem(CANVAS_TINT_STORAGE_KEY, n);
      } else {
        localStorage.removeItem(CANVAS_TINT_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [canvasTintHex]);

  useEffect(() => {
    writeSurfaceFinish(surfaceFinish);
  }, [surfaceFinish]);

  useEffect(() => {
    const onFinishChange = () => setSurfaceFinishState(readSurfaceFinish());
    window.addEventListener(SURFACE_FINISH_CHANGED_EVENT, onFinishChange);
    const onStorage = (e) => {
      if (e.key === SURFACE_FINISH_LS_KEY || e.key == null) onFinishChange();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SURFACE_FINISH_CHANGED_EVENT, onFinishChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (themePreference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      syncAppearanceDom(getSystemTheme(), palettePreference, canvasTintHex, surfaceFinish);
    };
    mq.addEventListener("change", onChange);
    syncAppearanceDom(resolveTheme("system"), palettePreference, canvasTintHex, surfaceFinish);
    return () => mq.removeEventListener("change", onChange);
  }, [themePreference, palettePreference, canvasTintHex, surfaceFinish]);

  const setThemePreference = useCallback((next) => {
    setThemePreferenceState((prev) =>
      typeof next === "function" ? next(prev) : next
    );
  }, []);

  /** Legacy: flip between explicit light/dark (does not use system). */
  const toggleTheme = useCallback(() => {
    setThemePreferenceState((prev) => {
      const r = resolveTheme(prev);
      return r === "dark" ? "light" : "dark";
    });
  }, []);

  const setPalettePreference = useCallback((next) => {
    setPalettePreferenceState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      return resolved === "studio" ? "studio" : "default";
    });
  }, []);

  const setCanvasTintHex = useCallback((next) => {
    setCanvasTintHexState((prev) => {
      const raw = typeof next === "function" ? next(prev) : next;
      if (raw == null || String(raw).trim() === "") return "";
      return String(raw).trim();
    });
  }, []);

  const setSurfaceFinish = useCallback((next) => {
    setSurfaceFinishState((prev) => {
      const raw = typeof next === "function" ? next(prev) : next;
      return raw === "standard" ? "standard" : "satin";
    });
  }, []);

  const value = useMemo(
    () => ({
      /** Resolved appearance: "dark" | "light" */
      theme: resolvedTheme,
      themePreference,
      setThemePreference,
      toggleTheme,
      /** Visual preset: "default" | "studio" (typography + neutrals) */
      palette: palettePreference,
      setPalettePreference,
      /** Optional #rrggbb — tints page canvas behind surfaces (saved locally). */
      canvasTintHex,
      setCanvasTintHex,
      /** color-mix() for People/Projects shells when tint active; else null. */
      shellBackground,
      /** "standard" | "satin" — lifts chrome app-wide via data-surface-finish on html */
      surfaceFinish,
      setSurfaceFinish,
    }),
    [
      resolvedTheme,
      themePreference,
      setThemePreference,
      toggleTheme,
      palettePreference,
      setPalettePreference,
      canvasTintHex,
      setCanvasTintHex,
      shellBackground,
      surfaceFinish,
      setSurfaceFinish,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within ThemeProvider");
  }
  return ctx;
}
