import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

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

/** Display label from Supabase user (OAuth / SSO). */
function displayNameFromSupabaseUser(user) {
  if (!user) return "";
  const metaName =
    typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const metaNameAzure =
    typeof user.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "";
  const email = typeof user.email === "string" ? user.email.trim() : "";
  const fromEmail =
    email && email.includes("@")
      ? email
          .split("@")[0]
          .split(/[._]/)
          .filter(Boolean)
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
          .join(" ")
      : "";
  const localPart = email.includes("@") ? email.split("@")[0] : "";
  return metaName || metaNameAzure || fromEmail || localPart || "Workspace member";
}

/** Clears app gate flags only — used after Supabase emits SIGNED_OUT (avoid recursive signOut). */
function clearStoredGate() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
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

  const lock = useCallback(() => {
    void (async () => {
      try {
        if (isSupabaseConfigured && supabase) {
          await supabase.auth.signOut();
        }
      } catch {
        /* ignore */
      }
      clearStoredGate();
      setSessionProfileState({ displayName: "" });
      setOk(false);
    })();
  }, []);

  /** Restore SSO session when returning from OAuth and keep gate in sync. */
  useEffect(() => {
    if (loginSkipAuth || !isSupabaseConfigured || !supabase) return undefined;

    const hydrateFromSession = (session) => {
      const u = session?.user;
      if (!u) return;
      unlock({ displayName: displayNameFromSupabaseUser(u) });
    };

    let unsub;
    try {
      const result = supabase.auth.onAuthStateChange((event, session) => {
        if (
          event === "INITIAL_SESSION" ||
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED"
        ) {
          hydrateFromSession(session ?? null);
          return;
        }
        if (event === "PASSWORD_RECOVERY") {
          hydrateFromSession(session ?? null);
          return;
        }
        if (event === "SIGNED_OUT") {
          clearStoredGate();
          setSessionProfileState({ displayName: "" });
          setOk(false);
          return;
        }
      });
      unsub = result?.data?.subscription;
    } catch {
      return undefined;
    }

    let canceled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (canceled) return;
      hydrateFromSession(data.session);
    });

    return () => {
      canceled = true;
      try {
        unsub?.unsubscribe();
      } catch {
        /* ignore */
      }
    };
  }, [loginSkipAuth, unlock]);

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
