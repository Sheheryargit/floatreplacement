import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Crown,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldOff,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
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

function AccessSwitch({ checked, labelOn, labelOff, onChange, disabled, ariaLabel, tone = "default" }) {
  return (
    <motion.button
      type="button"
      className={
        "ws-switch" +
        (checked ? " ws-switch--on" : "") +
        (tone === "admin" ? " ws-switch--admin" : "")
      }
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onChange}
      whileTap={disabled ? undefined : { scale: 0.97 }}
    >
      <span className="ws-switch-track" aria-hidden>
        <span className="ws-switch-thumb" />
      </span>
      <span className="ws-switch-text">{checked ? labelOn : labelOff}</span>
    </motion.button>
  );
}

function AccessRow({
  row,
  rowBusy,
  loading,
  reduceMotion,
  index,
  variant,
  onToggleAccess,
  onToggleAdmin,
  onDelete,
}) {
  return (
    <motion.tr
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: rowBusy ? 0.5 : 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0 }}
      transition={{ duration: 0.2, delay: reduceMotion ? 0 : Math.min(index * 0.015, 0.12) }}
      className={
        "ws-row" +
        (variant === "admin" ? " ws-row--admin" : " ws-row--member") +
        (rowBusy ? " ws-row--busy" : "") +
        (!row.accessEnabled ? " ws-row--blocked" : "")
      }
    >
      <td className="ws-col-user">
        <div className="ws-user">
          <span className={"ws-avatar" + (variant === "admin" ? " ws-avatar--admin" : "")} aria-hidden>
            {emailInitial(row.email)}
          </span>
          <div className="ws-user-text">
            <span className="ws-email">{row.email}</span>
            <span className="ws-user-sub">
              {variant === "admin" ? "Workspace administrator" : "Workspace member"}
            </span>
          </div>
        </div>
      </td>
      <td className="ws-col-status">
        <span className={"ws-status" + (row.accessEnabled ? " ws-status--on" : " ws-status--off")}>
          {row.accessEnabled ? "Allowed" : "Blocked"}
        </span>
      </td>
      <td className="ws-col-access">
        <AccessSwitch
          checked={row.accessEnabled}
          labelOn="Allowed"
          labelOff="Blocked"
          ariaLabel={`Access for ${row.email}`}
          disabled={rowBusy || loading}
          onChange={() => onToggleAccess(row)}
        />
      </td>
      <td className="ws-col-admin">
        <AccessSwitch
          checked={row.isWorkspaceAdmin}
          labelOn="Admin"
          labelOff="Standard"
          tone="admin"
          ariaLabel={`Administrator for ${row.email}`}
          disabled={rowBusy || loading}
          onChange={() => onToggleAdmin(row)}
        />
      </td>
      <td className="ws-col-action">
        <button
          type="button"
          className="ws-icon-btn"
          onClick={() => onDelete(row)}
          disabled={rowBusy || loading}
          aria-label={`Remove ${row.email}`}
          title="Remove user"
        >
          <Trash2 size={16} strokeWidth={1.85} />
        </button>
      </td>
    </motion.tr>
  );
}

