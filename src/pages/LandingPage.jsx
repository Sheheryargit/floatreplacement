import { useMemo, useState, useRef, useEffect, useCallback, memo, useLayoutEffect } from "react";
import {
  ChevronDown,
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
  Star,
  Tag,
  X,
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
import { tagChromaProps } from "../utils/tagChroma.js";
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
/** Day grid: min span in column units (~24min) so 1h blocks stay visible. */
const MIN_DAY_SPAN_COLUMNS = 0.2;
/** Standard workday for width scaling in week/month view. */
const STANDARD_DAY_HOURS = 7.5;
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
    const hpd = Math.max(0, Number(alloc.hoursPerDay) || 0);
    let spanCols = hpd <= 0 ? MIN_DAY_SPAN_COLUMNS : hpd / DAY_COLUMN_HOURS;
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

/** Date keys used for hour totals: anchor day only in day view; all visible columns in week/month. */
function visibleDateKeysForHours(scheduleModel, viewMode, anchorDate) {
  if (viewMode === "day") {
    return [dateKeyLocal(anchorDate)];
  }
  const seen = new Set();
  const ordered = [];
  for (const s of scheduleModel.slots) {
    if (!seen.has(s.dateKey)) {
      seen.add(s.dateKey);
      ordered.push(s.dateKey);
    }
  }
  return ordered;
}

function sumWorkHoursPersonOnDay(personId, allocations, dateKey) {
  let sum = 0;
  for (const a of allocations) {
    if (a.isLeave) continue;
    if (!allocationHasPerson(a, personId)) continue;
    if (dateKey >= a.startDate && dateKey <= a.endDate) {
      sum += parseFloat(a.hoursPerDay) || 0;
    }
  }
  return sum;
}

function computePersonHoursInView(personId, allocations, scheduleModel, viewMode, anchorDate) {
  const keys = visibleDateKeysForHours(scheduleModel, viewMode, anchorDate);
  let t = 0;
  for (const dk of keys) {
    t += sumWorkHoursPersonOnDay(personId, allocations, dk);
  }
  return t;
}

function personHasOverloadInView(personId, allocations, scheduleModel, viewMode, anchorDate) {
  const keys = visibleDateKeysForHours(scheduleModel, viewMode, anchorDate);
  for (const dk of keys) {
    if (sumWorkHoursPersonOnDay(personId, allocations, dk) > STANDARD_DAY_HOURS + 1e-6) return true;
  }
  return false;
}

/** Bar thickness: strong contrast between light (e.g. 1h) and heavy (7.5h+) bookings. */
const BAR_H_MIN = 26;
const BAR_H_MAX = 136;
const BAR_H_NORM = 7.5;

function allocationBarHeightPx(alloc) {
  if (alloc?.isLeave) return 54;
  const h = Math.max(0, parseFloat(alloc.hoursPerDay) || 0);
  if (h <= 0) return BAR_H_MIN + 6;
  const t = Math.min(h, 12) / BAR_H_NORM;
  const curved = Math.pow(Math.min(t, 1.45), 0.52);
  return Math.round(BAR_H_MIN + curved * (BAR_H_MAX - BAR_H_MIN));
}

const timelineRowEqual = (prev, next) => {
  if (prev.p !== next.p) return false;
  if (prev.viewMode !== next.viewMode) return false;
  if (prev.anchorDate?.getTime?.() !== next.anchorDate?.getTime?.()) return false;
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

function hexToRgba(hex, alpha) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return `rgba(108, 140, 255, ${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}

function hexToRgbTriplet(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return { r: 108, g: 140, b: 255 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Linear mix toward `target` (0–255 per channel). `amount` 0–1. */
function mixRgbHex(hex, target, amount) {
  const { r, g, b } = hexToRgbTriplet(hex);
  const t = Math.max(0, Math.min(1, amount));
  const R = r + (target - r) * t;
  const G = g + (target - g) * t;
  const B = b + (target - b) * t;
  return `#${clampByte(R).toString(16).padStart(2, "0")}${clampByte(G).toString(16).padStart(2, "0")}${clampByte(B).toString(16).padStart(2, "0")}`;
}

/** Gradient fill + rim light + depth-appropriate shadow for schedule blocks. */
function allocationBarSurfaceStyles(barColor, hours, theme) {
  const light = theme === "light";
  const hi = mixRgbHex(barColor, 255, light ? 0.42 : 0.28);
  const lo = mixRgbHex(barColor, 0, light ? 0.18 : 0.32);
  const rim = mixRgbHex(barColor, 255, light ? 0.55 : 0.22);
  const background = `linear-gradient(168deg, ${hi} 0%, ${barColor} 38%, ${lo} 100%)`;
  const hnorm = Math.min(1, Math.max(0, hours) / BAR_H_NORM);
  const sheen = light
    ? "inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(0,0,0,0.06)"
    : "inset 0 1px 0 rgba(255,255,255,0.24), inset 0 -1px 0 rgba(0,0,0,0.38)";
  const edge = light ? "rgba(15,22,40,0.1)" : "rgba(0,0,0,0.42)";
  const glow = `0 0 0 1px ${edge}, 0 4px ${14 + hnorm * 16}px ${hexToRgba(barColor, light ? 0.2 + hnorm * 0.12 : 0.32 + hnorm * 0.12)}, 0 ${18 + hnorm * 14}px ${40 + hnorm * 28}px ${hexToRgba(barColor, light ? 0.09 + hnorm * 0.07 : 0.16)}`;
  return {
    background,
    boxShadow: `${sheen}, ${glow}`,
    border: `1px solid ${hexToRgba(rim, light ? 0.45 : 0.38)}`,
  };
}

const TimelineRow = memo(function TimelineRow({
  p,
  i,
  allocations,
  projects,
  scheduleModel,
  viewMode,
  anchorDate,
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
  const hours = computePersonHoursInView(p.id, allocations, scheduleModel, viewMode, anchorDate);
  const visibleDays = Math.max(1, visibleDateKeysForHours(scheduleModel, viewMode, anchorDate).length);
  const cap = visibleDays * STANDARD_DAY_HOURS;
  const pct = Math.min(100, Math.round((hours / cap) * 100));
  const right =
    utilizationMode === "hours" ? `${hours.toFixed(hours % 1 ? 1 : 0)}h` : `${pct}%`;
  const overloaded = personHasOverloadInView(p.id, allocations, scheduleModel, viewMode, anchorDate);

  const rowSegments = allocations
    .filter((a) => allocationHasPerson(a, p.id))
    .flatMap((a) =>
      layoutsForAllocation(a, scheduleModel, viewMode).map((lay) => ({
        a,
        lay,
        occIdx: lay.occ,
        segKey: `${a.id}-o${lay.occ}-s${lay.start}-sp${lay.span}`,
        start: lay.start,
        span: lay.span,
      }))
    );

  const workSegments = rowSegments.filter((s) => !s.a.isLeave);
  const leaveSegments = rowSegments.filter((s) => s.a.isLeave);

  assignAllocationStackLevels(workSegments);
  const allocLaneCount = workSegments.length ? Math.max(...workSegments.map((s) => s.stack)) + 1 : 1;

  const LANE_STACK_GAP = 10;
  const BAR_VPAD = 10;
  const ROW_ALLOC_PAD = 24;
  let stackHeightsSum = 0;
  for (let k = 0; k < allocLaneCount; k++) {
    const segs = workSegments.filter((s) => s.stack === k);
    if (segs.length === 0) continue;
    const mh = Math.max(...segs.map((s) => allocationBarHeightPx(s.a))) + BAR_VPAD;
    stackHeightsSum += mh;
    if (k < allocLaneCount - 1) stackHeightsSum += LANE_STACK_GAP;
  }
  const schedAllocContentH = ROW_ALLOC_PAD + stackHeightsSum;


  return (
    <div
      key={p.id}
      className={"lp-sched-row" + (overloaded ? " lp-sched-row-overloaded" : "")}
      style={{ ["--animation-order"]: i }}
    >
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
                    {p.tags.slice(0, 2).map((tag) => {
                      const tp = tagChromaProps(tag, theme === "dark", "lp-schedule-tag");
                      return (
                        <span key={tag} className={tp.className} style={tp.style}>
                          {tag}
                        </span>
                      );
                    })}
                    {p.tags.length > 2 && <span className="lp-tag-more-pill">+{p.tags.length - 2}</span>}
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
            <span className={"lp-person-hours" + (overloaded ? " lp-person-hours-overloaded" : "")}>
              {right}
            </span>
            {overloaded && (
              <span className="lp-overload-dot" title="Over 7.5h booked on at least one day in view" aria-hidden />
            )}
          </button>
        </div>
      </div>
      <div className="lp-sched-timeline">
        <div
          className="lp-grid-stack"
          style={{
            cursor: "pointer",
            ["--lp-alloc-lane-count"]: allocLaneCount,
            ["--lp-sched-alloc-content-h"]: `${schedAllocContentH}px`,
          }}
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

                const laneMinH =
                  Math.max(...laneSegs.map((s) => allocationBarHeightPx(s.a))) + BAR_VPAD;

                return (
                  <div
                    key={stackIdx}
                    className="lp-alloc-lane"
                    style={{
                      position: "relative",
                      width: "100%",
                      minHeight: `${laneMinH}px`,
                    }}
                  >
                    {laneSegs.map((seg) => {
                      const colStartFrac = seg.lay.start / nCols;
                      const colWidthFrac = seg.lay.span / nCols;
                      const leftPct = colStartFrac * 100;
                      const widthPct = colWidthFrac * 100;
                      const z = 20 + seg.stack * 20 + seg.occIdx + Math.floor(seg.lay.start);

                      const h = Math.max(0, parseFloat(seg.a.hoursPerDay) || 0);
                      const calculatedHeight = allocationBarHeightPx(seg.a);

                      const { projectName, projectCode, hoursLabel } = allocationDisplay(seg.a);
                      const barColor = colorForAllocationBar(seg.a, projects);
                      const fg = contrastingTextColor(barColor);
                      const surface = allocationBarSurfaceStyles(barColor, h, theme);

                      const baseStyle = {
                        position: "absolute",
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        top: 0,
                        zIndex: z,
                        minHeight: `${calculatedHeight}px`,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        pointerEvents: "auto",
                        boxSizing: "border-box",
                        ...surface,
                        transition:
                          "min-height 0.35s cubic-bezier(0.22, 1, 0.36, 1), left 0.35s cubic-bezier(0.22, 1, 0.36, 1), width 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease, transform 0.2s ease, filter 0.2s ease",
                      };

                      return (
                        <button
                          key={seg.segKey}
                          type="button"
                          className="lp-block lp-block-alloc lp-block-alloc-project"
                          style={{ ...baseStyle, color: fg }}
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
    starredPeopleTags,
    schedulePeopleTagFilter,
    setStarredPeopleTags,
    setSchedulePeopleTagFilter,
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
  const [allocPreselectProject, setAllocPreselectProject] = useState(null);
  const [allocDetailOpen, setAllocDetailOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState(null);

  const viewWrapRef = useRef(null);
  const densityWrapRef = useRef(null);
  const addWrapRef = useRef(null);
  const tagFilterWrapRef = useRef(null);
  const starredWrapRef = useRef(null);

  const [tagFilterOpen, setTagFilterOpen] = useState(false);
  const [starredPopoverOpen, setStarredPopoverOpen] = useState(false);

  useEffect(() => {
    function onDoc(e) {
      if (viewWrapRef.current && !viewWrapRef.current.contains(e.target)) setViewMenuOpen(false);
      if (densityWrapRef.current && !densityWrapRef.current.contains(e.target)) setDensityOpen(false);
      if (addWrapRef.current && !addWrapRef.current.contains(e.target)) setAddMenuOpen(false);
      if (tagFilterWrapRef.current && !tagFilterWrapRef.current.contains(e.target)) setTagFilterOpen(false);
      if (starredWrapRef.current && !starredWrapRef.current.contains(e.target)) setStarredPopoverOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const scheduleModel = useMemo(
    () => buildScheduleModel(viewMode, anchorDate, timelineOffsets),
    [viewMode, anchorDate, timelineOffsets]
  );

  const todayDateKey = useMemo(() => dateKeyLocal(new Date()), []);

  const allScheduleTags = useMemo(() => {
    const s = new Set(peopleTagOpts);
    for (const p of people) {
      for (const t of p.tags || []) s.add(t);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [people, peopleTagOpts]);

  const schedulePeople = useMemo(() => {
    let list = people.filter((p) => !p.archived);
    if (schedulePeopleTagFilter.length > 0) {
      const need = new Set(schedulePeopleTagFilter);
      list = list.filter((p) => (p.tags || []).some((t) => need.has(t)));
    }
    return list;
  }, [people, schedulePeopleTagFilter]);

  const toggleScheduleFilterTag = useCallback((tag) => {
    setSchedulePeopleTagFilter((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].sort((a, b) => a.localeCompare(b))
    );
  }, [setSchedulePeopleTagFilter]);

  const clearScheduleFilter = useCallback(() => {
    setSchedulePeopleTagFilter([]);
  }, [setSchedulePeopleTagFilter]);

  const applyStarredToScheduleFilter = useCallback(() => {
    setSchedulePeopleTagFilter([...starredPeopleTags].sort((a, b) => a.localeCompare(b)));
    setTagFilterOpen(false);
  }, [starredPeopleTags, setSchedulePeopleTagFilter]);

  const toggleStarredPeopleTag = useCallback(
    (tag) => {
      setStarredPeopleTags((prev) =>
        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].sort((a, b) => a.localeCompare(b))
      );
    },
    [setStarredPeopleTags]
  );

  const visibleCapacityDays = useMemo(
    () => Math.max(1, visibleDateKeysForHours(scheduleModel, viewMode, anchorDate).length),
    [scheduleModel, viewMode, anchorDate]
  );

  const totalHours = useMemo(() => {
    let s = 0;
    for (const p of schedulePeople) {
      s += computePersonHoursInView(p.id, allocations, scheduleModel, viewMode, anchorDate);
    }
    return s;
  }, [schedulePeople, allocations, scheduleModel, viewMode, anchorDate]);

  const teamCapacityHours = useMemo(
    () => Math.max(STANDARD_DAY_HOURS, schedulePeople.length * visibleCapacityDays * STANDARD_DAY_HOURS),
    [schedulePeople.length, visibleCapacityDays]
  );

  const teamUtilPercent = useMemo(
    () => (teamCapacityHours > 0 ? Math.min(100, Math.round((totalHours / teamCapacityHours) * 100)) : 0),
    [totalHours, teamCapacityHours]
  );

  const scheduleMotionKey = useMemo(() => {
    if (viewMode === "month") return `m-${anchorDate.getFullYear()}-${anchorDate.getMonth()}`;
    if (viewMode === "week") return `w-${weekMondayKey(anchorDate)}`;
    return `d-${dateKeyLocal(anchorDate)}`;
  }, [viewMode, anchorDate]);

  const prevViewModeRef = useRef(viewMode);
  useEffect(() => {
    if (prevViewModeRef.current !== viewMode) {
      const label = VIEW_OPTIONS.find((v) => v.id === viewMode)?.label ?? viewMode;
      toast.success(`${label} view`, {
        description: "Hours now match the visible timeline.",
        duration: 2200,
        className: "float-schedule-view-toast",
      });
    }
    prevViewModeRef.current = viewMode;
  }, [viewMode]);

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
    setAllocPreselectProject(null);
    setAllocCreateOpen(true);
  }, []);

  const openCreateAllocationForPersonProject = useCallback((person, projectLabel) => {
    setAllocEditing(null);
    setAllocPreselectPerson(person ?? null);
    setAllocPreselectDate(null);
    setAllocPreselectProject(projectLabel != null ? String(projectLabel).trim() || null : null);
    setAllocCreateOpen(true);
  }, []);

  const closeCreateAllocation = useCallback(() => {
    setAllocCreateOpen(false);
    setAllocEditing(null);
    setAllocPreselectPerson(null);
    setAllocPreselectDate(null);
    setAllocPreselectProject(null);
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
      toast.success(payload.isLeave ? "Leave saved" : "Allocation saved", {
        description: payload.isLeave
          ? `${payload.startDate} → ${payload.endDate}`
          : `${shortenAllocLabel(payload.project, 42)} · ${Number(payload.hoursPerDay) || 0}h/day`,
        duration: 2800,
        className: "float-schedule-view-toast",
      });
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
      toast.success(payload.isLeave ? "Leave updated" : "Allocation updated", {
        description: payload.isLeave
          ? `${payload.startDate} → ${payload.endDate}`
          : `${shortenAllocLabel(payload.project, 42)} · ${Number(payload.hoursPerDay) || 0}h/day`,
        duration: 2600,
        className: "float-schedule-view-toast",
      });
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
            <div className="lp-schedule-title-cluster">
              <div className="lp-schedule-tag-dd-group">
                <div className="lp-dropdown-wrap" ref={tagFilterWrapRef}>
                  <button
                    type="button"
                    className={
                      "lp-pill lp-pill-btn lp-tag-dd-trigger" +
                      (schedulePeopleTagFilter.length > 0 ? " lp-tag-dd-trigger-active" : "")
                    }
                    aria-expanded={tagFilterOpen}
                    aria-haspopup="listbox"
                    aria-label="Filter people by tags"
                    onClick={() => {
                      setTagFilterOpen((o) => !o);
                      setStarredPopoverOpen(false);
                      setViewMenuOpen(false);
                      setDensityOpen(false);
                      setAddMenuOpen(false);
                    }}
                  >
                    <Tag size={14} strokeWidth={2} />
                    {schedulePeopleTagFilter.length === 0
                      ? "All tags"
                      : `${schedulePeopleTagFilter.length} tag${schedulePeopleTagFilter.length === 1 ? "" : "s"}`}
                    <ChevronDown size={14} />
                  </button>
                  {tagFilterOpen && (
                    <div className="lp-popover lp-popover-tags" role="listbox">
                      <div className="lp-popover-title">Filter by tags</div>
                      <p className="lp-tag-dd-hint">
                        Check tags to filter the schedule. Use ★ to save a tag — it then appears under Starred tags.
                      </p>
                      <div className="lp-tag-check-scroll">
                        {allScheduleTags.length === 0 ? (
                          <p className="lp-tag-dd-empty">No tags yet — add tags to people in the directory.</p>
                        ) : (
                          allScheduleTags.map((tag) => {
                            const isStarred = starredPeopleTags.includes(tag);
                            return (
                              <div key={tag} className="lp-tag-filter-row">
                                <label className="lp-tag-filter-check">
                                  <input
                                    type="checkbox"
                                    checked={schedulePeopleTagFilter.includes(tag)}
                                    onChange={() => toggleScheduleFilterTag(tag)}
                                  />
                                  <span className="lp-tag-filter-name">{tag}</span>
                                </label>
                                <button
                                  type="button"
                                  className={"lp-tag-row-star" + (isStarred ? " lp-tag-row-star-on" : "")}
                                  aria-label={isStarred ? `Remove ${tag} from starred` : `Star ${tag}`}
                                  title={isStarred ? "Remove from starred" : "Add to starred"}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    toggleStarredPeopleTag(tag);
                                  }}
                                >
                                  <Star size={16} strokeWidth={2} fill={isStarred ? "currentColor" : "none"} />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="lp-popover-divider lp-tag-dd-actions-divider" />
                      <div className="lp-tag-dd-actions">
                        <button type="button" className="lp-tag-dd-link" onClick={clearScheduleFilter}>
                          <X size={14} /> Clear filter
                        </button>
                        <button
                          type="button"
                          className="lp-tag-dd-link lp-tag-dd-link-accent"
                          disabled={starredPeopleTags.length === 0}
                          onClick={applyStarredToScheduleFilter}
                        >
                          <Star size={14} /> Use starred tags
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="lp-dropdown-wrap" ref={starredWrapRef}>
                  <button
                    type="button"
                    className={
                      "lp-pill lp-pill-btn lp-tag-dd-trigger" +
                      (starredPeopleTags.length > 0 ? " lp-tag-dd-trigger-star" : "")
                    }
                    aria-expanded={starredPopoverOpen}
                    aria-haspopup="listbox"
                    aria-label="Star tags for quick filtering"
                    onClick={() => {
                      setStarredPopoverOpen((o) => !o);
                      setTagFilterOpen(false);
                      setViewMenuOpen(false);
                      setDensityOpen(false);
                      setAddMenuOpen(false);
                    }}
                  >
                    <Star
                      size={14}
                      strokeWidth={2}
                      className={starredPeopleTags.length > 0 ? "lp-star-filled" : ""}
                      fill={starredPeopleTags.length > 0 ? "currentColor" : "none"}
                    />
                    Starred tags
                    {starredPeopleTags.length > 0 ? ` (${starredPeopleTags.length})` : ""}
                    <ChevronDown size={14} />
                  </button>
                  {starredPopoverOpen && (
                    <div className="lp-popover lp-popover-tags" role="listbox">
                      <div className="lp-popover-title">Starred tags</div>
                      <p className="lp-tag-dd-hint">
                        Tags you ★ in the filter appear here. Click a row to remove from starred.
                      </p>
                      <div className="lp-tag-check-scroll">
                        {starredPeopleTags.length === 0 ? (
                          <p className="lp-tag-dd-empty">No starred tags yet. Open the filter and click ★ on any tag.</p>
                        ) : (
                          [...starredPeopleTags].sort((a, b) => a.localeCompare(b)).map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              className="lp-star-tag-row lp-star-tag-row-on"
                              onClick={() => toggleStarredPeopleTag(tag)}
                            >
                              <Star size={16} className="lp-star-tag-icon" fill="currentColor" strokeWidth={2} />
                              <span className="lp-star-tag-label">{tag}</span>
                              <span className="lp-star-tag-remove-hint">Remove</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="lp-title-chevron">
                <h1 className="lp-page-title">Schedule</h1>
                <ChevronDown size={18} color={muted} aria-hidden />
              </div>
            </div>
          </div>

          <div className="lp-toolbar">
            <div className="lp-toolbar-left" />
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
              <span className="lp-hours-total" title={`${visibleCapacityDays} working day(s) in view · ${schedulePeople.length} people`}>
                {utilizationMode === "hours"
                  ? formatHourTotal(totalHours)
                  : `${teamUtilPercent}%`}
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
            <motion.div
              key={scheduleMotionKey}
              className="lp-schedule-canvas lp-timeline-enter"
              initial={{ opacity: 0.88, scale: 0.993, filter: "brightness(0.94)" }}
              animate={{ opacity: 1, scale: 1, filter: "brightness(1)" }}
              transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.88 }}
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
                  anchorDate={anchorDate}
                  utilizationMode={utilizationMode}
                  gridTemplate={gridTemplate}
                  nCols={scheduleModel.columnCount}
                  openEdit={openEdit}
                  openCreateAllocation={openCreateAllocation}
                  openAllocationDetail={openAllocationDetail}
                  handleTimelineClick={handleTimelineClick}
                />
              ))}
            </motion.div>
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
        projects={projects}
        allocations={allocations}
        setAllocations={setAllocations}
        syncAllocationDelete={syncAllocationDelete}
        syncAllocationUpdate={syncAllocationUpdate}
        onOpenCreateAllocation={({ person, projectLabel }) =>
          openCreateAllocationForPersonProject(person, projectLabel)
        }
        tagTheme={theme}
      />

      <CreateAllocationModal
        open={allocCreateOpen}
        onClose={closeCreateAllocation}
        onCreate={handleCreateAllocation}
        onCreateLeave={handleCreateAllocation}
        people={schedulePeople}
        preselectPerson={allocPreselectPerson}
        preselectDate={allocPreselectDate}
        preselectProject={allocPreselectProject}
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
        tagIsDark={theme === "dark"}
      />


    </div>
  );
}
