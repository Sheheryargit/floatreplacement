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
const STORAGE_PALETTE_KEY = "float-replacement-palette";

/** @returns {"alloc8" | "stellar"} */
function readStoredPalette() {
  try {
    const s = localStorage.getItem(STORAGE_PALETTE_KEY);
    if (s === "alloc8" || s === "stellar") return s;
  } catch {
    /* ignore */
  }
  return "alloc8";
}

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

function syncThemeDom(resolved, palette) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.palette = palette;
  document.documentElement.style.colorScheme = resolved === "dark" ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    if (palette === "stellar") {
      meta.setAttribute("content", resolved === "dark" ? "#0c0c0e" : "#f5f5f7");
    } else {
      meta.setAttribute("content", resolved === "dark" ? "#0F1117" : "#F4F6FA");
    }
  }
}

export function ThemeProvider({ children }) {
  const [themePreference, setThemePreferenceState] = useState(() => readStoredPreference());
  const [palette, setPaletteState] = useState(() => readStoredPalette());

  const resolvedTheme = useMemo(
    () => resolveTheme(themePreference),
    [themePreference]
  );

  useLayoutEffect(() => {
    syncThemeDom(resolvedTheme, palette);
  }, [resolvedTheme, palette]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, themePreference);
    } catch {
      /* ignore */
    }
  }, [themePreference]);

  useEffect(() => {
    if (themePreference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      syncThemeDom(getSystemTheme(), palette);
    };
    mq.addEventListener("change", onChange);
    syncThemeDom(resolveTheme("system"), palette);
    return () => mq.removeEventListener("change", onChange);
  }, [themePreference, palette]);

  const setThemePreference = useCallback((next) => {
    setThemePreferenceState((prev) =>
      typeof next === "function" ? next(prev) : next
    );
  }, []);

  const setPalette = useCallback((next) => {
    setPaletteState((prev) => {
      const v = typeof next === "function" ? next(prev) : next;
      if (v !== "alloc8" && v !== "stellar") return prev;
      try {
        localStorage.setItem(STORAGE_PALETTE_KEY, v);
      } catch {
        /* ignore */
      }
      return v;
    });
  }, []);

  /** Legacy: flip between explicit light/dark (does not use system). */
  const toggleTheme = useCallback(() => {
    setThemePreferenceState((prev) => {
      const r = resolveTheme(prev);
      return r === "dark" ? "light" : "dark";
    });
  }, []);

  const value = useMemo(
    () => ({
      /** Resolved appearance: "dark" | "light" */
      theme: resolvedTheme,
      themePreference,
      setThemePreference,
      toggleTheme,
      /** Color story: "alloc8" (teal) | "stellar" (graphite + Tesla red / Apple blue) */
      palette,
      setPalette,
    }),
    [resolvedTheme, themePreference, setThemePreference, toggleTheme, palette, setPalette]
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
