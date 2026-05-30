import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { useAuth, isPasswordWorkspaceGate } from "./AuthContext.jsx";
import { useAppStore } from "./AppDataContext.jsx";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import { presencePageLabel } from "../lib/presence/presencePageLabel.js";
import { mergePresenceState, resolveOnlineUsers } from "../lib/presence/presenceState.js";

const PRESENCE_CHANNEL = "workspace-presence";
const SYNC_DEBOUNCE_MS = 100;

const WorkspacePresenceContext = createContext(null);

export function WorkspacePresenceProvider({ children }) {
  const location = useLocation();
  const people = useAppStore((s) => s.people);
  const { sessionDisplayName, workspaceEmail, isAuthenticated } = useAuth();

  const passwordGate = isPasswordWorkspaceGate();
  const realtimeEnabled = isAuthenticated && isSupabaseConfigured && !!supabase && !passwordGate;

  const [onlineUsers, setOnlineUsers] = useState([]);
  const peopleRef = useRef(people);
  const pathnameRef = useRef(location.pathname);
  const syncTimerRef = useRef(null);
  const channelRef = useRef(null);
  const channelReadyRef = useRef(false);
  const trackSelfRef = useRef(async () => false);

  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  const applyPresenceState = useCallback((state) => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null;
      setOnlineUsers(mergePresenceState(state, peopleRef.current));
    }, SYNC_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (!realtimeEnabled) {
      channelReadyRef.current = false;
      setOnlineUsers([]);
      return undefined;
    }

    let cancelled = false;
    let subscribed = false;

    const syncFromChannel = () => {
      const ch = channelRef.current;
      if (!ch) return;
      applyPresenceState(ch.presenceState());
    };

    const trackSelf = async () => {
      const ch = channelRef.current;
      if (!ch || cancelled) return false;
      const { data } = await supabase.auth.getSession();
      const u = data?.session?.user;
      if (!u || cancelled) return false;

      const email = String(u.email || workspaceEmail || "").trim().toLowerCase();
      const displayName = sessionDisplayName || email.split("@")[0] || "Teammate";

      try {
        await ch.track({
          email,
          displayName,
          userSub: u.id,
          page: pathnameRef.current,
          lastSeen: Date.now(),
        });
        return true;
      } catch {
        return false;
      }
    };

    trackSelfRef.current = trackSelf;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id;
      if (!userId || cancelled) return;

      const channel = supabase.channel(PRESENCE_CHANNEL, {
        config: { presence: { key: userId } },
      });
      channelRef.current = channel;

      channel
        .on("presence", { event: "sync" }, syncFromChannel)
        .on("presence", { event: "join" }, syncFromChannel)
        .on("presence", { event: "leave" }, syncFromChannel);

      channel.subscribe(async (status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          subscribed = true;
          channelReadyRef.current = true;
          await trackSelf();
          syncFromChannel();
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          channelReadyRef.current = false;
        }
      });
    })();

    const onBeforeUnload = () => {
      void channelRef.current?.untrack();
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      cancelled = true;
      trackSelfRef.current = async () => false;
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      const ch = channelRef.current;
      channelRef.current = null;
      channelReadyRef.current = false;
      if (ch) {
        void ch.untrack();
        void supabase.removeChannel(ch);
      }
    };
  }, [realtimeEnabled, applyPresenceState, sessionDisplayName, workspaceEmail]);

  useEffect(() => {
    if (!realtimeEnabled || !channelReadyRef.current) return;
    void trackSelfRef.current();
  }, [realtimeEnabled, location.pathname, workspaceEmail, sessionDisplayName]);

  const resolvedUsers = useMemo(
    () =>
      resolveOnlineUsers({
        isAuthenticated,
        isSupabaseConfigured,
        passwordGate,
        sessionDisplayName,
        workspaceEmail,
        pathname: location.pathname,
        onlineUsers,
      }),
    [
      isAuthenticated,
      passwordGate,
      sessionDisplayName,
      workspaceEmail,
      location.pathname,
      onlineUsers,
    ]
  );

  const value = useMemo(
    () => ({
      onlineUsers: resolvedUsers,
      visible: isAuthenticated && (passwordGate || realtimeEnabled),
      count: resolvedUsers.length,
      pageLabel: (path) => presencePageLabel(path),
    }),
    [resolvedUsers, isAuthenticated, passwordGate, realtimeEnabled]
  );

  return (
    <WorkspacePresenceContext.Provider value={value}>
      {children}
    </WorkspacePresenceContext.Provider>
  );
}

export function useWorkspacePresence() {
  const ctx = useContext(WorkspacePresenceContext);
  if (!ctx) {
    throw new Error("useWorkspacePresence must be used within WorkspacePresenceProvider");
  }
  return ctx;
}
