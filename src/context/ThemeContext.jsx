import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";

const STORAGE_KEY = "float-replacement-theme";

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

function syncThemeDom(resolved) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [themePreference, setThemePreferenceState] = useState(() => readStoredPreference());

  const resolvedTheme = useMemo(
    () => resolveTheme(themePreference),
    [themePreference]
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, themePreference);
    } catch {
      /* ignore */
    }
    syncThemeDom(resolvedTheme);
  }, [themePreference, resolvedTheme]);

  useEffect(() => {
    if (themePreference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      syncThemeDom(getSystemTheme());
    };
    mq.addEventListener("change", onChange);
    syncThemeDom(resolveTheme("system"));
    return () => mq.removeEventListener("change", onChange);
  }, [themePreference]);

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

  const value = useMemo(
    () => ({
      /** Resolved appearance: "dark" | "light" */
      theme: resolvedTheme,
      themePreference,
      setThemePreference,
      toggleTheme,
    }),
    [resolvedTheme, themePreference, setThemePreference, toggleTheme]
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
