import { useEffect, useRef } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabase.js";
import { useAppStore } from "../../context/AppDataContext.jsx";
import { syncPersonProfileFromSsoUser } from "../../lib/auth/ssoPersonSync.js";

/** After workspace load, backfill roster email/role from Azure SSO when fields are empty. */
export function SsoPersonProfileSync() {
  const workspaceReady = useAppStore((s) => s.workspaceReady);
  const setPeople = useAppStore((s) => s.setPeople);
  const syncedUserIdRef = useRef("");

  useEffect(() => {
    if (!workspaceReady || !isSupabaseConfigured || !supabase) return undefined;

    let canceled = false;
    void (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (canceled || error) return;
      const user = data?.user;
      if (!user?.id || syncedUserIdRef.current === user.id) return;
      syncedUserIdRef.current = user.id;
      const people = useAppStore.getState().people;
      await syncPersonProfileFromSsoUser({ user, people, setPeople });
    })();

    return () => {
      canceled = true;
    };
  }, [workspaceReady, setPeople]);

  return null;
}
