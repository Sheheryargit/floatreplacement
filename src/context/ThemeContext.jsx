import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";

const STORAGE_KEY = "float-replacement-theme";

const ThemeContext = createContext(null);

function readStoredTheme() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "dark" || s === "light") return s;
  } catch {
    /* ignore */
  }
  return "light";
}

function syncThemeDom(theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const t = readStoredTheme();
    if (typeof document !== "undefined") syncThemeDom(t);
    return t;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
    syncThemeDom(theme);
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState((prev) => (typeof next === "function" ? next(prev) : next));
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((x) => (x === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
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
