import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Navigate } from "react-router-dom";
import {
  Building2,
  Plus,
  Search,
  Pencil,
  Trash2,
  UserPlus,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import AppSideNav from "../components/navigation/AppSideNav.jsx";
import { Button } from "../components/ui/Button.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAppData, refreshWorkspaceFromSupabase } from "../context/AppDataContext.jsx";
import { isSupabaseConfigured } from "../lib/supabase.js";
import { avatarGradientFromName } from "../utils/projectColors.js";
import {
  createDepartment,
  renameDepartment,
  deleteDepartment,
  assignPersonDepartment,
  removePersonFromDepartment,
} from "../lib/api/departments.js";
import "./DepartmentsPage.css";

const NO_DEPT_KEY = "";

function normDept(s) {
  return String(s || "").trim();
}

function personDeptKey(p) {
  return normDept(p?.department) || NO_DEPT_KEY;
}

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/g)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "?";
  return parts.map((p) => p[0]?.toUpperCase() || "").join("");
}

function hashHue(input) {
  const s = String(input || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 360;
}

function deptAccentCss(name) {
  return `hsl(${hashHue(name)} 72% 52%)`;
}

function ConfirmDialog({
  open,
  title,
  subtitle,
  desc,
  detail,
  onCancel,
  onConfirm,
  confirmLabel,
  danger,
  busy,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="depts-confirm-overlay"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="depts-confirm-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="depts-confirm-title"
        aria-describedby="depts-confirm-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="depts-confirm-icon" data-danger={danger ? "1" : "0"} aria-hidden>
          <AlertTriangle size={20} />
        </div>
        <div className="depts-confirm-heading">
          <h2 id="depts-confirm-title" className="depts-confirm-title">
            {title}
          </h2>
          {subtitle ? <p className="depts-confirm-subtitle">{subtitle}</p> : null}
        </div>
        <p id="depts-confirm-desc" className="depts-confirm-desc">
          {desc}
        </p>
        {detail ? <div className="depts-confirm-detail">{detail}</div> : null}
        <div className="depts-confirm-actions">
          <Button type="button" variant="secondary" size="md" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={danger ? "destructive" : "primary"}
            size="md"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function DepartmentsPage() {
  const { theme } = useAppTheme();
  const { isWorkspaceAdmin } = useAuth();
  const { people, depts } = useAppData();
  const [selected, setSelected] = useState("");
  const [listQuery, setListQuery] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [addQuery, setAddQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [confirm, setConfirm] = useState(null);

  const activePeople = useMemo(() => (people || []).filter((p) => !p.archived), [people]);

  const sortedDepts = useMemo(() => {
    const names = [...(depts || [])].map(normDept).filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [depts]);

  const filteredDepts = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    if (!q) return sortedDepts;
    return sortedDepts.filter((d) => d.toLowerCase().includes(q));
  }, [sortedDepts, listQuery]);

  useEffect(() => {
    if (!selected && sortedDepts.length) setSelected(sortedDepts[0]);
    if (selected && !sortedDepts.includes(selected) && sortedDepts.length) {
      setSelected(sortedDepts[0]);
    }
    if (selected && !sortedDepts.length) setSelected("");
  }, [sortedDepts, selected]);

  const members = useMemo(() => {
    if (!selected) return [];
    return activePeople
      .filter((p) => personDeptKey(p) === selected)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activePeople, selected]);

  const memberCounts = useMemo(() => {
    const m = new Map();
    for (const p of activePeople) {
      const k = personDeptKey(p);
      if (!k) continue;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }, [activePeople]);

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((p) => p.name.toLowerCase().includes(q));
  }, [members, memberQuery]);

  const addCandidates = useMemo(() => {
    if (!selected) return [];
    const q = addQuery.trim().toLowerCase();
    return activePeople
      .filter((p) => personDeptKey(p) !== selected)
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [activePeople, selected, addQuery]);

  const runBusy = useCallback(async (key, fn) => {
    setBusyKey(key);
    try {
      await fn();
      await refreshWorkspaceFromSupabase();
    } catch (err) {
      toast.error(err?.message || "Something went wrong");
      throw err;
    } finally {
      setBusyKey("");
    }
  }, []);

  const onCreate = async () => {
    const name = normDept(createName);
    if (!name) return;
    if (sortedDepts.some((d) => d.toLowerCase() === name.toLowerCase())) {
      toast.error("That department already exists");
      return;
    }
    await runBusy("create", async () => {
      await createDepartment(name);
      setSelected(name);
      setCreateOpen(false);
      setCreateName("");
      toast.success(`Created ${name}`);
    });
  };

  const requestRenameConfirm = () => {
    const next = normDept(renameValue);
    if (!selected || !next) {
      toast.error("Enter a department name");
      return;
    }
    if (next.toLowerCase() === selected.toLowerCase()) {
      setRenameOpen(false);
      return;
    }
    if (sortedDepts.some((d) => d.toLowerCase() === next.toLowerCase())) {
      toast.error("A department with that name already exists");
      return;
    }
    setConfirm({
      type: "rename",
      from: selected,
      to: next,
      memberCount: members.length,
    });
  };

  const onRename = async () => {
    if (confirm?.type !== "rename") return;
    const { from, to } = confirm;
    await runBusy("rename", async () => {
      await renameDepartment(from, to);
      setSelected(to);
      setRenameOpen(false);
      setConfirm(null);
      toast.success(`Renamed to ${to}`);
    });
  };

  const onDelete = async () => {
    if (confirm?.type !== "delete" || !selected) return;
    const name = selected;
    await runBusy("delete", async () => {
      await deleteDepartment(name);
      setConfirm(null);
      setRenameOpen(false);
      toast.success(`Deleted ${name}`);
    });
  };

  const onAddMember = async (personId) => {
    if (!selected) return;
    await runBusy(`add-${personId}`, async () => {
      await assignPersonDepartment(personId, selected);
      setAddQuery("");
      toast.success("Member added");
    });
  };

  const onRemoveMember = async () => {
    if (confirm?.type !== "removeMember") return;
    const { personId } = confirm;
    await runBusy(`rm-${personId}`, async () => {
      await removePersonFromDepartment(personId);
      setConfirm(null);
      toast.success("Removed from department");
    });
  };

  const closeConfirm = () => {
    if (busyKey) return;
    setConfirm(null);
  };

  const handleConfirmAction = () => {
    if (!confirm) return;
    if (confirm.type === "delete") onDelete();
    else if (confirm.type === "rename") onRename();
    else if (confirm.type === "removeMember") onRemoveMember();
  };

  const confirmBusy =
    confirm?.type === "delete"
      ? busyKey === "delete"
      : confirm?.type === "rename"
        ? busyKey === "rename"
        : confirm?.type === "removeMember"
          ? busyKey === `rm-${confirm.personId}`
          : false;

  const confirmProps = (() => {
    if (!confirm) return null;
    if (confirm.type === "delete") {
      const n = confirm.memberCount ?? 0;
      return {
        title: `Delete “${selected}”?`,
        subtitle: "This cannot be undone",
        desc:
          n > 0
            ? `${n} ${n === 1 ? "person will be" : "people will be"} moved to No department. The department will be removed from the workspace list.`
            : "This department will be removed from the workspace list.",
        detail: null,
        confirmLabel: "Delete department",
        danger: true,
      };
    }
    if (confirm.type === "rename") {
      const n = confirm.memberCount ?? 0;
      return {
        title: "Rename department?",
        subtitle: "Updates every member on this team",
        desc:
          n > 0
            ? `${n} ${n === 1 ? "member has" : "members have"} this department on their profile. All will show the new name after you confirm.`
            : "The department name will change in the workspace list.",
        detail: (
          <>
            <span className="depts-confirm-detail-label">From</span>
            <span className="depts-confirm-detail-value">{confirm.from}</span>
            <span className="depts-confirm-detail-arrow" aria-hidden>
              →
            </span>
            <span className="depts-confirm-detail-label">To</span>
            <span className="depts-confirm-detail-value depts-confirm-detail-value--new">
              {confirm.to}
            </span>
          </>
        ),
        confirmLabel: "Rename department",
        danger: false,
      };
    }
    if (confirm.type === "removeMember") {
      return {
        title: `Remove ${confirm.personName}?`,
        subtitle: "Profile department will be cleared",
        desc: `They will leave “${confirm.deptName}” and show as No department on their profile and the schedule.`,
        detail: null,
        confirmLabel: "Remove member",
        danger: true,
      };
    }
    return null;
  })();

  const disabled = !isSupabaseConfigured || !!busyKey;

  if (!isWorkspaceAdmin) {
    return <Navigate to="/settings" replace />;
  }

  return (
    <div className="depts-page" data-theme={theme === "light" ? "light" : "dark"}>
      <div className="depts-page-ambient" aria-hidden />
      <AppSideNav />

      <div className="depts-page-body">
        <main id="main-content" className="depts-page-main" aria-label="Departments">
          <header className="depts-page-header">
            <div className="depts-page-header-main">
              <div className="depts-page-icon" aria-hidden>
                <Building2 size={20} strokeWidth={2} />
              </div>
              <div>
                <p className="depts-page-eyebrow">Workspace</p>
                <h1 className="depts-page-title">Departments</h1>
                <p className="depts-page-lede">
                  Create teams, assign people, and keep profile department lists in sync.
                </p>
              </div>
            </div>
            {!isSupabaseConfigured ? (
              <p className="depts-page-offline">Connect Supabase to manage departments.</p>
            ) : null}
          </header>

          <div className="depts-layout">
            <aside className="depts-sidebar" aria-label="Department list">
              <div className="depts-sidebar-toolbar">
                <div className="depts-search">
                  <Search size={15} aria-hidden />
                  <input
                    type="search"
                    value={listQuery}
                    onChange={(e) => setListQuery(e.target.value)}
                    placeholder="Search departments…"
                    disabled={disabled}
                    aria-label="Search departments"
                  />
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={disabled}
                  onClick={() => {
                    setCreateOpen(true);
                    setCreateName("");
                  }}
                  aria-label="New department"
                >
                  <Plus size={16} />
                </Button>
              </div>

              {createOpen ? (
                <div className="depts-create">
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Department name"
                    disabled={disabled}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onCreate();
                      if (e.key === "Escape") setCreateOpen(false);
                    }}
                    autoFocus
                  />
                  <div className="depts-create-actions">
                    <Button type="button" variant="secondary" size="sm" onClick={() => setCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="button" variant="primary" size="sm" disabled={disabled} onClick={onCreate}>
                      Create
                    </Button>
                  </div>
                </div>
              ) : null}

              <ul className="depts-list" role="listbox" aria-label="Departments">
                {filteredDepts.length === 0 ? (
                  <li className="depts-list-empty">
                    {sortedDepts.length === 0
                      ? "No departments yet. Create one to get started."
                      : "No matches."}
                  </li>
                ) : (
                  filteredDepts.map((name) => {
                    const active = name === selected;
                    const count = memberCounts.get(name) || 0;
                    return (
                      <li key={name}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={`depts-list-item${active ? " depts-list-item--active" : ""}`}
                          style={{ "--dept-accent": deptAccentCss(name) }}
                          onClick={() => setSelected(name)}
                          disabled={disabled}
                        >
                          <span className="depts-list-dot" aria-hidden />
                          <span className="depts-list-label">{name}</span>
                          <span className="depts-list-count">{count}</span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </aside>

            <section className="depts-detail" aria-label="Department details">
              {!selected ? (
                <div className="depts-detail-empty">
                  <Building2 size={32} strokeWidth={1.5} />
                  <p>Select or create a department</p>
                </div>
              ) : (
                <>
                  <div className="depts-detail-head">
                    <div>
                      <h2 className="depts-detail-title" style={{ "--dept-accent": deptAccentCss(selected) }}>
                        <span className="depts-detail-title-dot" aria-hidden />
                        {selected}
                      </h2>
                      <p className="depts-detail-meta">
                        {members.length} {members.length === 1 ? "member" : "members"}
                      </p>
                    </div>
                    <div className="depts-detail-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={disabled}
                        onClick={() => {
                          setRenameValue(selected);
                          setRenameOpen(true);
                        }}
                      >
                        <Pencil size={14} />
                        Rename
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={disabled}
                        onClick={() =>
                          setConfirm({
                            type: "delete",
                            memberCount: members.length,
                          })
                        }
                      >
                        <Trash2 size={14} />
                        Delete
                      </Button>
                    </div>
                  </div>

                  {renameOpen ? (
                    <div className="depts-rename">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        disabled={disabled}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") requestRenameConfirm();
                          if (e.key === "Escape") setRenameOpen(false);
                        }}
                        autoFocus
                      />
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={disabled}
                        onClick={requestRenameConfirm}
                      >
                        Save name
                      </Button>
                      <Button type="button" variant="secondary" size="sm" onClick={() => setRenameOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  ) : null}

                  <div className="depts-members">
                    <div className="depts-members-head">
                      <h3>Members</h3>
                      <div className="depts-search depts-search--compact">
                        <Search size={14} aria-hidden />
                        <input
                          type="search"
                          value={memberQuery}
                          onChange={(e) => setMemberQuery(e.target.value)}
                          placeholder="Filter members…"
                          disabled={disabled}
                          aria-label="Filter members"
                        />
                      </div>
                    </div>

                    <ul className="depts-member-grid">
                      {filteredMembers.length === 0 ? (
                        <li className="depts-members-empty">No members in this department.</li>
                      ) : (
                        filteredMembers.map((p) => (
                          <li key={p.id}>
                            <div className="depts-person">
                              <span
                                className="depts-avatar"
                                style={{ background: avatarGradientFromName(p.name) }}
                                aria-hidden
                              >
                                {initials(p.name)}
                              </span>
                              <span className="depts-person-name">{p.name}</span>
                              <button
                                type="button"
                                className="depts-person-remove"
                                disabled={disabled}
                                aria-label={`Remove ${p.name} from ${selected}`}
                                onClick={() =>
                                  setConfirm({
                                    type: "removeMember",
                                    personId: p.id,
                                    personName: p.name,
                                    deptName: selected,
                                  })
                                }
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  <div className="depts-add">
                    <div className="depts-add-head">
                      <UserPlus size={16} aria-hidden />
                      <h3>Add member</h3>
                    </div>
                    <div className="depts-search">
                      <Search size={15} aria-hidden />
                      <input
                        type="search"
                        value={addQuery}
                        onChange={(e) => setAddQuery(e.target.value)}
                        placeholder="Search people not in this department…"
                        disabled={disabled}
                        aria-label="Search people to add"
                      />
                    </div>
                    <ul className="depts-add-list">
                      {addCandidates.length === 0 ? (
                        <li className="depts-add-empty">No people to add.</li>
                      ) : (
                        addCandidates.map((p) => (
                          <li key={p.id}>
                            <div className="depts-add-row">
                              <span
                                className="depts-avatar depts-avatar--sm"
                                style={{ background: avatarGradientFromName(p.name) }}
                                aria-hidden
                              >
                                {initials(p.name)}
                              </span>
                              <span className="depts-add-name">{p.name}</span>
                              <button
                                type="button"
                                className="depts-add-cta"
                                disabled={disabled}
                                aria-label={`Add ${p.name}`}
                                onClick={() => onAddMember(p.id)}
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </>
              )}
            </section>
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={!!confirmProps}
        title={confirmProps?.title ?? ""}
        subtitle={confirmProps?.subtitle}
        desc={confirmProps?.desc ?? ""}
        detail={confirmProps?.detail}
        confirmLabel={confirmProps?.confirmLabel ?? "Confirm"}
        danger={confirmProps?.danger}
        busy={confirmBusy}
        onCancel={closeConfirm}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}
