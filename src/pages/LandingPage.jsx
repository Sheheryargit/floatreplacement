import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { NavLink } from "react-router-dom";
import {
  CalendarDays,
  ClipboardList,
  Users,
  FolderOpen,
  BarChart3,
  ChevronDown,
  Filter,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Plus,
  UserPlus,
  MousePointer2,
  SlidersHorizontal,
  Share,
  Sun,
  Moon,
  Clock,
  Percent,
  LayoutGrid,
  Rows3,
  Maximize2,
  Check,
} from "lucide-react";
import PersonModal, {
  T,
  useToasts,
  Toasts,
  formToPerson,
  nextPersonId,
  PEOPLE_SEED,
  SEED_ROLES,
  SEED_DEPTS,
  SEED_TAGS,
  ini,
  avGrad,
} from "../components/PersonModal.jsx";
import {
  CreateAllocationModal,
  AllocationDetailModal,
  ALLOCATION_PROJECT_SEED,
  advanceRepeatWindow,
} from "../components/AllocationModals.jsx";
import "./LandingPage.css";

const VIEW_OPTIONS = [
  { id: "day", label: "Days" },
  { id: "week", label: "Weeks" },
  { id: "month", label: "Months" },
];

const DENSITY_OPTIONS = [
  { id: "compact", label: "Compact", Icon: LayoutGrid, desc: "Tightest spacing" },
  { id: "comfortable", label: "Comfortable", Icon: Rows3, desc: "Balanced" },
  { id: "spacious", label: "Spacious", Icon: Maximize2, desc: "Maximum row height" },
];

function startOfWeekMonday(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d, n) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

function isWeekendDate(dt) {
  const dow = dt.getDay();
  return dow === 0 || dow === 6;
}

/** Move anchor by N weekdays (skips Sat/Sun). */
function addWeekdays(date, delta) {
  const x = new Date(date);
  let n = Math.abs(delta);
  const step = delta >= 0 ? 1 : -1;
  while (n > 0) {
    x.setDate(x.getDate() + step);
    if (!isWeekendDate(x)) n--;
  }
  return x;
}

function weekMondayKey(dt) {
  const m = startOfWeekMonday(dt);
  return `${m.getFullYear()}-${m.getMonth()}-${m.getDate()}`;
}

