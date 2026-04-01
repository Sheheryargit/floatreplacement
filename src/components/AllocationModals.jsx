import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ChevronDown, ArrowLeftRight, Zap, Trash2, Palmtree } from "lucide-react";
import { resolveColorForProjectLabel } from "../utils/projectColors.js";
import "./AllocationModals.css";

export const ALLOCATION_PROJECT_SEED = [
  "ASF / ASF Managed Services",
  "ARTC / Cloud Managed Services",
  "Internal / Admin & Ops",
];

export const REPEAT_OPTIONS = [
  { id: "none", label: "Doesn't repeat" },
  { id: "weekly", label: "Weekly" },
  { id: "every2weeks", label: "Every 2 weeks" },
  { id: "every3weeks", label: "Every 3 weeks" },
  { id: "monthly", label: "Monthly" },
  { id: "every6weeks", label: "Every 6 weeks" },
  { id: "every2months", label: "Every 2 months" },
  { id: "every3months", label: "Every 3 months" },
  { id: "every6months", label: "Every 6 months" },
  { id: "yearly", label: "Yearly" },
];

export const LEAVE_TYPES = [
  { id: "annual", label: "Annual Leave" },
  { id: "sick", label: "Sick Leave" },
  { id: "personal", label: "Personal Leave" },
  { id: "parental", label: "Parental Leave" },
  { id: "bereavement", label: "Bereavement Leave" },
  { id: "unpaid", label: "Unpaid Leave" },
  { id: "public_holiday", label: "Public Holiday" },
  { id: "other", label: "Other" },
];

export function leaveLabel(id) {
  return LEAVE_TYPES.find((o) => o.id === id)?.label ?? "Annual Leave";
}

export function repeatLabel(id) {
  return REPEAT_OPTIONS.find((o) => o.id === id)?.label ?? "Doesn't repeat";
}

function countWorkingDaysBetween(start, end) {
  const a = new Date(start);
  a.setHours(0, 0, 0, 0);
  const b = new Date(end);
  b.setHours(0, 0, 0, 0);
  if (b < a) return 0;
  let n = 0;
  const x = new Date(a);
  while (x <= b) {
    const d = x.getDay();
    if (d !== 0 && d !== 6) n++;
    x.setDate(x.getDate() + 1);
  }
  return n;
}

