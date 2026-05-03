import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, ChevronDown, ArrowLeftRight, Zap, Trash2, Palmtree, ArrowRight } from "lucide-react";
import {
  resolveColorForProjectLabel,
  projectToAllocationLabel,
  matchProjectFromAllocationPickerLabel,
  registryProjectIdForPickerLabel,
} from "../utils/projectColors.js";
import { normalizeLeaveTypeId, leaveAccentTheme, leavePanelStyleVars } from "../utils/leaveVisuals.js";
import { isStaticUi } from "../config/uiMode.js";
import "./AllocationModals.css";
import "../styles/premium-overlays.css";
import { ALLOCATION_PROJECT_SEED } from "../data/workspaceSeedConstants.js";
import {
  countWorkingDaysBetween,
  countAllocationWorkingDaysExcludingOffDays,
  addCalendarWeeksToIsoLocal,
  allocationTotalHoursRounded,
} from "../utils/allocationWorkMetrics.js";
import { suggestHoursPerDayFromAllocations } from "../lib/suggestHoursPremiumV2.js";

const REPEAT_OPTIONS = [
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

const LEAVE_TYPES = [
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

function repeatLabel(id) {
  return REPEAT_OPTIONS.find((o) => o.id === id)?.label ?? "Doesn't repeat";
}

function formatAllocDate(d) {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function resolveProjectIdForCanonicalLabel(label, registry) {
  const t = String(label || "").trim();
  if (!t || !registry?.length) return "";
  const matches = registry.filter((p) => p && !p.archived && projectToAllocationLabel(p) === t);
  if (matches.length === 1) return String(matches[0].id);
  return "";
}

/** Group registry projects by code; non-registry option strings go under "Other projects". */
function buildProjectPickerCodeGroups(projectRegistry, optionStrings) {
  const active = (projectRegistry || []).filter((p) => p && !p.archived);
  const byCode = new Map();
  for (const row of active) {
    const code = String(row.code || "").trim() || "__nocode__";
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(row);
  }
  for (const rows of byCode.values()) {
    rows.sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" })
    );
  }
  const sortedCodes = [...byCode.keys()].sort((a, b) => {
    if (a === "__nocode__") return 1;
    if (b === "__nocode__") return -1;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
  const groups = [];
  for (const code of sortedCodes) {
    const rows = byCode.get(code);
    const heading = code === "__nocode__" ? "Other codes" : code;
    groups.push({ key: `code:${code}`, heading, kind: "registry", rows });
  }
  const registryLabels = new Set(active.map((r) => projectToAllocationLabel(r)));
  const extras = (optionStrings || [])
    .map(String)
    .filter((s) => s && !registryLabels.has(s))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  if (extras.length) {
    groups.push({
      key: "__extra__",
      heading: groups.length === 0 ? "Projects" : "Other projects",
      kind: "extras",
      labels: extras,
    });
  }
  return groups;
}

function filterProjectPickerCodeGroups(groups, query) {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  const out = [];
  for (const g of groups) {
    if (g.kind === "extras") {
      const labels = g.labels.filter((lbl) => lbl.toLowerCase().includes(q));
      if (labels.length) out.push({ ...g, labels });
      continue;
    }
    const headingHit = g.heading.toLowerCase().includes(q);
    const rows = headingHit
      ? g.rows
      : g.rows.filter((row) => {
          const lbl = projectToAllocationLabel(row).toLowerCase();
          const name = String(row.name || "").toLowerCase();
          const client = String(row.client || "").toLowerCase();
          const code = String(row.code || "").toLowerCase();
          return (
            lbl.includes(q) || name.includes(q) || client.includes(q) || code.includes(q)
          );
        });
    if (rows.length) out.push({ ...g, rows });
  }
  return out;
}

export function CreateAllocationModal({
  open,
  onClose,
  onCreate,
  onCreateLeave,
  allocations = [],
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
  publicHolidayAllocations = [],
  t,
  premiumV2Enabled = false,
  premiumV2Templates,
}) {
  const tplList = premiumV2Templates ?? [];
  /** Static UI clamps CSS animations globally — pair with `.lpam-modal` static-ui overrides to avoid invisible panels. */
  const clampMotion = useReducedMotion() || isStaticUi();
  const hoursMode = "Hours";
  const [activeTab, setActiveTab] = useState("allocation");
  const [templatePresetId, setTemplatePresetId] = useState("");
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
  const [projectQuery, setProjectQuery] = useState("");
  /** Registry project id when chosen from picker (disambiguates duplicate labels). */
  const [allocationProjectId, setAllocationProjectId] = useState("");

  // Leave-specific state
  const [leaveType, setLeaveType] = useState("annual");
  const [leaveTypeOpen, setLeaveTypeOpen] = useState(false);
  const [leaveNotes, setLeaveNotes] = useState("");
  const [leaveHoursPerDay, setLeaveHoursPerDay] = useState("7.5");

  const repeatWrapRef = useRef(null);
  const assignWrapRef = useRef(null);
  const projectWrapRef = useRef(null);
  const projectTriggerRef = useRef(null);
  const projectMenuRef = useRef(null);
  /** Portal mount inside Dialog.Content so Radix FocusScope includes the search input. */
  const projectMenuPortalRef = useRef(null);
  const [projectMenuHostEl, setProjectMenuHostEl] = useState(null);
  const leaveTypeWrapRef = useRef(null);
  const [projectMenuBox, setProjectMenuBox] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (editAllocation) {
      setTemplatePresetId("");
      setStartDate(editAllocation.startDate || "");
      setEndDate(editAllocation.endDate || "");
      setHoursPerDay(editAllocation.hoursPerDay ? String(editAllocation.hoursPerDay) : "7.5");
      setProject(editAllocation.project || "");
      setAllocationProjectId(
        editAllocation.projectId != null && String(editAllocation.projectId).trim() !== ""
          ? String(editAllocation.projectId)
          : resolveProjectIdForCanonicalLabel(editAllocation.project || "", projectRegistry)
      );
      setNotes(editAllocation.notes || "");
      setRepeatId(editAllocation.repeatId || "none");
      setActiveTab(editAllocation.isLeave ? "leave" : "allocation");
      if (editAllocation.isLeave) {
        setLeaveType(editAllocation.leaveType || "annual");
        setLeaveNotes(editAllocation.notes || "");
        setLeaveHoursPerDay(
          editAllocation.hoursPerDay != null ? String(editAllocation.hoursPerDay) : "7.5"
        );
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
    const list = projects.length ? projects : ALLOCATION_PROJECT_SEED;
    const pre = preselectProject != null ? String(preselectProject).trim() : "";
    const nextProj = pre || list[0] || "";
    if (pre) setProject(pre);
    else setProject(list[0] ?? "");
    setAllocationProjectId(resolveProjectIdForCanonicalLabel(nextProj, projectRegistry));
    const nextAssigned =
      preselectPerson != null ? [preselectPerson.id] : people[0] != null ? [people[0].id] : [];
    let hoursDefault = "7.5";
    if (
      premiumV2Enabled &&
      defaultTab !== "leave" &&
      nextAssigned.length > 0
    ) {
      const sug = suggestHoursPerDayFromAllocations(allocations, nextAssigned, nextProj);
      if (sug != null && Number.isFinite(sug) && sug > 0) {
        const rounded = Math.round(sug * 100) / 100;
        hoursDefault = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
      }
    }
    setHoursPerDay(hoursDefault);
    setNotes("");
    setRepeatId("none");
    setRepeatOpen(false);
    setAssignQuery("");
    setAssignOpen(false);
    setProjectOpen(false);
    setProjectQuery("");
    setActiveTab(defaultTab === "leave" ? "leave" : "allocation");
    setLeaveType("annual");
    setLeaveTypeOpen(false);
    setLeaveNotes("");
    setLeaveHoursPerDay("7.5");
    setAssignedIds(nextAssigned);
    setTemplatePresetId("");
  }, [
    open,
    preselectPerson,
    preselectDate,
    preselectProject,
    people,
    projects,
    projectRegistry,
    editAllocation,
    defaultTab,
    allocations,
    premiumV2Enabled,
  ]);

  useEffect(() => {
    function onDoc(e) {
      if (repeatWrapRef.current && !repeatWrapRef.current.contains(e.target)) setRepeatOpen(false);
      if (assignWrapRef.current && !assignWrapRef.current.contains(e.target)) setAssignOpen(false);
      const inProjectTrigger = projectWrapRef.current?.contains(e.target);
      const inProjectMenu = projectMenuRef.current?.contains(e.target);
      if (!inProjectTrigger && !inProjectMenu) {
        setProjectOpen(false);
        setProjectQuery("");
      }
      if (leaveTypeWrapRef.current && !leaveTypeWrapRef.current.contains(e.target)) setLeaveTypeOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDoc, true);
      return () => document.removeEventListener("mousedown", onDoc, true);
    }
  }, [open]);

  const workingDays = useMemo(
    () => {
      if (!startDate || !endDate) return 0;
      if (activeTab === "leave") return countWorkingDaysBetween(startDate, endDate);
      return countAllocationWorkingDaysExcludingOffDays(
        startDate,
        endDate,
        assignedIds,
        allocations,
        publicHolidayAllocations
      );
    },
    [startDate, endDate, activeTab, assignedIds, allocations, publicHolidayAllocations]
  );

  const totalHours = useMemo(() => {
    const h = parseFloat(hoursPerDay, 10) || 0;
    return Math.round(workingDays * h * 100) / 100;
  }, [workingDays, hoursPerDay]);

  const leaveTotalHours = useMemo(() => {
    const h = parseFloat(leaveHoursPerDay, 10) || 0;
    return Math.round(workingDays * h * 100) / 100;
  }, [workingDays, leaveHoursPerDay]);

  const assignablePeople = useMemo(() => {
    const q = assignQuery.trim().toLowerCase();
    return people.filter((p) => {
      if (assignedIds.includes(p.id)) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q);
    });
  }, [people, assignedIds, assignQuery]);

  const projectOptions = useMemo(
    () => (projects.length ? projects : ALLOCATION_PROJECT_SEED),
    [projects]
  );

  const projectOptionGroups = useMemo(
    () => buildProjectPickerCodeGroups(projectRegistry, projectOptions),
    [projectRegistry, projectOptions]
  );

  const filteredProjectGroups = useMemo(
    () => filterProjectPickerCodeGroups(projectOptionGroups, projectQuery),
    [projectOptionGroups, projectQuery]
  );

  const projectSelectionKey = allocationProjectId || resolveProjectIdForCanonicalLabel(project, projectRegistry);

  const triggerRegistryRow = useMemo(() => {
    const id = allocationProjectId.trim();
    if (!id) return null;
    return projectRegistry.find((r) => String(r.id) === id) ?? null;
  }, [allocationProjectId, projectRegistry]);

  const triggerSwatchColor = useMemo(() => {
    const hex = triggerRegistryRow?.color;
    if (hex && typeof hex === "string" && /^#([0-9A-Fa-f]{6})$/i.test(hex.trim())) {
      return hex.trim();
    }
    return resolveColorForProjectLabel(project, projectRegistry);
  }, [triggerRegistryRow, project, projectRegistry]);

  useLayoutEffect(() => {
    if (!open || !projectOpen) {
      setProjectMenuBox(null);
      return;
    }
    const el = projectTriggerRef.current;
    if (!el) {
      setProjectMenuBox(null);
      return;
    }
    const measure = () => {
      const host = projectMenuPortalRef.current;
      if (!host) return;
      const r = el.getBoundingClientRect();
      const h = host.getBoundingClientRect();
      const gap = 6;
      const spaceBelow = h.bottom - r.bottom - gap - 12;
      const maxH = Math.min(360, Math.max(120, spaceBelow));
      setProjectMenuBox({
        top: r.bottom - h.top + gap,
        left: r.left - h.left,
        width: Math.max(r.width, 260),
        maxHeight: maxH,
      });
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, projectOpen]);

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

  // Check for public holiday overlaps
  const publicHolidayOverlaps = useMemo(() => {
    if (activeTab === "leave" || !startDate || !endDate || assignedIds.length === 0) return [];
    const pStart = String(startDate).slice(0, 10);
    const pEnd = String(endDate).slice(0, 10);
    const assignedSet = new Set(assignedIds.map((id) => String(id)));
    const overlaps = [];
    const seenHolidayKeys = new Set();
    for (const ph of publicHolidayAllocations) {
      const phPeople = Array.isArray(ph.personIds)
        ? ph.personIds.map((id) => String(id))
        : ph.personId != null
          ? [String(ph.personId)]
          : [];
      const matchesAssignee = phPeople.some((pid) => assignedSet.has(pid));
      if (!matchesAssignee) continue;

      const phStart = String(ph.startDate).slice(0, 10);
      const phEnd = String(ph.endDate).slice(0, 10);
      if (pStart <= phEnd && pEnd >= phStart) {
        const key = `${phStart}|${phEnd}|${String(ph.notes || "Public holiday").trim()}`;
        if (seenHolidayKeys.has(key)) continue;
        seenHolidayKeys.add(key);
        overlaps.push(ph);
      }
    }
    return overlaps;
  }, [activeTab, startDate, endDate, publicHolidayAllocations, assignedIds]);



  const leaveAccent = useMemo(() => leaveAccentTheme(leaveType), [leaveType]);

  /** Do not tie commit to `workingDays` — it can be 0 after excluding leave/off-days (single assignee) or for odd ranges; that used to permanently disable Save with no explanation. */
  const primarySaveDisabled = useMemo(() => {
    const dateOk =
      Boolean(startDate && endDate) && new Date(`${startDate}T12:00:00`) <= new Date(`${endDate}T12:00:00`);
    if (!dateOk || assignedIds.length === 0) return true;
    if (activeTab === "allocation") {
      return !String(project || "").trim() || !(parseFloat(hoursPerDay) > 0);
    }
    return !(parseFloat(leaveHoursPerDay) > 0);
  }, [startDate, endDate, assignedIds, activeTab, project, hoursPerDay, leaveHoursPerDay]);

  if (!open) return null;

  const isSyntheticPhEdit = editAllocation?.syntheticPublicHoliday === true;
  const editingLeave = !!editAllocation && !!editAllocation.isLeave;

  const handleSave = () => {
    if (!(startDate && endDate)) {
      toast.error("Pick dates", { description: "Start and end date are required." });
      return;
    }
    if (new Date(`${startDate}T12:00:00`) > new Date(`${endDate}T12:00:00`)) {
      toast.error("Invalid range", { description: "End date must be on or after the start date." });
      return;
    }
    if (assignedIds.length === 0) {
      toast.error("Assign people", { description: "Choose at least one person." });
      return;
    }

    if (activeTab === "allocation") {
      if (!String(project || "").trim()) {
        toast.error("Choose a project", { description: "Select a project (or extra label) before saving." });
        return;
      }
      const payload = {
        personIds: assignedIds,
        startDate,
        endDate,
        hoursPerDay: parseFloat(hoursPerDay, 10) || 0,
        totalHours,
        workingDays,
        project,
        projectId:
          allocationProjectId.trim() !== ""
            ? allocationProjectId.trim()
            : registryProjectIdForPickerLabel(project, projectRegistry),
        notes: notes.trim(),
        repeatId,
      };
      if (editAllocation && onEditAllocation) {
        onEditAllocation(payload, editAllocation.id);
      } else {
        onCreate(payload);
      }
    } else {
      const payload = {
        personIds: assignedIds,
        startDate,
        endDate,
        hoursPerDay: parseFloat(leaveHoursPerDay, 10) || 0,
        totalHours: leaveTotalHours,
        workingDays,
        project: leaveLabel(leaveType),
        projectId: undefined,
        notes: leaveNotes.trim(),
        repeatId: "none",
        isLeave: true,
        leaveType,
      };
      if (editAllocation && onEditAllocation && !isSyntheticPhEdit) {
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
        <Dialog.Overlay
          className={
            "lpam-overlay-radix" + (!editAllocation ? " lpam-overlay-radix--create-new" : "")
          }
        />
        <Dialog.Content
          className={
            "lpam-modal lpam-create float-premium-modal" +
            (projectOpen ? " lpam-modal--project-picker-open" : "")
          }
          style={{
            color: t.text,
          }}
        >
          <Dialog.Description className="lpam-sr-only">
            Set hours, dates, project, and assign people for a new allocation or leave.
          </Dialog.Description>
        <div className="lpam-head">
          <Dialog.Title asChild>
            <h2 className="lpam-title">
              {editAllocation && !isSyntheticPhEdit ? "Edit" : activeTab === "leave" ? "Leave" : "Allocation"}
            </h2>
          </Dialog.Title>
          <Dialog.Close asChild>
            <button type="button" className="lpam-icon-close" aria-label="Close">
              <X size={20} color={t.textMuted} />
            </button>
          </Dialog.Close>
        </div>

        <div className="lpam-create-tabs-premium" role="tablist" aria-label="Allocation or leave">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "allocation"}
              className={
                "lpam-create-tab-chip" +
                (activeTab === "allocation" ? " lpam-create-tab-chip--active" : "") +
                (editingLeave ? " lpam-create-tab-chip--disabled" : "")
              }
              style={{
                color:
                  activeTab === "allocation" ? "#fff" : editingLeave ? t.textMuted : t.textSoft,
                opacity: editingLeave ? 0.45 : 1,
                cursor: editingLeave ? "not-allowed" : "pointer",
                ...(activeTab === "allocation"
                  ? {
                      background: `linear-gradient(155deg, color-mix(in srgb, ${t.accent} 88%, #0f172a), ${t.accent})`,
                      boxShadow:
                        `0 0 0 1px color-mix(in srgb, ${t.accent} 45%, transparent), 0 8px 24px ${t.accentGlow || "rgba(0,136,255,0.25)"}`,
                    }
                  : {}),
              }}
              disabled={editingLeave}
              onClick={() => {
                if (editingLeave) return;
                setActiveTab("allocation");
              }}
            >
              Allocation
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "leave"}
              className={
                "lpam-create-tab-chip" + (activeTab === "leave" ? " lpam-create-tab-chip--active" : "")
              }
              style={{
                color: activeTab === "leave" ? "#fff" : t.textSoft,
                ...(activeTab === "leave"
                  ? {
                      background: `linear-gradient(155deg,
                        color-mix(in srgb, ${leaveAccent.solid} 82%, #0f172a),
                        ${leaveAccent.solid})`,
                      boxShadow: `0 0 0 1px color-mix(in srgb, ${leaveAccent.solid} 42%, transparent), 0 8px 24px ${leaveAccent.glow}`,
                    }
                  : {}),
              }}
              onClick={() => setActiveTab("leave")}
            >
              <Palmtree size={15} strokeWidth={2} style={{ marginRight: 6, flexShrink: 0 }} aria-hidden />
              Leave
            </button>
          </div>

        <div className="lpam-modal-body">
        <AnimatePresence mode="wait">
        {activeTab === "allocation" ? (
          <motion.div
            key="lpam-body-alloc"
            initial={clampMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.45, 0, 0.55, 1] } }}
            exit={clampMotion ? undefined : { opacity: 0, y: -8, transition: { duration: 0.18 } }}
          >
        <div className="lpam-panel lpam-create-stage">
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
          {premiumV2Enabled && tplList.length > 0 && (
            <div className="lpam-field lpam-template-field">
              <label className="lpam-label" htmlFor="lpam-v2-template-presets">
                Template
              </label>
              <select
                id="lpam-v2-template-presets"
                className="lpam-select"
                aria-label="Apply hours and repeat preset"
                value={templatePresetId}
                style={{ borderColor: t.border, background: t.bg, color: t.text, width: "100%" }}
                onChange={(e) => {
                  const id = e.target.value;
                  setTemplatePresetId(id);
                  if (!id || activeTab !== "allocation") return;
                  const tpl = tplList.find((row) => row.id === id);
                  if (!tpl) return;
                  setHoursPerDay(String(tpl.hoursPerDay));
                  setRepeatId(tpl.repeatId || "none");
                }}
              >
                <option value="">Custom · no preset</option>
                {tplList.map((tplOpt) => (
                  <option key={tplOpt.id} value={tplOpt.id}>
                    {tplOpt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {publicHolidayOverlaps.length > 0 && (
            <div
              className={"lpam-ph-overlap-box" + (premiumV2Enabled ? " lpam-ph-overlap-box--v2" : "")}
              style={{
                marginTop: "12px",
                padding: premiumV2Enabled ? "12px 12px 10px" : "10px 12px",
                background: "rgba(245, 158, 11, 0.08)",
                borderLeft: "3px solid rgb(245, 158, 11)",
                borderRadius: "6px",
                color: "rgb(140, 100, 0)",
              }}
            >
              <p style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "500" }}>
                Public holiday overlap
              </p>
              {premiumV2Enabled ? (
                <div className="lpam-ph-chip-row" role="list" aria-label="Overlapping holidays">
                  {publicHolidayOverlaps.map((ph, hi) => {
                    const nid = `${String(ph?.id ?? "ph")}-${String(ph?.startDate ?? hi)}-${hi}`;
                    const label = String(ph?.notes ?? "Public holiday").trim() || "Public holiday";
                    return (
                      <span key={nid} className="lpam-ph-chip" role="listitem">
                        {label}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: "12px", lineHeight: "1.45" }}>
                  {publicHolidayOverlaps.length === 1
                    ? `This allocation overlaps with: ${publicHolidayOverlaps[0].notes || "Public holiday"}`
                    : `This allocation overlaps with ${publicHolidayOverlaps.length} public holidays`}
                </p>
              )}
            </div>
          )}
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
          </div>
          <div className="lpam-dropdown-wrap lpam-dropdown-full" ref={projectWrapRef}>
            <button
              ref={projectTriggerRef}
              type="button"
              className={
                "lpam-input lpam-project-trigger" + (projectOpen ? " lpam-project-trigger--open" : "")
              }
              style={{
                borderColor: projectOpen ? t.accent : t.borderIn || t.border,
                background: t.surface,
                color: t.text,
                boxShadow: projectOpen
                  ? `0 0 0 1px color-mix(in srgb, ${t.accent} 45%, transparent), 0 4px 14px rgba(0,0,0,0.08)`
                  : "0 1px 3px rgba(0,0,0,0.02)",
              }}
              aria-expanded={projectOpen}
              aria-haspopup="listbox"
              onClick={() => setProjectOpen((o) => !o)}
            >
              <span className="lpam-project-trigger-inner">
                {project ? (
                  <span
                    className="lpam-project-swatch lpam-project-swatch--trigger"
                    style={{ background: triggerSwatchColor }}
                    aria-hidden
                  />
                ) : null}
                <span className="lpam-project-trigger-text">{project || "Select project"}</span>
              </span>
              <ChevronDown size={16} style={{ color: t.textMuted }} />
            </button>
            {projectOpen &&
              projectMenuBox &&
              projectMenuHostEl &&
              createPortal(
                <div
                  ref={projectMenuRef}
                  className="lpam-menu lpam-menu-project lpam-menu-project-float"
                  style={{
                    position: "absolute",
                    top: projectMenuBox.top,
                    left: projectMenuBox.left,
                    width: projectMenuBox.width,
                    maxHeight: projectMenuBox.maxHeight,
                    minHeight: 0,
                    background: t.surface,
                    borderColor: t.border,
                  }}
                  role="listbox"
                  aria-label="Projects"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className="lpam-menu-search">
                    <input
                      type="text"
                      className="lpam-input lpam-menu-search-input"
                      style={{ borderColor: t.border, background: t.bg, color: t.text }}
                      placeholder="Search projects…"
                      value={projectQuery}
                      onChange={(e) => setProjectQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div
                    className="lpam-menu-scroll lpam-menu-scroll--grouped"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {filteredProjectGroups.length === 0 ? (
                      <div className="lpam-menu-empty" style={{ color: t.textMuted }}>
                        No projects match “{projectQuery}”
                      </div>
                    ) : (
                      filteredProjectGroups.map((g) => (
                        <div key={g.key} className="lpam-menu-client-block">
                          <div
                            className="lpam-menu-client-heading"
                            style={{ color: t.textSoft }}
                          >
                            {g.heading}
                          </div>
                          {g.kind === "extras"
                            ? g.labels.map((lbl) => {
                                const swatch = resolveColorForProjectLabel(lbl, projectRegistry);
                                return (
                                  <button
                                    key={g.key + ":" + lbl}
                                    type="button"
                                    role="option"
                                    aria-selected={project === lbl}
                                    className={
                                      "lpam-menu-item lpam-menu-item--project-row" +
                                      (project === lbl ? " lpam-menu-item-active" : "")
                                    }
                                    style={{ color: t.text }}
                                    onPointerDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setProject(lbl);
                                      setAllocationProjectId("");
                                      setProjectOpen(false);
                                      setProjectQuery("");
                                    }}
                                  >
                                    <span className="lpam-menu-item-inner">
                                      <span
                                        className="lpam-project-swatch lpam-project-swatch--menu"
                                        style={{ background: swatch }}
                                        aria-hidden
                                      />
                                      <span className="lpam-menu-item-label">{lbl}</span>
                                    </span>
                                  </button>
                                );
                              })
                            : g.rows.map((row) => {
                                const canonical = projectToAllocationLabel(row);
                                const swatch = resolveColorForProjectLabel(canonical, projectRegistry);
                                const selected = String(row.id) === projectSelectionKey;
                                return (
                                  <button
                                    key={String(row.id)}
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    className={
                                      "lpam-menu-item lpam-menu-item--project-row" +
                                      (selected ? " lpam-menu-item-active" : "")
                                    }
                                    style={{ color: t.text }}
                                    onPointerDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setProject(canonical);
                                      setAllocationProjectId(String(row.id));
                                      setProjectOpen(false);
                                      setProjectQuery("");
                                    }}
                                  >
                                    <span className="lpam-menu-item-inner">
                                      <span
                                        className="lpam-project-swatch lpam-project-swatch--menu"
                                        style={{ background: swatch }}
                                        aria-hidden
                                      />
                                      <span className="lpam-menu-item-label lpam-menu-item-label--stacked">
                                        <span className="lpam-menu-item-title">
                                          {String(row.name || "").trim() || canonical}
                                        </span>
                                        {(row.client || "").trim() ? (
                                          <span
                                            className="lpam-menu-item-sub"
                                            style={{ color: t.textMuted }}
                                          >
                                            {String(row.client).trim()}
                                          </span>
                                        ) : null}
                                      </span>
                                    </span>
                                  </button>
                                );
                              })}
                        </div>
                      ))
                    )}
                  </div>
                </div>,
                projectMenuHostEl
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
            initial={clampMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.45, 0, 0.55, 1] } }}
            exit={clampMotion ? undefined : { opacity: 0, y: -8, transition: { duration: 0.18 } }}
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
                  animate={clampMotion ? undefined : { scale: [1, 1.04, 1] }}
                  transition={{ duration: 0.45, ease: [0.45, 0, 0.55, 1] }}
                  key={leaveTypeNorm}
                >
                  <Palmtree size={22} style={{ color: leaveAccent.solid }} />
                </motion.div>
              </div>
              {leaveType === "annual" ? (
                <p className="lpam-leave-hint" style={{ color: t.textMuted }}>
                  Paid time off — appears on the schedule with a distinct fill pattern so it stays separate from other leave types.
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
                        initial={clampMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: [0.45, 0, 0.55, 1] } }}
                        exit={clampMotion ? undefined : { opacity: 0, y: -4, scale: 0.99, transition: { duration: 0.15 } }}
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
                              initial={clampMotion ? false : { opacity: 0, x: -8 }}
                              animate={{
                                opacity: 1,
                                x: 0,
                                transition: { delay: clampMotion ? 0 : li * 0.035, duration: 0.2 },
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
              <div className="lpam-row lpam-row-split" style={{ marginTop: 10 }}>
                <div className="lpam-field lpam-grow">
                  <label className="lpam-label" style={{ color: t.textMuted }}>Per day</label>
                  <div className="lpam-inline">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={leaveHoursPerDay}
                      onChange={(e) => setLeaveHoursPerDay(e.target.value)}
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
                  <label className="lpam-label" style={{ color: t.textMuted }}>Total hours</label>
                  <div className="lpam-total-pill" style={{ background: t.bg, borderColor: t.border, color: t.text }}>
                    {leaveTotalHours}
                  </div>
                </div>
              </div>
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
              disabled={primarySaveDisabled}
              style={
                activeTab === "leave"
                  ? {
                      background: `linear-gradient(145deg, ${leaveAccent.solid}, color-mix(in srgb, ${leaveAccent.solid} 75%, #0f172a))`,
                      borderColor: "transparent",
                      color: "#fff",
                      boxShadow: `0 6px 28px ${leaveAccent.glow}`,
                    }
                  : { borderColor: "transparent", color: "#fff" }
              }
              whileTap={clampMotion || primarySaveDisabled ? undefined : { scale: 0.98 }}
            >
              {editAllocation && !isSyntheticPhEdit
                ? "Save changes"
                : activeTab === "leave"
                  ? "Create leave"
                  : "Create allocation"}
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
        <div
          ref={(el) => {
            projectMenuPortalRef.current = el;
            setProjectMenuHostEl(el);
          }}
          className="lpam-project-menu-portal-host"
          aria-hidden={!projectOpen}
        />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AllocationDetailModal({
  open,
  allocation,
  assigneeNames,
  onClose,
  onDelete,
  onEditClick,
  onExtendAllocation,
  allocations = [],
  publicHolidayAllocations = [],
  t,
}) {
  const allocationPersonIds = useMemo(() => {
    if (!allocation) return [];
    if (allocation.personIds?.length) return allocation.personIds.map(String);
    if (allocation.personId != null) return [String(allocation.personId)];
    return [];
  }, [allocation]);

  const showExtendPanel =
    !!onExtendAllocation &&
    !!allocation &&
    !allocation.isLeave &&
    !allocation.syntheticPublicHoliday;

  const [extendPresetWeeks, setExtendPresetWeeks] = useState(2);
  const [extendChipMode, setExtendChipMode] = useState("preset");
  const [extendCustomWeeksStr, setExtendCustomWeeksStr] = useState("2");
  const [extendBusy, setExtendBusy] = useState(false);

  useEffect(() => {
    if (open && allocation) {
      setExtendPresetWeeks(2);
      setExtendChipMode("preset");
      setExtendCustomWeeksStr("2");
      setExtendBusy(false);
    }
  }, [open, allocation?.id]);

  const currentEndKey = allocation ? String(allocation.endDate || "").slice(0, 10) : "";

  const activeExtendWeeks = useMemo(() => {
    if (extendChipMode === "custom") {
      const raw = extendCustomWeeksStr.replace(/\D/g, "");
      const n = Number.parseInt(raw || "1", 10);
      const v = Number.isFinite(n) ? n : 1;
      return Math.min(52, Math.max(1, v));
    }
    return Math.min(52, Math.max(1, extendPresetWeeks));
  }, [extendChipMode, extendCustomWeeksStr, extendPresetWeeks]);

  const previewEndKey = allocation
    ? addCalendarWeeksToIsoLocal(String(allocation.endDate || "").slice(0, 10), activeExtendWeeks)
    : "";

  const extendValid =
    !!allocation &&
    !!previewEndKey &&
    previewEndKey.length >= 10 &&
    previewEndKey.slice(0, 10) > currentEndKey;

  const previewExtendWorkingDays = useMemo(() => {
    if (!allocation || !previewEndKey || !extendValid) return 0;
    return countAllocationWorkingDaysExcludingOffDays(
      allocation.startDate,
      previewEndKey.slice(0, 10),
      allocationPersonIds,
      allocations,
      publicHolidayAllocations
    );
  }, [
    allocation,
    previewEndKey,
    extendValid,
    allocationPersonIds,
    allocations,
    publicHolidayAllocations,
  ]);

  const previewExtendTotalHours = useMemo(
    () => allocationTotalHoursRounded(previewExtendWorkingDays, allocation?.hoursPerDay),
    [previewExtendWorkingDays, allocation?.hoursPerDay]
  );

  if (!open || !allocation) return null;

  const isLeave = !!allocation.isLeave;
  const detailLeaveAccent = isLeave ? leaveAccentTheme(allocation.leaveType) : null;
  const wd =
    allocation.workingDays ??
    countWorkingDaysBetween(
      allocation.startDate,
      allocation.endDate
    );
  const repeatText =
    allocation.repeatId && allocation.repeatId !== "none" ? repeatLabel(allocation.repeatId) : null;
  const currentTotalH = Number(allocation.totalHours) || 0;
  const deltaWd = extendValid ? previewExtendWorkingDays - wd : 0;
  const deltaH =
    extendValid ? Math.round((previewExtendTotalHours - currentTotalH) * 100) / 100 : 0;

  const bumpCustomWeeks = (delta) => {
    setExtendChipMode("custom");
    setExtendCustomWeeksStr((prev) => {
      const raw = prev.replace(/\D/g, "") || String(activeExtendWeeks);
      const n = Number.parseInt(raw, 10) || 1;
      const next = Math.min(52, Math.max(1, n + delta));
      return String(next);
    });
  };

  const handleApplyExtend = async () => {
    if (!onExtendAllocation || !extendValid || extendBusy) return;
    const nextKey = previewEndKey.slice(0, 10);
    setExtendBusy(true);
    try {
      await onExtendAllocation(allocation, nextKey);
    } finally {
      setExtendBusy(false);
    }
  };

  const handleDelete = () => {
    if (!onDelete) return;
    let msg;
    if (allocation.syntheticPublicHoliday) {
      msg = "Remove this public holiday from the schedule for this person?";
    } else {
      msg = isLeave ? "Delete this leave entry? This cannot be undone." : "Delete this allocation? This cannot be undone.";
    }
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
              : showExtendPanel
                ? "Hours, project, assignments, notes, assigned people, and an optional Extend end date section."
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
            <div className="lpam-detail-metrics" style={{ marginTop: 6 }}>
              <div>
                <div className="lpam-detail-label" style={{ color: t.textMuted }}>
                  Hours/day
                </div>
                <div className="lpam-detail-value">{allocation.hoursPerDay ?? 0}</div>
              </div>
              <div>
                <div className="lpam-detail-label" style={{ color: t.textMuted }}>
                  Total hours
                </div>
                <div className="lpam-detail-value">{allocation.totalHours ?? 0}</div>
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

            {showExtendPanel ? (
              <details className="lpam-detail-extend-drawer">
                <summary
                  className="lpam-detail-extend-drawer-sum"
                  style={{
                    color: t.text,
                    borderColor: `color-mix(in srgb, ${t.borderSub} 88%, transparent)`,
                    background: `color-mix(in srgb, ${t.surfRaised || t.surface} 55%, transparent)`,
                  }}
                >
                  <ArrowRight aria-hidden strokeWidth={2.25} className="lpam-detail-extend-drawer-ico" size={17} />
                  <span className="lpam-detail-extend-drawer-label">Extend end date</span>
                  <span className="lpam-detail-extend-drawer-hint" style={{ color: t.textMuted }}>
                    calendar weeks · optional
                  </span>
                </summary>
                <div className="lpam-extend-card-wrap lpam-extend-card-wrap--drawer">
                <div
                  className="lpam-extend-card"
                  style={{
                    borderColor: `color-mix(in srgb, ${t.borderSub} 72%, transparent)`,
                    boxShadow: `inset 0 1px 0 color-mix(in srgb, ${t.surface} 40%, transparent), 0 10px 32px ${t.accentGlow || "rgba(0,136,255,0.06)"}`,
                    background: `linear-gradient(
                      148deg,
                      color-mix(in srgb, ${t.surface} 92%, ${t.accent} 8%) 0%,
                      color-mix(in srgb, ${t.surfRaised || t.surface} 97%, ${t.border} 3%) 100%
                    )`,
                  }}
                >
                  <div className="lpam-extend-chip-row" role="group" aria-label="Extension length presets">
                    {[
                      { w: 1, label: "+1 week" },
                      { w: 2, label: "+2 weeks" },
                      { w: 4, label: "+4 weeks" },
                    ].map(({ w, label }) => (
                      <button
                        key={w}
                        type="button"
                        className={`lpam-extend-chip${extendChipMode === "preset" && extendPresetWeeks === w ? " lpam-extend-chip--active" : ""}`}
                        style={{
                          borderColor:
                            extendChipMode === "preset" && extendPresetWeeks === w
                              ? t.accent
                              : `color-mix(in srgb, ${t.border} 82%, transparent)`,
                          background:
                            extendChipMode === "preset" && extendPresetWeeks === w
                              ? `linear-gradient(180deg,
                                  color-mix(in srgb, ${t.surface} 40%, transparent),
                                  color-mix(in srgb, ${t.accent} 12%, transparent))`
                              : t.btnSec || t.surface,
                          color:
                            extendChipMode === "preset" && extendPresetWeeks === w ? t.accent : t.textSoft,
                        }}
                        onClick={() => {
                          setExtendChipMode("preset");
                          setExtendPresetWeeks(w);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`lpam-extend-chip lpam-extend-chip--narrow${extendChipMode === "custom" ? " lpam-extend-chip--active" : ""}`}
                      style={{
                        borderColor:
                          extendChipMode === "custom"
                            ? t.accent
                            : `color-mix(in srgb, ${t.border} 82%, transparent)`,
                        background:
                          extendChipMode === "custom"
                            ? `linear-gradient(180deg,
                                color-mix(in srgb, ${t.surface} 40%, transparent),
                                color-mix(in srgb, ${t.accent} 12%, transparent))`
                            : t.btnSec || t.surface,
                        color: extendChipMode === "custom" ? t.accent : t.textSoft,
                      }}
                      onClick={() => {
                        setExtendChipMode("custom");
                        setExtendCustomWeeksStr(
                          String(extendChipMode === "preset" ? extendPresetWeeks : activeExtendWeeks)
                        );
                      }}
                    >
                      Custom
                    </button>
                  </div>

                  {extendChipMode === "custom" ? (
                    <div className="lpam-extend-custom">
                      <span className="lpam-detail-label" style={{ color: t.textMuted }}>
                        Weeks
                      </span>
                      <div
                        className="lpam-extend-stepper"
                        style={{
                          border: `1px solid ${t.border}`,
                          borderRadius: 12,
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "stretch",
                        }}
                      >
                        <button
                          type="button"
                          className="lpam-extend-step"
                          aria-label="Fewer weeks"
                          style={{
                            borderColor: t.border,
                            background: t.btnSec || t.surface,
                            color: t.text,
                          }}
                          onClick={() => bumpCustomWeeks(-1)}
                        >
                          −
                        </button>
                        <input
                          aria-label="Number of calendar weeks to extend"
                          className="lpam-extend-input"
                          type="text"
                          inputMode="numeric"
                          value={extendCustomWeeksStr}
                          onChange={(e) => {
                            setExtendChipMode("custom");
                            const next = e.target.value.replace(/\D/g, "").slice(0, 2);
                            setExtendCustomWeeksStr(next === "" ? "" : next);
                          }}
                          onBlur={() =>
                            setExtendCustomWeeksStr((s) =>
                              String(
                                Math.min(52, Math.max(1, Number.parseInt(s.replace(/\D/g, "") || "1", 10)))
                              )
                            )
                          }
                          style={{
                            borderColor: t.border,
                            background: t.surface,
                            color: t.text,
                          }}
                        />
                        <button
                          type="button"
                          className="lpam-extend-step"
                          aria-label="More weeks"
                          style={{
                            borderColor: t.border,
                            background: t.btnSec || t.surface,
                            color: t.text,
                          }}
                          onClick={() => bumpCustomWeeks(1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div
                    className={
                      extendValid
                        ? "lpam-extend-preview lpam-extend-preview--ok"
                        : "lpam-extend-preview lpam-extend-preview--warn"
                    }
                    style={{
                      borderColor: extendValid
                        ? `color-mix(in srgb, ${t.accent} 35%, transparent)`
                        : `color-mix(in srgb, ${t.warn ?? "#f59e0b"} 40%, transparent)`,
                      background: extendValid
                        ? `color-mix(in srgb, ${t.accentGlow || "rgba(0,136,255,0.12)"} 28%, transparent)`
                        : String(t.warnSoft || "rgba(245,158,11,0.12)"),
                    }}
                  >
                    <div className="lpam-extend-preview-top" style={{ color: extendValid ? t.text : t.warn ?? "#f59e0b" }}>
                      <ArrowRight
                        size={17}
                        aria-hidden
                        strokeWidth={2.25}
                        style={{
                          flexShrink: 0,
                          color: extendValid ? t.accent : (t.warn ?? "#f59e0b"),
                        }}
                      />
                      <span>
                        {extendValid
                          ? `New end · ${formatAllocDate(previewEndKey)}`
                          : "Choose at least one more week"}
                      </span>
                    </div>
                    {extendValid ? (
                      <div className="lpam-extend-preview-metrics" style={{ color: t.textSoft }}>
                        <span>
                          {previewExtendWorkingDays} working days · {previewExtendTotalHours} h total
                        </span>
                        {deltaWd !== 0 || deltaH !== 0 ? (
                          <span className="lpam-extend-delta" style={{ color: t.accent }}>
                            +{deltaWd} days · +{deltaH} h vs current
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    className="lpam-btn lpam-extend-apply"
                    disabled={!extendValid || extendBusy}
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      background: extendValid
                        ? `linear-gradient(145deg, ${t.accent}, ${t.accentSoft || t.accent})`
                        : t.btnSec || "#1e2235",
                      borderColor: "transparent",
                      color: extendValid ? "#fff" : t.textMuted,
                      opacity: extendBusy ? 0.75 : 1,
                      boxShadow: extendValid ? `0 12px 32px ${t.accentGlow || "rgba(0,136,255,0.2)"}` : undefined,
                    }}
                    onClick={handleApplyExtend}
                  >
                    {extendBusy ? "Applying…" : extendValid ? "Apply extension" : "Pick a duration"}
                  </button>
                </div>
              </div>
              </details>
            ) : null}
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

        <div
          className="lpam-detail-foot"
          style={{
            borderTop: `1px solid ${t.borderSub || t.border}`,
            flexShrink: 0,
          }}
        >
          <div className="lpam-meta" style={{ color: t.textMuted }}>
            <Zap size={14} />
            <span>
              {allocation.syntheticPublicHoliday
                ? "Regional calendar — Edit to record custom leave, Delete to hide this day on the schedule."
                : `Updated by ${allocation.updatedBy || "—"} · ${formatAllocDate(allocation.updatedAt)}`}
            </span>
          </div>
          <div className="lpam-detail-actions" style={{ display: "flex", gap: "10px" }}>
            {onDelete ? (
              <button
                type="button"
                className="lpam-btn lpam-btn-delete-solid"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            {onEditClick ? (
              <button
                type="button"
                className={
                  "lpam-btn lpam-btn-primary lpam-btn-edit-solid" + (isLeave ? " lpam-btn-leave" : "")
                }
                style={
                  isLeave && detailLeaveAccent
                    ? {
                        background: `linear-gradient(145deg, ${detailLeaveAccent.solid}, color-mix(in srgb, ${detailLeaveAccent.solid} 72%, #0f172a))`,
                        borderColor: "transparent",
                        color: "#fff",
                        boxShadow: `0 6px 24px ${detailLeaveAccent.glow}`,
                      }
                    : { borderColor: "transparent", color: "#fff" }
                }
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