function formatDayMonth(dt) {
  return dt.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

/** All Mon–Fri dates inside calendar month (y, mo). */
function weekdaysInMonth(y, mo) {
  const dim = daysInMonth(y, mo);
  const out = [];
  for (let day = 1; day <= dim; day++) {
    const dt = new Date(y, mo, day);
    if (!isWeekendDate(dt)) out.push(dt);
  }
  return out;
}

/** Mon–Fri for the ISO week containing d. */
function weekdaysInAnchorWeek(d) {
  const mon = startOfWeekMonday(d);
  return [0, 1, 2, 3, 4].map((i) => addDays(mon, i));
}

function dateKeyLocal(dt) {
  const x = new Date(dt);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Map allocation date range to visible column start + span (Mon–Fri columns). */
function layoutAllocation(alloc, scheduleModel, viewMode) {
  const n = scheduleModel.columnCount;
  const keys = scheduleModel.slots.map((s) => s.dateKey);
  const sk = alloc.startDate;
  const ek = alloc.endDate;

  if (viewMode === "day") {
    const anchorK = scheduleModel.anchorDateKey;
    if (!anchorK || anchorK < sk || anchorK > ek) return null;
    const w = Math.max(2, Math.floor(n * 0.22));
    const s = Math.max(0, Math.floor((n - w) / 2));
    return { start: s, span: Math.min(w, n - s) };
  }

  let i0 = keys.findIndex((k) => k >= sk);
  if (i0 < 0) return null;
  let i1 = -1;
  for (let i = keys.length - 1; i >= 0; i--) {
    if (keys[i] <= ek) {
      i1 = i;
      break;
    }
  }
  if (i1 < i0) return null;
  return { start: i0, span: i1 - i0 + 1 };
}

function allocationHasPerson(a, pid) {
  if (Array.isArray(a.personIds) && a.personIds.length > 0) return a.personIds.includes(pid);
  return a.personId === pid;
}

/** Visible timeline segments for an allocation (includes recurring occurrences). */
function layoutsForAllocation(alloc, scheduleModel, viewMode) {
  const out = [];
  let start = alloc.startDate;
  let end = alloc.endDate;
  const repeatId = alloc.repeatId ?? "none";
  const originMs = new Date(`${alloc.startDate}T12:00:00`).getTime();
  const maxMs = originMs + 800 * 864e5;

  for (let i = 0; i < 80; i++) {
    const lay = layoutAllocation({ ...alloc, startDate: start, endDate: end }, scheduleModel, viewMode);
    if (lay) out.push({ ...lay, occ: i });
    if (repeatId === "none") break;
    const next = advanceRepeatWindow(start, end, repeatId);
    if (!next) break;
    ({ start, end } = next);
    if (new Date(`${start}T12:00:00`).getTime() > maxMs) break;
  }
  return out;
}

function shortenAllocLabel(s, maxLen) {
  if (!s) return "";
  return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s;
}

function allocationDisplay(alloc) {
  const parts = alloc.project.split("/").map((x) => x.trim());
  const code = parts[0] || "";
  const name = parts[1] || parts[0] || alloc.project;
  const h = alloc.hoursPerDay;
  const hStr = Number.isInteger(h) ? String(h) : String(h);
  return {
    label: shortenAllocLabel(name, 17),
    sub: `${code} · ${hStr}h`,
  };
}

function blockClassForColor(key) {
  if (key === "pink") return "lp-block lp-block-pink";
  if (key === "teal") return "lp-block lp-block-teal";
  return "lp-block lp-block-orange";
}

function buildScheduleModel(viewMode, anchorDate) {
  const d = new Date(anchorDate);
  const y = d.getFullYear();
  const mo = d.getMonth();

  if (viewMode === "day") {
    const cols = 12;
    const anchorKey = dateKeyLocal(d);
    const slots = Array.from({ length: cols }, (_, i) => {
      const h = 8 + i * 2;
      return {
        main: `${String(h).padStart(2, "0")}:00`,
        sub: null,
        weekParity: 0,
        weekBlockStart: false,
        weekBlockEnd: false,
        dateKey: anchorKey,
      };
    });
    const title = d.toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return {
      columnCount: cols,
      bandTitle: title,
      bandSpans: null,
      slots,
      anchorDateKey: anchorKey,
    };
  }

  if (viewMode === "week") {
    const dates = weekdaysInAnchorWeek(d);
    const bandLabel = `${formatDayMonth(dates[0])} – ${formatDayMonth(dates[4])}`;
    const slots = dates.map((dt, i) => ({
      main: String(dt.getDate()),
      sub: dt.toLocaleDateString("en-AU", { weekday: "short" }),
      weekParity: 0,
      weekBlockStart: i === 0,
      weekBlockEnd: i === dates.length - 1,
      dateKey: dateKeyLocal(dt),
    }));
    return {
      columnCount: 5,
      bandTitle: bandLabel,
      bandSpans: [{ span: 5, label: bandLabel, weekParity: 0 }],
      slots,
      anchorDateKey: dateKeyLocal(d),
    };
  }

  const dates = weekdaysInMonth(y, mo);
  const bandTitle = d.toLocaleDateString("en-AU", { month: "long", year: "numeric" });

  if (dates.length === 0) {
    const fallbackKey = dateKeyLocal(d);
    return {
      columnCount: 1,
      bandTitle,
      bandSpans: [{ span: 1, label: "—", weekParity: 0 }],
      slots: [
        {
          main: "—",
          sub: "",
          weekParity: 0,
          weekBlockStart: true,
          weekBlockEnd: true,
          dateKey: fallbackKey,
        },
      ],
      anchorDateKey: fallbackKey,
    };
  }

  let weekStripe = -1;
  let prevMondayKey = null;
  const slots = dates.map((dt, i) => {
    const mk = weekMondayKey(dt);
    if (mk !== prevMondayKey) {
      weekStripe++;
      prevMondayKey = mk;
    }
    const prevK = i > 0 ? weekMondayKey(dates[i - 1]) : null;
    const nextK = i < dates.length - 1 ? weekMondayKey(dates[i + 1]) : null;
    return {
      main: String(dt.getDate()),
      sub: dt.toLocaleDateString("en-AU", { weekday: "short" }),
      weekParity: weekStripe % 2,
      weekBlockStart: mk !== prevK,
      weekBlockEnd: mk !== nextK,
      dateKey: dateKeyLocal(dt),
    };
  });

  const bandSpans = [];
  let i = 0;
  while (i < dates.length) {
    const mk0 = weekMondayKey(dates[i]);
    let j = i + 1;
    while (j < dates.length && weekMondayKey(dates[j]) === mk0) j++;
    const span = j - i;
    bandSpans.push({
      span,
      label: `${formatDayMonth(dates[i])} – ${formatDayMonth(dates[j - 1])}`,
      weekParity: slots[i].weekParity,
    });
    i = j;
  }

  return {
    columnCount: dates.length,
    bandTitle,
    bandSpans,
    slots,
    anchorDateKey: dateKeyLocal(d),
  };
}

function formatHourTotal(n) {
  return `${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}h`;
}

function mockPersonHours(personId) {
  const s = String(personId);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  const base = 80 + (Math.abs(h) % 80);
  return base + (Math.abs(h) % 100) / 100;
}

export default function LandingPage() {
  const [theme, setTheme] = useState("dark");
  const t = T[theme];

  const [people, setPeople] = useState(() => PEOPLE_SEED.map((p) => ({ ...p })));
  const [roles, setRoles] = useState([...SEED_ROLES]);
  const [depts, setDepts] = useState([...SEED_DEPTS]);
  const [tagOpts, setTagOpts] = useState([...SEED_TAGS]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);

  const [viewMode, setViewMode] = useState("month");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [density, setDensity] = useState("comfortable");
  const [utilizationMode, setUtilizationMode] = useState("hours");

  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [densityOpen, setDensityOpen] = useState(false);

  const [allocations, setAllocations] = useState([]);
  const allocIdRef = useRef(1);
  const [allocCreateOpen, setAllocCreateOpen] = useState(false);
  const [allocPreselectPerson, setAllocPreselectPerson] = useState(null);
  const [allocDetailOpen, setAllocDetailOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState(null);
  const [allocationProjects, setAllocationProjects] = useState(() => [...ALLOCATION_PROJECT_SEED]);

  const viewWrapRef = useRef(null);
  const densityWrapRef = useRef(null);
  const { ts, add: toast } = useToasts();

  useEffect(() => {
    function onDoc(e) {
      if (viewWrapRef.current && !viewWrapRef.current.contains(e.target)) setViewMenuOpen(false);
      if (densityWrapRef.current && !densityWrapRef.current.contains(e.target)) setDensityOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const scheduleModel = useMemo(() => buildScheduleModel(viewMode, anchorDate), [viewMode, anchorDate]);

  const schedulePeople = useMemo(() => people.filter((p) => !p.archived), [people]);

  const totalHours = useMemo(() => {
    let s = 0;
    for (const p of schedulePeople) s += mockPersonHours(p.id);
    return s;
  }, [schedulePeople]);

  const muted = theme === "dark" ? "#636d84" : "#858da3";

  const navigatePrev = useCallback(() => {
    if (viewMode === "day") setAnchorDate((d) => addWeekdays(d, -1));
    else if (viewMode === "week") setAnchorDate((d) => addDays(startOfWeekMonday(d), -7));
    else setAnchorDate((d) => addMonths(d, -1));
  }, [viewMode]);

  const navigateNext = useCallback(() => {
    if (viewMode === "day") setAnchorDate((d) => addWeekdays(d, 1));
    else if (viewMode === "week") setAnchorDate((d) => addDays(startOfWeekMonday(d), 7));
    else setAnchorDate((d) => addMonths(d, 1));
  }, [viewMode]);

  const goToday = useCallback(() => setAnchorDate(new Date()), []);

  const openAdd = () => {
    setEditingPerson(null);
    setModalOpen(true);
  };

  const openCreateAllocation = useCallback((person) => {
    setAllocPreselectPerson(person ?? null);
    setAllocCreateOpen(true);
  }, []);

  const closeCreateAllocation = useCallback(() => {
    setAllocCreateOpen(false);
    setAllocPreselectPerson(null);
  }, []);

  const handleCreateAllocation = useCallback(
    (payload) => {
      const id = allocIdRef.current++;
      const colorKeys = ["orange", "pink", "teal"];
      const colorKey = colorKeys[id % 3];
      setAllocations((prev) => [
        ...prev,
        {
          id,
          ...payload,
          updatedBy: "You",
          updatedAt: new Date().toISOString(),
          colorKey,
        },
      ]);
      toast("Allocation created", "success");
    },
    [toast]
  );

  const openAllocationDetail = useCallback((alloc) => {
    setSelectedAllocation(alloc);
    setAllocDetailOpen(true);
  }, []);

  const closeAllocationDetail = useCallback(() => {
    setAllocDetailOpen(false);
    setSelectedAllocation(null);
  }, []);

  const handleAddAllocationProject = useCallback((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    setAllocationProjects((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  }, []);

  const selectedAssigneeNames = useMemo(() => {
    if (!selectedAllocation) return "";
    const ids =
      selectedAllocation.personIds?.length > 0
        ? selectedAllocation.personIds
        : selectedAllocation.personId != null
          ? [selectedAllocation.personId]
          : [];
    return ids
      .map((id) => schedulePeople.find((x) => x.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  }, [selectedAllocation, schedulePeople]);

  const openEdit = (person) => {
    setEditingPerson(person);
    setModalOpen(true);
  };

  const handleModalSave = (form) => {
    if (editingPerson) {
      const updated = formToPerson(form, editingPerson.id, editingPerson.archived);
      setPeople(
        people.map((p) => (p.id === editingPerson.id ? updated : p)).sort((a, b) => a.name.localeCompare(b.name))
      );
      toast(`${form.name} updated`, "success");
    } else {
      const newP = formToPerson(form, nextPersonId(), false);
      setPeople([...people, newP].sort((a, b) => a.name.localeCompare(b.name)));
      toast(`${form.name} added to directory`, "success");
    }
    setModalOpen(false);
    setEditingPerson(null);
  };

  const handleModalArchive = () => {
    if (editingPerson) {
      setPeople(
        people.map((p) =>
          p.id === editingPerson.id ? { ...p, archived: !p.archived } : p
        )
      );
      toast(`${editingPerson.name} ${editingPerson.archived ? "restored" : "archived"}`, "warn");
      setModalOpen(false);
      setEditingPerson(null);
    }
  };

  const viewLabel = VIEW_OPTIONS.find((v) => v.id === viewMode)?.label ?? "Months";

  /** Minimum column width (px) per view — keeps timeline readable and scrolls horizontally when needed */
  const colMinPx = viewMode === "day" ? 52 : viewMode === "week" ? 72 : 36;
  const gridTemplate = `repeat(${scheduleModel.columnCount}, minmax(${colMinPx}px, 1fr))`;
  const timelineMinWidthPx = scheduleModel.columnCount * colMinPx;

  return (
    <div
      className="lp-root"
      data-theme={theme === "light" ? "light" : "dark"}
      data-density={density}
      data-view={viewMode}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap"
        rel="stylesheet"
      />

      <aside className="lp-sidenav" aria-label="Primary">
        <NavLink to="/" className="lp-logo" end title="Home">
          R1
        </NavLink>

        <NavLink to="/" end className={({ isActive }) => "lp-nav-item" + (isActive ? " lp-active" : "")}>
          <CalendarDays size={19} strokeWidth={2} />
          Schedule
        </NavLink>

        <span className="lp-nav-item lp-disabled" title="Coming soon">
          <ClipboardList size={19} strokeWidth={1.8} />
          Project plan
        </span>

        <NavLink to="/people" className={({ isActive }) => "lp-nav-item" + (isActive ? " lp-active" : "")}>
          <Users size={19} strokeWidth={2} />
          People
        </NavLink>

        <NavLink to="/projects" className={({ isActive }) => "lp-nav-item" + (isActive ? " lp-active" : "")}>
          <FolderOpen size={19} strokeWidth={2} />
          Projects
        </NavLink>

        <span className="lp-nav-item lp-disabled" title="Coming soon">
          <BarChart3 size={19} strokeWidth={1.8} />
          Report
        </span>

        <div className="lp-sidenav-spacer" />

        <button
          type="button"
          className="lp-theme-btn"
          title={theme === "dark" ? "Light mode" : "Dark mode"}
          onClick={() => setTheme((x) => (x === "dark" ? "light" : "dark"))}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </aside>

      <div className="lp-main">
        <div className="lp-header-block">
          <div className="lp-page-title-row">
            <div className="lp-title-chevron">
              <h1 className="lp-page-title">Schedule</h1>
              <ChevronDown size={18} color={muted} aria-hidden />
            </div>
          </div>

          <div className="lp-toolbar">
            <div className="lp-toolbar-left">
              <button type="button" className="lp-btn-secondary">
                <Filter size={14} strokeWidth={2} />
                Filter
              </button>
            </div>
            <div className="lp-toolbar-right">
              <div className="lp-date-nav">
                <button type="button" aria-label="Previous period" onClick={navigatePrev}>
                  <ChevronLeft size={16} />
                </button>
                <button type="button" className="lp-today" onClick={goToday}>
                  Today
                </button>
                <button type="button" aria-label="Next period" onClick={navigateNext}>
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="lp-dropdown-wrap" ref={viewWrapRef}>
                <button
                  type="button"
                  className="lp-pill lp-pill-btn"
                  aria-expanded={viewMenuOpen}
                  aria-haspopup="listbox"
                  onClick={() => {
                    setViewMenuOpen((o) => !o);
                    setDensityOpen(false);
                  }}
                >
                  <Calendar size={14} />
                  {viewLabel}
                  <ChevronDown size={14} />
                </button>
                {viewMenuOpen && (
                  <div className="lp-popover lp-popover-view" role="listbox">
                    {VIEW_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        role="option"
                        className={"lp-popover-item" + (viewMode === opt.id ? " lp-popover-item-active" : "")}
                        onClick={() => {
                          setViewMode(opt.id);
                          setViewMenuOpen(false);
                        }}
                      >
                        {opt.label}
                        {viewMode === opt.id && <Check size={16} className="lp-popover-check" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="lp-dropdown-wrap" ref={densityWrapRef}>
                <button
                  type="button"
                  className={"lp-icon-btn" + (densityOpen ? " lp-icon-btn-active" : "")}
                  aria-label="View settings"
                  aria-expanded={densityOpen}
                  onClick={() => {
                    setDensityOpen((o) => !o);
                    setViewMenuOpen(false);
                  }}
                >
                  <SlidersHorizontal size={18} />
                </button>
                {densityOpen && (
                  <div className="lp-popover lp-popover-density">
                    <div className="lp-popover-title">Density</div>
                    {DENSITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={
                          "lp-density-row" + (density === opt.id ? " lp-density-row-active" : "")
                        }
                        onClick={() => {
                          setDensity(opt.id);
                        }}
                      >
                        <opt.Icon size={18} strokeWidth={1.8} className="lp-density-icon" />
                        <span className="lp-density-text">
                          <span className="lp-density-label">{opt.label}</span>
                          <span className="lp-density-desc">{opt.desc}</span>
                        </span>
                        {density === opt.id && <Check size={16} className="lp-popover-check" />}
                      </button>
                    ))}
                    <div className="lp-popover-divider" />
                    <div className="lp-popover-title">Date range insights</div>
                    <div className="lp-util-row">
                      <span className="lp-util-label">Show utilization in</span>
                      <div className="lp-segment" role="group" aria-label="Utilization unit">
                        <button
                          type="button"
                          className={utilizationMode === "hours" ? "lp-seg-active" : ""}
                          onClick={() => setUtilizationMode("hours")}
                          title="Hours"
                        >
                          <Clock size={14} />
                        </button>
                        <button
                          type="button"
                          className={utilizationMode === "percent" ? "lp-seg-active" : ""}
                          onClick={() => setUtilizationMode("percent")}
                          title="Percent"
                        >
                          <Percent size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button type="button" className="lp-icon-btn" aria-label="Share">
                <Share size={18} />
              </button>
              <button
                type="button"
                className="lp-btn-primary"
                aria-label="Add allocation"
                onClick={() => openCreateAllocation(null)}
              >
                <Plus size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="lp-subbar">
            <div className="lp-subbar-people">
              <button type="button" className="lp-icon-btn" aria-label="Add person" onClick={openAdd}>
                <UserPlus size={18} />
              </button>
              <span className="lp-pill lp-pill-muted">
                {viewMode === "month" && "This month"}
                {viewMode === "week" && "This week"}
                {viewMode === "day" && "This day"}
              </span>
            </div>
            <div className="lp-subbar-timeline">
              <span className="lp-hours-total">
                {utilizationMode === "hours"
                  ? formatHourTotal(totalHours)
                  : `${Math.min(100, Math.round((totalHours / (schedulePeople.length * 160 || 1)) * 100))}%`}
              </span>
            </div>
          </div>
        </div>

        <div className="lp-schedule">
          <div
            className="lp-schedule-viewport"
            style={{
              "--lp-cols": scheduleModel.columnCount,
              "--lp-col-min": `${colMinPx}px`,
              "--lp-timeline-min": `${timelineMinWidthPx}px`,
            }}
          >
            <div
              key={`${viewMode}-${anchorDate.getTime()}`}
              className="lp-schedule-canvas lp-timeline-enter"
            >
              <div className="lp-sched-row lp-sched-row-head">
                <div className="lp-sched-corner" aria-hidden />
                <div className="lp-sched-timeline lp-sched-sticky-top">
                  <div className="lp-cal-head">
                    <div
                      className="lp-band-row"
                      style={{
                        gridTemplateColumns: gridTemplate,
                      }}
                    >
                      {scheduleModel.bandSpans
                        ? scheduleModel.bandSpans.map((w, i, arr) => (
                            <div
                              key={i}
                              className={
                                "lp-week-cell lp-week-band-block" +
                                (w.weekParity ? " lp-week-band-b" : " lp-week-band-a") +
                                (i === 0 ? " lp-week-band-outer-left" : "") +
                                (i === arr.length - 1 ? " lp-week-band-outer-right" : "")
                              }
                              style={{ gridColumn: `span ${w.span}` }}
                            >
                              <span className="lp-week-band-label">{w.label}</span>
                            </div>
                          ))
                        : (
                            <div className="lp-week-cell lp-week-cell-full" style={{ gridColumn: "1 / -1" }}>
                              {scheduleModel.bandTitle}
                            </div>
                          )}
                    </div>
                    <div
                      className="lp-days"
                      style={{
                        gridTemplateColumns: gridTemplate,
                      }}
                    >
                      {scheduleModel.slots.map((slot, i) => (
                        <div
                          key={`slot-${i}-${slot.main}`}
                          className={
                            "lp-day-cell" +
                            (viewMode !== "day" && slot.weekParity ? " lp-day-week-b" : "") +
                            (viewMode !== "day" && !slot.weekParity ? " lp-day-week-a" : "") +
                            (viewMode !== "day" && slot.weekBlockStart ? " lp-day-week-start" : "") +
                            (viewMode !== "day" && slot.weekBlockEnd ? " lp-day-week-end" : "")
                          }
                        >
                          <span className="lp-day-main">{slot.main}</span>
                          {slot.sub ? <span className="lp-day-sub">{slot.sub}</span> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {schedulePeople.map((p) => {
                const hours = mockPersonHours(p.id);
                const pct = Math.min(100, Math.round((hours / 160) * 100));
                const right =
                  utilizationMode === "hours"
                    ? `${hours.toFixed(hours % 1 ? 1 : 0)}h`
                    : `${pct}%`;
                return (
                  <div key={p.id} className="lp-sched-row">
                    <div className="lp-sched-person">
                      <div className="lp-person-row-shell">
                        <div className="lp-person-row-cluster">
                          <button
                            type="button"
                            className="lp-person-row lp-person-row-main"
                            onClick={() => openEdit(p)}
                          >
                            <div className="lp-avatar" style={{ background: avGrad(p.name) }}>
                              {ini(p.name)}
                            </div>
                            <div className="lp-person-meta">
                              <div className="lp-person-name">{p.name}</div>
                              <div className="lp-person-sub">
                                {p.role !== "—" ? `${p.role} · ` : ""}
                                {p.department || "—"}
                              </div>
                              {p.tags.length > 0 && (
                                <div className="lp-person-tags">
                                  {p.tags.slice(0, 2).map((tag) => (
                                    <span key={tag} className="lp-tag">
                                      {tag}
                                    </span>
                                  ))}
                                  {p.tags.length > 2 && (
                                    <span className="lp-tag lp-tag-more">+{p.tags.length - 2}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </button>
                          <button
                            type="button"
                            className="lp-person-add-alloc"
                            title="Add allocation"
                            aria-label={`Add allocation for ${p.name}`}
                            onClick={() => openCreateAllocation(p)}
                          >
                            <Plus size={12} strokeWidth={2} />
                          </button>
                        </div>
                        <button
                          type="button"
                          className="lp-person-row lp-person-hours-hit"
                          onClick={() => openEdit(p)}
                        >
                          <span className="lp-person-hours">{right}</span>
                        </button>
                      </div>
                    </div>
                    <div className="lp-sched-timeline">
                      <div className="lp-grid-stack">
                        <div
                          className="lp-grid-week-lanes"
                          style={{ gridTemplateColumns: gridTemplate }}
                          aria-hidden
                        >
                          {scheduleModel.slots.map((slot, i) => (
                            <div
                              key={`lane-${p.id}-${i}`}
                              className={
                                "lp-week-lane" +
                                (viewMode !== "day" && slot.weekParity ? " lp-week-lane-b" : "") +
                                (viewMode !== "day" && !slot.weekParity ? " lp-week-lane-a" : "") +
                                (viewMode !== "day" && slot.weekBlockStart ? " lp-week-lane-block-start" : "") +
                                (viewMode !== "day" && slot.weekBlockEnd ? " lp-week-lane-block-end" : "")
                              }
                            />
                          ))}
                        </div>
                        <div
                          className="lp-grid-row"
                          style={{
                            gridTemplateColumns: gridTemplate,
                          }}
                        >
                          {allocations
                            .filter((a) => allocationHasPerson(a, p.id))
                            .flatMap((a) =>
                              layoutsForAllocation(a, scheduleModel, viewMode).map((lay, occIdx) => {
                                const n = scheduleModel.columnCount;
                                const left = (lay.start / n) * 100;
                                const width = (lay.span / n) * 100;
                                const { label, sub } = allocationDisplay(a);
                                const z = 12 + occIdx;
                                return (
                                  <button
                                    key={`${a.id}-occ-${occIdx}`}
                                    type="button"
                                    className={`${blockClassForColor(a.colorKey)} lp-block-alloc`}
                                    style={{
                                      left: `${left}%`,
                                      width: `${width}%`,
                                      zIndex: z,
                                    }}
                                    onClick={() => openAllocationDetail(a)}
                                  >
                                    {label}
                                    <br />
                                    {sub}
                                  </button>
                                );
                              })
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <button type="button" className="lp-fab" aria-label="Pointer tool">
        <MousePointer2 size={16} />
      </button>

      <PersonModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingPerson(null);
        }}
        onSave={handleModalSave}
        onArchive={handleModalArchive}
        editPerson={editingPerson}
        roles={roles}
        setRoles={setRoles}
        depts={depts}
        setDepts={setDepts}
        tagOpts={tagOpts}
        setTagOpts={setTagOpts}
        t={t}
      />

      <CreateAllocationModal
        open={allocCreateOpen}
        onClose={closeCreateAllocation}
        onCreate={handleCreateAllocation}
        people={schedulePeople}
        preselectPerson={allocPreselectPerson}
        projects={allocationProjects}
        onAddProject={handleAddAllocationProject}
        t={t}
      />

      <AllocationDetailModal
        open={allocDetailOpen}
        allocation={selectedAllocation}
        assigneeNames={selectedAssigneeNames}
        onClose={closeAllocationDetail}
        t={t}
      />

      <Toasts ts={ts} t={t} />
    </div>
  );
}
