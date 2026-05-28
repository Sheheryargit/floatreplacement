import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Shield, ShieldCheck, ShieldX, UserCog, Users, FolderKanban } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useAppStore } from "../../context/AppDataContext.jsx";
import {
  fetchAllProfiles,
  updateProfile,
  fetchProjectLeads,
  addProjectLead,
  removeProjectLead,
  linkPersonToProfile,
  unlinkPersonFromProfile,
} from "../../lib/api/profiles.js";
import "./AdminPanel.css";

const ROLE_OPTIONS = [
  { value: "member", label: "Member" },
  { value: "team_lead", label: "Team Lead" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

const ROLE_BADGE_CLASS = {
  admin: "admin-role-badge--admin",
  manager: "admin-role-badge--manager",
  team_lead: "admin-role-badge--lead",
  member: "admin-role-badge--member",
};

/**
 * Admin panel section for Settings page.
 * Only rendered when the current user has admin role.
 */
export function AdminPanel() {
  const { appRole, rbacProfile } = useAuth();
  const projects = useAppStore((s) => s.projects);
  const people = useAppStore((s) => s.people);

  const [profiles, setProfiles] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("users"); // 'users' | 'leads'

  const isAdmin = appRole === "admin";
  const isManagerOrAbove = appRole === "admin" || appRole === "manager";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [p, l] = await Promise.all([fetchAllProfiles(), fetchProjectLeads()]);
      setProfiles(p);
      setLeads(l);
    } catch (err) {
      console.warn("[AdminPanel] load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isManagerOrAbove) refresh();
  }, [isManagerOrAbove, refresh]);

  const handleApprove = useCallback(
    async (userId, approved) => {
      try {
        const updated = await updateProfile(userId, { approved });
        setProfiles((prev) => prev.map((p) => (p.id === userId ? updated : p)));
        toast.success(approved ? "User approved" : "User access revoked");
      } catch (err) {
        toast.error("Failed to update: " + err.message);
      }
    },
    []
  );

  const handleRoleChange = useCallback(
    async (userId, newRole) => {
      try {
        const updated = await updateProfile(userId, { app_role: newRole });
        setProfiles((prev) => prev.map((p) => (p.id === userId ? updated : p)));
        toast.success(`Role updated to ${newRole.replace("_", " ")}`);
      } catch (err) {
        toast.error("Failed to update role: " + err.message);
      }
    },
    []
  );

  const handleAddLead = useCallback(
    async (projectId, profileId) => {
      try {
        const created = await addProjectLead(projectId, profileId);
        setLeads((prev) => [...prev, created]);
        toast.success("Project lead assigned");
      } catch (err) {
        toast.error("Failed to assign lead: " + err.message);
      }
    },
    []
  );

  const handleRemoveLead = useCallback(
    async (projectId, profileId) => {
      try {
        await removeProjectLead(projectId, profileId);
        setLeads((prev) =>
          prev.filter((l) => !(l.project_id === projectId && l.profile_id === profileId))
        );
        toast.success("Project lead removed");
      } catch (err) {
        toast.error("Failed to remove lead: " + err.message);
      }
    },
    []
  );

  const handleLinkPerson = useCallback(
    async (personId, profileId) => {
      try {
        await linkPersonToProfile(personId, profileId);
        toast.success("Person linked to profile");
      } catch (err) {
        toast.error("Failed to link: " + err.message);
      }
    },
    []
  );

  const handleUnlinkPerson = useCallback(
    async (personId) => {
      try {
        await unlinkPersonFromProfile(personId);
        toast.success("Person unlinked");
      } catch (err) {
        toast.error("Failed to unlink: " + err.message);
      }
    },
    []
  );

  if (!isManagerOrAbove) return null;

  const pendingCount = profiles.filter((p) => !p.approved).length;

  return (
    <>
      <h2 id="settings-admin" className="settings-h2">
        <Shield size={13} strokeWidth={2.2} style={{ marginRight: 6, verticalAlign: -1 }} />
        Administration
      </h2>
      <p className="settings-section-desc">
        Manage team access, roles, and project lead assignments.
        {pendingCount > 0 && (
          <span className="admin-pending-badge">{pendingCount} pending</span>
        )}
      </p>

      <div className="admin-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "users"}
          className={"admin-tab" + (tab === "users" ? " admin-tab--active" : "")}
          onClick={() => setTab("users")}
        >
          <Users size={14} strokeWidth={2} />
          Users
          {pendingCount > 0 && <span className="admin-tab-count">{pendingCount}</span>}
        </button>
        <button
          role="tab"
          aria-selected={tab === "leads"}
          className={"admin-tab" + (tab === "leads" ? " admin-tab--active" : "")}
          onClick={() => setTab("leads")}
        >
          <FolderKanban size={14} strokeWidth={2} />
          Project Leads
        </button>
      </div>

      {loading ? (
        <div className="admin-loading">Loading...</div>
      ) : tab === "users" ? (
        <UsersTab
          profiles={profiles}
          people={people}
          currentUserId={rbacProfile?.id}
          isAdmin={isAdmin}
          onApprove={handleApprove}
          onRoleChange={handleRoleChange}
          onLinkPerson={handleLinkPerson}
          onUnlinkPerson={handleUnlinkPerson}
        />
      ) : (
        <LeadsTab
          leads={leads}
          profiles={profiles}
          projects={projects}
          isAdmin={isAdmin}
          onAddLead={handleAddLead}
          onRemoveLead={handleRemoveLead}
        />
      )}
    </>
  );
}

/* ── Users Tab ─────────────────────────────────────────── */

function UsersTab({ profiles, people, currentUserId, isAdmin, onApprove, onRoleChange, onLinkPerson, onUnlinkPerson }) {
  const [search, setSearch] = useState("");
  const filtered = profiles.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (p.email || "").toLowerCase().includes(q) ||
      (p.display_name || "").toLowerCase().includes(q) ||
      (p.app_role || "").toLowerCase().includes(q)
    );
  });

  // Sort: pending first, then by email
  const sorted = [...filtered].sort((a, b) => {
    if (a.approved !== b.approved) return a.approved ? 1 : -1;
    return (a.email || "").localeCompare(b.email || "");
  });

  return (
    <div className="admin-card">
      <div className="admin-search-row">
        <input
          type="search"
          className="admin-search"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search users"
        />
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table" aria-label="User management">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Linked Person</th>
              <th className="admin-th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-empty">No users found</td>
              </tr>
            ) : (
              sorted.map((profile) => (
                <UserRow
                  key={profile.id}
                  profile={profile}
                  people={people}
                  isSelf={profile.id === currentUserId}
                  isAdmin={isAdmin}
                  onApprove={onApprove}
                  onRoleChange={onRoleChange}
                  onLinkPerson={onLinkPerson}
                  onUnlinkPerson={onUnlinkPerson}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserRow({ profile, people, isSelf, isAdmin, onApprove, onRoleChange, onLinkPerson, onUnlinkPerson }) {
  const linkedPerson = people.find((p) => p.profile_id === profile.id);

  return (
    <tr className={!profile.approved ? "admin-row--pending" : undefined}>
      <td>
        <div className="admin-user-cell">
          <span className="admin-user-name">{profile.display_name || profile.email}</span>
          {profile.display_name && (
            <span className="admin-user-email">{profile.email}</span>
          )}
        </div>
      </td>
      <td>
        {isAdmin && !isSelf ? (
          <select
            className="admin-role-select"
            value={profile.app_role}
            onChange={(e) => onRoleChange(profile.id, e.target.value)}
            aria-label={`Role for ${profile.email}`}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <span className={"admin-role-badge " + (ROLE_BADGE_CLASS[profile.app_role] || "")}>
            {profile.app_role?.replace("_", " ") || "member"}
            {isSelf && <span className="admin-you-tag">you</span>}
          </span>
        )}
      </td>
      <td>
        {profile.approved ? (
          <span className="admin-status admin-status--approved">
            <ShieldCheck size={13} strokeWidth={2.2} /> Active
          </span>
        ) : (
          <span className="admin-status admin-status--pending">
            <ShieldX size={13} strokeWidth={2.2} /> Pending
          </span>
        )}
      </td>
      <td>
        {linkedPerson ? (
          <span className="admin-linked-person">
            {linkedPerson.name}
            {isAdmin && (
              <button
                type="button"
                className="admin-unlink-btn"
                onClick={() => onUnlinkPerson(linkedPerson.id)}
                aria-label={`Unlink ${linkedPerson.name}`}
                title="Unlink"
              >
                ×
              </button>
            )}
          </span>
        ) : isAdmin ? (
          <PersonLinkSelector
            people={people}
            linkedProfileIds={new Set(people.filter((p) => p.profile_id).map((p) => p.profile_id))}
            onSelect={(personId) => onLinkPerson(personId, profile.id)}
          />
        ) : (
          <span className="admin-none">—</span>
        )}
      </td>
      <td className="admin-td-actions">
        {isAdmin && !isSelf && (
          profile.approved ? (
            <button
              type="button"
              className="admin-action-btn admin-action-btn--revoke"
              onClick={() => onApprove(profile.id, false)}
            >
              Revoke
            </button>
          ) : (
            <button
              type="button"
              className="admin-action-btn admin-action-btn--approve"
              onClick={() => onApprove(profile.id, true)}
            >
              Approve
            </button>
          )
        )}
      </td>
    </tr>
  );
}

function PersonLinkSelector({ people, linkedProfileIds, onSelect }) {
  const available = people.filter((p) => !linkedProfileIds.has(p.profile_id) && !p.profile_id);
  if (available.length === 0) return <span className="admin-none">—</span>;

  return (
    <select
      className="admin-link-select"
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) onSelect(e.target.value);
        e.target.value = "";
      }}
      aria-label="Link a person"
    >
      <option value="" disabled>
        Link person...
      </option>
      {available.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

/* ── Project Leads Tab ─────────────────────────────────── */

function LeadsTab({ leads, profiles, projects, isAdmin, onAddLead, onRemoveLead }) {
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedProfile, setSelectedProfile] = useState("");

  const teamLeadProfiles = profiles.filter(
    (p) => p.approved && (p.app_role === "team_lead" || p.app_role === "manager" || p.app_role === "admin")
  );

  const leadsWithNames = leads.map((l) => ({
    ...l,
    projectName: projects.find((p) => p.id === l.project_id)?.name || l.project_id,
    profileName:
      profiles.find((p) => p.id === l.profile_id)?.display_name ||
      profiles.find((p) => p.id === l.profile_id)?.email ||
      l.profile_id,
  }));

  const handleAdd = () => {
    if (!selectedProject || !selectedProfile) return;
    const exists = leads.some(
      (l) => l.project_id === selectedProject && l.profile_id === selectedProfile
    );
    if (exists) {
      toast.error("This lead is already assigned to that project");
      return;
    }
    onAddLead(selectedProject, selectedProfile);
    setSelectedProfile("");
  };

  return (
    <div className="admin-card">
      {isAdmin && (
        <div className="admin-lead-add-row">
          <select
            className="admin-lead-select"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            aria-label="Select project"
          >
            <option value="">Select project...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="admin-lead-select"
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            aria-label="Select team lead"
          >
            <option value="">Select team lead...</option>
            {teamLeadProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name || p.email}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="admin-action-btn admin-action-btn--approve"
            disabled={!selectedProject || !selectedProfile}
            onClick={handleAdd}
          >
            Assign
          </button>
        </div>
      )}

      {leadsWithNames.length === 0 ? (
        <div className="admin-empty-state">
          <UserCog size={28} strokeWidth={1.5} />
          <p>No project leads assigned yet.</p>
          <p className="admin-empty-hint">
            Assign team leads to projects so they can manage allocations for their teams.
          </p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table" aria-label="Project leads">
            <thead>
              <tr>
                <th>Project</th>
                <th>Team Lead</th>
                {isAdmin && <th className="admin-th-actions">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {leadsWithNames.map((l) => (
                <tr key={`${l.project_id}-${l.profile_id}`}>
                  <td>{l.projectName}</td>
                  <td>{l.profileName}</td>
                  {isAdmin && (
                    <td className="admin-td-actions">
                      <button
                        type="button"
                        className="admin-action-btn admin-action-btn--revoke"
                        onClick={() => onRemoveLead(l.project_id, l.profile_id)}
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
