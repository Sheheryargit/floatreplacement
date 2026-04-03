import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";

const STORAGE_KEY = "float_auth_session";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [ok, setOk] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const unlock = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOk(true);
  }, []);

  const lock = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setOk(false);
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated: ok, unlock, lock }),
    [ok, unlock, lock]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
