import {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
  memo,
  useLayoutEffect,
} from "react";
import { useVirtualizer, measureElement as virtualMeasureElement } from "@tanstack/react-virtual";
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
  X,
  ArrowDownUp,
  Repeat2,
  StickyNote,
  Filter,
  Palmtree,
  HeartPulse,
  User,
  Baby,
  Flower2,
  Wallet,
  Landmark,
  Umbrella,
} from "lucide-react";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useSchedulePageData } from "../hooks/useSchedulePageData.js";
import { ProjectModal } from "./ProjectsPage.jsx";
import PersonModal, {
  T,
  formToPerson,
  ini,
  avGrad,
} from "../components/PersonModal.jsx";
import { toast } from "sonner";
import { syncPersonAvailabilityFromForm } from "../lib/api/personAvailability.js";
import { previewAvailabilityHours } from "../utils/availabilityPreview.js";
import {
  CreateAllocationModal,
  AllocationDetailModal,
  leaveLabel,
} from "../components/AllocationModals.jsx";
import { advanceRepeatWindow } from "../utils/allocationRepeatWindow.js";
import { ScheduleAllocationFilterMenu } from "../components/ScheduleAllocationFilterMenu.jsx";
import AppSideNav from "../components/navigation/AppSideNav.jsx";
import {
  colorForAllocationBar,
  contrastingTextColor,
  projectCodeChipStyles,
  resolveColorForProjectLabel,
  projectToAllocationLabel,
} from "../utils/projectColors.js";
import { tagChromaProps } from "../utils/tagChroma.js";
import {
  SCHEDULE_SORT_OPTIONS,
  comparePeopleForScheduleSort,
} from "../utils/peopleSort.js";
import {
  personMatchesScheduleFilter,
  countActiveFilterRules,
} from "../utils/scheduleAllocationFilter.js";
import {
  findLeaveOverlapWithWorkRange,
  maxWorkHoursOnDayForPersonList,
} from "../utils/allocationLeaveConflict.js";
import { workAllocationCoversDateKey } from "../utils/allocationOccurrence.js";
import { buildAllocationsByPerson, getPersonAllocations } from "../utils/allocationsByPerson.js";
import { isSupabaseConfigured } from "../lib/supabase.js";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  normalizeLeaveTypeId,
  leaveTimelineIconKey,
  leaveSpansToday,
  buildLeaveHoverTitle,
} from "../utils/leaveVisuals.js";
import "./LandingPage.css";

const LEAVE_LUCIDE = {
  palmtree: Palmtree,
  heartpulse: HeartPulse,
  user: User,
  baby: Baby,
  flower2: Flower2,
  wallet: Wallet,
  landmark: Landmark,
  umbrella: Umbrella,
};

function LeaveTimelineGlyph({ leaveTypeId, className }) {
  const key = leaveTimelineIconKey(leaveTypeId);
  const Ic = LEAVE_LUCIDE[key] || Palmtree;
  return <Ic className={className} size={15} strokeWidth={2.25} aria-hidden />;
}

const VIEW_OPTIONS = [
  { id: "day", label: "Days" },
  { id: "week", label: "Weeks" },
  { id: "month", label: "Months" },
];

