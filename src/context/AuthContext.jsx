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
const PROFILE_KEY = "float_auth_profile";

/** When `true` in `.env.local`, skip the login gate (useful while SSO is UI-only). */
const loginSkipAuth = import.meta.env.VITE_LOGIN_SKIP_AUTH === "true";

function readSessionProfile() {
  try {
    const raw = sessionStorage.getItem(PROFILE_KEY);
    if (!raw) return { displayName: "" };
    const o = JSON.parse(raw);
    return { displayName: typeof o?.displayName === "string" ? o.displayName : "" };
  } catch {
    return { displayName: "" };
  }
}

/** First letters for avatar chips (workspace session label). */
export function initialsFromDisplayName(name) {
  const s = String(name || "").trim();
  if (!s) return "";
  const p = s.split(/\s+/);
  if (p.length === 1) return (p[0][0] || "").toUpperCase();
  return `${p[0][0] || ""}${p[p.length - 1][0] || ""}`.toUpperCase();
}

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
  const [sessionProfile, setSessionProfileState] = useState(() => {
    if (typeof sessionStorage === "undefined") return { displayName: "" };
    try {
      if (loginSkipAuth || sessionStorage.getItem(STORAGE_KEY) === "1") {
        return readSessionProfile();
      }
    } catch {
      /* ignore */
    }
    return { displayName: "" };
  });

  const [ok, setOk] = useState(() => {
    if (loginSkipAuth) return true;
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const unlock = useCallback((opts) => {
    const displayName =
      typeof opts?.displayName === "string" ? opts.displayName.trim() : "";
    const nextProfile = displayName ? { displayName } : readSessionProfile();
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
      if (displayName) {
        sessionStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
      } else if (!sessionStorage.getItem(PROFILE_KEY)) {
        sessionStorage.setItem(PROFILE_KEY, JSON.stringify({ displayName: "" }));
      }
    } catch {
      /* ignore */
    }
    setSessionProfileState(nextProfile);
    setOk(true);
  }, []);


  // CHANGE: when SSO is implemented
  const lock = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(PROFILE_KEY);
    } catch {
      /* ignore */
    }
    setSessionProfileState({ displayName: "" });
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
    () => ({
      isAuthenticated: ok,
      unlock,
      lock,
      sessionDisplayName: sessionProfile.displayName,
    }),
    [ok, unlock, lock, sessionProfile.displayName]
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
