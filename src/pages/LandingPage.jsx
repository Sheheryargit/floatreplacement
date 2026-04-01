import { useMemo, useState, useRef, useEffect, useCallback, memo, useLayoutEffect } from "react";
import {
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
  Clock,
  Percent,
  LayoutGrid,
  Rows3,
  Maximize2,
  Check,
  FolderPlus,
  CalendarPlus,
} from "lucide-react";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAppData } from "../context/AppDataContext.jsx";
import { ProjectModal } from "./ProjectsPage.jsx";
import PersonModal, {
  T,
  formToPerson,
  ini,
  avGrad,
} from "../components/PersonModal.jsx";
import { toast } from "sonner";
import {
  CreateAllocationModal,
  AllocationDetailModal,
  advanceRepeatWindow,
  leaveLabel,
} from "../components/AllocationModals.jsx";
import AppSideNav from "../components/navigation/AppSideNav.jsx";
import {
  colorForAllocationBar,
  contrastingTextColor,
  resolveColorForProjectLabel,
} from "../utils/projectColors.js";
import { motion } from "framer-motion";
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

function formatDayMonthYear(dt) {
  return dt.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
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

/** Day grid: 12 columns, each column = 2 hours starting at 08:00 (see buildScheduleModel). */
const DAY_GRID_START_HOUR = 8;
const DAY_COLUMN_HOURS = 2;
/** Minimum span in column units so short bookings stay readable (~2.5h). */
const MIN_DAY_SPAN_COLUMNS = 1.25;
/** Minimum span in column units for week/month (integer columns). */
const MIN_WEEK_MONTH_SPAN_COLS = 1;

/**
 * Map allocation date range to visible column start + span.
 * `start` / `span` are in column index units (fractional allowed in day view).
 */
function layoutAllocation(alloc, scheduleModel, viewMode) {
  const n = scheduleModel.columnCount;
  const keys = scheduleModel.slots.map((s) => s.dateKey);
  const sk = alloc.startDate;
  const ek = alloc.endDate;

  if (viewMode === "day") {
    const anchorK = scheduleModel.anchorDateKey;
    if (!anchorK || anchorK < sk || anchorK > ek) return null;
    // Leave covers the entire day
    if (alloc.isLeave) {
      return { start: 0, span: n };
    }
    const hpd = Math.max(0.25, Number(alloc.hoursPerDay) || 0);
    let spanCols = hpd / DAY_COLUMN_HOURS;
    spanCols = Math.max(spanCols, MIN_DAY_SPAN_COLUMNS);
    spanCols = Math.min(spanCols, n);
    // Optional future: alloc.dayStartHour (0–24) anchors the block on the hourly grid.
    const gridStart =
      Number.isFinite(alloc.dayStartHour) && alloc.dayStartHour >= 0 && alloc.dayStartHour <= 24
        ? Math.max(0, (alloc.dayStartHour - DAY_GRID_START_HOUR) / DAY_COLUMN_HOURS)
        : 0;
    let startCol = gridStart;
    if (startCol + spanCols > n) startCol = Math.max(0, n - spanCols);
    startCol = Math.min(startCol, Math.max(0, n - spanCols));
    return { start: startCol, span: spanCols };
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
  let span = i1 - i0 + 1;
  span = Math.max(span, MIN_WEEK_MONTH_SPAN_COLS);
  return { start: i0, span };
}

/** Greedy lane assignment for overlapping [start, start+span) intervals. Mutates segments with .stack. */
function assignAllocationStackLevels(segments) {
  const sorted = [...segments].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.span - a.span;
  });
  const laneEnds = [];
  for (const seg of sorted) {
    const s = seg.start;
    const e = seg.start + seg.span;
    let placed = false;
    for (let k = 0; k < laneEnds.length; k++) {
      if (laneEnds[k] <= s + 1e-9) {
        seg.stack = k;
        laneEnds[k] = e;
        placed = true;
        break;
      }
    }
    if (!placed) {
      seg.stack = laneEnds.length;
      laneEnds.push(e);
    }
  }
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
  const name = parts.length > 1 ? parts.slice(1).join(" / ") : parts[0] || alloc.project;
  const code = parts.length > 1 ? parts[0] : "";
  const h = alloc.hoursPerDay;
  const hStr = Number.isInteger(h) ? String(h) : String(h);
  return {
    projectName: name,
    projectCode: code,
    hoursLabel: `${hStr}h`,
  };
}

