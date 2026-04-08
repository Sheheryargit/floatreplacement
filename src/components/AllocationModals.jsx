import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from "framer-motion";
import { X, ChevronDown, ArrowLeftRight, Zap, Trash2, Palmtree } from "lucide-react";
import { resolveColorForProjectLabel } from "../utils/projectColors.js";
import { normalizeLeaveTypeId, leaveAccentTheme, leavePanelStyleVars } from "../utils/leaveVisuals.js";
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

export function CreateAllocationModal({
  open,
  onClose,
  onCreate,
  onCreateLeave,
  people,
  preselectPerson,
  preselectDate,
  preselectProject,
  projects,
  projectRegistry = [],
  onAddProject,
  editAllocation,
  onEditAllocation,
  defaultTab = "allocation",
  t,
}) {
  const reduceMotion = useReducedMotion();
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
        setLeaveType(editAllocation.leaveType || "annual");
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
    const pre = preselectProject != null ? String(preselectProject).trim() : "";
    if (pre) setProject(pre);
    else setProject(list[0] ?? "");
    setNotes("");
    setRepeatId("none");
    setRepeatOpen(false);
    setAssignQuery("");
    setAssignOpen(false);
    setProjectOpen(false);
    setProjectCreateMode(false);
    setNewProjectLine("");
    setActiveTab(defaultTab === "leave" ? "leave" : "allocation");
    setLeaveType("annual");
    setLeaveTypeOpen(false);
    setLeaveNotes("");
    if (preselectPerson) setAssignedIds([preselectPerson.id]);
    else if (people[0]) setAssignedIds([people[0].id]);
    else setAssignedIds([]);
  }, [open, preselectPerson, preselectDate, preselectProject, people, projects, editAllocation, defaultTab]);

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

  const leaveAccent = useMemo(() => leaveAccentTheme(leaveType), [leaveType]);

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

  const leaveTypeNorm = normalizeLeaveTypeId(leaveType);

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

        <LayoutGroup id="lpam-create-tabs">
          <div className="lpam-tabs lpam-tabs--motion" style={{ borderColor: t.border }}>
            <button
              type="button"
              className={"lpam-tab" + (activeTab === "allocation" ? " lpam-tab-active" : "")}
              style={{
                color: activeTab === "allocation" ? t.accent : t.textSoft,
                borderBottomColor: "transparent",
                position: "relative",
              }}
              onClick={() => setActiveTab("allocation")}
            >
              Allocation
              {activeTab === "allocation" ? (
                <motion.span
                  layoutId="lpam-create-tab-line"
                  className="lpam-tab-line"
                  style={{ background: t.accent }}
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              ) : null}
            </button>
            <button
              type="button"
              className={"lpam-tab" + (activeTab === "leave" ? " lpam-tab-active" : "")}
              style={{
                color: activeTab === "leave" ? leaveAccent.solid : t.textSoft,
                borderBottomColor: "transparent",
                position: "relative",
              }}
              onClick={() => setActiveTab("leave")}
            >
              <Palmtree size={14} style={{ marginRight: 5 }} />
              Leave
              {activeTab === "leave" ? (
                <motion.span
                  layoutId="lpam-create-tab-line"
                  className="lpam-tab-line"
                  style={{ background: leaveAccent.solid }}
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              ) : null}
            </button>
          </div>
        </LayoutGroup>

        <div className="lpam-modal-body">
        <AnimatePresence mode="wait">
        {activeTab === "allocation" ? (
          <motion.div
            key="lpam-body-alloc"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.45, 0, 0.55, 1] } }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8, transition: { duration: 0.18 } }}
          >
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
          </motion.div>
        ) : (
          <motion.div
            key="lpam-body-leave"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.45, 0, 0.55, 1] } }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8, transition: { duration: 0.18 } }}
          >
            <div
              className={"lpam-panel lpam-panel-leave lpam-panel-leave--" + leaveTypeNorm}
              style={{
                background: t.surface,
                borderColor: t.borderIn || t.border,
                boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                ...leavePanelStyleVars(leaveType),
              }}
            >
              <div className="lpam-leave-icon-row">
                <motion.div
                  className="lpam-leave-icon-circle"
                  style={{ background: leaveAccent.soft }}
                  animate={reduceMotion ? undefined : { scale: [1, 1.04, 1] }}
                  transition={{ duration: 0.45, ease: [0.45, 0, 0.55, 1] }}
                  key={leaveTypeNorm}
                >
                  <Palmtree size={22} style={{ color: leaveAccent.solid }} />
                </motion.div>
              </div>
              {leaveType === "annual" ? (
                <p className="lpam-leave-hint" style={{ color: t.textMuted }}>
                  Paid time off — appears on the schedule with a teal pattern so it stays distinct from other leave types.
                </p>
              ) : null}
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
                        className={"lpam-leave-swatch lpam-leave-swatch--" + leaveTypeNorm}
                        aria-hidden
                      />
                      <span className="lpam-project-trigger-text">{leaveLabel(leaveType)}</span>
                    </span>
                    <ChevronDown size={16} style={{ color: t.textMuted }} />
                  </button>
                  <AnimatePresence>
                    {leaveTypeOpen ? (
                      <motion.div
                        key="leave-type-menu"
                        className="lpam-menu lpam-menu-project lpam-menu-leave-types"
                        style={{ background: t.surface, borderColor: t.border }}
                        role="listbox"
                        initial={reduceMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: [0.45, 0, 0.55, 1] } }}
                        exit={reduceMotion ? undefined : { opacity: 0, y: -4, scale: 0.99, transition: { duration: 0.15 } }}
                      >
                        {LEAVE_TYPES.map((lt, li) => {
                          const n = normalizeLeaveTypeId(lt.id);
                          return (
                            <motion.button
                              key={lt.id}
                              type="button"
                              role="option"
                              className={"lpam-menu-item" + (leaveType === lt.id ? " lpam-menu-item-active" : "")}
                              style={{ color: t.text }}
                              initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                              animate={{
                                opacity: 1,
                                x: 0,
                                transition: { delay: reduceMotion ? 0 : li * 0.035, duration: 0.2 },
                              }}
                              onClick={() => {
                                setLeaveType(lt.id);
                                setLeaveTypeOpen(false);
                              }}
                            >
                              <span className="lpam-menu-item-inner">
                                <span className={"lpam-leave-swatch lpam-leave-swatch--" + n} aria-hidden />
                                <span className="lpam-menu-item-label">{lt.label}</span>
                              </span>
                            </motion.button>
                          );
                        })}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
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
          </motion.div>
        )}
        </AnimatePresence>

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
        </div>

        <div className="lpam-footer">
          <div className="lpam-create-actions">
            <motion.button
              type="button"
              className={"lpam-btn lpam-btn-primary" + (activeTab === "leave" ? " lpam-btn-leave" : "")}
              onClick={handleSave}
              disabled={workingDays <= 0 || (activeTab === "allocation" && parseFloat(hoursPerDay) <= 0)}
              style={{
                background:
                  activeTab === "leave"
                    ? `linear-gradient(145deg, ${leaveAccent.solid}, color-mix(in srgb, ${leaveAccent.solid} 75%, #0f172a))`
                    : t.accent,
                borderColor: "transparent",
                color: "#fff",
                boxShadow:
                  activeTab === "leave"
                    ? `0 6px 28px ${leaveAccent.glow}`
                    : undefined,
              }}
              whileTap={reduceMotion || workingDays <= 0 ? undefined : { scale: 0.98 }}
            >
              {editAllocation ? "Save changes" : (activeTab === "leave" ? "Create leave" : "Create allocation")}
            </motion.button>
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
  const detailLeaveAccent = isLeave ? leaveAccentTheme(allocation.leaveType) : null;
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

        <div className="lpam-modal-body">
        {isLeave ? (
          /* ── Leave detail layout ─────────── */
          <>
            <div className="lpam-detail-section">
              <div className="lpam-detail-label" style={{ color: t.textMuted }}>
                Leave type
              </div>
              <div className="lpam-detail-project" style={{ color: t.text, display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  className={"lpam-leave-swatch lpam-leave-swatch--" + normalizeLeaveTypeId(allocation.leaveType)}
                  aria-hidden
                />
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
                  border: `1px solid color-mix(in srgb, ${t.danger} 35%, transparent)`,
                  color: t.danger,
                  boxShadow: t.dangerGlow || "0 2px 14px rgba(244,63,94,0.15)",
                  transition: "box-shadow 0.22s cubic-bezier(0.22,1,0.36,1), filter 0.18s ease, transform 0.18s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = "brightness(1.05)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = "";
                  e.currentTarget.style.transform = "";
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
                  background: isLeave && detailLeaveAccent
                    ? `linear-gradient(145deg, ${detailLeaveAccent.solid}, color-mix(in srgb, ${detailLeaveAccent.solid} 72%, #0f172a))`
                    : t.accent,
                  borderColor: "transparent",
                  color: "#fff",
                  boxShadow: isLeave && detailLeaveAccent ? `0 6px 24px ${detailLeaveAccent.glow}` : undefined,
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

export { countWorkingDaysBetween };
export { advanceRepeatWindow } from "../utils/allocationRepeatWindow.js";