function AccessSection({
  variant,
  title,
  subtitle,
  icon: Icon,
  rows,
  busy,
  loading,
  savingEmail,
  reduceMotion,
  onToggleAccess,
  onToggleAdmin,
  onDelete,
}) {
  if (!busy && rows.length === 0) return null;

  return (
    <section className={"ws-section ws-section--" + variant} aria-label={title}>
      <header className="ws-section-head">
        <div className="ws-section-title-wrap">
          <span className={"ws-section-icon ws-section-icon--" + variant} aria-hidden>
            <Icon size={18} strokeWidth={2} />
          </span>
          <div>
            <h2 className="ws-section-title">{title}</h2>
            <p className="ws-section-sub">{subtitle}</p>
          </div>
        </div>
        <span className="ws-section-count">{busy ? "—" : rows.length}</span>
      </header>

      <div className="ws-table-surface">
        <table className="ws-table">
          <thead>
            <tr>
              <th scope="col">User</th>
              <th scope="col">Status</th>
              <th scope="col">Access</th>
              <th scope="col">Administrator</th>
              <th scope="col" className="ws-th-action">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {busy
              ? Array.from({ length: variant === "admin" ? 2 : 4 }, (_, i) => (
                  <tr key={`sk-${variant}-${i}`} className="ws-row--skel" aria-hidden>
                    <td colSpan={5}>
                      <div className="ws-skel" />
                    </td>
                  </tr>
                ))
              : null}
            <AnimatePresence mode="popLayout">
              {!busy &&
                rows.map((r, index) => (
                  <AccessRow
                    key={r.email}
                    row={r}
                    rowBusy={savingEmail === r.email}
                    loading={loading}
                    reduceMotion={reduceMotion}
                    index={index}
                    variant={variant}
                    onToggleAccess={onToggleAccess}
                    onToggleAdmin={onToggleAdmin}
                    onDelete={onDelete}
                  />
                ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </section>
  );
}

const METRICS = [
  { id: "all", label: "Directory" },
  { id: "active", label: "Allowed" },
  { id: "blocked", label: "Blocked" },
  { id: "admin", label: "Administrators" },
];

export function WorkspaceAccessManager({ isWorkspaceAdmin, layout = "embedded" }) {
  const reduceMotion = useReducedMotion();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingEmail, setSavingEmail] = useState("");
  const [query, setQuery] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [metric, setMetric] = useState("all");
  const loadedOnceRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!isWorkspaceAdmin) return;
    setLoading(true);
    try {
      const list = await fetchWorkspaceAccessList();
      setRows(list);
      loadedOnceRef.current = true;
    } catch (e) {
      toast.error("Could not load directory", {
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
    const admins = rows.filter((r) => r.isWorkspaceAdmin);
    const members = rows.filter((r) => !r.isWorkspaceAdmin);
    const blocked = rows.filter((r) => !r.accessEnabled).length;
    return {
      total: rows.length,
      admins: admins.length,
      members: members.length,
      blocked,
      active: rows.length - blocked,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (metric === "active") list = list.filter((r) => r.accessEnabled);
    if (metric === "blocked") list = list.filter((r) => !r.accessEnabled);
    if (metric === "admin") list = list.filter((r) => r.isWorkspaceAdmin);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((r) => r.email.toLowerCase().includes(q));
    return list;
  }, [rows, query, metric]);

  const adminRows = useMemo(
    () => filtered.filter((r) => r.isWorkspaceAdmin).sort((a, b) => a.email.localeCompare(b.email)),
    [filtered]
  );

  const memberRows = useMemo(
    () => filtered.filter((r) => !r.isWorkspaceAdmin).sort((a, b) => a.email.localeCompare(b.email)),
    [filtered]
  );

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
        const saved = await upsertWorkspaceAccess({
          email: em,
          accessEnabled: patch.accessEnabled ?? existing?.accessEnabled ?? true,
          isWorkspaceAdmin: patch.isWorkspaceAdmin ?? existing?.isWorkspaceAdmin ?? false,
        });
        setRow(em, saved);
      } catch (e) {
        toast.error("Could not save changes", {
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

  const onToggleAccess = useCallback((r) => save(r.email, { accessEnabled: !r.accessEnabled }), [save]);

  const onToggleAdmin = useCallback(
    async (r) => {
      if (r.isWorkspaceAdmin && stats.admins <= 1) {
        toast.error("At least one administrator is required", { className: "alloc8-toast" });
        return;
      }
      await save(r.email, { isWorkspaceAdmin: !r.isWorkspaceAdmin });
    },
    [save, stats.admins]
  );

  const onDelete = useCallback(
    async (r) => {
      if (r.isWorkspaceAdmin && stats.admins <= 1) {
        toast.error("At least one administrator is required", { className: "alloc8-toast" });
        return;
      }
      const em = normEmail(r.email);
      setSavingEmail(em);
      try {
        await deleteWorkspaceAccess(em);
        setRows((prev) => prev.filter((x) => x.email !== em));
        toast.success("User removed", { className: "alloc8-toast" });
      } catch (e) {
        toast.error("Could not remove user", {
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
      toast.error("Deloitte email required", { className: "alloc8-toast" });
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
      toast.success("User added to directory", { className: "alloc8-toast" });
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

  const busy = loading && !loadedOnceRef.current;
  const isPage = layout === "page";
  const showAdmins = metric !== "admin" || adminRows.length > 0;
  const showMembers = metric !== "admin";
  const empty = !busy && filtered.length === 0;

  const metricCounts = {
    all: stats.total,
    active: stats.active,
    blocked: stats.blocked,
    admin: stats.admins,
  };

  return (
    <div className={"ws-access" + (isPage ? " ws-access--page" : "")}>
      <div className="ws-command-bar">
        <div className="ws-command-search">
          <Search size={17} strokeWidth={2} aria-hidden />
          <input
            type="search"
            placeholder="Search directory…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search users"
          />
          {query ? (
            <button type="button" className="ws-clear" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={14} />
            </button>
          ) : null}
        </div>
        <form
          className="ws-command-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (!addDisabled && !loading) void onAdd();
          }}
        >
          <input
            type="email"
            placeholder="Add Deloitte email"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            aria-label="Add user email"
          />
          <button type="submit" className="ws-btn ws-btn--primary" disabled={addDisabled || loading}>
            <Plus size={16} strokeWidth={2.25} />
            Add user
          </button>
        </form>
        <button
          type="button"
          className="ws-btn ws-btn--ghost"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="Refresh"
        >
          <RefreshCw size={16} className={loading ? "ws-spin" : ""} />
        </button>
      </div>

      <div className="ws-metrics" role="tablist" aria-label="Directory filters">
        {METRICS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={metric === id}
            className={"ws-metric" + (metric === id ? " ws-metric--on" : "")}
            onClick={() => setMetric(id)}
          >
            <span className="ws-metric-num">{busy ? "—" : metricCounts[id]}</span>
            <span className="ws-metric-label">{label}</span>
          </button>
        ))}
      </div>

      <div className="ws-directory">
        {showAdmins ? (
          <AccessSection
            variant="admin"
            title="Workspace administrators"
            subtitle="Full control over access policy and user directory"
            icon={Crown}
            rows={adminRows}
            busy={busy}
            loading={loading}
            savingEmail={savingEmail}
            reduceMotion={reduceMotion}
            onToggleAccess={onToggleAccess}
            onToggleAdmin={onToggleAdmin}
            onDelete={onDelete}
          />
        ) : null}

        {showMembers ? (
          <AccessSection
            variant="member"
            title="Members"
            subtitle="Standard users with SSO access to the workspace"
            icon={Users}
            rows={memberRows}
            busy={busy}
            loading={loading}
            savingEmail={savingEmail}
            reduceMotion={reduceMotion}
            onToggleAccess={onToggleAccess}
            onToggleAdmin={onToggleAdmin}
            onDelete={onDelete}
          />
        ) : null}

        {empty ? (
          <div className="ws-empty">
            <div className="ws-empty-icon">
              {metric === "blocked" ? <ShieldOff size={26} /> : <UserPlus size={26} />}
            </div>
            <p>No users match your criteria</p>
            <button
              type="button"
              className="ws-btn ws-btn--outline"
              onClick={() => {
                setQuery("");
                setMetric("all");
              }}
            >
              Reset filters
            </button>
          </div>
        ) : null}
      </div>

      {!busy && filtered.length > 0 ? (
        <footer className="ws-footer">
          <span>
            {adminRows.length} administrators · {memberRows.length} members · {stats.total} total
          </span>
          {savingEmail ? (
            <span className="ws-footer-save">
              <Loader2 size={14} className="ws-spin" />
              Saving changes
            </span>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}