function allocationAriaLabel(alloc) {
  if (alloc.isLeave) {
    const lbl = alloc.leaveType ? leaveLabel(alloc.leaveType) : "Leave";
    const range =
      alloc.startDate === alloc.endDate
        ? `on ${alloc.startDate}`
        : `from ${alloc.startDate} to ${alloc.endDate}`;
    return `${lbl} ${range}.`;
  }
  const h = alloc.hoursPerDay;
  const hStr = Number.isInteger(h) ? String(h) : String(h);
  const range =
    alloc.startDate === alloc.endDate
      ? `on ${alloc.startDate}`
      : `from ${alloc.startDate} to ${alloc.endDate}`;
  return `${alloc.project}, ${hStr} hours per day, ${range}. Open allocation details.`;
}

function buildScheduleModel(viewMode, anchorDate, offsets = { prev: 0, next: 0 }) {
  const d = new Date(anchorDate);
  const y = d.getFullYear();
  const mo = d.getMonth();

  if (viewMode === "day") {
    const colsPerDay = 12;
    const slots = [];
    let title = "";

    for (let o = -offsets.prev; o <= offsets.next; o++) {
      const dt = addWeekdays(d, o);
      if (o === 0) {
        title = dt.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      }
      const anchorKey = dateKeyLocal(dt);

      for (let i = 0; i < colsPerDay; i++) {
        const rawH = 8 + i * 2;
        const h = rawH >= 24 ? rawH - 24 : rawH;
        slots.push({
          main: `${String(h).padStart(2, "0")}:00`,
          sub: null,
          weekParity: o % 2 === 0 ? 0 : 1,
          weekBlockStart: i === 0,
          weekBlockEnd: i === colsPerDay - 1,
          dateKey: anchorKey,
        });
      }
    }

    return {
      columnCount: slots.length,
      bandTitle: title,
      bandSpans: null,
      slots,
      anchorDateKey: dateKeyLocal(d),
    };
  }

  let dates = [];
  let bandTitle = "";

  if (viewMode === "week") {
    for (let o = -offsets.prev; o <= offsets.next; o++) {
      const wStart = addDays(startOfWeekMonday(d), 7 * o);
      const wDates = [0, 1, 2, 3, 4].map((i) => addDays(wStart, i));
      dates.push(...wDates);
      if (o === 0) {
        bandTitle = `${formatDayMonth(wDates[0])} – ${formatDayMonthYear(wDates[4])}`;
      }
    }
  } else {
    for (let o = -offsets.prev; o <= offsets.next; o++) {
      const targetMonth = new Date(y, mo + o, 1);
      dates.push(...weekdaysInMonth(targetMonth.getFullYear(), targetMonth.getMonth()));
      if (o === 0) {
        bandTitle = targetMonth.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
      }
    }
  }

  if (dates.length === 0) {
    const fallbackKey = dateKeyLocal(d);
    return {
      columnCount: 1,
      bandTitle: bandTitle || "—",
      bandSpans: [{ span: 1, label: "—", weekParity: 0 }],
      slots: [
        { main: "—", sub: "", weekParity: 0, weekBlockStart: true, weekBlockEnd: true, dateKey: fallbackKey },
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
      label: `${formatDayMonth(dates[i])} – ${formatDayMonthYear(dates[j - 1])}`,
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

const timelineRowEqual = (prev, next) => {
  if (prev.p !== next.p) return false;
  if (prev.viewMode !== next.viewMode) return false;
  if (prev.utilizationMode !== next.utilizationMode) return false;
  if (prev.gridTemplate !== next.gridTemplate) return false;
  if (prev.scheduleModel !== next.scheduleModel) return false;
  if (prev.projects !== next.projects) return false;

  const prevAlloc = prev.allocations.filter((a) => allocationHasPerson(a, prev.p.id));
  const nextAlloc = next.allocations.filter((a) => allocationHasPerson(a, next.p.id));

  if (prevAlloc.length !== nextAlloc.length) return false;
  for (let idx = 0; idx < prevAlloc.length; idx++) {
    if (prevAlloc[idx] !== nextAlloc[idx]) return false;
  }
  return true;
};

const TimelineRow = memo(function TimelineRow({
  p,
  i,
  allocations,
  projects,
  scheduleModel,
  viewMode,
  utilizationMode,
  gridTemplate,
  nCols,
  openEdit,
  openCreateAllocation,
  openAllocationDetail,
  handleTimelineClick
}) {
  const { theme } = useAppTheme();
  const t = T[theme];
  const hours = mockPersonHours(p.id);
  const pct = Math.min(100, Math.round((hours / 160) * 100));
  const right =
    utilizationMode === "hours" ? `${hours.toFixed(hours % 1 ? 1 : 0)}h` : `${pct}%`;

  const rowSegments = allocations
    .filter((a) => allocationHasPerson(a, p.id))
    .flatMap((a) =>
      layoutsForAllocation(a, scheduleModel, viewMode).map((lay, occIdx) => ({
        a,
        lay,
        occIdx,
        start: lay.start,
        span: lay.span,
      }))
    );
  
  const workSegments = rowSegments.filter((s) => !s.a.isLeave);
  const leaveSegments = rowSegments.filter((s) => s.a.isLeave);
  
  assignAllocationStackLevels(workSegments);
  const allocLaneCount = workSegments.length ? Math.max(...workSegments.map((s) => s.stack)) + 1 : 1;


  return (
    <div key={p.id} className="lp-sched-row" style={{ ["--animation-order"]: i }}>
      <div className="lp-sched-person">
        <div className="lp-person-row-shell">
          <div className="lp-person-row-cluster">
            <button type="button" className="lp-person-row lp-person-row-main" onClick={() => openEdit(p)}>
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
                      <span key={tag} className="lp-tag">{tag}</span>
                    ))}
                    {p.tags.length > 2 && <span className="lp-tag lp-tag-more">+{p.tags.length - 2}</span>}
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
          <button type="button" className="lp-person-row lp-person-hours-hit" onClick={() => openEdit(p)}>
            <span className="lp-person-hours">{right}</span>
          </button>
        </div>
      </div>
      <div className="lp-sched-timeline">
        <div 
          className="lp-grid-stack" 
          style={{ ["--lp-alloc-lane-count"]: allocLaneCount, cursor: "pointer" }}
          onClick={(e) => handleTimelineClick(e, p, nCols)}
        >
          <div className="lp-grid-week-lanes" style={{ gridTemplateColumns: gridTemplate }} aria-hidden>
            {scheduleModel.slots.map((slot, idx) => (
              <div
                key={`lane-${p.id}-${idx}`}
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

          {leaveSegments.length > 0 && (
            <div
              className="lp-grid-leave-layer"
              style={{
                display: "grid",
                gridTemplateColumns: gridTemplate,
                gridColumn: 1,
                gridRow: 1,
                alignSelf: "stretch",
                pointerEvents: "none",
                zIndex: 1,
              }}
            >
              {leaveSegments.map((seg) => {
                // Day view: leave covers the entire day, so span all columns
                // Week/Month view: use the integer column positions from layoutAllocation
                const isDay = viewMode === "day";
                const colStart = isDay ? 1 : Math.max(1, Math.round(seg.lay.start) + 1);
                const colSpan = isDay ? nCols : Math.max(1, Math.round(seg.lay.span));
                const lbl = seg.a.leaveType ? leaveLabel(seg.a.leaveType) : "Leave";
                return (
                  <button
                    key={`${seg.a.id}-occ-${seg.occIdx}`}
                    type="button"
                    style={{
                      gridColumn: `${colStart} / span ${colSpan}`,
                      gridRow: 1,
                      alignSelf: "stretch",
                      pointerEvents: "auto",
                      border: "none",
                      margin: 0,
                      borderRadius: 0,
                      backgroundColor: t.surface,
                      backgroundImage: theme === "light"
                        ? "repeating-linear-gradient(-45deg, rgba(140, 150, 170, 0.25), rgba(140, 150, 170, 0.25) 4px, rgba(100, 115, 140, 0.05) 4px, rgba(100, 115, 140, 0.05) 9px)"
                        : "repeating-linear-gradient(-45deg, rgba(140, 150, 170, 0.35), rgba(140, 150, 170, 0.35) 4px, rgba(100, 115, 140, 0.12) 4px, rgba(100, 115, 140, 0.12) 9px)",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "flex-start",
                      padding: "18px 12px",
                      cursor: "pointer",
                      boxShadow: "inset 0 0 0 1px rgba(140, 155, 175, 0.12)",
                      minHeight: "100%",
                    }}
                    aria-label={allocationAriaLabel(seg.a)}
                    onClick={(e) => { e.stopPropagation(); openAllocationDetail(seg.a); }}
                  >
                    <span style={{ fontWeight: 700, fontSize: "12px", color: t.text }}>
                      {lbl}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div
            className="lp-grid-row"
            style={{ 
              gridTemplateColumns: gridTemplate, 
              padding: "12px 0", 
              alignContent: "start", 
              zIndex: 2,
              pointerEvents: "none" 
            }}
          >
            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "10px", width: "100%", position: "relative" }}>
              {Array.from({ length: allocLaneCount }).map((_, stackIdx) => {
                const laneSegs = workSegments
                  .filter((s) => s.stack === stackIdx)
                  .sort((a, b) => a.lay.start - b.lay.start);

                if (laneSegs.length === 0) return null;

                return (
                  <div key={stackIdx} style={{ display: "flex", width: "100%", position: "relative", alignItems: "flex-start" }}>
                    {laneSegs.map((seg, idx) => {
                      const prevEnd = idx === 0 ? 0 : laneSegs[idx - 1].lay.start + laneSegs[idx - 1].lay.span;
                      const marginLeft = ((seg.lay.start - prevEnd) / nCols) * 100;
                      const width = (seg.lay.span / nCols) * 100;
                      const z = 20 + seg.stack * 20 + seg.occIdx;

                      const h = parseFloat(seg.a.hoursPerDay) || 8;
                      const calculatedHeight = Math.max(28, Math.min(84, h * 10.5));

                      const baseStyle = {
                        position: "relative",
                        top: "auto",
                        left: "auto",
                        marginLeft: `${marginLeft}%`,
                        width: `${width}%`,
                        flexShrink: 0,
                        zIndex: z,
                        marginTop: 0,
                        minHeight: `${calculatedHeight}px`,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        pointerEvents: "auto",
                      };

                      const { projectName, projectCode, hoursLabel } = allocationDisplay(seg.a);
                      const barColor = colorForAllocationBar(seg.a, projects);
                      const fg = contrastingTextColor(barColor);
                      return (
                        <button
                          key={`${seg.a.id}-occ-${seg.occIdx}`}
                          type="button"
                          className="lp-block lp-block-alloc lp-block-alloc-project"
                          style={{ ...baseStyle, background: barColor, color: fg }}
                          aria-label={allocationAriaLabel(seg.a)}
                          onClick={(e) => { e.stopPropagation(); openAllocationDetail(seg.a); }}
                        >
                          <span className="lp-alloc-top">
                            <span className="lp-alloc-name">{projectName}</span>
                            {projectCode && <span className="lp-alloc-code">{projectCode}</span>}
                          </span>
                          <span className="lp-alloc-hours">{hoursLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}, timelineRowEqual);

export default function LandingPage() {
  const { theme, toggleTheme } = useAppTheme();
  const t = T[theme];

  const {
    people,
    setPeople,
    roles,
    setRoles,
    depts,
    setDepts,
    peopleTagOpts,
    setPeopleTagOpts,
    allocations,
    setAllocations,
    projects,
    setProjects,
    clients,
    setClients,
    projectTagOpts,
    setProjectTagOpts,
    allocationProjectOptions,
    addAllocationProjectLabel,
    getNextPersonId,
    getNextProjectId,
    syncPersonCreate,
    syncPersonUpdate,
    syncProjectCreate,
    syncAllocationCreate,
    syncAllocationUpdate,
    syncAllocationDelete,
  } = useAppData();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);

  const [viewMode, setViewMode] = useState("month");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [density, setDensity] = useState("comfortable");
  const [utilizationMode, setUtilizationMode] = useState("hours");

  const [timelineOffsets, setTimelineOffsets] = useState({ prev: 1, next: 2 });
  const prevOffsets = useRef(timelineOffsets);
  const prevColCount = useRef(0);
  const scheduleViewportRef = useRef(null);
  const lastAnchorKey = useRef(null);

  // Reset infinite scroll chunks if jumping across large dates/views
  useEffect(() => {
    setTimelineOffsets({ prev: 1, next: 2 });
  }, [anchorDate, viewMode]);

  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [densityOpen, setDensityOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);

  const [allocCreateOpen, setAllocCreateOpen] = useState(false);
  const [allocEditing, setAllocEditing] = useState(null);
  const [allocPreselectPerson, setAllocPreselectPerson] = useState(null);
  const [allocPreselectDate, setAllocPreselectDate] = useState(null);
  const [allocDetailOpen, setAllocDetailOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState(null);

  const viewWrapRef = useRef(null);
  const densityWrapRef = useRef(null);
  const addWrapRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (viewWrapRef.current && !viewWrapRef.current.contains(e.target)) setViewMenuOpen(false);
      if (densityWrapRef.current && !densityWrapRef.current.contains(e.target)) setDensityOpen(false);
      if (addWrapRef.current && !addWrapRef.current.contains(e.target)) setAddMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const scheduleModel = useMemo(
    () => buildScheduleModel(viewMode, anchorDate, timelineOffsets),
    [viewMode, anchorDate, timelineOffsets]
  );

  const todayDateKey = useMemo(() => dateKeyLocal(new Date()), []);

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
    lastAnchorKey.current = null;
  }, [viewMode]);

  const navigateNext = useCallback(() => {
    if (viewMode === "day") setAnchorDate((d) => addWeekdays(d, 1));
    else if (viewMode === "week") setAnchorDate((d) => addDays(startOfWeekMonday(d), 7));
    else setAnchorDate((d) => addMonths(d, 1));
    lastAnchorKey.current = null;
  }, [viewMode]);

  const goToday = useCallback(() => {
    setAnchorDate(new Date());
    setTimelineOffsets({ prev: 1, next: 2 });
    lastAnchorKey.current = null;
  }, []);

  const openAdd = () => {
    setEditingPerson(null);
    setModalOpen(true);
  };

  const openCreateAllocation = useCallback((person, date) => {
    setAllocEditing(null);
    setAllocPreselectPerson(person ?? null);
    setAllocPreselectDate(date ?? null);
    setAllocCreateOpen(true);
  }, []);

  const closeCreateAllocation = useCallback(() => {
    setAllocCreateOpen(false);
    setAllocEditing(null);
    setAllocPreselectPerson(null);
    setAllocPreselectDate(null);
  }, []);

  /** Click on empty timeline space → open allocation modal with person + date */
  const handleTimelineClick = useCallback(
    (e, person, nCols) => {
      // Don't open if user clicked on an existing allocation block
      if (e.target.closest(".lp-block")) return;
      const row = e.currentTarget;
      const rect = row.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const colWidth = rect.width / nCols;
      const colIndex = Math.min(Math.max(0, Math.floor(x / colWidth)), nCols - 1);
      const slot = scheduleModel.slots[colIndex];
      const clickedDate = slot?.dateKey ?? null;
      openCreateAllocation(person, clickedDate);
    },
    [scheduleModel, openCreateAllocation]
  );

  const handleCreateAllocation = useCallback(
    (payload) => {
      // ── Block allocation if any assigned person is on leave during these dates ──
      if (!payload.isLeave) {
        const pStart = payload.startDate;
        const pEnd = payload.endDate;
        for (const pid of payload.personIds) {
          const leaveConflict = allocations.find(
            (a) =>
              a.isLeave &&
              allocationHasPerson(a, pid) &&
              a.startDate <= pEnd &&
              a.endDate >= pStart
          );
          if (leaveConflict) {
            const personName = people.find((p) => p.id === pid)?.name || "This person";
            const leaveTypeName = leaveConflict.leaveType
              ? (leaveConflict.project || "Leave")
              : "Leave";
            toast.error(
              `Cannot allocate ${personName} — they are on ${leaveTypeName} (${leaveConflict.startDate} to ${leaveConflict.endDate})`
            );
            return;
          }
        }
      }

      const projectColor = resolveColorForProjectLabel(payload.project, projects);
      setAllocations((prev) => {
        const nextId = prev.reduce((m, a) => Math.max(m, Number(a.id) || 0), 0) + 1;
        const created = {
          id: nextId,
          ...payload,
          updatedBy: "You",
          updatedAt: new Date().toISOString(),
          projectColor,
        };
        queueMicrotask(() => syncAllocationCreate(created));
        return [...prev, created];
      });
      toast.success(payload.isLeave ? "Leave created" : "Allocation created");
    },
    [setAllocations, projects, allocations, people, syncAllocationCreate]
  );

  const handleEditAllocation = useCallback(
    (payload, id) => {
      // ── Block allocation if any assigned person is on leave during these dates ──
      if (!payload.isLeave) {
        const pStart = payload.startDate;
        const pEnd = payload.endDate;
        for (const pid of payload.personIds) {
          const leaveConflict = allocations.find(
            (a) =>
              a.id !== id &&
              a.isLeave &&
              allocationHasPerson(a, pid) &&
              a.startDate <= pEnd &&
              a.endDate >= pStart
          );
          if (leaveConflict) {
            const personName = people.find((p) => p.id === pid)?.name || "This person";
            const leaveTypeName = leaveConflict.leaveType
              ? (leaveConflict.project || "Leave")
              : "Leave";
            toast.error(
              `Cannot allocate ${personName} — they are on ${leaveTypeName} (${leaveConflict.startDate} to ${leaveConflict.endDate})`
            );
            return;
          }
        }
      }

      const projectColor = payload.isLeave ? undefined : resolveColorForProjectLabel(payload.project, projects);
      setAllocations((prev) =>
        prev.map((a) => {
          if (a.id !== id) return a;
          const merged = {
            ...a,
            ...payload,
            updatedBy: "You",
            updatedAt: new Date().toISOString(),
            projectColor,
          };
          queueMicrotask(() => syncAllocationUpdate(merged));
          return merged;
        })
      );
      toast.success(payload.isLeave ? "Leave updated" : "Allocation updated");
    },
    [setAllocations, projects, allocations, people, syncAllocationUpdate]
  );

  const handleDeleteAllocation = useCallback(
    (alloc) => {
      setAllocations((prev) => prev.filter((a) => a.id !== alloc.id));
      syncAllocationDelete(alloc.id);
      toast.success("Allocation deleted");
    },
    [setAllocations, syncAllocationDelete]
  );

  const openAllocationDetail = useCallback((alloc) => {
    setSelectedAllocation(alloc);
    setAllocDetailOpen(true);
  }, []);

  const closeAllocationDetail = useCallback(() => {
    setAllocDetailOpen(false);
    setSelectedAllocation(null);
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
      .map((id) => people.find((x) => x.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  }, [selectedAllocation, people]);

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
      syncPersonUpdate(updated);
      toast.success(`${form.name} updated`);
    } else {
      const newP = formToPerson(form, getNextPersonId(), false);
      setPeople([...people, newP].sort((a, b) => a.name.localeCompare(b.name)));
      syncPersonCreate(newP);
      toast.success(`${form.name} added to directory`);
    }
    setModalOpen(false);
    setEditingPerson(null);
  };

  const handleModalArchive = () => {
    if (editingPerson) {
      const next = { ...editingPerson, archived: !editingPerson.archived };
      setPeople(people.map((p) => (p.id === editingPerson.id ? next : p)));
      syncPersonUpdate(next);
      toast.warning(`${editingPerson.name} ${editingPerson.archived ? "restored" : "archived"}`);
      setModalOpen(false);
      setEditingPerson(null);
    }
  };

  const viewLabel = VIEW_OPTIONS.find((v) => v.id === viewMode)?.label ?? "Months";

  const colMinPx = viewMode === "day" ? 120 : viewMode === "week" ? 150 : 105;
  const gridTemplate = `repeat(${scheduleModel.columnCount}, minmax(${colMinPx}px, 1fr))`;
  const timelineMinWidthPx = scheduleModel.columnCount * colMinPx;

  // Inject timeline columns and maintain perfect scroll locks
  useLayoutEffect(() => {
    if (!scheduleViewportRef.current || scheduleModel.columnCount === 0) return;
    const el = scheduleViewportRef.current;

    // 1. Initial/Anchor jump: if the anchor date completely changed (e.g. clicked < > Next/Prev)
    if (scheduleModel.anchorDateKey !== lastAnchorKey.current) {
      const slotIdx = scheduleModel.slots.findIndex(s => s.dateKey >= scheduleModel.anchorDateKey);
      if (slotIdx >= 0) {
        el.scrollLeft = slotIdx * colMinPx;
      }
      lastAnchorKey.current = scheduleModel.anchorDateKey;
    }
    // 2. Endless scroll jump: if we just dynamically added months to the PAST (left)
    else if (prevColCount.current > 0 && scheduleModel.columnCount > prevColCount.current) {
      if (timelineOffsets.prev > prevOffsets.current.prev) {
        const addedCols = scheduleModel.columnCount - prevColCount.current;
        el.scrollLeft += addedCols * colMinPx;
      }
    }

    prevColCount.current = scheduleModel.columnCount;
    prevOffsets.current = timelineOffsets;
  }, [scheduleModel, timelineOffsets, colMinPx]);

  const handleTimelineScroll = useCallback((e) => {
    const el = e.target;
    const thresholdBase = 250;

    // Left endless load
    if (el.scrollLeft < thresholdBase) {
      setTimelineOffsets((o) => (o.prev < 36 ? { ...o, prev: o.prev + 1 } : o));
    }

    // Right endless load
    if (el.scrollLeft + el.clientWidth > el.scrollWidth - thresholdBase) {
      setTimelineOffsets((o) => (o.next < 36 ? { ...o, next: o.next + 1 } : o));
    }
  }, []);

  return (
    <div
      className="lp-root"
      data-theme={theme === "light" ? "light" : "dark"}
      data-density={density}
      data-view={viewMode}
    >
      <AppSideNav theme={theme} onToggleTheme={toggleTheme} />

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
              <div className="lp-date-pill-group">
                <motion.button
                  type="button"
                  className="lp-pill-arrow"
                  aria-label="Previous period"
                  onClick={navigatePrev}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ChevronLeft size={16} />
                </motion.button>
                <div className="lp-pill-divider" />
                <motion.button
                  type="button"
                  className="lp-pill-today"
                  onClick={goToday}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                >
                  Today
                </motion.button>
                <div className="lp-pill-divider" />
                <motion.button
                  type="button"
                  className="lp-pill-arrow"
                  aria-label="Next period"
                  onClick={navigateNext}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ChevronRight size={16} />
                </motion.button>
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
                          setTimelineOffsets({ prev: 1, next: 2 });
                          lastAnchorKey.current = null;
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

              <div className="lp-dropdown-wrap" ref={addWrapRef}>
                <button
                  type="button"
                  className="lp-btn-primary"
                  aria-label="Add new"
                  aria-expanded={addMenuOpen}
                  onClick={() => {
                    setAddMenuOpen((o) => !o);
                    setViewMenuOpen(false);
                    setDensityOpen(false);
                  }}
                  style={{
                    transform: addMenuOpen ? "rotate(45deg)" : "none",
                    transition: "transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)",
                  }}
                >
                  <Plus size={18} strokeWidth={2.5} />
                </button>
                {addMenuOpen && (
                  <div className="lp-popover lp-popover-add" style={{ right: 0, minWidth: "200px", zIndex: 100 }}>
                    <div className="lp-popover-title">Create New</div>
                    <button
                      type="button"
                      className="lp-popover-item"
                      onClick={() => {
                        setAddMenuOpen(false);
                        openAdd();
                      }}
                    >
                      <UserPlus size={16} strokeWidth={1.8} className="lp-popover-icon" />
                      Person
                    </button>
                    <button
                      type="button"
                      className="lp-popover-item"
                      onClick={() => {
                        setAddMenuOpen(false);
                        setProjectCreateOpen(true);
                      }}
                    >
                      <FolderPlus size={16} strokeWidth={1.8} className="lp-popover-icon" />
                      Project
                    </button>
                    <div className="lp-popover-divider" style={{ margin: "6px 0", height: "1px", background: "var(--border)" }} />
                    <button
                      type="button"
                      className="lp-popover-item"
                      onClick={() => {
                        setAddMenuOpen(false);
                        openCreateAllocation(null);
                      }}
                    >
                      <CalendarPlus size={16} strokeWidth={1.8} className="lp-popover-icon" />
                      Allocation
                    </button>
                  </div>
                )}
              </div>
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
            ref={scheduleViewportRef}
            onScroll={handleTimelineScroll}
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
                      {scheduleModel.slots.map((slot, i) => {
                        const isToday = slot.dateKey === todayDateKey;
                        return (
                          <div
                            key={`slot-${i}-${slot.main}`}
                            className={
                              "lp-day-cell" +
                              (isToday ? " lp-day-is-today" : "") +
                              (viewMode !== "day" && slot.weekParity ? " lp-day-week-b" : "") +
                              (viewMode !== "day" && !slot.weekParity ? " lp-day-week-a" : "") +
                              (viewMode !== "day" && slot.weekBlockStart ? " lp-day-week-start" : "") +
                              (viewMode !== "day" && slot.weekBlockEnd ? " lp-day-week-end" : "")
                            }
                          >
                            <span className="lp-day-main">
                              {isToday && <span className="lp-today-grid-dot" />}
                              {slot.main}
                            </span>
                            {slot.sub ? <span className="lp-day-sub">{slot.sub}</span> : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {schedulePeople.map((p, i) => (
                <TimelineRow
                  key={p.id}
                  p={p}
                  i={i}
                  allocations={allocations}
                  projects={projects}
                  scheduleModel={scheduleModel}
                  viewMode={viewMode}
                  utilizationMode={utilizationMode}
                  gridTemplate={gridTemplate}
                  nCols={scheduleModel.columnCount}
                  openEdit={openEdit}
                  openCreateAllocation={openCreateAllocation}
                  openAllocationDetail={openAllocationDetail}
                  handleTimelineClick={handleTimelineClick}
                />
              ))}
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
        tagOpts={peopleTagOpts}
        setTagOpts={setPeopleTagOpts}
        t={t}
      />

      <CreateAllocationModal
        open={allocCreateOpen}
        onClose={closeCreateAllocation}
        onCreate={handleCreateAllocation}
        onCreateLeave={handleCreateAllocation}
        people={schedulePeople}
        preselectPerson={allocPreselectPerson}
        preselectDate={allocPreselectDate}
        editAllocation={allocEditing}
        onEditAllocation={handleEditAllocation}
        projects={allocationProjectOptions}
        projectRegistry={projects}
        onAddProject={addAllocationProjectLabel}
        t={t}
      />

      <AllocationDetailModal
        open={allocDetailOpen}
        allocation={selectedAllocation}
        assigneeNames={selectedAssigneeNames}
        onClose={closeAllocationDetail}
        onDelete={handleDeleteAllocation}
        onEditClick={selectedAllocation ? () => {
          setAllocEditing(selectedAllocation);
          setAllocDetailOpen(false);
          setAllocCreateOpen(true);
        } : undefined}
        t={t}
      />

      <ProjectModal
        open={projectCreateOpen}
        onClose={() => setProjectCreateOpen(false)}
        onSave={(form) => {
          const clean = { ...form };
          delete clean._colorOpen;
          const id = getNextProjectId();
          const created = { ...clean, id, archived: false };
          setProjects([...projects, created].sort((a, b) => a.name.localeCompare(b.name)));
          syncProjectCreate(created);
          toast.success(`Project "${form.name}" created!`);
          setProjectCreateOpen(false);
        }}
        people={people}
        clients={clients}
        setClients={setClients}
        tagOpts={projectTagOpts}
        setTagOpts={setProjectTagOpts}
        getNextProjectId={getNextProjectId}
        t={t}
      />


    </div>
  );
}
