import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import { fetchMyProfile } from "../lib/api/profiles.js";

/** Browser gate flag (localStorage survives restarts — sessionStorage did not). */
const STORAGE_KEY = "float_auth_session";

/**
 * Display label + optionally Supabase `user.id` so mirrors never apply to someone else after account switch.
 * JSON: { displayName: string; userSub?: string | null } — omit userSub legacy (treated unknown).
 */
const PROFILE_KEY = "float_auth_profile";

/** Earlier builds used sessionStorage; migrate once keys still exist before tab closed. */
const LEGACY_GATE = "float_auth_session";
const LEGACY_PROFILE = "float_auth_profile";

/** When `true` in `.env.local`, skip the login gate (useful while SSO is UI-only). */
const loginSkipAuth = import.meta.env.VITE_LOGIN_SKIP_AUTH === "true";

function migrateLegacySessionStorageMirrorsOnce() {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    if (localStorage.getItem(STORAGE_KEY) === "1") return;

    let gate = "";
    try {
      gate = window.sessionStorage.getItem(LEGACY_GATE) ?? "";
    } catch {
      /* ignore */
    }
    if (gate !== "1") return;

    let profileRaw = "";
    try {
      profileRaw = window.sessionStorage.getItem(LEGACY_PROFILE) ?? "";
    } catch {
      /* ignore */
    }
    localStorage.setItem(STORAGE_KEY, "1");
    if (profileRaw) {
      localStorage.setItem(PROFILE_KEY, profileRaw);
    }
    try {
      sessionStorage.removeItem(LEGACY_GATE);
      sessionStorage.removeItem(LEGACY_PROFILE);
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

/** @typedef {{ displayName: string; userSub: string | null | undefined }} SessionProfileMirror */

/** @returns {SessionProfileMirror} */
function readSessionProfileMirror() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { displayName: "", userSub: undefined };
    const o = JSON.parse(raw);
    const displayName =
      typeof o?.displayName === "string" ? String(o.displayName).trim() : "";
    /** @type {string | null | undefined} */
    let userSub = undefined;
    if (Object.prototype.hasOwnProperty.call(o, "userSub")) {
      userSub =
        o.userSub === null
          ? null
          : typeof o.userSub === "string" && o.userSub.trim().length > 0
            ? o.userSub.trim()
            : undefined;
    }
    return { displayName, userSub };
  } catch {
    return { displayName: "", userSub: undefined };
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
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PROFILE_KEY);
    sessionStorage.removeItem(LEGACY_GATE);
    sessionStorage.removeItem(LEGACY_PROFILE);
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

migrateLegacySessionStorageMirrorsOnce();

export function AuthProvider({ children }) {

  const [sessionProfile, setSessionProfileState] = useState(() => {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return { displayName: "" };
    }
    try {
      if (loginSkipAuth || localStorage.getItem(STORAGE_KEY) === "1") {
        const r = readSessionProfileMirror();
        return { displayName: r.displayName };
      }
    } catch {
      /* ignore */
    }
    return { displayName: "" };
  });

  const [ok, setOk] = useState(() => {
    if (loginSkipAuth) return true;
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  // RBAC profile state: undefined = not yet loaded, null = fetch failed / no profile, object = loaded
  const [rbacProfile, setRbacProfile] = useState(undefined);
  const isApproved = rbacProfile?.approved === true;
  const appRole = rbacProfile?.app_role ?? null; // 'admin' | 'manager' | 'team_lead' | 'member' | null
  const rbacLoading = ok && isSupabaseConfigured && rbacProfile === undefined;

  const unlock = useCallback((opts) => {
    const displayNameRaw =
      typeof opts?.displayName === "string" ? opts.displayName.trim() : "";

    /** @type {SessionProfileMirror} */
    let next = readSessionProfileMirror();
    if (displayNameRaw) next = { ...next, displayName: displayNameRaw };
    if (Object.prototype.hasOwnProperty.call(opts ?? {}, "userSub")) {
      /** @type {string | null} */
      const us = opts.userSub == null ? null : String(opts.userSub);
      next = { ...next, userSub: us };
    }
    const nextProfile = { displayName: next.displayName, userSub: next.userSub };

    try {
      localStorage.setItem(STORAGE_KEY, "1");
      localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
    } catch {
      /* ignore */
    }
    setSessionProfileState({ displayName: nextProfile.displayName });
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
      setRbacProfile(undefined);
      setOk(false);
    })();
  }, []);

  /** Restore SSO session when returning from OAuth and keep gate in sync. */
  useEffect(() => {
    if (loginSkipAuth || !isSupabaseConfigured || !supabase) return undefined;

    const hydrateFromSession = (session) => {
      const u = session?.user ?? null;

      /**
       * No Supabase session.
       * Only clear the gate if the stored profile has a userSub (SSO user).
       * Password-gate users (userSub === null) should stay authenticated.
       */
      if (!u) {
        const stored = readSessionProfileMirror();
        if (stored.userSub) {
          // SSO user whose session expired / was revoked — kick to login
          clearStoredGate();
          setSessionProfileState({ displayName: "" });
          setOk(false);
        }
        // Either way, mark RBAC as resolved (no profile to load)
        setRbacProfile(null);
        return;
      }

      const id = typeof u.id === "string" && u.id.trim() ? u.id.trim() : null;
      if (!id) {
        clearStoredGate();
        setSessionProfileState({ displayName: "" });
        setRbacProfile(null);
        setOk(false);
        return;
      }

      const stale = readSessionProfileMirror();
      if (
        stale.userSub != null &&
        typeof stale.userSub === "string" &&
        stale.userSub !== id
      ) {
        clearStoredGate();
      }

      unlock({ displayName: displayNameFromSupabaseUser(u), userSub: id });

      // Fetch RBAC profile now that session is confirmed
      fetchMyProfile().then((p) => setRbacProfile(p ?? null));
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
          setRbacProfile(undefined);
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
      hydrateFromSession(data.session ?? null);
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

  /**
   * Fallback: resolve rbacProfile for password-gate users.
   * The main profile fetch lives inside hydrateFromSession (SSO path).
   * Password logins never trigger an auth event, so rbacProfile stays undefined.
   * This effect detects that case and sets rbacProfile = null (skip RBAC).
   */
  useEffect(() => {
    if (!ok || !isSupabaseConfigured || rbacProfile !== undefined) return;
    let canceled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (canceled) return;
      if (data.session) {
        // Unexpected: SSO session exists but hydrateFromSession didn't fire yet.
        // Fetch profile as a safety net.
        fetchMyProfile().then((p) => {
          if (!canceled) setRbacProfile(p ?? null);
        });
      } else {
        // No SSO session → password-gate login → skip RBAC
        setRbacProfile(null);
      }
    });
    return () => { canceled = true; };
  }, [ok, rbacProfile]);

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
      // RBAC
      rbacProfile,
      rbacLoading,
      isApproved,
      appRole,
    }),
    [ok, unlock, lock, sessionProfile.displayName, rbacProfile, rbacLoading, isApproved, appRole]
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
