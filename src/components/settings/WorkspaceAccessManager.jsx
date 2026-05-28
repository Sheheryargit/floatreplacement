import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
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

function emailInitial(email) {
  const local = normEmail(email).split("@")[0] || "";
  return (local[0] || "?").toUpperCase();
}

function AccessSwitch({ checked, labelOn, labelOff, onChange, disabled, ariaLabel }) {
  return (
    <button
      type="button"
      className={"ws-switch" + (checked ? " ws-switch--on" : "")}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onChange}
    >
      <span className="ws-switch-track" aria-hidden>
        <span className="ws-switch-thumb" />
      </span>
      <span className="ws-switch-text">{checked ? labelOn : labelOff}</span>
    </button>
  );
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

  const stats = useMemo(() => {
    const total = rows.length;
    const admins = rows.filter((r) => r.isWorkspaceAdmin).length;
    const blocked = rows.filter((r) => !r.accessEnabled).length;
    return { total, admins, blocked, active: total - blocked };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(q));
  }, [rows, query]);

  const setRow = useCallback((email, patch) => {
    setRows((prev) => prev.map((r) => (r.email === email ? { ...r, ...patch } : r)));
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
          isWorkspaceAdmin: patch.isWorkspaceAdmin ?? existing?.isWorkspaceAdmin ?? false,
        };
        const saved = await upsertWorkspaceAccess(next);
        setRow(em, saved);
      } catch (e) {
        toast.error("Could not save", {
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
      if (r.isWorkspaceAdmin && stats.admins <= 1) {
        toast.error("At least one admin required", {
          description: "You can’t remove the last workspace admin.",
          className: "alloc8-toast",
        });
        return;
      }
      await save(r.email, { isWorkspaceAdmin: !r.isWorkspaceAdmin });
    },
    [save, stats.admins]
  );

  const onDelete = useCallback(
    async (r) => {
      if (r.isWorkspaceAdmin && stats.admins <= 1) {
        toast.error("At least one admin required", {
          description: "You can’t remove the last workspace admin.",
          className: "alloc8-toast",
        });
        return;
      }
      const em = normEmail(r.email);
      setSavingEmail(em);
      try {
        await deleteWorkspaceAccess(em);
        setRows((prev) => prev.filter((x) => x.email !== em));
        toast.success("Removed", { className: "alloc8-toast" });
      } catch (e) {
        toast.error("Could not remove", {
          description: formatWorkspaceAccessError(e),
          className: "alloc8-toast",
        });
      } finally {
        setSavingEmail("");
      }
    },
    [stats.admins]
  );

  const addDisabled = useMemo(() => {
    const em = normEmail(addEmail);
    if (!em || !isAllowedDeloitteEmail(em)) return true;
    return rows.some((r) => r.email === em);
  }, [addEmail, rows]);

  const onAdd = useCallback(async () => {
    const em = normEmail(addEmail);
    if (!em || !isAllowedDeloitteEmail(em)) {
      toast.error("Deloitte email required", {
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
      toast.success("User added", { className: "alloc8-toast" });
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

  const isPage = layout === "page";
  const busy = loading && !loadedOnceRef.current;

  return (
    <section
      className={"ws-access" + (isPage ? " ws-access--page" : "")}
      aria-label="Workspace access management"
    >
      {layout === "embedded" ? (
        <p className="ws-access-embedded-note">
          Only Deloitte domains. Access is enforced at SSO sign-in.
        </p>
      ) : null}

      <div className="ws-access-toolbar">
        <div className="ws-access-search">
          <Search className="ws-access-search-icon" size={16} strokeWidth={2} aria-hidden />
          <input
            className="ws-access-input"
            type="search"
            placeholder="Search by email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search users"
          />
        </div>

        <form
          className="ws-access-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (!addDisabled && !loading) void onAdd();
          }}
        >
          <input
            className="ws-access-input"
            type="email"
            placeholder="name@deloitte.com.au"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            autoComplete="off"
            aria-label="Add Deloitte email"
          />
          <button
            type="submit"
            className="ws-access-btn ws-access-btn--primary"
            disabled={addDisabled || savingEmail !== "" || loading}
          >
            <Plus size={16} strokeWidth={2.25} aria-hidden />
            Add
          </button>
        </form>

        <button
          type="button"
          className="ws-access-btn ws-access-btn--icon"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="Refresh list"
          title="Refresh"
        >
          <RefreshCw size={16} strokeWidth={2} className={loading ? "ws-spin" : ""} aria-hidden />
        </button>
      </div>

      <div className="ws-access-stats" aria-label="Summary">
        <span className="ws-stat">
          <span className="ws-stat-value">{busy ? "—" : stats.total}</span>
          <span className="ws-stat-label">Total</span>
        </span>
        <span className="ws-stat">
          <span className="ws-stat-value">{busy ? "—" : stats.active}</span>
          <span className="ws-stat-label">Allowed</span>
        </span>
        <span className="ws-stat">
          <span className="ws-stat-value">{busy ? "—" : stats.blocked}</span>
          <span className="ws-stat-label">Blocked</span>
        </span>
        <span className="ws-stat">
          <span className="ws-stat-value">{busy ? "—" : stats.admins}</span>
          <span className="ws-stat-label">Admins</span>
        </span>
      </div>

      <div className="ws-access-card">
        <div className="ws-access-table-wrap">
          <table className="ws-access-table">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Access</th>
                <th scope="col">Admin</th>
                <th scope="col" className="ws-access-th-actions">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {busy ? (
                <tr>
                  <td colSpan={4} className="ws-access-loading">
                    <Loader2 size={20} strokeWidth={2} className="ws-spin" aria-hidden />
                    Loading users…
                  </td>
                </tr>
              ) : null}

              {!busy &&
                filtered.map((r) => {
                  const rowBusy = savingEmail === r.email;
                  return (
                    <tr key={r.email} className={rowBusy ? "ws-access-tr--busy" : ""}>
                      <td>
                        <div className="ws-user-cell">
                          <span className="ws-user-avatar" aria-hidden>
                            {emailInitial(r.email)}
                          </span>
                          <div className="ws-user-meta">
                            <span className="ws-user-email">{r.email}</span>
                            {r.isWorkspaceAdmin ? (
                              <span className="ws-user-badge">Workspace admin</span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <AccessSwitch
                          checked={r.accessEnabled}
                          labelOn="Allowed"
                          labelOff="Blocked"
                          ariaLabel={`Access for ${r.email}`}
                          disabled={rowBusy || loading}
                          onChange={() => void onToggleAccess(r)}
                        />
                      </td>
                      <td>
                        <AccessSwitch
                          checked={r.isWorkspaceAdmin}
                          labelOn="Admin"
                          labelOff="Member"
                          ariaLabel={`Admin role for ${r.email}`}
                          disabled={rowBusy || loading}
                          onChange={() => void onToggleAdmin(r)}
                        />
                      </td>
                      <td className="ws-access-td-actions">
                        <button
                          type="button"
                          className="ws-access-btn ws-access-btn--ghost ws-access-btn--icon"
                          onClick={() => void onDelete(r)}
                          disabled={rowBusy || loading}
                          aria-label={`Remove ${r.email}`}
                          title="Remove"
                        >
                          <Trash2 size={15} strokeWidth={2} aria-hidden />
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          {!busy && filtered.length === 0 ? (
            <div className="ws-access-empty">
              <p>No users match your search.</p>
              <p className="ws-access-empty-hint">Add a Deloitte email above to allow sign-in.</p>
            </div>
          ) : null}
        </div>

        {!busy && filtered.length > 0 ? (
          <footer className="ws-access-footer">
            Showing {filtered.length} of {rows.length}
          </footer>
        ) : null}
      </div>
    </section>
  );
}
