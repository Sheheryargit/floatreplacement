import {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
} from "react";

const STORAGE_KEY = "float-replacement-theme";
const PALETTE_STORAGE_KEY = "alloc8-palette";

const ThemeContext = createContext(null);

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** @returns {"system" | "dark" | "light"} */
function readStoredPreference() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "system" || s === "dark" || s === "light") return s;
  } catch {
    /* ignore */
  }
  return "system";
}

function resolveTheme(preference) {
  if (preference === "system") return getSystemTheme();
  return preference;
}

/** @returns {"default" | "studio"} */
function readStoredPalette() {
  try {
    const s = localStorage.getItem(PALETTE_STORAGE_KEY);
    if (s === "studio") return "studio";
  } catch {
    /* ignore */
  }
  return "default";
}

function syncAppearanceDom(resolvedTheme, palette) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.dataset.theme = resolvedTheme;
  if (palette === "studio") {
    el.dataset.palette = "studio";
  } else {
    el.removeAttribute("data-palette");
  }
  el.style.colorScheme = resolvedTheme === "dark" ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const darkBg = palette === "studio" ? "#07080c" : "#0F1117";
    const lightBg = palette === "studio" ? "#fafafa" : "#F4F6FA";
    meta.setAttribute("content", resolvedTheme === "dark" ? darkBg : lightBg);
  }
}

export function ThemeProvider({ children }) {
  const [themePreference, setThemePreferenceState] = useState(() => readStoredPreference());
  const [palettePreference, setPalettePreferenceState] = useState(() => readStoredPalette());

  const resolvedTheme = useMemo(
    () => resolveTheme(themePreference),
    [themePreference]
  );

  useLayoutEffect(() => {
    syncAppearanceDom(resolvedTheme, palettePreference);
  }, [resolvedTheme, palettePreference]);

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
    if (themePreference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      syncAppearanceDom(getSystemTheme(), palettePreference);
    };
    mq.addEventListener("change", onChange);
    syncAppearanceDom(resolveTheme("system"), palettePreference);
    return () => mq.removeEventListener("change", onChange);
  }, [themePreference, palettePreference]);

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
    }),
    [
      resolvedTheme,
      themePreference,
      setThemePreference,
      toggleTheme,
      palettePreference,
      setPalettePreference,
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