function formatAllocDate(d) {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function advanceRepeatWindow(startIso, endIso, repeatId) {
  if (!repeatId || repeatId === "none") return null;
  const s = new Date(`${startIso}T12:00:00`);
  const e = new Date(`${endIso}T12:00:00`);
  switch (repeatId) {
    case "weekly":
      s.setDate(s.getDate() + 7);
      e.setDate(e.getDate() + 7);
      break;
    case "every2weeks":
      s.setDate(s.getDate() + 14);
      e.setDate(e.getDate() + 14);
      break;
    case "every3weeks":
      s.setDate(s.getDate() + 21);
      e.setDate(e.getDate() + 21);
      break;
    case "every6weeks":
      s.setDate(s.getDate() + 42);
      e.setDate(e.getDate() + 42);
      break;
    case "monthly":
      s.setMonth(s.getMonth() + 1);
      e.setMonth(e.getMonth() + 1);
      break;
    case "every2months":
      s.setMonth(s.getMonth() + 2);
      e.setMonth(e.getMonth() + 2);
      break;
    case "every3months":
      s.setMonth(s.getMonth() + 3);
      e.setMonth(e.getMonth() + 3);
      break;
    case "every6months":
      s.setMonth(s.getMonth() + 6);
      e.setMonth(e.getMonth() + 6);
      break;
    case "yearly":
      s.setFullYear(s.getFullYear() + 1);
      e.setFullYear(e.getFullYear() + 1);
      break;
    default:
      return null;
  }
  const pad = (n) => String(n).padStart(2, "0");
  const toIso = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { start: toIso(s), end: toIso(e) };
}

export function CreateAllocationModal({
  open,
  onClose,
  onCreate,
  onCreateLeave,
  people,
  preselectPerson,
  preselectDate,
  projects,
  projectRegistry = [],
  onAddProject,
  editAllocation,
  onEditAllocation,
  t,
}) {
  const hoursMode = "Hours";
  const [activeTab, setActiveTab] = useState("allocation");
  const [hoursPerDay, setHoursPerDay] = useState("7.5");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [project, setProject] = useState("");
  const [notes, setNotes] = useState("");
  const [repeatId, setRepeatId] = useState("none");
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [assignedIds, setAssignedIds] = useState([]);
  const [assignQuery, setAssignQuery] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectCreateMode, setProjectCreateMode] = useState(false);
  const [newProjectLine, setNewProjectLine] = useState("");

  // Leave-specific state
  const [leaveType, setLeaveType] = useState("annual");
  const [leaveTypeOpen, setLeaveTypeOpen] = useState(false);
  const [leaveNotes, setLeaveNotes] = useState("");

  const repeatWrapRef = useRef(null);
  const assignWrapRef = useRef(null);
  const projectWrapRef = useRef(null);
  const leaveTypeWrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (editAllocation) {
      setStartDate(editAllocation.startDate || "");
      setEndDate(editAllocation.endDate || "");
      setHoursPerDay(editAllocation.hoursPerDay ? String(editAllocation.hoursPerDay) : "7.5");
      setProject(editAllocation.project || "");
      setNotes(editAllocation.notes || "");
      setRepeatId(editAllocation.repeatId || "none");
      setActiveTab(editAllocation.isLeave ? "leave" : "allocation");
      if (editAllocation.isLeave) {
        setLeaveType(editAllocation.leaveType || "");
        setLeaveNotes(editAllocation.notes || "");
      }
      setAssignedIds(editAllocation.personIds || (editAllocation.personId != null ? [editAllocation.personId] : []));
      return;
    }

    let iso;
    if (preselectDate) {
      iso = preselectDate;
    } else {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      iso = `${y}-${m}-${day}`;
    }
    setStartDate(iso);
    setEndDate(iso);
    setHoursPerDay("7.5");
    const list = projects.length ? projects : ALLOCATION_PROJECT_SEED;
    setProject(list[0] ?? "");
    setNotes("");
    setRepeatId("none");
    setRepeatOpen(false);
    setAssignQuery("");
    setAssignOpen(false);
    setProjectOpen(false);
    setProjectCreateMode(false);
    setNewProjectLine("");
    setActiveTab("allocation");
    setLeaveType("annual");
    setLeaveTypeOpen(false);
    setLeaveNotes("");
    if (preselectPerson) setAssignedIds([preselectPerson.id]);
    else if (people[0]) setAssignedIds([people[0].id]);
    else setAssignedIds([]);
  }, [open, preselectPerson, preselectDate, people, projects, editAllocation]);

  useEffect(() => {
    function onDoc(e) {
      if (repeatWrapRef.current && !repeatWrapRef.current.contains(e.target)) setRepeatOpen(false);
      if (assignWrapRef.current && !assignWrapRef.current.contains(e.target)) setAssignOpen(false);
      if (projectWrapRef.current && !projectWrapRef.current.contains(e.target)) {
        setProjectOpen(false);
        setProjectCreateMode(false);
      }
      if (leaveTypeWrapRef.current && !leaveTypeWrapRef.current.contains(e.target)) setLeaveTypeOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDoc, true);
      return () => document.removeEventListener("mousedown", onDoc, true);
    }
  }, [open]);

  const workingDays = useMemo(
    () => (startDate && endDate ? countWorkingDaysBetween(startDate, endDate) : 0),
    [startDate, endDate]
  );

  const totalHours = useMemo(() => {
    const h = parseFloat(hoursPerDay, 10) || 0;
    return Math.round(workingDays * h * 100) / 100;
  }, [workingDays, hoursPerDay]);

  const assignablePeople = useMemo(() => {
    const q = assignQuery.trim().toLowerCase();
    return people.filter((p) => {
      if (assignedIds.includes(p.id)) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q);
    });
  }, [people, assignedIds, assignQuery]);

  const assignedPeople = useMemo(
    () => assignedIds.map((id) => people.find((p) => p.id === id)).filter(Boolean),
    [assignedIds, people]
  );

  const addAssignee = useCallback((id) => {
    setAssignedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setAssignQuery("");
    setAssignOpen(true);
  }, []);

  const removeAssignee = useCallback((id) => {
    setAssignedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const submitNewProject = useCallback(() => {
    const line = newProjectLine.trim();
    if (!line || !onAddProject) return;
    onAddProject(line);
    setProject(line);
    setNewProjectLine("");
    setProjectCreateMode(false);
    setProjectOpen(false);
  }, [newProjectLine, onAddProject]);

  if (!open) return null;

  const handleSave = () => {
    if (activeTab === "allocation") {
      if (assignedIds.length === 0 || !startDate || !endDate || !project) return;
      const payload = {
        personIds: assignedIds,
        startDate,
        endDate,
        hoursPerDay: parseFloat(hoursPerDay, 10) || 0,
        totalHours,
        workingDays,
        project,
        notes: notes.trim(),
        repeatId,
      };
      if (editAllocation && onEditAllocation) {
        onEditAllocation(payload, editAllocation.id);
      } else {
        onCreate(payload);
      }
    } else {
      if (assignedIds.length === 0 || !startDate || !endDate) return;
      const payload = {
        personIds: assignedIds,
        startDate,
        endDate,
        hoursPerDay: 0,
        totalHours: 0,
        workingDays,
        project: leaveLabel(leaveType),
        notes: leaveNotes.trim(),
        repeatId: "none",
        isLeave: true,
        leaveType,
      };
      if (editAllocation && onEditAllocation) {
        onEditAllocation(payload, editAllocation.id);
      } else {
        onCreateLeave(payload);
      }
    }
    onClose();
  };

  const repeatOptionLabel = repeatLabel(repeatId);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="lpam-overlay-radix" />
        <Dialog.Content 
          className="lpam-modal lpam-create float-premium-modal" 
          style={{ 
            background: t.surface, 
            color: t.text 
          }}
        >
          <Dialog.Description className="lpam-sr-only">
            Set hours, dates, project, and assign people for a new allocation or leave.
          </Dialog.Description>
        <div className="lpam-head">
          <Dialog.Title asChild>
            <h2 className="lpam-title">{editAllocation ? "Edit" : (activeTab === "leave" ? "Leave" : "Allocation")}</h2>
          </Dialog.Title>
          <Dialog.Close asChild>
            <button type="button" className="lpam-icon-close" aria-label="Close">
              <X size={20} color={t.textMuted} />
            </button>
          </Dialog.Close>
        </div>

        <div className="lpam-tabs" style={{ borderColor: t.border }}>
          <button
            type="button"
            className={"lpam-tab" + (activeTab === "allocation" ? " lpam-tab-active" : "")}
            style={{
              color: activeTab === "allocation" ? t.accent : t.textSoft,
              borderBottomColor: activeTab === "allocation" ? t.accent : "transparent",
            }}
            onClick={() => setActiveTab("allocation")}
          >
            Allocation
          </button>
          <button
            type="button"
            className={"lpam-tab" + (activeTab === "leave" ? " lpam-tab-active" : "")}
            style={{
              color: activeTab === "leave" ? "#8c9fbe" : t.textSoft,
              borderBottomColor: activeTab === "leave" ? "#8c9fbe" : "transparent",
            }}
            onClick={() => setActiveTab("leave")}
          >
            <Palmtree size={14} style={{ marginRight: 5 }} />
            Leave
          </button>
        </div>

        {activeTab === "allocation" ? (
          <>
        <div className="lpam-panel" style={{ background: t.surface, borderColor: t.borderIn || t.border, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
          <div className="lpam-row lpam-row-split">
            <div className="lpam-field">
              <label className="lpam-label">Type</label>
              <button type="button" className="lpam-select" style={{ borderColor: t.border, color: t.textSoft }}>
                {hoursMode}
                <ChevronDown size={16} />
              </button>
            </div>
            <div className="lpam-field lpam-grow">
              <label className="lpam-label">Per day</label>
              <div className="lpam-inline">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(e.target.value)}
                  className="lpam-input lpam-input-sm"
                  style={{
                    borderColor: t.borderIn || t.border,
                    background: t.bg,
                    color: t.text,
                  }}
                />
                <span className="lpam-suffix" style={{ color: t.textMuted }}>
                  h/day
                </span>
              </div>
            </div>
            <div className="lpam-field">
              <label className="lpam-label">Total hours</label>
              <div className="lpam-total-pill" style={{ background: t.bg, borderColor: t.border, color: t.text }}>
                {totalHours}
              </div>
            </div>
          </div>
          <p className="lpam-duration" style={{ color: t.textSoft, marginTop: "8px" }}>
            Duration: {workingDays === 1 ? "1 working day" : `${workingDays} working days`}
          </p>
          <div className="lpam-dates">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="lpam-input lpam-date"
              style={{ borderColor: t.borderIn || t.border, background: t.bg, color: t.text }}
            />
            <ArrowLeftRight size={16} className="lpam-date-arrow" style={{ color: t.textMuted }} />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="lpam-input lpam-date"
              style={{ borderColor: t.borderIn || t.border, background: t.bg, color: t.text }}
            />
          </div>
          <div className="lpam-links">
            <button type="button" className="lpam-link" style={{ color: t.accent }}>
              Specific time
            </button>
            <div className="lpam-dropdown-wrap" ref={repeatWrapRef}>
              <button
                type="button"
                className="lpam-select lpam-select-ghost"
                style={{ borderColor: t.border, color: t.textSoft }}
                aria-expanded={repeatOpen}
                onClick={() => setRepeatOpen((o) => !o)}
              >
                {repeatOptionLabel}
                <ChevronDown size={16} />
              </button>
              {repeatOpen && (
                <div
                  className="lpam-menu lpam-menu-repeat"
                  style={{
                    background: t.surface,
                    borderColor: t.border,
                  }}
                  role="listbox"
                >
                  {REPEAT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="option"
                      className={"lpam-menu-item" + (repeatId === opt.id ? " lpam-menu-item-active" : "")}
                      style={{ color: t.text }}
                      onClick={() => {
                        setRepeatId(opt.id);
                        setRepeatOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lpam-field lpam-field-project">
          <div className="lpam-project-head">
            <label className="lpam-label" style={{ color: t.textMuted }}>
              Project
            </label>
            <button
              type="button"
              className="lpam-link"
              style={{ color: t.accent }}
              onClick={() => {
                setProjectOpen(true);
                setProjectCreateMode(true);
                setNewProjectLine("");
              }}
            >
              Add project
            </button>
          </div>
          <div className="lpam-dropdown-wrap lpam-dropdown-full" ref={projectWrapRef}>
            <button
              type="button"
              className="lpam-input lpam-project-trigger"
              style={{ borderColor: t.borderIn || t.border, background: t.surface, color: t.text, boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}
              aria-expanded={projectOpen}
              onClick={() => {
                setProjectOpen((o) => !o);
                if (projectOpen) setProjectCreateMode(false);
              }}
            >
              <span className="lpam-project-trigger-inner">
                {project ? (
                  <span
                    className="lpam-project-swatch"
                    style={{ background: resolveColorForProjectLabel(project, projectRegistry) }}
                    aria-hidden
                  />
                ) : null}
                <span className="lpam-project-trigger-text">{project || "Select project"}</span>
              </span>
              <ChevronDown size={16} style={{ color: t.textMuted }} />
            </button>
            {projectOpen && (
              <div
                className="lpam-menu lpam-menu-project"
                style={{ background: t.surface, borderColor: t.border }}
              >
                {projectCreateMode ? (
                  <div className="lpam-project-create" onMouseDown={(e) => e.stopPropagation()}>
                    <p className="lpam-project-create-hint" style={{ color: t.textMuted }}>
                      Use format <strong style={{ color: t.textSoft }}>Code / Project name</strong>
                    </p>
                    <input
                      type="text"
                      value={newProjectLine}
                      onChange={(e) => setNewProjectLine(e.target.value)}
                      placeholder="e.g. ACME / Website redesign"
                      className="lpam-input"
                      style={{ borderColor: t.border, background: t.bg, color: t.text }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitNewProject();
                      }}
                      autoFocus
                    />
                    <div className="lpam-project-create-actions">
                      <button
                        type="button"
                        className="lpam-btn lpam-btn-tiny lpam-btn-primary"
                        style={{ background: t.accent, color: t.accentTxt }}
                        onClick={submitNewProject}
                      >
                        Add &amp; select
                      </button>
                      <button
                        type="button"
                        className="lpam-btn lpam-btn-tiny lpam-btn-secondary"
                        style={{ borderColor: t.border, background: t.btnSec, color: t.textSoft }}
                        onClick={() => {
                          setProjectCreateMode(false);
                          setNewProjectLine("");
                        }}
                      >
                        Back
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {(projects.length ? projects : ALLOCATION_PROJECT_SEED).map((p) => {
                      const swatch = resolveColorForProjectLabel(p, projectRegistry);
                      return (
                        <button
                          key={p}
                          type="button"
                          className={"lpam-menu-item" + (project === p ? " lpam-menu-item-active" : "")}
                          style={{ color: t.text }}
                          onClick={() => {
                            setProject(p);
                            setProjectOpen(false);
                          }}
                        >
                          <span className="lpam-menu-item-inner">
                            <span
                              className="lpam-project-swatch"
                              style={{ background: swatch }}
                              aria-hidden
                            />
                            <span className="lpam-menu-item-label">{p}</span>
                          </span>
                        </button>
                      );
                    })}
                    <div className="lpam-menu-divider" style={{ background: t.border }} />
                    <button
                      type="button"
                      className="lpam-menu-item lpam-menu-item-accent"
                      style={{ color: t.accent }}
                      onClick={() => {
                        setProjectCreateMode(true);
                        setNewProjectLine("");
                      }}
                    >
                      + Create new project…
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lpam-field">
          <label className="lpam-label" style={{ color: t.textMuted }}>
            Notes
          </label>
          <textarea
            className="lpam-textarea"
            rows={4}
            placeholder="Add details specific to this allocation"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ borderColor: "transparent", background: t.surface, color: t.text, boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}
          />
        </div>
          </>
        ) : (
          /* ───── LEAVE TAB CONTENT ───── */
          <>
            <div className="lpam-panel lpam-panel-leave" style={{ background: t.surface, borderColor: t.borderIn || t.border, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
              <div className="lpam-leave-icon-row">
                <div className="lpam-leave-icon-circle" style={{ background: `${t.accent}18` }}>
                  <Palmtree size={22} style={{ color: t.accent }} />
                </div>
              </div>
              <div className="lpam-field">
                <label className="lpam-label" style={{ color: t.textMuted }}>Leave type</label>
                <div className="lpam-dropdown-wrap lpam-dropdown-full" ref={leaveTypeWrapRef}>
                  <button
                    type="button"
                    className="lpam-input lpam-assignee-trigger"
                    style={{ borderColor: t.borderIn || t.border, background: t.surface, color: t.text, boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}
                    aria-expanded={leaveTypeOpen}
                    onClick={() => setLeaveTypeOpen((o) => !o)}
                  >
                    <span className="lpam-project-trigger-inner">
                      <span
                        className="lpam-leave-swatch"
                        aria-hidden
                      />
                      <span className="lpam-project-trigger-text">{leaveLabel(leaveType)}</span>
                    </span>
                    <ChevronDown size={16} style={{ color: t.textMuted }} />
                  </button>
                  {leaveTypeOpen && (
                    <div
                      className="lpam-menu lpam-menu-project"
                      style={{ background: t.surface, borderColor: t.border }}
                      role="listbox"
                    >
                      {LEAVE_TYPES.map((lt) => (
                        <button
                          key={lt.id}
                          type="button"
                          role="option"
                          className={"lpam-menu-item" + (leaveType === lt.id ? " lpam-menu-item-active" : "")}
                          style={{ color: t.text }}
                          onClick={() => {
                            setLeaveType(lt.id);
                            setLeaveTypeOpen(false);
                          }}
                        >
                          <span className="lpam-menu-item-inner">
                            <span className="lpam-leave-swatch" aria-hidden />
                            <span className="lpam-menu-item-label">{lt.label}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <p className="lpam-duration" style={{ color: t.textSoft, marginTop: 12 }}>
                Duration: {workingDays === 1 ? "1 working day" : `${workingDays} working days`}
              </p>
              <div className="lpam-dates">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="lpam-input lpam-date"
                  style={{ borderColor: t.borderIn || t.border, background: t.bg, color: t.text }}
                />
                <ArrowLeftRight size={16} className="lpam-date-arrow" style={{ color: t.textMuted }} />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="lpam-input lpam-date"
                  style={{ borderColor: "transparent", background: t.bg, color: t.text, boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}
                />
              </div>
            </div>

            <div className="lpam-field">
              <label className="lpam-label" style={{ color: t.textMuted }}>
                Notes
              </label>
              <textarea
                className="lpam-textarea"
                rows={4}
                placeholder="Add details specific to this leave"
                value={leaveNotes}
                onChange={(e) => setLeaveNotes(e.target.value)}
                style={{ borderColor: "transparent", background: t.surface, color: t.text, boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}
              />
            </div>
          </>
        )}

        <div className="lpam-field lpam-field-assign">
          <label className="lpam-label" style={{ color: t.textMuted }}>
            Assigned to
          </label>
          <div
            className="lpam-assign-wrap"
            style={{ borderColor: "transparent", background: t.surface, color: t.text, boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}
            ref={assignWrapRef}
          >
            <div className="lpam-assign-chips">
              {assignedPeople.map((p) => (
                <span key={p.id} className="lpam-chip" style={{ background: t.btnSec, color: t.textSoft }}>
                  {p.name}
                  <button
                    type="button"
                    className="lpam-chip-x"
                    aria-label={`Remove ${p.name}`}
                    onClick={() => removeAssignee(p.id)}
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                className="lpam-assign-input"
                style={{ color: t.text }}
                placeholder={assignedPeople.length ? "" : "Search people…"}
                value={assignQuery}
                onChange={(e) => {
                  setAssignQuery(e.target.value);
                  setAssignOpen(true);
                }}
                onFocus={() => setAssignOpen(true)}
              />
            </div>
            {assignOpen && assignablePeople.length > 0 && (
              <div className="lpam-menu lpam-menu-assign" style={{ background: t.surface, borderColor: t.border }}>
                {assignablePeople.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="lpam-menu-item"
                    style={{ color: t.text }}
                    onClick={() => addAssignee(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lpam-footer">
          <div className="lpam-create-actions">
            <button
              type="button"
              className={"lpam-btn lpam-btn-primary" + (activeTab === "leave" ? " lpam-btn-leave" : "")}
              onClick={handleSave}
              disabled={workingDays <= 0 || (activeTab === "allocation" && parseFloat(hoursPerDay) <= 0)}
              style={{ background: activeTab === "leave" ? "#8c9fbe" : t.accent, borderColor: "transparent", color: "#fff" }}
            >
              {editAllocation ? "Save changes" : (activeTab === "leave" ? "Create leave" : "Create allocation")}
            </button>
            <Dialog.Close asChild>
              <button
                type="button"
                className="lpam-btn lpam-btn-secondary"
                style={{ borderColor: t.border, background: t.btnSec || "#f3f4f6", color: t.textSoft }}
              >
                Cancel
              </button>
            </Dialog.Close>
          </div>
        </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AllocationDetailModal({ open, allocation, assigneeNames, onClose, onDelete, onEditClick, t }) {
  if (!open || !allocation) return null;

  const isLeave = !!allocation.isLeave;
  const wd = allocation.workingDays ?? countWorkingDaysBetween(allocation.startDate, allocation.endDate);
  const repeatText = allocation.repeatId && allocation.repeatId !== "none" ? repeatLabel(allocation.repeatId) : null;

  const handleDelete = () => {
    if (!onDelete) return;
    const msg = isLeave ? "Delete this leave entry? This cannot be undone." : "Delete this allocation? This cannot be undone.";
    if (typeof window !== "undefined" && !window.confirm(msg)) return;
    onDelete(allocation);
    onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="lpam-overlay-radix" />
        <Dialog.Content
          className="lpam-modal lpam-detail float-premium-modal"
          style={{ background: t.surface, color: t.text }}
        >
          <Dialog.Description className="lpam-sr-only">
            {isLeave
              ? "Leave type, dates, and assignment details for this leave entry."
              : "Hours, project, assignments, and notes for this allocation."}
          </Dialog.Description>
        <div className="lpam-head">
          <Dialog.Title asChild>
            <h2 className="lpam-title">{isLeave ? "Leave" : "Allocation"}</h2>
          </Dialog.Title>
          <Dialog.Close asChild>
            <button type="button" className="lpam-icon-close" aria-label="Close">
              <X size={20} color={t.textMuted} />
            </button>
          </Dialog.Close>
        </div>

        {isLeave ? (
          /* ── Leave detail layout ─────────── */
          <>
            <div className="lpam-detail-section">
              <div className="lpam-detail-label" style={{ color: t.textMuted }}>
                Leave type
              </div>
              <div className="lpam-detail-project" style={{ color: t.text, display: "flex", alignItems: "center", gap: 10 }}>
                <span className="lpam-leave-swatch" aria-hidden />
                {allocation.leaveType ? leaveLabel(allocation.leaveType) : allocation.project}
              </div>
            </div>
            <div className="lpam-detail-section">
              <div className="lpam-detail-label" style={{ color: t.textMuted }}>
                Duration: {wd} working {wd === 1 ? "day" : "days"}
              </div>
              <div className="lpam-detail-dates" style={{ color: t.text }}>
                {formatAllocDate(allocation.startDate)} <span style={{ color: t.textMuted }}>&gt;</span>{" "}
                {formatAllocDate(allocation.endDate)}
              </div>
            </div>
          </>
        ) : (
          /* ── Allocation detail layout ───── */
          <>
            <div className="lpam-detail-metrics">
              <div>
                <div className="lpam-detail-label" style={{ color: t.textMuted }}>
                  Hours
                </div>
                <div className="lpam-detail-value">{allocation.hoursPerDay}</div>
              </div>
              <div>
                <div className="lpam-detail-label" style={{ color: t.textMuted }}>
                  Total hours
                </div>
                <div className="lpam-detail-value">{allocation.totalHours}</div>
              </div>
              <div className="lpam-detail-span">
                <div className="lpam-detail-label" style={{ color: t.textMuted }}>
                  Duration: {wd} working {wd === 1 ? "day" : "days"}
                </div>
                <div className="lpam-detail-dates" style={{ color: t.text }}>
                  {formatAllocDate(allocation.startDate)} <span style={{ color: t.textMuted }}>&gt;</span>{" "}
                  {formatAllocDate(allocation.endDate)}
                </div>
              </div>
            </div>

            {repeatText ? (
              <div className="lpam-detail-section">
                <div className="lpam-detail-label" style={{ color: t.textMuted }}>
                  Repeats
                </div>
                <div className="lpam-detail-value lpam-detail-value-sm">{repeatText}</div>
              </div>
            ) : null}

            <div className="lpam-detail-section">
              <div className="lpam-detail-label" style={{ color: t.textMuted }}>
                Project
              </div>
              <div className="lpam-detail-project" style={{ color: t.text }}>
                {allocation.project}
              </div>
              <button type="button" className="lpam-link" style={{ color: t.accent }}>
                View project
              </button>
            </div>
          </>
        )}

        {allocation.notes ? (
          <div className="lpam-detail-section">
            <div className="lpam-detail-label" style={{ color: t.textMuted }}>
              Notes
            </div>
            <div className="lpam-detail-notes" style={{ color: t.textSoft }}>
              {allocation.notes}
            </div>
          </div>
        ) : null}

        <div className="lpam-detail-section">
          <div className="lpam-detail-label" style={{ color: t.textMuted }}>
            Assigned to
          </div>
          <div className="lpam-detail-value lpam-detail-value-sm">{assigneeNames || "—"}</div>
        </div>

        <div className="lpam-detail-foot">
          <div className="lpam-meta" style={{ color: t.textMuted }}>
            <Zap size={14} />
            <span>
              Updated by {allocation.updatedBy} · {formatAllocDate(allocation.updatedAt)}
            </span>
          </div>
          <div className="lpam-detail-actions" style={{ display: "flex", gap: "10px" }}>
            {onDelete ? (
              <button
                type="button"
                className="lpam-btn lpam-btn-secondary"
                style={{
                  background: t.dangerSoft,
                  borderColor: "transparent",
                  color: t.danger,
                }}
                onClick={() => {
                  onDelete(allocation);
                  onClose();
                }}
              >
                Delete
              </button>
            ) : null}
            {onEditClick ? (
              <button
                type="button"
                className={"lpam-btn lpam-btn-primary" + (isLeave ? " lpam-btn-leave" : "")}
                style={{
                  background: isLeave ? "#8c9fbe" : t.accent,
                  borderColor: "transparent",
                  color: "#fff",
                }}
                onClick={onEditClick}
              >
                Edit
              </button>
            ) : null}
          </div>
        </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { countWorkingDaysBetween, advanceRepeatWindow };
