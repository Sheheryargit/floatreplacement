import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/Button.jsx";
import {
  deleteWorkspaceAccess,
  fetchWorkspaceAccessList,
  formatWorkspaceAccessError,
  isAllowedDeloitteEmail,
  upsertWorkspaceAccess,
} from "../../lib/api/workspaceAccess.js";
import "./WorkspaceAccessManager.css";

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

export function WorkspaceAccessManager({ isWorkspaceAdmin, layout = "embedded" }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingEmail, setSavingEmail] = useState("");
  const [query, setQuery] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const loadedOnceRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!isWorkspaceAdmin) return;
    setLoading(true);
    try {
      const list = await fetchWorkspaceAccessList();
      setRows(list);
      loadedOnceRef.current = true;
    } catch (e) {
      toast.error("Could not load access list", {
        description: formatWorkspaceAccessError(e),
        className: "alloc8-toast",
        duration: 9000,
      });
    } finally {
      setLoading(false);
    }
  }, [isWorkspaceAdmin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const adminsCount = useMemo(
    () => rows.reduce((n, r) => n + (r.isWorkspaceAdmin ? 1 : 0), 0),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(q));
  }, [rows, query]);

  const setRow = useCallback((email, patch) => {
    setRows((prev) =>
      prev.map((r) => (r.email === email ? { ...r, ...patch } : r))
    );
  }, []);

  const save = useCallback(
    async (email, patch) => {
      const em = normEmail(email);
      if (!em) return;
      setSavingEmail(em);
      try {
        const existing = rows.find((r) => r.email === em);
        const next = {
          email: em,
          accessEnabled: patch.accessEnabled ?? existing?.accessEnabled ?? true,
          isWorkspaceAdmin:
            patch.isWorkspaceAdmin ?? existing?.isWorkspaceAdmin ?? false,
        };
        const saved = await upsertWorkspaceAccess(next);
        setRow(em, saved);
      } catch (e) {
        toast.error("Could not save access", {
          description: formatWorkspaceAccessError(e),
          className: "alloc8-toast",
        });
        await refresh();
      } finally {
        setSavingEmail("");
      }
    },
    [rows, refresh, setRow]
  );

  const onToggleAccess = useCallback(
    async (r) => {
      await save(r.email, { accessEnabled: !r.accessEnabled });
    },
    [save]
  );

  const onToggleAdmin = useCallback(
    async (r) => {
      if (r.isWorkspaceAdmin && adminsCount <= 1) {
        toast.error("At least one admin required", {
          description: "You can’t remove the last Workspace Admin.",
          className: "alloc8-toast",
        });
        return;
      }
      await save(r.email, { isWorkspaceAdmin: !r.isWorkspaceAdmin });
    },
    [save, adminsCount]
  );

  const onDelete = useCallback(
    async (r) => {
      if (r.isWorkspaceAdmin && adminsCount <= 1) {
        toast.error("At least one admin required", {
          description: "You can’t delete the last Workspace Admin.",
          className: "alloc8-toast",
        });
        return;
      }
      const em = normEmail(r.email);
      setSavingEmail(em);
      try {
        await deleteWorkspaceAccess(em);
        setRows((prev) => prev.filter((x) => x.email !== em));
        toast.success("Removed", { description: em, className: "alloc8-toast" });
      } catch (e) {
        toast.error("Could not remove user", {
          description: formatWorkspaceAccessError(e),
          className: "alloc8-toast",
        });
      } finally {
        setSavingEmail("");
      }
    },
    [adminsCount]
  );

  const addDisabled = useMemo(() => {
    const em = normEmail(addEmail);
    if (!em) return true;
    if (!isAllowedDeloitteEmail(em)) return true;
    if (rows.some((r) => r.email === em)) return true;
    return false;
  }, [addEmail, rows]);

  const onAdd = useCallback(async () => {
    const em = normEmail(addEmail);
    if (!em) return;
    if (!isAllowedDeloitteEmail(em)) {
      toast.error("Only Deloitte emails allowed", {
        description: "Use @deloitte.com or @deloitte.com.au",
        className: "alloc8-toast",
      });
      return;
    }
    setSavingEmail(em);
    try {
      const saved = await upsertWorkspaceAccess({
        email: em,
        accessEnabled: true,
        isWorkspaceAdmin: false,
      });
      setRows((prev) => [...prev, saved].sort((a, b) => a.email.localeCompare(b.email)));
      setAddEmail("");
      toast.success("Added", { description: saved.email, className: "alloc8-toast" });
    } catch (e) {
      toast.error("Could not add user", {
        description: formatWorkspaceAccessError(e),
        className: "alloc8-toast",
      });
      await refresh();
    } finally {
      setSavingEmail("");
    }
  }, [addEmail, refresh]);

  if (!isWorkspaceAdmin) return null;

  return (
    <div className={"ws-access" + (layout === "page" ? " ws-access--page" : "")}>
      <div className="ws-access-head">
        <div className="ws-access-head-left">
          <p className="ws-access-note">
            Workspace access is enforced at SSO sign-in. Turn <strong>Access</strong> off to block entry.
          </p>
          <p className="ws-access-subnote">
            Only <strong>@deloitte.com</strong> and <strong>@deloitte.com.au</strong> emails are permitted.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      <div className="ws-access-toolbar">
        <input
          className="ws-access-input"
          placeholder="Search email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="ws-access-add">
          <input
            className="ws-access-input"
            placeholder="Add Deloitte email…"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            inputMode="email"
            autoComplete="email"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={() => void onAdd()}
            disabled={addDisabled || savingEmail !== "" || loading}
          >
            Add
          </Button>
        </div>
      </div>

      <div className="ws-access-meta">
        <span>
          {loading && !loadedOnceRef.current ? "Loading…" : `${filtered.length} shown / ${rows.length} total`}
        </span>
        <span>{`${adminsCount} admin${adminsCount === 1 ? "" : "s"}`}</span>
      </div>

      <div className="ws-access-list" role="list" aria-label="Workspace access list">
        {filtered.map((r) => {
          const busy = savingEmail === r.email;
          const accessLabel = r.accessEnabled ? "Yes" : "No";
          const adminLabel = r.isWorkspaceAdmin ? "Yes" : "No";
          return (
            <div key={r.email} className="ws-access-row" role="listitem">
              <div className="ws-access-email">{r.email}</div>
              <div className="ws-access-actions">
                <div className="ws-access-toggle" role="group" aria-label={`Access for ${r.email}`}>
                  <button
                    type="button"
                    className={"ws-access-toggle-btn" + (!r.accessEnabled ? " ws-access-toggle-btn--active" : "")}
                    aria-pressed={!r.accessEnabled}
                    onClick={() => void onToggleAccess(r)}
                    disabled={busy || loading}
                  >
                    Access: {accessLabel}
                  </button>
                </div>
                <div className="ws-access-toggle" role="group" aria-label={`Admin for ${r.email}`}>
                  <button
                    type="button"
                    className={"ws-access-toggle-btn" + (r.isWorkspaceAdmin ? " ws-access-toggle-btn--active" : "")}
                    aria-pressed={r.isWorkspaceAdmin}
                    onClick={() => void onToggleAdmin(r)}
                    disabled={busy || loading}
                  >
                    Admin: {adminLabel}
                  </button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void onDelete(r)}
                  disabled={busy || loading}
                  className="ws-access-remove"
                >
                  Remove
                </Button>
              </div>
            </div>
          );
        })}
        {!loading && filtered.length === 0 ? (
          <div className="ws-access-empty">
            No matches. Try clearing search or adding a user.
          </div>
        ) : null}
      </div>
    </div>
  );
}