const TIME_RANGE_PRESETS = [
  { id: "this_week", label: "This week" },
  { id: "next_week", label: "Next week" },
  { id: "last_week", label: "Last week" },
  { id: "this_month", label: "This month" },
  { id: "next_month", label: "Next month" },
  { id: "last_month", label: "Last month" },
  { id: "custom", label: "Custom" },
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

/** Move by whole calendar months; anchor stays on the 1st so Jan 31 → +1 → Feb 1 (not March). */
function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Days in month; `month` is 1–12 (January = 1). */
function daysInMonth(y, month) {
  return new Date(y, month, 0).getDate();
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

/** ISO date key for the Monday of the week containing `dt` (must match `dateKeyLocal` padding for comparisons). */
function weekMondayKey(dt) {
  return dateKeyLocal(startOfWeekMonday(dt));
}

function formatDayMonth(dt) {
  return dt.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function formatDayMonthYear(dt) {
  return dt.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

/** All Mon–Fri dates inside calendar month (y, month) with month 1–12. */
function weekdaysInMonth(y, month) {
  const dim = daysInMonth(y, month);
  const out = [];
  for (let day = 1; day <= dim; day++) {
    const dt = new Date(y, month - 1, day);
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
  const mo = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
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

/**
 * Split a week/month layout that spans multiple ISO weeks into one segment per week.
 * Each segment shows the same allocation (project, hours, etc.) — e.g. Wed–Fri then Mon–Fri
 * appear as two bars instead of one continuous bar across the Fri↔Mon week boundary.
 */
function splitLayoutByWorkWeek(lay, scheduleModel) {
  const keys = scheduleModel.slots.map((s) => s.dateKey);
  const i0 = lay.start;
  const i1 = lay.start + lay.span - 1;
  if (i0 < 0 || i1 >= keys.length || i1 < i0) return [lay];
  const segments = [];
  let segStart = i0;
  let curMonday = weekMondayKey(dateFromKey(keys[i0]));
  for (let idx = i0 + 1; idx <= i1; idx++) {
    const km = weekMondayKey(dateFromKey(keys[idx]));
    if (km !== curMonday) {
      const segSpan = Math.max(MIN_WEEK_MONTH_SPAN_COLS, idx - segStart);
      segments.push({ start: segStart, span: segSpan });
      segStart = idx;
      curMonday = km;
    }
  }
  segments.push({
    start: segStart,
    span: Math.max(MIN_WEEK_MONTH_SPAN_COLS, i1 - segStart + 1),
  });
  return segments.length > 0 ? segments : [lay];
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
    if (lay) {
      if (viewMode === "day") {
        out.push({ ...lay, occ: i, weekPart: 0 });
      } else {
        const splits = splitLayoutByWorkWeek(lay, scheduleModel);
        const weekSplitCount = splits.length;
        splits.forEach((sli, partIdx) => {
          out.push({ ...sli, occ: i, weekPart: partIdx, weekSplitCount });
        });
      }
    }
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
  const raw = (alloc.project || "").trim();
  if (!raw) {
    return { projectName: "", projectCode: "", hoursLabel: `${Number(alloc.hoursPerDay) || 0}h` };
  }
  const parts = raw.split("/").map((x) => x.trim()).filter(Boolean);
  const name = parts.length > 1 ? parts.slice(1).join(" / ") : parts[0] || raw;
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
      dates.push(
        ...weekdaysInMonth(targetMonth.getFullYear(), targetMonth.getMonth() + 1)
      );
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

function dateFromKey(key) {
  const parts = String(key).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return new Date();
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
}

/** Weekday columns between two ISO date keys (inclusive). */
function buildScheduleModelCustomRange(startKey, endKey) {
  const dates = [];
  const x = dateFromKey(startKey);
  const end = dateFromKey(endKey);
  if (x > end) return buildScheduleModelCustomRange(endKey, startKey);
  const cur = new Date(x);
  while (cur <= end) {
    if (!isWeekendDate(cur)) dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  if (dates.length === 0) {
    const dk = dateKeyLocal(new Date());
    return {
      columnCount: 1,
      bandTitle: "—",
      bandSpans: [{ span: 1, label: "—", weekParity: 0 }],
      slots: [
        {
          main: "—",
          sub: "",
          weekParity: 0,
          weekBlockStart: true,
          weekBlockEnd: true,
          dateKey: dk,
        },
      ],
      anchorDateKey: dk,
      aggregateAllSlots: true,
    };
  }
  let weekStripe = -1;
  let prevMondayKey = null;
  const slots = dates.map((dt, idx) => {
    const mk = weekMondayKey(dt);
    if (mk !== prevMondayKey) {
      weekStripe++;
      prevMondayKey = mk;
    }
    const prevK = idx > 0 ? weekMondayKey(dates[idx - 1]) : null;
    const nextK = idx < dates.length - 1 ? weekMondayKey(dates[idx + 1]) : null;
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
    bandTitle: `${formatDayMonth(dates[0])} – ${formatDayMonthYear(dates[dates.length - 1])}`,
    bandSpans,
    slots,
    anchorDateKey: dateKeyLocal(dates[0]),
    aggregateAllSlots: true,
  };
}

function formatHourTotal(n) {
  return `${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}h`;
}

/** Date keys used for hour totals: anchor day only in day view; all visible columns in week/month / custom range. */
function visibleDateKeysForHours(scheduleModel, viewMode, anchorDate) {
  if (scheduleModel.aggregateAllSlots) {
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

function sumWorkHoursOnDayForPersonList(personAllocations, dateKey) {
  let sum = 0;
  for (const a of personAllocations) {
    if (a.isLeave) continue;
    if (workAllocationCoversDateKey(a, dateKey)) {
      sum += parseFloat(a.hoursPerDay) || 0;
    }
  }
  return sum;
}

function computePersonHoursInViewFromList(personAllocations, scheduleModel, viewMode, anchorDate) {
  const keys = visibleDateKeysForHours(scheduleModel, viewMode, anchorDate);
  let t = 0;
  for (const dk of keys) {
    t += sumWorkHoursOnDayForPersonList(personAllocations, dk);
  }
  return t;
}

function personHasOverloadInViewFromList(personAllocations, scheduleModel, viewMode, anchorDate) {
  const keys = visibleDateKeysForHours(scheduleModel, viewMode, anchorDate);
  for (const dk of keys) {
    const maxH = maxWorkHoursOnDayForPersonList(personAllocations, dk, STANDARD_DAY_HOURS);
    if (sumWorkHoursOnDayForPersonList(personAllocations, dk) > maxH + 1e-6) return true;
  }
  return false;
}

/** Bar thickness: strong contrast between light (e.g. 1h) and heavy (7.5h+) bookings. */
const BAR_H_MIN = 26;
const BAR_H_MAX = 136;
const BAR_H_NORM = 7.5;
/**
 * Week/month bars show full project name (multi-line clamp), code chip, hours row, 3px border.
 * Lane height is budgeted from this value; if too small, absolute-positioned bars overflow the row.
 */
const MIN_TIMELINE_BAR_CONTENT_PX = 104;

function allocationBarHeightPx(alloc, allocViewMode) {
  if (alloc?.isLeave) return 54;
  const h = Math.max(0, parseFloat(alloc.hoursPerDay) || 0);
  if (h <= 0) {
    const base = BAR_H_MIN + 6;
    return allocViewMode && allocViewMode !== "day" ? Math.max(base, MIN_TIMELINE_BAR_CONTENT_PX) : base;
  }
  const t = Math.min(h, 12) / BAR_H_NORM;
  const curved = Math.pow(Math.min(t, 1.45), 0.52);
  let px = Math.round(BAR_H_MIN + curved * (BAR_H_MAX - BAR_H_MIN));
  if (allocViewMode && allocViewMode !== "day") {
    px = Math.max(px, MIN_TIMELINE_BAR_CONTENT_PX);
  }
  return px;
}

const timelineRowEqual = (prev, next) => {
  if (prev.p !== next.p) return false;
  if (prev.i !== next.i) return false;
  if (prev.viewMode !== next.viewMode) return false;
  if (prev.anchorDate?.getTime?.() !== next.anchorDate?.getTime?.()) return false;
  if (prev.utilizationMode !== next.utilizationMode) return false;
  if (prev.gridTemplate !== next.gridTemplate) return false;
  if (prev.scheduleModel !== next.scheduleModel) return false;
  if (prev.projects !== next.projects) return false;
  if (prev.personAllocations !== next.personAllocations) return false;

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

function allocationBarChromeStyles(barColor, hours, theme) {
  const light = theme === "light";
  const hnorm = Math.min(1, Math.max(0, hours) / BAR_H_NORM);
  const sheen = light
    ? "inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.05)"
    : "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.35)";
  const drop = light
    ? `0 2px 10px ${hexToRgba(barColor, 0.2 + hnorm * 0.08)}`
    : `0 2px 12px rgba(0,0,0,0.42)`;
  return {
    boxShadow: `${sheen}, ${drop}`,
    border: `3px solid ${barColor}`,
  };
}

/** Softer interior wash behind text — slightly lifted toward white / mid-tones for calmer UI. */
function allocationBarInnerWash(barColor, theme) {
  const light = theme === "light";
  const hi = mixRgbHex(barColor, 255, light ? 0.72 : 0.46);
  const mid = mixRgbHex(barColor, light ? 255 : 0, light ? 0.36 : 0.28);
  const lo = mixRgbHex(barColor, 0, light ? 0.1 : 0.34);
  return `linear-gradient(168deg, ${hi} 0%, ${mid} 42%, ${lo} 100%)`;
}

function allocationBarBorderRadiusPx(widthPct) {
  if (widthPct < 4) return 6;
  if (widthPct < 9) return 8;
  if (widthPct < 16) return 10;
  return 12;
}

function allocationCompactInitials(projectName, projectCode) {
  const code = (projectCode || "").trim();
  const name = (projectName || "").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  // Numeric-only codes (e.g. "12") read wrong as micro label; prefer letters from the project name.
  if (code.length >= 2 && !/^\d+$/.test(code)) return code.slice(0, 2).toUpperCase();
  if (code.length >= 2 && /^\d+$/.test(code)) {
    if (parts.length >= 2) return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
    if (name.length >= 2) return name.slice(0, 2).toUpperCase();
  }
  if (parts.length >= 2) return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

function buildWorkAllocationTitle(alloc, projectName, hoursLabel) {
  const bits = [alloc.project || projectName, hoursLabel ? `${hoursLabel}/day` : ""];
  if (alloc.startDate === alloc.endDate) bits.push(alloc.startDate);
  else bits.push(`${alloc.startDate} → ${alloc.endDate}`);
  const n = (alloc.notes || "").trim();
  if (n) bits.push(n.length > 120 ? `${n.slice(0, 120)}…` : n);
  return bits.filter(Boolean).join(" · ");
}

const TimelineRow = memo(function TimelineRow({
  p,
  i,
  personAllocations,
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
  handleTimelineClick,
  todayDateKey,
}) {
  const { theme } = useAppTheme();
  const t = T[theme];
  const reduceMotion = useReducedMotion();
  const allocViewMode = scheduleModel.aggregateAllSlots ? "week" : viewMode;

  const hoursKeys = visibleDateKeysForHours(scheduleModel, viewMode, anchorDate);
  const hours = computePersonHoursInViewFromList(personAllocations, scheduleModel, viewMode, anchorDate);
  const rawCap = hoursKeys.reduce(
    (s, dk) => s + maxWorkHoursOnDayForPersonList(personAllocations, dk, STANDARD_DAY_HOURS),
    0
  );
  const pct =
    rawCap > 0
      ? Math.min(100, Math.round((hours / rawCap) * 100))
      : hours > 1e-6
        ? 100
        : 0;
  const right =
    utilizationMode === "hours" ? `${hours.toFixed(hours % 1 ? 1 : 0)}h` : `${pct}%`;
  const overloaded = personHasOverloadInViewFromList(
    personAllocations,
    scheduleModel,
    viewMode,
    anchorDate
  );
  const noWorkingDaysInView = hoursKeys.length > 0 && rawCap < 1e-6;

  const rowSegments = personAllocations.flatMap((a) =>
      layoutsForAllocation(a, scheduleModel, allocViewMode).map((lay) => ({
        a,
        lay,
        occIdx: lay.occ,
        segKey: `${a.id}-o${lay.occ}-wk${lay.weekPart ?? 0}-s${lay.start}-sp${lay.span}`,
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
    const mh = Math.max(...segs.map((s) => allocationBarHeightPx(s.a, allocViewMode))) + BAR_VPAD;
    stackHeightsSum += mh;
    if (k < allocLaneCount - 1) stackHeightsSum += LANE_STACK_GAP;
  }
  const schedAllocContentH = ROW_ALLOC_PAD + stackHeightsSum;


  return (
    <div
      key={p.id}
      className={
        "lp-sched-row" + (overloaded ? " lp-sched-row-overloaded" : "")
      }
      style={{ ["--animation-order"]: i }}
    >
      <div className="lp-sched-person">
        <div className="lp-person-row-shell">
          <div className="lp-person-row-cluster">
            <div className="lp-person-row lp-person-row-main">
              <div
                className="lp-person-main-col"
                onClick={(e) => {
                  if (e.target.closest(".lp-person-add-banner")) return;
                  openEdit(p);
                }}
              >
                <button
                  type="button"
                  className="lp-person-identity-hit"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(p);
                  }}
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
                <div className="lp-person-add-banner">
                  <button
                    type="button"
                    className="lp-sched-add-btn lp-sched-add-btn--inline"
                    disabled={noWorkingDaysInView}
                    title={
                      noWorkingDaysInView
                        ? "No working days in this view (all days have leave or are unavailable)"
                        : "Add allocation (blocked on leave days when you save)"
                    }
                    aria-label={`Add allocation for ${p.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (noWorkingDaysInView) return;
                      openCreateAllocation(p);
                    }}
                  >
                    <Plus size={14} strokeWidth={2.25} />
                  </button>
                </div>
              </div>
            </div>
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
                  (allocViewMode !== "day" && slot.weekParity ? " lp-week-lane-b" : "") +
                  (allocViewMode !== "day" && !slot.weekParity ? " lp-week-lane-a" : "") +
                  (allocViewMode !== "day" && slot.weekBlockStart ? " lp-week-lane-block-start" : "") +
                  (allocViewMode !== "day" && slot.weekBlockEnd ? " lp-week-lane-block-end" : "")
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
              <AnimatePresence initial={false}>
                {leaveSegments.map((seg, segIdx) => {
                  const isDay = allocViewMode === "day";
                  const colStart = isDay ? 1 : Math.max(1, Math.round(seg.lay.start) + 1);
                  const colSpan = isDay ? nCols : Math.max(1, Math.round(seg.lay.span));
                  const lbl = seg.a.leaveType ? leaveLabel(seg.a.leaveType) : "Leave";
                  const typeId = normalizeLeaveTypeId(seg.a.leaveType);
                  const onToday = leaveSpansToday(seg.a, todayDateKey);
                  const dateLine =
                    seg.a.startDate === seg.a.endDate
                      ? seg.a.startDate
                      : `${seg.a.startDate} → ${seg.a.endDate}`;
                  const hoverTitle = buildLeaveHoverTitle(seg.a, leaveLabel);
                  return (
                    <motion.button
                      key={`${seg.a.id}-occ-${seg.occIdx}`}
                      type="button"
                      layout={false}
                      className={
                        "lp-leave-block lp-leave-block--" +
                        typeId +
                        (onToday ? " lp-leave-block--today" : "")
                      }
                      style={{
                        gridColumn: `${colStart} / span ${colSpan}`,
                        gridRow: 1,
                        alignSelf: "stretch",
                        pointerEvents: "auto",
                      }}
                      aria-label={allocationAriaLabel(seg.a)}
                      title={hoverTitle}
                      initial={
                        reduceMotion
                          ? false
                          : { opacity: 0, y: -8, scale: 0.97 }
                      }
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        transition: {
                          delay: reduceMotion ? 0 : segIdx * 0.045,
                          duration: 0.28,
                          ease: [0.45, 0, 0.55, 1],
                        },
                      }}
                      exit={
                        reduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.2 } }
                      }
                      whileHover={reduceMotion ? undefined : { scale: 1.015 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openAllocationDetail(seg.a);
                      }}
                    >
                      <LeaveTimelineGlyph leaveTypeId={seg.a.leaveType} className="lp-leave-block__icon" />
                      <span className="lp-leave-block__label">
                        <span>{lbl}</span>
                        <span className="lp-leave-block__dates">{dateLine}</span>
                      </span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
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
            <div
              className="lp-alloc-lanes-root"
              style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "10px", width: "100%", position: "relative" }}
            >
              {Array.from({ length: allocLaneCount }).map((_, stackIdx) => {
                const laneSegs = workSegments
                  .filter((s) => s.stack === stackIdx)
                  .sort((a, b) => a.lay.start - b.lay.start);

                if (laneSegs.length === 0) return null;

                const laneMinH =
                  Math.max(...laneSegs.map((s) => allocationBarHeightPx(s.a, allocViewMode))) + BAR_VPAD;

                return (
                  <div
                    key={stackIdx}
                    className={"lp-alloc-lane" + (stackIdx % 2 ? " lp-alloc-lane--stripe" : "")}
                    style={{
                      position: "relative",
                      width: "100%",
                      minHeight: `${laneMinH}px`,
                    }}
                  >
                    {laneSegs.map((seg, segJ) => {
                      const startCol = Math.max(0, Math.min(seg.lay.start, Math.max(0, nCols - 1)));
                      const spanClamped = Math.max(
                        0,
                        Math.min(seg.lay.span, nCols - startCol)
                      );
                      const colStartFrac = nCols > 0 ? startCol / nCols : 0;
                      const colWidthFrac = nCols > 0 ? spanClamped / nCols : 0;
                      const leftPct = colStartFrac * 100;
                      const widthPct = colWidthFrac * 100;
                      const z = 20 + seg.stack * 20 + seg.occIdx + Math.floor(seg.lay.start);

                      const h = Math.max(0, parseFloat(seg.a.hoursPerDay) || 0);
                      const hnorm = Math.min(1, Math.max(0, h) / BAR_H_NORM);
                      const calculatedHeight = allocationBarHeightPx(seg.a, allocViewMode);

                      const { projectName, projectCode, hoursLabel } = allocationDisplay(seg.a);
                      const barColor = colorForAllocationBar(seg.a, projects);
                      const fg = contrastingTextColor(barColor);
                      const chrome = allocationBarChromeStyles(barColor, h, theme);
                      const innerWash = allocationBarInnerWash(barColor, theme);

                      const brPx = allocationBarBorderRadiusPx(widthPct);
                      // Micro layout (code initials): only on **day** (hourly) grid where columns are time slots.
                      // Week/month/custom range use many date columns → narrow width% → never use micro or we show
                      // project codes (e.g. "12") instead of names when endless-scroll adds many weeks.
                      // Week-split segments keep full label per segment via weekSplitCount when micro applies.
                      const micro =
                        allocViewMode === "day" &&
                        widthPct < 5.5 &&
                        (seg.lay.weekSplitCount ?? 1) <= 1;
                      const compactInitials = allocationCompactInitials(projectName, projectCode);
                      const hoursFontW = 600 + Math.round(hnorm * 220);
                      const clampedHw = Math.min(820, Math.max(600, hoursFontW));

                      const repeatOn = (seg.a.repeatId ?? "none") !== "none";
                      const hasNotes = Boolean((seg.a.notes || "").trim());
                      const tip = buildWorkAllocationTitle(seg.a, projectName, hoursLabel);

                      const enterDelayMs = reduceMotion ? 0 : Math.min(i, 28) * 22 + stackIdx * 10 + segJ * 38;

                      const baseStyle = {
                        position: "absolute",
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        top: 0,
                        zIndex: z,
                        minHeight: `${calculatedHeight}px`,
                        padding: 0,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        pointerEvents: "auto",
                        boxSizing: "border-box",
                        background: "transparent",
                        borderRadius: `${brPx}px`,
                        ...chrome,
                        color: fg,
                        transition:
                          "min-height 0.35s cubic-bezier(0.22, 1, 0.36, 1), left 0.35s cubic-bezier(0.22, 1, 0.36, 1), width 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease, transform 0.2s ease, filter 0.2s ease",
                        animationDelay: enterDelayMs ? `${enterDelayMs}ms` : undefined,
                      };

                      return (
                        <button
                          key={seg.segKey}
                          type="button"
                          className={
                            "lp-block lp-block-alloc lp-block-alloc-project lp-alloc-bar" +
                            (micro ? " lp-alloc-bar--micro" : "") +
                            (allocViewMode === "day" ? " lp-alloc-bar--day" : "")
                          }
                          style={baseStyle}
                          aria-label={allocationAriaLabel(seg.a)}
                          title={tip}
                          onClick={(e) => {
                            e.stopPropagation();
                            openAllocationDetail(seg.a);
                          }}
                        >
                          <span className="lp-alloc-bar__underlay" style={{ background: innerWash }} aria-hidden />
                          <span
                            className="lp-alloc-bar__load"
                            style={{
                              background: `linear-gradient(to top, ${hexToRgba(barColor, theme === "light" ? 0.34 : 0.42)}, ${hexToRgba(barColor, 0)})`,
                              height: `${hnorm * 100}%`,
                            }}
                            aria-hidden
                          />
                          <span className="lp-alloc-bar__body">
                            {micro ? (
                              <>
                                <span className="lp-alloc-bar__micro-row">
                                  <span className="lp-alloc-micro-initials">{compactInitials}</span>
                                  <span className="lp-alloc-bar__micro-icons">
                                    {repeatOn ? (
                                      <Repeat2 size={11} strokeWidth={2.25} className="lp-alloc-bar__ic" aria-hidden />
                                    ) : null}
                                    {hasNotes ? (
                                      <StickyNote size={11} strokeWidth={2.25} className="lp-alloc-bar__ic" aria-hidden />
                                    ) : null}
                                  </span>
                                </span>
                                <span className="lp-alloc-hours" style={{ fontWeight: clampedHw }}>
                                  {hoursLabel}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="lp-alloc-top">
                                  <span className="lp-alloc-name">{projectName}</span>
                                  {projectCode ? (
                                    <span
                                      className="lp-alloc-code-chip"
                                      style={projectCodeChipStyles(barColor, theme)}
                                    >
                                      {projectCode}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="lp-alloc-bar__row-foot">
                                  <span className="lp-alloc-hours" style={{ fontWeight: clampedHw }}>
                                    {hoursLabel}
                                  </span>
                                  <span className="lp-alloc-bar__icons">
                                    {repeatOn ? (
                                      <Repeat2 size={12} strokeWidth={2.25} className="lp-alloc-bar__ic" aria-hidden />
                                    ) : null}
                                    {hasNotes ? (
                                      <StickyNote size={12} strokeWidth={2.25} className="lp-alloc-bar__ic" aria-hidden />
                                    ) : null}
                                  </span>
                                </span>
                              </>
                            )}
                          </span>
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
  const { theme } = useAppTheme();
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
    publicHolidayAllocations,
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
    scheduleFilterRules,
    setStarredPeopleTags,
    setScheduleFilterRules,
    syncPersonCreate,
    syncPersonUpdate,
    syncProjectCreate,
    syncAllocationCreate,
    syncAllocationUpdate,
    syncAllocationDelete,
    refreshWorkspaceFromSupabase,
  } = useSchedulePageData();

  const scheduleAllocations = useMemo(
    () => [...allocations, ...publicHolidayAllocations],
    [allocations, publicHolidayAllocations]
  );

  const allocationsByPerson = useMemo(
    () => buildAllocationsByPerson(scheduleAllocations),
    [scheduleAllocations]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);

  const [viewMode, setViewMode] = useState("month");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [density, setDensity] = useState("comfortable");
  const [utilizationMode, setUtilizationMode] = useState("hours");

  const [timelineOffsets, setTimelineOffsets] = useState({ prev: 1, next: 2 });
  const [timeRangePreset, setTimeRangePreset] = useState(null);
  const [customRange, setCustomRange] = useState(null);
  const [customRangeDraft, setCustomRangeDraft] = useState({ start: "", end: "" });
  const [timeRangeOpen, setTimeRangeOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [scheduleSort, setScheduleSort] = useState("custom");
  const timeRangeWrapRef = useRef(null);
  const sortWrapRef = useRef(null);
  const prevOffsets = useRef(timelineOffsets);
  const prevColCount = useRef(0);
  const scheduleViewportRef = useRef(null);
  /** Coalesces horizontal scroll to one layout read per frame (fewer setState calls while scrolling). */
  const timelineScrollRafRef = useRef(null);
  const lastAnchorKey = useRef(null);

  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [densityOpen, setDensityOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);

  const [allocCreateOpen, setAllocCreateOpen] = useState(false);
  const [allocEditing, setAllocEditing] = useState(null);
  const [allocPreselectPerson, setAllocPreselectPerson] = useState(null);
  const [allocPreselectDate, setAllocPreselectDate] = useState(null);
  const [allocPreselectProject, setAllocPreselectProject] = useState(null);
  const [allocDefaultTab, setAllocDefaultTab] = useState("allocation");
  const [allocDetailOpen, setAllocDetailOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState(null);

  const viewWrapRef = useRef(null);
  const densityWrapRef = useRef(null);
  const addWrapRef = useRef(null);
  const scheduleFilterWrapRef = useRef(null);
  const starredWrapRef = useRef(null);

  const [scheduleFilterOpen, setScheduleFilterOpen] = useState(false);
  const [starredPopoverOpen, setStarredPopoverOpen] = useState(false);

  useEffect(() => {
    function onDoc(e) {
      if (viewWrapRef.current && !viewWrapRef.current.contains(e.target)) setViewMenuOpen(false);
      if (densityWrapRef.current && !densityWrapRef.current.contains(e.target)) setDensityOpen(false);
      if (addWrapRef.current && !addWrapRef.current.contains(e.target)) setAddMenuOpen(false);
      if (scheduleFilterWrapRef.current && !scheduleFilterWrapRef.current.contains(e.target))
        setScheduleFilterOpen(false);
      if (starredWrapRef.current && !starredWrapRef.current.contains(e.target)) setStarredPopoverOpen(false);
      if (timeRangeWrapRef.current && !timeRangeWrapRef.current.contains(e.target)) setTimeRangeOpen(false);
      if (sortWrapRef.current && !sortWrapRef.current.contains(e.target)) setSortOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const scheduleModel = useMemo(() => {
    if (customRange?.start && customRange?.end) {
      return buildScheduleModelCustomRange(customRange.start, customRange.end);
    }
    return buildScheduleModel(viewMode, anchorDate, timelineOffsets);
  }, [customRange, viewMode, anchorDate, timelineOffsets]);

  const todayDateKey = useMemo(() => dateKeyLocal(new Date()), []);

  const peopleOrderMap = useMemo(() => {
    const m = new Map();
    let idx = 0;
    for (const p of people) {
      if (!p.archived) m.set(p.id, idx++);
    }
    return m;
  }, [people]);

  const scheduleVisibleKeys = useMemo(
    () => visibleDateKeysForHours(scheduleModel, viewMode, anchorDate),
    [scheduleModel, viewMode, anchorDate]
  );

  const { schedulePeople, schedulePeopleHoursInView } = useMemo(() => {
    let list = people.filter((p) => !p.archived);
    list = list.filter((p) =>
      personMatchesScheduleFilter(p, scheduleFilterRules, {
        allocations: scheduleAllocations,
        personAllocations: getPersonAllocations(allocationsByPerson, p.id),
        projects,
        visibleKeys: scheduleVisibleKeys,
      })
    );
    const hoursMap = new Map();
    for (const p of list) {
      const pa = getPersonAllocations(allocationsByPerson, p.id);
      hoursMap.set(
        p.id,
        computePersonHoursInViewFromList(pa, scheduleModel, viewMode, anchorDate)
      );
    }
    const sorted = [...list].sort((a, b) =>
      comparePeopleForScheduleSort(a, b, scheduleSort, peopleOrderMap, hoursMap)
    );
    return { schedulePeople: sorted, schedulePeopleHoursInView: hoursMap };
  }, [
    people,
    scheduleFilterRules,
    scheduleVisibleKeys,
    scheduleSort,
    peopleOrderMap,
    scheduleAllocations,
    allocationsByPerson,
    projects,
    scheduleModel,
    viewMode,
    anchorDate,
  ]);

  const projectByLabel = useMemo(() => {
    const m = new Map();
    for (const p of projects) {
      m.set(projectToAllocationLabel(p), p);
    }
    return m;
  }, [projects]);

  const scheduleFilterActiveCount = countActiveFilterRules(scheduleFilterRules);

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
      s += schedulePeopleHoursInView.get(p.id) ?? 0;
    }
    return s;
  }, [schedulePeople, schedulePeopleHoursInView]);

  const teamCapacityHours = useMemo(() => {
    const keys = visibleDateKeysForHours(scheduleModel, viewMode, anchorDate);
    let cap = 0;
    for (const p of schedulePeople) {
      const pa = getPersonAllocations(allocationsByPerson, p.id);
      for (const dk of keys) {
        cap += maxWorkHoursOnDayForPersonList(pa, dk, STANDARD_DAY_HOURS);
      }
    }
    return Math.max(STANDARD_DAY_HOURS, cap);
  }, [schedulePeople, allocationsByPerson, scheduleModel, viewMode, anchorDate]);

  const teamUtilPercent = useMemo(
    () => (teamCapacityHours > 0 ? Math.min(100, Math.round((totalHours / teamCapacityHours) * 100)) : 0),
    [totalHours, teamCapacityHours]
  );

  const scheduleMotionKey = useMemo(() => {
    if (customRange?.start && customRange?.end) {
      return `cr-${customRange.start}-${customRange.end}`;
    }
    if (viewMode === "month") return `m-${anchorDate.getFullYear()}-${anchorDate.getMonth() + 1}`;
    if (viewMode === "week") return `w-${weekMondayKey(anchorDate)}`;
    return `d-${dateKeyLocal(anchorDate)}`;
  }, [viewMode, anchorDate, customRange]);

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
    setCustomRange(null);
    setTimeRangePreset(null);
    if (viewMode === "day") setAnchorDate((d) => addWeekdays(d, -1));
    else if (viewMode === "week") setAnchorDate((d) => addDays(startOfWeekMonday(d), -7));
    else setAnchorDate((d) => addMonths(d, -1));
    lastAnchorKey.current = null;
  }, [viewMode]);

  const navigateNext = useCallback(() => {
    setCustomRange(null);
    setTimeRangePreset(null);
    if (viewMode === "day") setAnchorDate((d) => addWeekdays(d, 1));
    else if (viewMode === "week") setAnchorDate((d) => addDays(startOfWeekMonday(d), 7));
    else setAnchorDate((d) => addMonths(d, 1));
    lastAnchorKey.current = null;
  }, [viewMode]);

  const goToday = useCallback(() => {
    setCustomRange(null);
    setTimeRangePreset(null);
    setAnchorDate(new Date());
    setTimelineOffsets({ prev: 1, next: 2 });
    lastAnchorKey.current = null;
  }, []);

  const applyTimeRangePreset = useCallback((presetId) => {
    setTimeRangePreset(presetId);
    setTimeRangeOpen(false);
    setTimelineOffsets({ prev: 0, next: 0 });
    lastAnchorKey.current = null;
    if (presetId === "custom") return;
    setCustomRange(null);
    const now = new Date();
    if (presetId === "this_week") {
      setViewMode("week");
      setAnchorDate(startOfWeekMonday(now));
      return;
    }
    if (presetId === "last_week") {
      setViewMode("week");
      setAnchorDate(addDays(startOfWeekMonday(now), -7));
      return;
    }
    if (presetId === "next_week") {
      setViewMode("week");
      setAnchorDate(addDays(startOfWeekMonday(now), 7));
      return;
    }
    if (presetId === "this_month") {
      setViewMode("month");
      setAnchorDate(new Date(now.getFullYear(), now.getMonth(), 1));
      return;
    }
    if (presetId === "last_month") {
      setViewMode("month");
      setAnchorDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      return;
    }
    if (presetId === "next_month") {
      setViewMode("month");
      setAnchorDate(new Date(now.getFullYear(), now.getMonth() + 1, 1));
    }
  }, []);

  const applyCustomRange = useCallback(() => {
    const s = customRangeDraft.start;
    const e = customRangeDraft.end;
    if (!s || !e) return;
    if (s > e) setCustomRange({ start: e, end: s });
    else setCustomRange({ start: s, end: e });
    setTimeRangePreset("custom");
    setTimeRangeOpen(false);
    setTimelineOffsets({ prev: 0, next: 0 });
    lastAnchorKey.current = null;
  }, [customRangeDraft.start, customRangeDraft.end]);

  const timeRangeLabelText = useMemo(() => {
    if (timeRangePreset === "custom" && customRange?.start && customRange?.end) {
      return `${customRange.start} → ${customRange.end}`;
    }
    const hit = TIME_RANGE_PRESETS.find((x) => x.id === timeRangePreset);
    if (hit && hit.id !== "custom") return hit.label;
    // No preset (e.g. after prev/next): label must match the anchored period, not always "This month".
    if (viewMode === "month") {
      return anchorDate.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
    }
    if (viewMode === "week") {
      const mon = startOfWeekMonday(anchorDate);
      const fri = addDays(mon, 4);
      return `${formatDayMonth(mon)} – ${formatDayMonthYear(fri)}`;
    }
    return anchorDate.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  }, [timeRangePreset, customRange, viewMode, anchorDate]);

  const openAdd = () => {
    setEditingPerson(null);
    setModalOpen(true);
  };

  const openCreateAllocation = useCallback((person, date) => {
    setAllocEditing(null);
    setAllocDefaultTab("allocation");
    setAllocPreselectPerson(person ?? null);
    setAllocPreselectDate(date ?? null);
    setAllocPreselectProject(null);
    setAllocCreateOpen(true);
  }, []);

  const openCreateAllocationForPersonProject = useCallback((person, projectLabel) => {
    setAllocEditing(null);
    setAllocDefaultTab("allocation");
    setAllocPreselectPerson(person ?? null);
    setAllocPreselectDate(null);
    setAllocPreselectProject(projectLabel != null ? String(projectLabel).trim() || null : null);
    setAllocCreateOpen(true);
  }, []);

  const openCreateLeaveForPerson = useCallback((person) => {
    setAllocEditing(null);
    setAllocDefaultTab("leave");
    setAllocPreselectPerson(person ?? null);
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setAllocPreselectDate(`${y}-${m}-${day}`);
    setAllocPreselectProject(null);
    setAllocCreateOpen(true);
  }, []);

  const closeCreateAllocation = useCallback(() => {
    setAllocCreateOpen(false);
    setAllocEditing(null);
    setAllocPreselectPerson(null);
    setAllocPreselectDate(null);
    setAllocPreselectProject(null);
    setAllocDefaultTab("allocation");
  }, []);

  /** Click on empty timeline space → open allocation modal with person + date */
  const handleTimelineClick = useCallback(
    (e, person, nCols) => {
      // Don't open if user clicked on an existing allocation block
      if (e.target.closest(".lp-block") || e.target.closest(".lp-leave-block")) return;
      const row = e.currentTarget;
      const rect = row.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const colWidth = rect.width / nCols;
      const colIndex = Math.min(Math.max(0, Math.floor(x / colWidth)), nCols - 1);
      const slot = scheduleModel.slots[colIndex];
      const clickedDate = slot?.dateKey ?? null;
      if (person && clickedDate) {
        const pa = getPersonAllocations(allocationsByPerson, person.id);
        const maxH = maxWorkHoursOnDayForPersonList(pa, clickedDate, STANDARD_DAY_HOURS);
        if (maxH < 1e-6) {
          toast.error(`${person.name} is not available that day`, {
            description: "That date is covered by leave or recurring unavailability.",
          });
          return;
        }
      }
      openCreateAllocation(person, clickedDate);
    },
    [scheduleModel, openCreateAllocation, allocationsByPerson]
  );

  const handleCreateAllocation = useCallback(
    async (payload) => {
      // ── Block allocation if any assigned person is on leave during these dates ──
      if (!payload.isLeave) {
        const pStart = payload.startDate;
        const pEnd = payload.endDate;
        for (const pid of payload.personIds) {
          let leaveConflict = null;
          let overlap = null;
          for (const a of getPersonAllocations(allocationsByPerson, pid)) {
            const o = findLeaveOverlapWithWorkRange(a, pStart, pEnd);
            if (o) {
              leaveConflict = a;
              overlap = o;
              break;
            }
          }
          if (leaveConflict && overlap) {
            const personName = people.find((p) => p.id === pid)?.name || "This person";
            const leaveTypeName = leaveConflict.leaveType
              ? leaveLabel(leaveConflict.leaveType)
              : "Leave";
            const rangeLabel =
              overlap.start === overlap.end
                ? overlap.start
                : `${overlap.start} → ${overlap.end}`;
            toast.error(
              `Cannot allocate ${personName} — they are on ${leaveTypeName} (${rangeLabel})`
            );
            return;
          }
        }
      }

      const projectColor = resolveColorForProjectLabel(payload.project, projects);
      const createdDraft = {
        id:
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `tmp_${Date.now()}`,
        ...payload,
        updatedBy: "You",
        updatedAt: new Date().toISOString(),
        projectColor,
        version: 1,
      };

      try {
        const saved = isSupabaseConfigured ? await syncAllocationCreate(createdDraft) : createdDraft;
        setAllocations((prev) => [...prev, saved]);
        toast.success(payload.isLeave ? "Leave saved" : "Allocation saved", {
          description: payload.isLeave
            ? `${payload.startDate} → ${payload.endDate}`
            : `${shortenAllocLabel(payload.project, 42)} · ${Number(payload.hoursPerDay) || 0}h/day`,
          duration: 2800,
          className: "float-schedule-view-toast",
        });
      } catch (e) {
        toast.error("Save failed", { description: e?.message || String(e) });
      }
    },
    [setAllocations, projects, allocationsByPerson, people, syncAllocationCreate]
  );

  const handleEditAllocation = useCallback(
    async (payload, id) => {
      // ── Block allocation if any assigned person is on leave during these dates ──
      if (!payload.isLeave) {
        const pStart = payload.startDate;
        const pEnd = payload.endDate;
        for (const pid of payload.personIds) {
          let leaveConflict = null;
          let overlap = null;
          for (const a of getPersonAllocations(allocationsByPerson, pid)) {
            if (a.id === id) continue;
            const o = findLeaveOverlapWithWorkRange(a, pStart, pEnd);
            if (o) {
              leaveConflict = a;
              overlap = o;
              break;
            }
          }
          if (leaveConflict && overlap) {
            const personName = people.find((p) => p.id === pid)?.name || "This person";
            const leaveTypeName = leaveConflict.leaveType
              ? leaveLabel(leaveConflict.leaveType)
              : "Leave";
            const rangeLabel =
              overlap.start === overlap.end
                ? overlap.start
                : `${overlap.start} → ${overlap.end}`;
            toast.error(
              `Cannot allocate ${personName} — they are on ${leaveTypeName} (${rangeLabel})`
            );
            return;
          }
        }
      }

      const projectColor = payload.isLeave ? undefined : resolveColorForProjectLabel(payload.project, projects);
      const prevAlloc = scheduleAllocations.find((a) => a.id === id) || null;
      const merged = {
        ...(prevAlloc || {}),
        id,
        ...payload,
        updatedBy: "You",
        updatedAt: new Date().toISOString(),
        projectColor,
        version: Number(prevAlloc?.version) || 1,
      };

      try {
        const saved = isSupabaseConfigured ? await syncAllocationUpdate(merged) : merged;
        setAllocations((prev) => prev.map((a) => (a.id === id ? saved : a)));
        toast.success(payload.isLeave ? "Leave updated" : "Allocation updated", {
          description: payload.isLeave
            ? `${payload.startDate} → ${payload.endDate}`
            : `${shortenAllocLabel(payload.project, 42)} · ${Number(payload.hoursPerDay) || 0}h/day`,
          duration: 2600,
          className: "float-schedule-view-toast",
        });
      } catch (e) {
        if (e?.name === "OptimisticLockError") {
          toast.error("Someone else edited this allocation", {
            description: "Refreshing the schedule from the server.",
          });
          refreshWorkspaceFromSupabase().catch(() => {});
        } else {
          toast.error("Update failed", { description: e?.message || String(e) });
        }
      }
    },
    [setAllocations, projects, allocationsByPerson, people, syncAllocationUpdate, refreshWorkspaceFromSupabase]
  );

  const handleDeleteAllocation = useCallback(
    async (alloc) => {
      if (alloc?.syntheticPublicHoliday) {
        toast.message("Public holidays follow the person’s region", {
          description: "Change their region under Time off in the profile, or edit availability dates.",
        });
        return;
      }
      const prev = alloc;
      setAllocations((cur) => cur.filter((a) => a.id !== alloc.id));
      try {
        if (isSupabaseConfigured) await syncAllocationDelete(alloc.id);
        toast.success("Allocation deleted");
      } catch (e) {
        setAllocations((cur) => [...cur, prev]);
        toast.error("Delete failed", { description: e?.message || String(e) });
      }
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

  const openEdit = useCallback((person) => {
    setEditingPerson(person);
    setModalOpen(true);
  }, []);

  const handleModalSave = async (form) => {
    const syncAvailAfterSave = async (saved) => {
      if (!isSupabaseConfigured || !saved?.id) return;
      const wh = parseFloat(String(form.weeklyHours ?? "37.5")) || 0;
      const prev = previewAvailabilityHours({
        mon: !!form.availMon,
        tue: !!form.availTue,
        wed: !!form.availWed,
        thu: !!form.availThu,
        fri: !!form.availFri,
        weeklyHours: wh,
      });
      if (!prev.valid) return;
      try {
        await syncPersonAvailabilityFromForm(saved.id, form);
        await refreshWorkspaceFromSupabase();
      } catch (availErr) {
        toast.warning("Profile saved; availability did not sync", {
          description: availErr?.message || String(availErr),
        });
      }
    };
    if (editingPerson) {
      const draft = formToPerson(form, editingPerson.id, editingPerson.archived);
      try {
        const saved = isSupabaseConfigured ? await syncPersonUpdate(draft) : draft;
        setPeople(people.map((p) => (p.id === editingPerson.id ? saved : p)).sort((a, b) => a.name.localeCompare(b.name)));
        toast.success(`${form.name} updated`);
        await syncAvailAfterSave(saved);
        setModalOpen(false);
        setEditingPerson(null);
      } catch (e) {
        toast.error("Update failed", { description: e?.message || String(e) });
      }
    } else {
      const tempId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `tmp_${Date.now()}`;
      const draft = formToPerson(form, tempId, false);
      try {
        const saved = isSupabaseConfigured ? await syncPersonCreate(draft) : draft;
        setPeople([...people, saved].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success(`${form.name} added to directory`);
        await syncAvailAfterSave(saved);
        setModalOpen(false);
        setEditingPerson(null);
      } catch (e) {
        toast.error("Save failed", { description: e?.message || String(e) });
      }
    }
  };

  const handleModalArchive = async () => {
    if (!editingPerson) return;
    const next = { ...editingPerson, archived: !editingPerson.archived };
    setPeople(people.map((p) => (p.id === editingPerson.id ? next : p)));
    try {
      if (isSupabaseConfigured) await syncPersonUpdate(next);
      toast.warning(`${editingPerson.name} ${editingPerson.archived ? "restored" : "archived"}`);
      setModalOpen(false);
      setEditingPerson(null);
    } catch (e) {
      setPeople(people.map((p) => (p.id === editingPerson.id ? editingPerson : p)));
      toast.error("Update failed", { description: e?.message || String(e) });
    }
  };

  const viewLabel = VIEW_OPTIONS.find((v) => v.id === viewMode)?.label ?? "Months";

  const colMinPx =
    viewMode === "day"
      ? 120
      : scheduleModel.columnCount > 28
        ? 88
        : viewMode === "week"
          ? 150
          : 105;
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
    const el = e.currentTarget;
    if (timelineScrollRafRef.current != null) return;
    timelineScrollRafRef.current = requestAnimationFrame(() => {
      timelineScrollRafRef.current = null;
      const thresholdBase = 250;

      // Left endless load
      if (el.scrollLeft < thresholdBase) {
        setTimelineOffsets((o) => (o.prev < 36 ? { ...o, prev: o.prev + 1 } : o));
      }

      // Right endless load
      if (el.scrollLeft + el.clientWidth > el.scrollWidth - thresholdBase) {
        setTimelineOffsets((o) => (o.next < 36 ? { ...o, next: o.next + 1 } : o));
      }
    });
  }, []);

  useEffect(
    () => () => {
      if (timelineScrollRafRef.current != null) {
        cancelAnimationFrame(timelineScrollRafRef.current);
        timelineScrollRafRef.current = null;
      }
    },
    []
  );

  const scheduleFirefox =
    typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent || "");

  // scrollMargin must stay 0: the calendar header is a sibling above .lp-sched-virtual-rows in the
  // scroll flow. Non-zero scrollMargin would add the same offset again as empty space above row 0.
  const scheduleRowVirtualizer = useVirtualizer({
    count: schedulePeople.length,
    getScrollElement: () => scheduleViewportRef.current,
    estimateSize: () => 148,
    overscan: 4,
    measureElement: scheduleFirefox ? undefined : virtualMeasureElement,
  });

  const scheduleRowVirtualizerRef = useRef(scheduleRowVirtualizer);
  scheduleRowVirtualizerRef.current = scheduleRowVirtualizer;
  useLayoutEffect(() => {
    scheduleRowVirtualizerRef.current.measure();
  }, [scheduleModel, viewMode, customRange, colMinPx, schedulePeople.length]);

  return (
    <div
      className="lp-root"
      data-theme={theme === "light" ? "light" : "dark"}
      data-density={density}
      data-view={viewMode}
    >
      <AppSideNav />

      <div className="lp-main">
        <div className="lp-header-block">
          <div className="lp-page-title-row">
            <div className="lp-schedule-title-cluster">
              <div className="lp-schedule-tag-dd-group">
                <div className="lp-dropdown-wrap" ref={scheduleFilterWrapRef}>
                  <button
                    type="button"
                    className={
                      "lp-pill lp-pill-btn lp-tag-dd-trigger" +
                      (scheduleFilterActiveCount > 0 ? " lp-tag-dd-trigger-active" : "")
                    }
                    aria-expanded={scheduleFilterOpen}
                    aria-haspopup="dialog"
                    aria-label="Filter schedule by people and allocations"
                    onClick={() => {
                      setScheduleFilterOpen((o) => !o);
                      setStarredPopoverOpen(false);
                      setViewMenuOpen(false);
                      setDensityOpen(false);
                      setAddMenuOpen(false);
                    }}
                  >
                    <Filter size={14} strokeWidth={2.25} />
                    Filter
                    {scheduleFilterActiveCount > 0 ? (
                      <span className="lp-schedule-filter-trigger-badge">{scheduleFilterActiveCount}</span>
                    ) : null}
                    <ChevronDown size={14} />
                  </button>
                  <ScheduleAllocationFilterMenu
                    open={scheduleFilterOpen}
                    onRequestClose={() => setScheduleFilterOpen(false)}
                    rules={scheduleFilterRules}
                    setRules={setScheduleFilterRules}
                    people={people}
                    projects={projects}
                    depts={depts}
                    roles={roles}
                    clients={clients}
                    peopleTagOpts={peopleTagOpts}
                    projectTagOpts={projectTagOpts}
                    allocationProjectOptions={allocationProjectOptions}
                    starredPeopleTags={starredPeopleTags}
                    toggleStarredPeopleTag={toggleStarredPeopleTag}
                  />
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
                      setScheduleFilterOpen(false);
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
                        Tags you ★ under Filter → Person tag appear here. Click a row to remove from starred.
                      </p>
                      <div className="lp-tag-check-scroll">
                        {starredPeopleTags.length === 0 ? (
                          <p className="lp-tag-dd-empty">
                            No starred tags yet. Open Filter, choose Person tag, then click ★ on any tag.
                          </p>
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
                          setCustomRange(null);
                          setTimeRangePreset(null);
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
                  className="lp-sched-add-btn"
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
                  <Plus size={16} strokeWidth={2.5} />
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
              <div className="lp-dropdown-wrap" ref={sortWrapRef}>
                <button
                  type="button"
                  className={
                    "lp-pill lp-pill-btn lp-subbar-dd" +
                    (scheduleSort !== "custom" ? " lp-subbar-dd-active" : "")
                  }
                  aria-expanded={sortOpen}
                  aria-haspopup="listbox"
                  aria-label="Sort people"
                  onClick={() => {
                    setSortOpen((o) => !o);
                    setTimeRangeOpen(false);
                    setScheduleFilterOpen(false);
                    setStarredPopoverOpen(false);
                    setViewMenuOpen(false);
                    setDensityOpen(false);
                    setAddMenuOpen(false);
                  }}
                >
                  <ArrowDownUp size={14} strokeWidth={2.25} />
                  Sort
                  <ChevronDown size={14} />
                </button>
                {sortOpen && (
                  <div className="lp-popover lp-popover-sort" role="listbox">
                    {SCHEDULE_SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        role="option"
                        className={
                          "lp-popover-item" + (scheduleSort === opt.id ? " lp-popover-item-active" : "")
                        }
                        onClick={() => {
                          setScheduleSort(opt.id);
                          setSortOpen(false);
                        }}
                      >
                        {opt.label}
                        {scheduleSort === opt.id && <Check size={16} className="lp-popover-check" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="lp-dropdown-wrap" ref={timeRangeWrapRef}>
                <button
                  type="button"
                  className={
                    "lp-pill lp-pill-btn lp-subbar-dd" +
                    (timeRangePreset || customRange ? " lp-subbar-dd-active" : "")
                  }
                  aria-expanded={timeRangeOpen}
                  aria-haspopup="listbox"
                  aria-label="Time range"
                  onClick={() => {
                    const today = dateKeyLocal(new Date());
                    setCustomRangeDraft({
                      start: customRange?.start || today,
                      end: customRange?.end || today,
                    });
                    setTimeRangeOpen((o) => !o);
                    setSortOpen(false);
                    setScheduleFilterOpen(false);
                    setStarredPopoverOpen(false);
                    setViewMenuOpen(false);
                    setDensityOpen(false);
                    setAddMenuOpen(false);
                  }}
                >
                  <Calendar size={14} />
                  <span className="lp-time-range-label">{timeRangeLabelText}</span>
                  <ChevronDown size={14} />
                </button>
                {timeRangeOpen && (
                  <div className="lp-popover lp-popover-time-range">
                    {TIME_RANGE_PRESETS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={
                          "lp-popover-item" +
                          (opt.id === "custom"
                            ? timeRangePreset === "custom"
                              ? " lp-popover-item-active"
                              : ""
                            : timeRangePreset === opt.id
                              ? " lp-popover-item-active"
                              : "")
                        }
                        onClick={() => {
                          if (opt.id === "custom") {
                            setTimeRangePreset("custom");
                            const today = dateKeyLocal(new Date());
                            setCustomRangeDraft((d) => ({
                              start: d.start || customRange?.start || today,
                              end: d.end || customRange?.end || today,
                            }));
                            return;
                          }
                          applyTimeRangePreset(opt.id);
                        }}
                      >
                        {opt.label}
                        {opt.id === "custom" ? (
                          timeRangePreset === "custom" && (
                            <Check size={16} className="lp-popover-check" />
                          )
                        ) : (
                          timeRangePreset === opt.id && (
                            <Check size={16} className="lp-popover-check" />
                          )
                        )}
                      </button>
                    ))}
                    <div className="lp-popover-divider" />
                    <div className="lp-custom-range-fields">
                      <span className="lp-popover-title lp-custom-range-title">Custom range</span>
                      <div className="lp-custom-range-grid">
                        <label className="lp-custom-range-lbl">From</label>
                        <input
                          type="date"
                          className="lp-custom-range-input"
                          value={customRangeDraft.start}
                          onChange={(e) =>
                            setCustomRangeDraft((d) => ({ ...d, start: e.target.value }))
                          }
                        />
                        <label className="lp-custom-range-lbl">To</label>
                        <input
                          type="date"
                          className="lp-custom-range-input"
                          value={customRangeDraft.end}
                          onChange={(e) =>
                            setCustomRangeDraft((d) => ({ ...d, end: e.target.value }))
                          }
                        />
                      </div>
                      <button type="button" className="lp-custom-range-apply" onClick={applyCustomRange}>
                        Apply custom range
                      </button>
                    </div>
                    <div className="lp-popover-divider" />
                    <div className="lp-util-row lp-util-row-in-time-dd">
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
            </div>
            <div className="lp-subbar-timeline">
              <span
                className="lp-hours-total lp-hours-total-badge"
                title={`${visibleCapacityDays} working day(s) in view · ${schedulePeople.length} people · ${formatHourTotal(totalHours)} total`}
              >
                {utilizationMode === "hours"
                  ? `${Math.round(totalHours).toLocaleString("en-AU")}h`
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

              <div
                className="lp-sched-virtual-rows"
                style={{
                  height: scheduleRowVirtualizer.getTotalSize(),
                  width: "100%",
                  minWidth: "max(100%, calc(var(--lp-people-w) + var(--lp-timeline-min)))",
                  position: "relative",
                }}
              >
                {scheduleRowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const p = schedulePeople[virtualRow.index];
                  const i = virtualRow.index;
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={scheduleRowVirtualizer.measureElement}
                      className="lp-sched-virtual-anchor"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        minWidth: "max(100%, calc(var(--lp-people-w) + var(--lp-timeline-min)))",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <TimelineRow
                        p={p}
                        i={i}
                        personAllocations={getPersonAllocations(allocationsByPerson, p.id)}
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
                        todayDateKey={todayDateKey}
                      />
                    </div>
                  );
                })}
              </div>
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
        onOpenCreateLeave={(person) => openCreateLeaveForPerson(person)}
        onRefreshWorkspace={refreshWorkspaceFromSupabase}
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
        defaultTab={allocDefaultTab}
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
        onDelete={selectedAllocation?.syntheticPublicHoliday ? undefined : handleDeleteAllocation}
        onEditClick={
          selectedAllocation && !selectedAllocation.syntheticPublicHoliday
            ? () => {
                setAllocEditing(selectedAllocation);
                setAllocDetailOpen(false);
                setAllocCreateOpen(true);
              }
            : undefined
        }
        t={t}
      />

      <ProjectModal
        open={projectCreateOpen}
        onClose={() => setProjectCreateOpen(false)}
        onSave={async (form) => {
          const clean = { ...form };
          delete clean._colorOpen;
          const tempId =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `tmp_${Date.now()}`;
          const draft = { ...clean, id: tempId, archived: false };
          try {
            const saved = isSupabaseConfigured ? await syncProjectCreate(draft) : draft;
            setProjects([...projects, saved].sort((a, b) => a.name.localeCompare(b.name)));
            toast.success(`Project "${form.name}" created!`);
            setProjectCreateOpen(false);
          } catch (e) {
            toast.error("Save failed", { description: e?.message || String(e) });
          }
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
