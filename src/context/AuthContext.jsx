import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";


// CHANGE: when SSO is implemented
const STORAGE_KEY = "float_auth_session";

/** When `true` in `.env.local`, skip the login gate (useful while SSO is UI-only). */
const loginSkipAuth = import.meta.env.VITE_LOGIN_SKIP_AUTH === "true";

const AuthContext = createContext(null);

// CHANGE: when SSO is implemented
const PERSISTED_USER_KEY = "float_current_user";
function loadPersistedUser() {
  try {
    const raw = localStorage.getItem(PERSISTED_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [ok, setOk] = useState(() => {
    if (loginSkipAuth) return true;
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  // CHANGE: when SSO is implemented
  const [currentUser, setCurrentUser] = useState(() => {
    if (loginSkipAuth) return loadPersistedUser();
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "1"
        ? loadPersistedUser()
        : null;
    } catch {
      return null;
    }
  });

  // CHANGE: when SSO is implemented 
  const unlock = useCallback((person) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
      localStorage.setItem(PERSISTED_USER_KEY, JSON.stringify(person));
    } catch {
      /* ignore */
    }
    setCurrentUser(person);
    setOk(true);
  }, []);


  // CHANGE: when SSO is implemented
  const lock = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PERSISTED_USER_KEY);
    } catch {
      /* ignore */
    }
    setOk(false);
    setCurrentUser(null);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("logout") !== "1") return;
    lock();
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
  }, [lock]);

  const value = useMemo(
    () => ({ isAuthenticated: ok, currentUser, unlock, lock }),
    [ok, currentUser, unlock, lock]
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
