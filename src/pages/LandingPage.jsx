import {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
  memo,
  useLayoutEffect,
  useSyncExternalStore,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowDownUp,
  Calendar,
  CalendarPlus,
  ArrowRightToLine,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  FolderPlus,
  LayoutGrid,
  LayoutDashboard,
  Maximize2,
  MousePointer2,
  Percent,
  Plus,
  Repeat2,
  Rows3,
  SlidersHorizontal,
  Star,
  StickyNote,
  UserPlus,
  X,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useAppTheme } from "../context/ThemeContext.jsx";
import PersonModal, { formToPerson } from "../components/PersonModal.jsx";
import {
  CreateAllocationModal,
  AllocationDetailModal,
  leaveLabel,
} from "../components/AllocationModals.jsx";
import { ScheduleAllocationFilterMenu } from "../components/ScheduleAllocationFilterMenu.jsx";
import { useSchedulePageData } from "../hooks/useSchedulePageData.js";
import AppSideNav from "../components/navigation/AppSideNav.jsx";
import {
  showCenterActionFeedback,
  useAlloc8ActionFeedbackMount,
} from "../context/CenterActionFeedbackContext.jsx";
import { showAdminAllocationPulse } from "../lib/adminAllocationPulse.js";
import {
  addPendingAllocationKey,
  removePendingAllocationKey,
  replacePendingAllocationKey,
  parsePendingAllocationKeys,
} from "../schedule/allocationPendingKeys.js";
import { useTimelineScrollController } from "../schedule/useTimelineScrollController.js";
import {
  getEffectiveLayoutColumnRange,
  readLayoutColumnRangeFromViewport,
  segmentIntersectsColumnRange,
  isValidColumnRange,
} from "../schedule/scheduleLayoutRange.js";
import {
  publishLayoutColumnRange,
  subscribeLayoutColumnRange,
  getLayoutColumnRangeSnapshot,
} from "../schedule/scheduleLayoutColumnRangeStore.js";
import { attachColumnIndex } from "../schedule/scheduleColumnIndex.js";
import {
  collectVirtualRowIndices,
  setScheduleRowHeightRevision,
} from "../schedule/scheduleRowHeightRuntime.js";
import {
  buildScheduleRowHeightResolver,
  cancelScheduledRowRemeasure,
  queueScheduleRowRemeasure,
  remeasureVisibleScheduleRows,
} from "../schedule/scheduleRowRemeasure.js";
import {
  buildTimelineRowLayout,
  leaveMinHeightPx,
  resolveTimelineRowContentHeight,
  ROW_ALLOC_PAD,
} from "../schedule/timelineRowLayout.js";
import { ScheduleVirtualizedRows } from "../schedule/ScheduleVirtualizedRows.jsx";
import { ProjectModal } from "./ProjectsPage.jsx";
import { syncPersonAvailabilityFromForm } from "../lib/api/personAvailability.js";
import { previewAvailabilityHours } from "../utils/availabilityPreview.js";
import { WORKSPACE_THEME as T } from "../theme/workspacePalette.js";
import {
  BAR_H_BASE_PX,
  BAR_H_NORM,
  PX_PER_HOUR,
  allocationBarHeightPx,
  isFullDayLeaveAlloc,
  leaveBlockHeightPx,
  workTileHeightPxForDensity,
  clampedSegmentGeometry,
} from "../schedule/renderModel/index.js";
import {
  allocationBarBorderRadiusPx,
  allocationBarChromeStyles,
  allocationBarInnerWash,
  allocationCenterHoursHeroPx,
  allocationLoadFillTopAlpha,
  hexToRgba,
} from "../schedule/allocationBarVisuals.js";
import {
  avatarGradientFromName as avGrad,
  colorForAllocationBar,
  allocationBarForegroundColor,
  allocationProjectDisplay,
  projectCodeChipStyles,
  resolveColorForProjectLabel,
  projectToAllocationLabel,
} from "../utils/projectColors.js";
import { allocationHasPerson } from "../utils/allocationWorkMetrics.js";
import {
  buildExtendedAllocationPayload,
  listLatestEndBulkExtendCandidates,
} from "../utils/allocationBulkExtend.js";
import { buildSplitSegments } from "../utils/allocationSplit.js";
import { BulkExtendAllocationsDialog } from "../components/BulkExtendAllocationsDialog.jsx";
import { PublicHolidayTimelineTile } from "../components/schedule/PublicHolidayTimelineTile.jsx";
import { LeaveTimelineTile } from "../components/schedule/LeaveTimelineTile.jsx";
import { publicHolidayRegionBadge } from "../utils/publicHolidayDisplay.js";
import {
  leaveTypeShortLabel,
  computeLeaveTileTier,
  formatPartialLeaveHours,
} from "../utils/leaveTimelineDisplay.js";
import "../components/BulkExtendAllocationsPanel.css";
import { isStaticUi } from "../config/uiMode.js";
import { tagChromaProps } from "../utils/tagChroma.js";
import {
  SCHEDULE_SORT_OPTIONS,
  comparePeopleForScheduleSort,
} from "../utils/peopleSort.js";
import {
  personMatchesScheduleFilter,
  countActiveFilterRules,
  normalizeFilterRules,
} from "../utils/scheduleAllocationFilter.js";
import {
  findLeaveOverlapWithWorkRange,
  maxWorkHoursOnDayForPersonList,
} from "../utils/allocationLeaveConflict.js";
import { workAllocationCoversDateKey } from "../utils/allocationOccurrence.js";
import { buildAllocationsByPerson, getPersonAllocations } from "../utils/allocationsByPerson.js";
import { mergeScheduleAllocations } from "../utils/scheduleAllocationsMerge.js";
import { isSupabaseConfigured } from "../lib/supabase.js";
import {
  dismissPublicHolidayForPerson,
  publicHolidayDismissKeyFromAlloc,
} from "../lib/api/personPublicHolidays.js";
import {
  normalizeLeaveTypeId,
  leaveSpansToday,
  buildLeaveHoverTitle,
  isAvailabilityDayOffAlloc,
} from "../utils/leaveVisuals.js";
import {
  ALLOCATION_BOX_STYLE_CHANGED_EVENT,
  ALLOCATION_BOX_STYLE_LS_KEY,
  ALLOCATION_ENTER_ANIM_CHANGED_EVENT,
  ALLOCATION_ENTER_ANIM_LS_KEY,
  SCHEDULE_DENSITY_CHANGED_EVENT,
  SCHEDULE_DENSITY_LS_KEY,
  readAllocationBoxStyle,
  readAllocationEnterAnimation,
  readScheduleDensity,
  writeScheduleDensity,
} from "../config/scheduleUiPrefs.js";
import {
  ALLOC8_OPEN_COMMAND_PALETTE_EVENT,
  ALLOC8_ASSISTANT_OPEN_ALLOCATION_MODAL_EVENT,
  ALLOC8_ASSISTANT_CREATE_ALLOCATION_EVENT,
} from "../config/appKeyboardEvents.js";
import { useAssistantPageContext } from "../lib/assistant/alloc8Context.js";
import { usePremiumV2 } from "../context/PremiumV2Context.jsx";
import { useAppDialog } from "../context/AppDialogContext.jsx";
import "./LandingPage.css";
import "../styles/premium-schedule.css";

const VIEW_OPTIONS = [
  { id: "week", label: "Weeks" },
  { id: "month", label: "Months" },
];

const ini = (n) => {
  if (!n) return "";
  const p = String(n).trim().split(/\s+/);
  return p.length === 1
    ? (p[0][0] || "").toUpperCase()
    : `${p[0][0] || ""}${p[p.length - 1][0] || ""}`.toUpperCase();
};

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

/** Standard workday for width scaling in week/month view. */
const STANDARD_DAY_HOURS = 7.5;
function shortenAllocLabel(s, maxLen) {
  if (!s) return "";
  return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s;
}

function allocationAriaLabel(alloc, projects) {
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
  const { projectName, projectCode } = allocationProjectDisplay(alloc, projects);
  const label =
    projectCode && projectName
      ? `${projectCode} / ${projectName}`
      : projectName || projectCode || alloc.project || "Work";
  return `${label}, ${hStr} hours per day, ${range}. Open allocation details.`;
}

function buildScheduleModel(viewMode, anchorDate, offsets = { prev: 0, next: 0 }) {
  const d = new Date(anchorDate);
  const y = d.getFullYear();
  const mo = d.getMonth();

  let dates = [];
  let bandTitle = "";
  let anchorStartCol = 0;
  let anchorEndCol = -1;

  if (viewMode === "week") {
    for (let o = -offsets.prev; o <= offsets.next; o++) {
      const colStart = dates.length;
      const wStart = addDays(startOfWeekMonday(d), 7 * o);
      const wDates = [0, 1, 2, 3, 4].map((i) => addDays(wStart, i));
      dates.push(...wDates);
      if (o === 0) {
        bandTitle = `${formatDayMonth(wDates[0])} – ${formatDayMonthYear(wDates[4])}`;
        anchorStartCol = colStart;
        anchorEndCol = dates.length - 1;
      }
    }
  } else {
    for (let o = -offsets.prev; o <= offsets.next; o++) {
      const colStart = dates.length;
      const targetMonth = new Date(y, mo + o, 1);
      dates.push(
        ...weekdaysInMonth(targetMonth.getFullYear(), targetMonth.getMonth() + 1)
      );
      if (o === 0) {
        bandTitle = targetMonth.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
        anchorStartCol = colStart;
        anchorEndCol = dates.length - 1;
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
      anchorColumnRange: { startCol: 0, endCol: 0 },
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
    anchorColumnRange: { startCol: anchorStartCol, endCol: anchorEndCol },
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
      anchorColumnRange: { startCol: 0, endCol: 0 },
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
    anchorColumnRange: { startCol: 0, endCol: dates.length - 1 },
  };
}

function formatHourTotal(n) {
  return `${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}h`;
}

/** Date keys used for hour totals across the visible schedule slots. */
function visibleDateKeysForHours(scheduleModel) {
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

function computePersonHoursInViewFromList(personAllocations, scheduleModel) {
  const keys = visibleDateKeysForHours(scheduleModel);
  let t = 0;
  for (const dk of keys) {
    t += sumWorkHoursOnDayForPersonList(personAllocations, dk);
  }
  return t;
}

/** Peak booked work hours / day vs a full 7.5h target (fixed bar, not per-person capacity). */
const PEAK_LOAD_EPS = 0.02;

function classifyPeakDailyLoad(peakHours) {
  const T = STANDARD_DAY_HOURS;
  if (!Number.isFinite(peakHours) || peakHours < 0) return "none";
  if (peakHours > T + PEAK_LOAD_EPS) return "over";
  if (Math.abs(peakHours - T) <= PEAK_LOAD_EPS) return "onTarget";
  return "under";
}

function formatPeakHoursForCopy(peak) {
  if (!Number.isFinite(peak)) return "0";
  return peak.toFixed(peak % 1 ? 1 : 0);
}

function landingPageShortcutsConsumesKeydown(el) {
  const tag = el && el.tagName;
  return Boolean(
    el?.isContentEditable ||
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT"
  );
}

function peakLoadSummaryLine(loadBand, peakHours, target = STANDARD_DAY_HOURS) {
  const pf = formatPeakHoursForCopy(peakHours);
  if (loadBand === "over") return `Overallocated — peak ${pf}h/day vs ${target}h/day target.`;
  if (loadBand === "under") return `Underallocated — peak ${pf}h/day vs ${target}h/day target.`;
  if (loadBand === "onTarget") return `On target — peak ${pf}h/day (${target}h/day target).`;
  return "";
}

/**
 * Bar thickness scales linearly with hours: `height = BASE + hours * STEP`.
 * - BASE gives every bar (even 0.5h) enough room for the two-line compact layout.
 * - STEP makes each 0.5h step a clearly distinct jump in height, so the stacked
 *   column still reads as a proportional fill gauge.
 * A full 7.5h working day lands near `BASE + 7.5 * STEP` px; overloaded days
 * overflow visibly as the stack exceeds one cell's worth of height.
 */
const TABLE_ROW_ENTER_ANIM_MAX = 32;

/** Leave tile class + size styles (full-day column vs partial hours bar). */
function leaveTimelineBlockChrome(allocUi, { isDayOff, onToday, typeId, leaveBrPx }) {
  const fullDay = isDayOff || isFullDayLeaveAlloc(allocUi);
  const partialH = fullDay ? null : leaveBlockHeightPx(allocUi);
  const className =
    "lp-leave-block lp-leave-block--" +
    typeId +
    (onToday ? " lp-leave-block--today" : "") +
    (!isDayOff ? " lp-leave-block--leave-tile" : "") +
    (partialH != null ? " lp-leave-block--partial" : "");
  const sizeStyle =
    partialH != null
      ? {
          alignSelf: "start",
          height: `${partialH}px`,
          minHeight: `${partialH}px`,
          maxHeight: `${partialH}px`,
        }
      : {
          alignSelf: "stretch",
          height: "100%",
          minHeight: 0,
          maxHeight: "100%",
        };
  return {
    className,
    partialH,
    style: {
      gridRow: 1,
      width: "100%",
      minWidth: 0,
      justifySelf: "stretch",
      margin: 0,
      borderRadius: `${leaveBrPx}px`,
      overflow: "hidden",
      pointerEvents: "auto",
      ...sizeStyle,
    },
  };
}

function renderLeaveTimelineTile(allocUi, { colSpan, partialH }) {
  const notesTrim = (allocUi.notes || "").trim();
  return (
    <LeaveTimelineTile
      leaveTypeId={allocUi.leaveType}
      typeLabel={leaveTypeShortLabel(allocUi.leaveType)}
      notes={allocUi.notes}
      colSpan={colSpan}
      tier={computeLeaveTileTier({
        colSpan,
        blockHeightPx: partialH,
        hasNotes: notesTrim.length > 0,
        isPartial: partialH != null,
      })}
      isPartial={partialH != null}
      hoursLabel={partialH != null ? formatPartialLeaveHours(allocUi.hoursPerDay) : ""}
    />
  );
}

const timelineRowEqual = (prev, next) => {
  if (prev.p !== next.p) return false;
  if (prev.i !== next.i) return false;
  if (prev.viewMode !== next.viewMode) return false;
  if (prev.anchorDate?.getTime?.() !== next.anchorDate?.getTime?.()) return false;
  if (prev.utilizationMode !== next.utilizationMode) return false;
  if (prev.density !== next.density) return false;
  if (prev.gridTemplate !== next.gridTemplate) return false;
  if (prev.scheduleModel !== next.scheduleModel) return false;
  if (prev.projects !== next.projects) return false;
  if (prev.personAllocations !== next.personAllocations) return false;
  if (prev.dismissedAvailOffKeys !== next.dismissedAvailOffKeys) return false;
  if (prev.showPeakLoadStatus !== next.showPeakLoadStatus) return false;
  if (prev.allocationBoxStyle !== next.allocationBoxStyle) return false;
  if (prev.allocationEnterAnim !== next.allocationEnterAnim) return false;
  if (prev.freshEnteredAllocationKey !== next.freshEnteredAllocationKey) return false;
  if (prev.pendingAllocationKeys !== next.pendingAllocationKeys) return false;
  if (prev.premiumV2Enabled !== next.premiumV2Enabled) return false;

  return true;
};

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
  density,
  gridTemplate,
  nCols,
  openEdit,
  openCreateAllocation,
  openBulkExtend,
  openAllocationDetail,
  handleTimelineClick,
  todayDateKey,
  dismissedAvailOffKeys,
  showPeakLoadStatus,
  allocationBoxStyle,
  allocationEnterAnim,
  freshEnteredAllocationKey,
  pendingAllocationKeys,
  premiumV2Enabled,
}) {
  const { theme } = useAppTheme();
  const layoutColumnRange = useSyncExternalStore(
    subscribeLayoutColumnRange,
    getLayoutColumnRangeSnapshot
  );
  const t = T[theme];
  const reduceMotion = useReducedMotion();
  const lightInteraction = reduceMotion || isStaticUi();

  const enteredFreshSet = useMemo(
    () => new Set((freshEnteredAllocationKey || "").split("|").filter(Boolean)),
    [freshEnteredAllocationKey]
  );
  const pendingAllocSet = useMemo(
    () => parsePendingAllocationKeys(pendingAllocationKeys),
    [pendingAllocationKeys]
  );
  const wantsAllocEnterFx = !reduceMotion && allocationEnterAnim !== "instant";

  const hoursKeys = visibleDateKeysForHours(scheduleModel);
  const hours = computePersonHoursInViewFromList(personAllocations, scheduleModel);
  const maxDailyBookedHours = useMemo(() => {
    if (!hoursKeys.length) return 0;
    let mx = 0;
    for (const dk of hoursKeys) {
      mx = Math.max(mx, sumWorkHoursOnDayForPersonList(personAllocations, dk));
    }
    return mx;
  }, [hoursKeys, personAllocations, scheduleModel]);
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
    utilizationMode === "hours"
      ? `${maxDailyBookedHours.toFixed(maxDailyBookedHours % 1 ? 1 : 0)}h/d`
      : `${pct}%`;
  const noWorkingDaysInView = hoursKeys.length > 0 && rawCap < 1e-6;

  const showBulkExtendBtn = useMemo(
    () => listLatestEndBulkExtendCandidates(p.id, personAllocations).length >= 2,
    [p.id, personAllocations]
  );

  const peakLoadBand = useMemo(() => {
    if (noWorkingDaysInView || !hoursKeys.length) return "none";
    return classifyPeakDailyLoad(maxDailyBookedHours);
  }, [noWorkingDaysInView, hoursKeys.length, maxDailyBookedHours]);

  const peakLoadSummary = useMemo(() => {
    if (peakLoadBand === "none") return "";
    return peakLoadSummaryLine(peakLoadBand, maxDailyBookedHours);
  }, [peakLoadBand, maxDailyBookedHours]);

  const hoursToneClass =
    peakLoadBand !== "none" ? ` lp-person-hours--load-${peakLoadBand === "onTarget" ? "on" : peakLoadBand}` : "";

  const hoursHitTitle = useMemo(() => {
    const base =
      utilizationMode === "hours"
        ? `${hours.toFixed(hours % 1 ? 1 : 0)}h total in view · peak ${maxDailyBookedHours.toFixed(
            maxDailyBookedHours % 1 ? 1 : 0
          )}h/day`
        : `${pct}% utilization in view (peak ${maxDailyBookedHours.toFixed(maxDailyBookedHours % 1 ? 1 : 0)}h/day)`;
    return peakLoadSummary ? `${base}. ${peakLoadSummary}` : base;
  }, [utilizationMode, hours, maxDailyBookedHours, pct, peakLoadSummary]);

  const overAllocated = peakLoadBand === "over";

  const rowLayout = useMemo(
    () =>
      buildTimelineRowLayout({
        personAllocations,
        scheduleModel,
        dismissedAvailOffKeys,
        layoutColumnRange,
      }),
    [personAllocations, scheduleModel, dismissedAvailOffKeys, layoutColumnRange]
  );

  const {
    blockingLeaveAndHolidaySegments,
    publicHolidaySegments,
    leaveSegments,
    offDayColSet,
    workEnvelopeSegments,
    workSegments,
    segTopMap,
    schedAllocContentH,
    allocLaneCount,
    hasVisibleWorkSegments,
  } = rowLayout;

  const leaveMinH = leaveMinHeightPx(rowLayout, density);
  const timelineContentH = resolveTimelineRowContentHeight({
    schedAllocContentH,
    hasWorkSegments: hasVisibleWorkSegments,
    density,
    leaveMinH,
  });
  const isSparseRow = !hasVisibleWorkSegments && maxDailyBookedHours < 0.05;

  const paintWorkSegments = useMemo(() => {
    if (!isValidColumnRange(layoutColumnRange)) return workSegments;
    return workSegments.filter((seg) => segmentIntersectsColumnRange(seg, layoutColumnRange));
  }, [workSegments, layoutColumnRange]);

  // Dev-only invariants to catch geometry/stack bugs early (prevents "silent" canvas breakage).
  if (import.meta.env.DEV) {
    const colCount = Math.max(0, Math.floor(scheduleModel?.slots?.length || 0));
    const assertLayOk = (seg, kind) => {
      const st = Math.floor(seg?.lay?.start ?? -1);
      const sp = Math.floor(seg?.lay?.span ?? 0);
      if (colCount <= 0) return;
      if (!(Number.isFinite(st) && Number.isFinite(sp) && sp >= 0)) {
        throw new Error(`[Schedule] invalid ${kind} layout for ${p?.id || "?"}: start/span not finite`);
      }
      if (sp > 0 && (st < 0 || st >= colCount)) {
        throw new Error(`[Schedule] out-of-bounds ${kind} start for ${p?.id || "?"}: ${st}/${colCount}`);
      }
    };

    for (const s of workSegments) assertLayOk(s, "work");
    for (const s of leaveSegments) assertLayOk(s, "leave");
    for (const s of publicHolidaySegments) assertLayOk(s, "holiday");

    const stacks = workEnvelopeSegments.map((s) => s.stack).filter((n) => Number.isFinite(n));
    const maxStack = stacks.length ? Math.max(...stacks) : -1;
    for (const st of stacks) {
      if (st < 0 || st > maxStack) {
        throw new Error(`[Schedule] invalid lane index for ${p?.id || "?"}: ${st}`);
      }
    }
  }


  return (
    <div
      key={p.id}
      className={
        "lp-sched-row" +
        (overAllocated ? " lp-sched-row-overloaded" : "") +
        (isSparseRow ? " lp-sched-row--sparse" : "")
      }
      style={{ ["--animation-order"]: Math.min(i, TABLE_ROW_ENTER_ANIM_MAX) }}
    >
      <div className="lp-sched-person">
        <div className="lp-person-row-shell">
          <div className="lp-person-row-cluster">
            <div className="lp-person-row lp-person-row-main">
              <div
                className="lp-person-main-col"
                onClick={(e) => {
                  if (e.target.closest(".lp-person-add-banner, .lp-person-hours-hit")) return;
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
                  <span className="lp-person-identity-hit-inner">
                    <span className="lp-person-identity-top">
                      <span className="lp-avatar" style={{ background: avGrad(p.name) }}>
                        {ini(p.name)}
                      </span>
                      <span className="lp-person-meta">
                        <span className="lp-person-identity-stack">
                          <span className="lp-person-name-line">
                            <span className="lp-person-name" title={p.name}>
                              {p.name}
                            </span>
                            {showPeakLoadStatus && peakLoadBand !== "none" && (
                              <span className="lp-person-load-wrap" aria-hidden>
                                <span
                                  className={`lp-person-load-pip lp-person-load-pip--${peakLoadBand}`}
                                  aria-hidden
                                />
                              </span>
                            )}
                          </span>
                          <span
                            className="lp-person-sub"
                            title={[p.role !== "—" ? p.role : null, p.department || null]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          >
                            {p.role !== "—" ? `${p.role} · ` : ""}
                            {p.department || "—"}
                          </span>
                          <button
                            type="button"
                            className="lp-person-hours-hit lp-person-hours-hit--meta"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(p);
                            }}
                            title={hoursHitTitle}
                          >
                            <span className={"lp-person-hours" + hoursToneClass}>{right}</span>
                          </button>
                          {p.tags.length > 0 && (
                            <span className="lp-person-tags">
                              {p.tags.slice(0, 2).map((tag) => {
                                const tp = tagChromaProps(tag, theme === "dark", "lp-schedule-tag");
                                return (
                                  <span key={tag} className={tp.className} style={tp.style}>
                                    {tag}
                                  </span>
                                );
                              })}
                              {p.tags.length > 2 && <span className="lp-tag-more-pill">+{p.tags.length - 2}</span>}
                            </span>
                          )}
                          {premiumV2Enabled && !showPeakLoadStatus && peakLoadBand !== "none" && (
                            <span className="lp-person-v2-peak-micro" title={peakLoadSummary}>
                              Peak {formatPeakHoursForCopy(maxDailyBookedHours)}h/d ·{" "}
                              {peakLoadBand === "over"
                                ? "over typical"
                                : peakLoadBand === "under"
                                  ? "under typical"
                                  : "on target"}
                            </span>
                          )}
                        </span>
                      </span>
                    </span>
                    {showPeakLoadStatus && peakLoadBand !== "none" && (
                      <span className="lp-person-load-status-row">
                        <span
                          className={`lp-person-load-pop lp-person-load-pop--${peakLoadBand}`}
                          role="status"
                          aria-label={peakLoadSummary}
                        >
                          {peakLoadBand === "over"
                            ? "Overallocated"
                            : peakLoadBand === "under"
                              ? "Underallocated"
                              : "On target"}
                        </span>
                      </span>
                    )}
                  </span>
                </button>
                <div className="lp-person-add-banner">
                  {showBulkExtendBtn && openBulkExtend ? (
                    <button
                      type="button"
                      className="lp-sched-add-btn lp-sched-add-btn--inline lp-sched-bulk-extend-btn"
                      title={`Extend all project allocations for ${p.name}`}
                      aria-label={`Extend all allocations for ${p.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openBulkExtend(p);
                      }}
                    >
                      <ArrowRightToLine size={14} strokeWidth={2.25} />
                    </button>
                  ) : null}
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
        </div>
      </div>
      <div className="lp-sched-timeline">
        <div
          className="lp-grid-stack"
          style={{
            cursor: "pointer",
            ["--lp-alloc-lane-count"]: allocLaneCount,
            ["--lp-sched-alloc-content-h"]: `${timelineContentH}px`,
            ["--lp-leave-min-h"]: leaveMinH > 0 ? `${leaveMinH}px` : undefined,
          }}
          onClick={(e) => handleTimelineClick(e, p, nCols, offDayColSet)}
        >
          <div className="lp-grid-week-lanes" style={{ gridTemplateColumns: gridTemplate }} aria-hidden>
            {scheduleModel.slots.map((slot, idx) => (
              <div
                key={`lane-${p.id}-${idx}`}
                className={
                  "lp-week-lane" +
                  (slot.weekParity ? " lp-week-lane-b" : " lp-week-lane-a") +
                  (slot.weekBlockStart ? " lp-week-lane-block-start" : "") +
                  (slot.weekBlockEnd ? " lp-week-lane-block-end" : "")
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
                gridColumn: "1 / -1",
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: `${timelineContentH}px`,
                width: "100%",
                gap: 0,
                alignContent: "stretch",
                alignItems: "stretch",
                padding: 0,
                pointerEvents: "none",
                zIndex: 1,
                minWidth: 0,
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            >
              {lightInteraction ? (
                leaveSegments.map((seg) => {
                  const colStart = Math.max(1, Math.round(seg.lay.start) + 1);
                  const colSpan = Math.max(1, Math.round(seg.lay.span));
                  const leaveBrPx = allocationBarBorderRadiusPx(
                    (colSpan / Math.max(1, nCols)) * 100,
                    allocationBoxStyle
                  );
                  const isDayOff = isAvailabilityDayOffAlloc(seg.a);
                  const occStart = seg?.lay?.occStart ?? seg.a.startDate;
                  const occEnd = seg?.lay?.occEnd ?? seg.a.endDate;
                  const allocUi = isDayOff ? { ...seg.a, startDate: occStart, endDate: occEnd } : seg.a;
                  const dismissKey = isDayOff ? `${allocUi.personIds?.[0] ?? ""}|${allocUi.startDate}` : "";
                  if (isDayOff && dismissedAvailOffKeys && dismissedAvailOffKeys.has(dismissKey)) return null;

                  const typeId = isDayOff ? "day_off" : normalizeLeaveTypeId(allocUi.leaveType);
                  const onToday = leaveSpansToday(allocUi, todayDateKey);
                  const hoverTitle = buildLeaveHoverTitle(allocUi, leaveLabel);
                  const leaveChrome = leaveTimelineBlockChrome(allocUi, {
                    isDayOff,
                    onToday,
                    typeId,
                    leaveBrPx,
                  });
                  return (
                    <button
                      key={`${seg.a.id}-occ-${seg.occIdx}`}
                      type="button"
                      className={leaveChrome.className}
                      style={{
                        gridColumn: `${colStart} / span ${colSpan}`,
                        ...leaveChrome.style,
                      }}
                      aria-label={allocationAriaLabel(allocUi, projects)}
                      title={hoverTitle}
                      onClick={(e) => {
                        e.stopPropagation();
                        openAllocationDetail(allocUi);
                      }}
                    >
                      {isDayOff ? (
                        <span className="lp-leave-block__label">
                          <span>Off</span>
                        </span>
                      ) : (
                        renderLeaveTimelineTile(allocUi, {
                          colSpan,
                          partialH: leaveChrome.partialH,
                        })
                      )}
                    </button>
                  );
                })
              ) : (
              <AnimatePresence initial={false}>
                {leaveSegments.map((seg, segIdx) => {
                  const colStart = Math.max(1, Math.round(seg.lay.start) + 1);
                  const colSpan = Math.max(1, Math.round(seg.lay.span));
                  const leaveBrPx = allocationBarBorderRadiusPx(
                    (colSpan / Math.max(1, nCols)) * 100,
                    allocationBoxStyle
                  );
                  const isDayOff = isAvailabilityDayOffAlloc(seg.a);
                  const occStart = seg?.lay?.occStart ?? seg.a.startDate;
                  const occEnd = seg?.lay?.occEnd ?? seg.a.endDate;
                  const allocUi = isDayOff ? { ...seg.a, startDate: occStart, endDate: occEnd } : seg.a;
                  const dismissKey = isDayOff ? `${allocUi.personIds?.[0] ?? ""}|${allocUi.startDate}` : "";
                  if (isDayOff && dismissedAvailOffKeys && dismissedAvailOffKeys.has(dismissKey)) return null;

                  const typeId = isDayOff ? "day_off" : normalizeLeaveTypeId(allocUi.leaveType);
                  const onToday = leaveSpansToday(allocUi, todayDateKey);
                  const hoverTitle = buildLeaveHoverTitle(allocUi, leaveLabel);
                  const leaveChrome = leaveTimelineBlockChrome(allocUi, {
                    isDayOff,
                    onToday,
                    typeId,
                    leaveBrPx,
                  });
                  return (
                    <motion.button
                      key={`${seg.a.id}-occ-${seg.occIdx}`}
                      type="button"
                      layout={false}
                      className={leaveChrome.className}
                      style={{
                        gridColumn: `${colStart} / span ${colSpan}`,
                        ...leaveChrome.style,
                      }}
                      aria-label={allocationAriaLabel(allocUi, projects)}
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
                          : isDayOff
                            ? { opacity: 0, transition: { duration: 0 } }
                          : { opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.2 } }
                      }
                      whileHover={reduceMotion ? undefined : { scale: 1.015 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openAllocationDetail(allocUi);
                      }}
                    >
                      {isDayOff ? (
                        <span className="lp-leave-block__label">
                          <span>Off</span>
                        </span>
                      ) : (
                        renderLeaveTimelineTile(allocUi, {
                          colSpan,
                          partialH: leaveChrome.partialH,
                        })
                      )}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
              )}
            </div>
          )}

          <div
            className="lp-grid-row"
            style={{ 
              gridTemplateColumns: gridTemplate, 
              padding: 0, 
              alignContent: "start", 
              zIndex: 2,
              pointerEvents: "none" 
            }}
          >
            <div
              className="lp-alloc-lanes-root"
              style={{ gridColumn: "1 / -1", position: "relative", width: "100%", height: `${timelineContentH}px` }}
            >
              {paintWorkSegments.map((seg, segJ) => {
                    const stackIdx = seg.stack;
                    const topPx = segTopMap.get(seg.segKey) ?? (ROW_ALLOC_PAD / 2);
                    const geo = clampedSegmentGeometry(seg.lay, nCols);
                      const z = 20 + seg.stack * 20 + seg.occIdx + Math.floor(seg.lay.start);

                      const h = Math.max(0, parseFloat(seg.a.hoursPerDay) || 0);
                      const hnorm = Math.min(1, Math.max(0, h) / BAR_H_NORM);
                      const calculatedHeight = allocationBarHeightPx(seg.a);

                      const { projectName, projectCode, hoursLabel } = allocationProjectDisplay(
                        seg.a,
                        projects
                      );
                      const barColor = colorForAllocationBar(seg.a, projects);
                      const fg = allocationBarForegroundColor(theme, barColor);
                      const innerWash = allocationBarInnerWash(barColor, theme, allocationBoxStyle);

                      const brPx = allocationBarBorderRadiusPx(geo.widthPct, allocationBoxStyle);
                      // Every bar uses the same compact two-line layout with a
                      // consistent text style — short bars clip via overflow: hidden.
                      const compactBorder = calculatedHeight < 40;
                      const chrome = allocationBarChromeStyles(barColor, h, theme, {
                        thin: compactBorder,
                        boxStyle: allocationBoxStyle,
                      });

                      const repeatOn = (seg.a.repeatId ?? "none") !== "none";
                      const hasNotes = Boolean((seg.a.notes || "").trim());
                      const tip = buildWorkAllocationTitle(seg.a, projectName, hoursLabel);

                      const allocId = String(seg.a?.id ?? "");
                      const showFreshEnterAlloc = wantsAllocEnterFx && enteredFreshSet.has(allocId);
                      const enterDelayMs =
                        showFreshEnterAlloc && !reduceMotion ? stackIdx * 10 + segJ * 20 : undefined;

                      const baseStyle = {
                        position: "absolute",
                        left: `${geo.leftPct}%`,
                        width: `${geo.widthPct}%`,
                        top: `${topPx}px`,
                        zIndex: z,
                        // Pin a hard height so a 1h / 2h / 3h bar cannot grow to fit content —
                        // proportional scaling only reads clearly when the box is actually sized
                        // to the hour value and content clips via overflow: hidden. The CSS var
                        // pairs with an !important rule below to beat the .lp-block-alloc default.
                        "--alloc-bar-h": `${calculatedHeight}px`,
                        height: `${calculatedHeight}px`,
                        minHeight: `${calculatedHeight}px`,
                        maxHeight: `${calculatedHeight}px`,
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
                          "height 0.35s cubic-bezier(0.22, 1, 0.36, 1), left 0.35s cubic-bezier(0.22, 1, 0.36, 1), width 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease, transform 0.2s ease, filter 0.2s ease",
                        animationDelay:
                          enterDelayMs != null ? `${enterDelayMs}ms` : undefined,
                      };

                      return (
                        <button
                          key={seg.segKey}
                          type="button"
                          className={
                            "lp-block lp-block-alloc lp-block-alloc-project lp-alloc-bar" +
                            (compactBorder ? " lp-alloc-bar--compact" : "") +
                            (allocationBoxStyle === "center" ? " lp-alloc-bar--layout-center" : "") +
                            (showFreshEnterAlloc
                              ? ` lp-alloc-enter lp-alloc-enter--${allocationEnterAnim}`
                              : "") +
                            (pendingAllocSet.has(String(seg.a.id)) ? " lp-alloc-bar--pending" : "")
                          }
                          data-hours={h}
                          data-bar-h={calculatedHeight}
                          style={baseStyle}
                          aria-label={allocationAriaLabel(seg.a, projects)}
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
                              background: `linear-gradient(to top, ${hexToRgba(barColor, allocationLoadFillTopAlpha(theme, allocationBoxStyle))}, ${hexToRgba(barColor, 0)})`,
                              height: `${hnorm * 100}%`,
                            }}
                            aria-hidden
                          />
                          {allocationBoxStyle === "center" ? (
                            <span className="lp-alloc-bar__body lp-alloc-bar__body--center-hours">
                              {projectName || projectCode ? (
                                <span className="lp-alloc-bar__line lp-alloc-bar__line--name lp-alloc-bar__line--center-subtitle">
                                  {projectName || projectCode}
                                </span>
                              ) : null}
                              <span
                                className="lp-alloc-bar__hours-hero"
                                style={{
                                  fontSize: `${allocationCenterHoursHeroPx(calculatedHeight)}px`,
                                }}
                              >
                                {hoursLabel}
                              </span>
                              <span className="lp-alloc-bar__line lp-alloc-bar__line--meta lp-alloc-bar__line--center-meta">
                                {projectName && projectCode ? (
                                  <span
                                    className="lp-alloc-code-chip"
                                    style={projectCodeChipStyles(barColor, theme)}
                                  >
                                    {projectCode}
                                  </span>
                                ) : null}
                                {repeatOn || hasNotes ? (
                                  <span className="lp-alloc-bar__icons">
                                    {repeatOn ? (
                                      <Repeat2 size={10} strokeWidth={2.25} className="lp-alloc-bar__ic" aria-hidden />
                                    ) : null}
                                    {hasNotes ? (
                                      <StickyNote size={10} strokeWidth={2.25} className="lp-alloc-bar__ic" aria-hidden />
                                    ) : null}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                          ) : (
                            <span className="lp-alloc-bar__body">
                              {/* Consistent compact layout for EVERY bar, regardless of hours.
                                  Line 1: project name (truncated). Line 2: code chip + hours + icons.
                                  Short bars (e.g. 0.5h) clip via overflow: hidden; tall bars
                                  display the full two-line block. */}
                              <span className="lp-alloc-bar__line lp-alloc-bar__line--name">
                                {projectName || hoursLabel}
                              </span>
                              <span className="lp-alloc-bar__line lp-alloc-bar__line--meta">
                                {projectCode ? (
                                  <span
                                    className="lp-alloc-code-chip"
                                    style={projectCodeChipStyles(barColor, theme)}
                                  >
                                    {projectCode}
                                  </span>
                                ) : null}
                                <span className="lp-alloc-hours">{hoursLabel}</span>
                                {repeatOn || hasNotes ? (
                                  <span className="lp-alloc-bar__icons">
                                    {repeatOn ? (
                                      <Repeat2 size={10} strokeWidth={2.25} className="lp-alloc-bar__ic" aria-hidden />
                                    ) : null}
                                    {hasNotes ? (
                                      <StickyNote size={10} strokeWidth={2.25} className="lp-alloc-bar__ic" aria-hidden />
                                    ) : null}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                          )}
                        </button>
                      );
              })}
            </div>

            {publicHolidaySegments.length > 0 && (
              <div
                className="lp-public-holiday-overlay"
                style={{
                  gridColumn: "1 / -1",
                  display: "grid",
                  gridTemplateColumns: gridTemplate,
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: `${timelineContentH}px`,
                  width: "100%",
                  gap: 0,
                  alignContent: "stretch",
                  alignItems: "stretch",
                  padding: 0,
                  pointerEvents: "none",
                  zIndex: 2000,
                  minWidth: 0,
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                {publicHolidaySegments.map((seg) => {
                  const colStart = Math.max(1, Math.round(seg.lay.start) + 1);
                  const colSpan = Math.max(1, Math.round(seg.lay.span));
                  const phWidthPct = (colSpan / Math.max(1, nCols)) * 100;
                  const phBrPx = allocationBarBorderRadiusPx(phWidthPct, allocationBoxStyle);
                  const holidayLabel = seg.a.notes || "Public holiday";
                  const holidayHours = Math.max(0, parseFloat(seg.a.hoursPerDay) || 0);
                  const phDetailTitle = `${holidayLabel}${holidayHours > 0 ? ` · ${holidayHours}h` : ""} · Click for details`;

                  return (
                    <button
                      key={seg.segKey}
                      type="button"
                      className="lp-leave-block lp-leave-block--public_holiday lp-leave-block--public_holiday-tile"
                      style={{
                        gridColumn: `${colStart} / span ${colSpan}`,
                        gridRow: 1,
                        alignSelf: "stretch",
                        height: "100%",
                        minHeight: 0,
                        maxHeight: "100%",
                        width: "100%",
                        minWidth: 0,
                        justifySelf: "stretch",
                        pointerEvents: "auto",
                        margin: 0,
                        borderRadius: `${phBrPx}px`,
                        overflow: "hidden",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openAllocationDetail(seg.a);
                      }}
                      title={phDetailTitle}
                      aria-label={phDetailTitle}
                    >
                      <PublicHolidayTimelineTile
                        holidayName={holidayLabel}
                        regionBadge={publicHolidayRegionBadge(p)}
                        colSpan={colSpan}
                        segKey={seg.segKey}
                      />
                    </button>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}, timelineRowEqual);

export default function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useAppTheme();
  const t = T[theme];
  const setAlloc8FeedbackDock = useAlloc8ActionFeedbackMount();

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
    starredScheduleFilters,
    scheduleFilterRules,
    toggleStarredPersonTagPreset,
    saveCurrentFilterAsStarred,
    removeStarredFilterPreset,
    applyStarredFilterPreset,
    setScheduleFilterRules,
    syncPersonCreate,
    syncPersonUpdate,
    syncProjectCreate,
    syncAllocationCreate,
    syncAllocationUpdate,
    syncAllocationDelete,
    refreshWorkspaceFromSupabase,
    setPublicHolidayAllocations,
  } = useSchedulePageData();

  const { premiumV2Templates } = usePremiumV2();
  const premiumV2Enabled = false;
  const { openDialog } = useAppDialog();

  const [dismissedAvailOffKeys, setDismissedAvailOffKeys] = useState(() => {
    try {
      if (typeof window === "undefined") return new Set();
      const raw = window.localStorage.getItem("float.dismissedAvailOff.v1");
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr.map(String) : []);
    } catch {
      return new Set();
    }
  });

  const [dismissedPublicHolidayKeys, setDismissedPublicHolidayKeys] = useState(() => {
    try {
      if (typeof window === "undefined") return new Set();
      const raw = window.localStorage.getItem("float.dismissedPublicHoliday.v1");
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr.map(String) : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(
        "float.dismissedAvailOff.v1",
        JSON.stringify([...dismissedAvailOffKeys])
      );
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  }, [dismissedAvailOffKeys]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(
        "float.dismissedPublicHoliday.v1",
        JSON.stringify([...dismissedPublicHolidayKeys])
      );
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  }, [dismissedPublicHolidayKeys]);

  const visiblePublicHolidayAllocations = useMemo(() => {
    if (!dismissedPublicHolidayKeys.size) return publicHolidayAllocations;
    return publicHolidayAllocations.filter((a) => {
      const key = publicHolidayDismissKeyFromAlloc(a);
      return key && !dismissedPublicHolidayKeys.has(key);
    });
  }, [publicHolidayAllocations, dismissedPublicHolidayKeys]);

  const scheduleAllocations = useMemo(
    () => mergeScheduleAllocations(allocations, visiblePublicHolidayAllocations),
    [allocations, visiblePublicHolidayAllocations]
  );

  const allocationsByPerson = useMemo(
    () => buildAllocationsByPerson(scheduleAllocations),
    [scheduleAllocations]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [bulkExtendPerson, setBulkExtendPerson] = useState(null);

  const [viewMode, setViewMode] = useState("month");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [density, setDensity] = useState(() => readScheduleDensity());
  const [utilizationMode, setUtilizationMode] = useState("hours");
  const showPeakLoadStatus = false;
  const [allocationBoxStyle, setAllocationBoxStyle] = useState(() => readAllocationBoxStyle());
  const [allocationEnterAnim, setAllocationEnterAnim] = useState(() => readAllocationEnterAnimation());
  const [freshEnteredAllocationKey, setFreshEnteredAllocationKey] = useState("");
  const [pendingAllocationKeys, setPendingAllocationKeys] = useState("");
  const [scheduleTodayPulse, setScheduleTodayPulse] = useState(false);
  const [scheduleCanvasSettling, setScheduleCanvasSettling] = useState(false);
  const allocationEnterTimersRef = useRef(new Map());

  useEffect(() => {
    const sync = () => setDensity(readScheduleDensity());
    window.addEventListener(SCHEDULE_DENSITY_CHANGED_EVENT, sync);
    const onStorage = (e) => {
      if (e.key === SCHEDULE_DENSITY_LS_KEY || e.key == null) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SCHEDULE_DENSITY_CHANGED_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const sync = () => setAllocationBoxStyle(readAllocationBoxStyle());
    window.addEventListener(ALLOCATION_BOX_STYLE_CHANGED_EVENT, sync);
    const onStorage = (e) => {
      if (e.key === ALLOCATION_BOX_STYLE_LS_KEY || e.key == null) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ALLOCATION_BOX_STYLE_CHANGED_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const sync = () => setAllocationEnterAnim(readAllocationEnterAnimation());
    window.addEventListener(ALLOCATION_ENTER_ANIM_CHANGED_EVENT, sync);
    const onStorage = (e) => {
      if (e.key === ALLOCATION_ENTER_ANIM_LS_KEY || e.key == null) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ALLOCATION_ENTER_ANIM_CHANGED_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const tmt of allocationEnterTimersRef.current.values()) window.clearTimeout(tmt);
      allocationEnterTimersRef.current.clear();
    };
  }, []);

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
  const resetScheduleVerticalScrollRef = useRef(false);
  const scheduleRowVirtualizerRef = useRef(null);
  const prevTimelineOffsetsRef = useRef({ prev: 1, next: 2 });
  const scheduleHeaderRef = useRef(null);
  const scheduleHeaderInnerRef = useRef(null);
  const lastAnchorKey = useRef(null);

  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [densityOpen, setDensityOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);

  const [allocCreateOpen, setAllocCreateOpen] = useState(false);
  const [assistantExternalPrefill, setAssistantExternalPrefill] = useState(null);
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

  const scheduleModelForCanvas = useMemo(
    () => attachColumnIndex(scheduleModel),
    [scheduleModel]
  );

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
    () => visibleDateKeysForHours(scheduleModel),
    [scheduleModel]
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
      hoursMap.set(p.id, computePersonHoursInViewFromList(pa, scheduleModel));
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
  ]);

  /** Stable identity for virtualizer remeasure + scroll reset when filter/sort changes. */
  const schedulePeopleKey = useMemo(
    () => schedulePeople.map((p) => p.id).join("|"),
    [schedulePeople]
  );

  const scheduleFilterSig = useMemo(
    () =>
      normalizeFilterRules(scheduleFilterRules)
        .map((r) => `${r.field}:${r.op}:${String(r.value ?? "")}`)
        .join(","),
    [scheduleFilterRules]
  );

  useEffect(() => {
    setScheduleCanvasSettling(true);
    const t = window.setTimeout(() => setScheduleCanvasSettling(false), 300);
    return () => window.clearTimeout(t);
  }, [schedulePeopleKey, scheduleSort, scheduleFilterSig]);

  const projectByLabel = useMemo(() => {
    const m = new Map();
    for (const p of projects) {
      m.set(projectToAllocationLabel(p), p);
    }
    return m;
  }, [projects]);

  const scheduleFilterActiveCount = countActiveFilterRules(scheduleFilterRules);

  useAssistantPageContext("schedule", {
    visibleCount: schedulePeople.length,
    totalPeople: people.length,
    emptyResults: schedulePeople.length === 0 && people.length > 0,
    activeFilterCount: scheduleFilterActiveCount,
  });

  const deptDashboardEnabled = useMemo(() => {
    const norm = normalizeFilterRules(scheduleFilterRules);
    return norm.some((r) => r.field === "department");
  }, [scheduleFilterRules]);

  const applySavedStarredFilter = useCallback(
    (presetId) => {
      applyStarredFilterPreset(presetId);
      setStarredPopoverOpen(false);
    },
    [applyStarredFilterPreset]
  );

  const visibleCapacityDays = useMemo(
    () => Math.max(1, visibleDateKeysForHours(scheduleModel).length),
    [scheduleModel]
  );

  const totalHours = useMemo(() => {
    let s = 0;
    for (const p of schedulePeople) {
      s += schedulePeopleHoursInView.get(p.id) ?? 0;
    }
    return s;
  }, [schedulePeople, schedulePeopleHoursInView]);

  const teamCapacityHours = useMemo(() => {
    const keys = visibleDateKeysForHours(scheduleModel);
    let cap = 0;
    for (const p of schedulePeople) {
      const pa = getPersonAllocations(allocationsByPerson, p.id);
      for (const dk of keys) {
        cap += maxWorkHoursOnDayForPersonList(pa, dk, STANDARD_DAY_HOURS);
      }
    }
    return Math.max(STANDARD_DAY_HOURS, cap);
  }, [schedulePeople, allocationsByPerson, scheduleModel]);

  const teamUtilPercent = useMemo(
    () => (teamCapacityHours > 0 ? Math.min(100, Math.round((totalHours / teamCapacityHours) * 100)) : 0),
    [totalHours, teamCapacityHours]
  );

  const showV2GettingStartedBanner = useMemo(
    () =>
      premiumV2Enabled &&
      schedulePeople.length > 0 &&
      visibleCapacityDays > 0 &&
      totalHours <= 1e-6,
    [premiumV2Enabled, schedulePeople.length, visibleCapacityDays, totalHours]
  );

  const scheduleMotionKey = useMemo(() => {
    if (customRange?.start && customRange?.end) {
      return `cr-${customRange.start}-${customRange.end}`;
    }
    if (viewMode === "week") return `w-${weekMondayKey(anchorDate)}`;
    return `m-${anchorDate.getFullYear()}-${anchorDate.getMonth() + 1}`;
  }, [viewMode, anchorDate, customRange]);

  useEffect(() => {
    if (!premiumV2Enabled) return undefined;
    const onKeyDown = (e) => {
      if (landingPageShortcutsConsumesKeydown(document.activeElement)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") {
        e.preventDefault();
        openDialog({
          title: "Schedule v2 shortcuts",
          message: [
            "? — Opens this shortcuts list.",
            "/ — Opens the command palette (same as ⌘K or Ctrl+K).",
            "After saving a new allocation or leave — use Undo on the toast to remove it.",
            "Create modal — bundled templates plus suggested hours/day from recent work.",
            "Holiday overlaps — labelled chips listing public holidays in the draft range.",
          ].join("\n\n"),
        });
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(ALLOC8_OPEN_COMMAND_PALETTE_EVENT));
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [premiumV2Enabled, openDialog]);

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
    if (viewMode === "week") setAnchorDate((d) => addDays(startOfWeekMonday(d), -7));
    else setAnchorDate((d) => addMonths(d, -1));
    lastAnchorKey.current = null;
  }, [viewMode]);

  const navigateNext = useCallback(() => {
    setCustomRange(null);
    setTimeRangePreset(null);
    if (viewMode === "week") setAnchorDate((d) => addDays(startOfWeekMonday(d), 7));
    else setAnchorDate((d) => addMonths(d, 1));
    lastAnchorKey.current = null;
  }, [viewMode]);

  const goToday = useCallback(() => {
    setCustomRange(null);
    setTimeRangePreset(null);
    setAnchorDate(new Date());
    setTimelineOffsets({ prev: 1, next: 2 });
    resetScheduleVerticalScrollRef.current = true;
    lastAnchorKey.current = null;
    setScheduleTodayPulse(true);
    window.setTimeout(() => setScheduleTodayPulse(false), 2200);
  }, []);

  const registerScheduleRowVirtualizer = useCallback((instance) => {
    scheduleRowVirtualizerRef.current = instance;
    if (instance?.measure) {
      instance.measure();
      requestAnimationFrame(() => {
        instance.measure();
        instance.scrollToIndex?.(0, { align: "start" });
      });
    }
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

  useEffect(() => {
    const action = location.state?.quickCreate;
    if (!action) return;

    if (action === "allocation") {
      openCreateAllocation(null);
    } else if (action === "leave") {
      openCreateLeaveForPerson(null);
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate, openCreateAllocation, openCreateLeaveForPerson]);

  const closeCreateAllocation = useCallback(() => {
    setAllocCreateOpen(false);
    setAllocEditing(null);
    setAllocPreselectPerson(null);
    setAllocPreselectDate(null);
    setAllocPreselectProject(null);
    setAllocDefaultTab("allocation");
    setAssistantExternalPrefill(null);
  }, []);

  const pulseFreshAllocationTile = useCallback(
    (allocId) => {
      const id = String(allocId || "");
      if (!id || allocationEnterAnim === "instant") return;

      const existing = allocationEnterTimersRef.current.get(id);
      if (existing != null) window.clearTimeout(existing);

      setFreshEnteredAllocationKey((k) => {
        const s = new Set((k || "").split("|").filter(Boolean));
        s.add(id);
        return [...s].sort().join("|");
      });

      const tmt = window.setTimeout(() => {
        allocationEnterTimersRef.current.delete(id);
        setFreshEnteredAllocationKey((k) => {
          const s = new Set((k || "").split("|").filter(Boolean));
          s.delete(id);
          return [...s].sort().join("|");
        });
      }, 920);

      allocationEnterTimersRef.current.set(id, tmt);
    },
    [allocationEnterAnim]
  );

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
      openCreateAllocation(person, clickedDate);
    },
    [scheduleModel, openCreateAllocation]
  );

  const handleCreateAllocation = useCallback(
    async (payload) => {
      // ── Allow allocations across leave: skip off-days in totals, warn instead of blocking ──
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
            toast.warning(`Allocation includes time off for ${personName}`, {
              description: `${leaveTypeName} (${rangeLabel}). Allocation will still be created; off days are skipped in working-day totals.`,
              duration: 4200,
            });
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

      setAllocations((prev) => [...prev, createdDraft]);
      setPendingAllocationKeys((k) => addPendingAllocationKey(k, createdDraft.id));

      try {
        const saved = isSupabaseConfigured ? await syncAllocationCreate(createdDraft) : createdDraft;
        setAllocations((prev) =>
          prev.map((a) => (a.id === createdDraft.id ? saved : a))
        );
        setPendingAllocationKeys((k) =>
          replacePendingAllocationKey(k, createdDraft.id, saved.id)
        );
        if (!payload.isLeave) pulseFreshAllocationTile(saved.id);

        const saveSubtitle = payload.isLeave
          ? `${payload.startDate} → ${payload.endDate}`
          : `${shortenAllocLabel(payload.project, 42)} · ${Number(payload.hoursPerDay) || 0}h/day`;
        const runUndo = () => {
          void (async () => {
            const uid = saved.id;
            setAllocations((cur) => cur.filter((a) => a.id !== uid));
            try {
              if (isSupabaseConfigured) await syncAllocationDelete(uid);
              showCenterActionFeedback({
                action: "remove",
                title: "Undone",
                subtitle: "Removed what you had just saved.",
              });
            } catch (err) {
              setAllocations((cur) => (cur.some((a) => a.id === uid) ? cur : [...cur, saved]));
              toast.error("Undo failed", { description: err?.message || String(err) });
            }
          })();
        };

        if (premiumV2Enabled && saved?.id) {
          showAdminAllocationPulse({
            action: "add",
            title: payload.isLeave ? "Leave saved" : "Saved",
            subtitle: saveSubtitle,
            duration: 4200,
            onUndo: runUndo,
          });
        } else {
          showCenterActionFeedback({
            action: "add",
            title: payload.isLeave ? "Leave saved" : "Saved",
            subtitle: saveSubtitle,
          });
        }
      } catch (e) {
        setAllocations((prev) => prev.filter((a) => a.id !== createdDraft.id));
        setPendingAllocationKeys((k) => removePendingAllocationKey(k, createdDraft.id));
        toast.error("Save failed", { description: e?.message || String(e) });
      }
    },
    [
      setAllocations,
      projects,
      allocationsByPerson,
      people,
      syncAllocationCreate,
      pulseFreshAllocationTile,
      premiumV2Enabled,
      isSupabaseConfigured,
      syncAllocationDelete,
    ]
  );

  useEffect(() => {
    const onOpenModal = (e) => {
      const d = e.detail || {};
      const person = people.find((p) => String(p.id) === String(d.personId));
      setAssistantExternalPrefill(d);
      setAllocEditing(null);
      setAllocDefaultTab("allocation");
      setAllocPreselectPerson(person ?? null);
      setAllocPreselectDate(d.startDate ?? null);
      setAllocPreselectProject(d.project ?? null);
      setAllocCreateOpen(true);
    };

    const onCreateDirect = (e) => {
      const d = e.detail || {};
      if (!d.personId || !d.startDate || !d.endDate) return;
      void handleCreateAllocation({
        personIds: [d.personId],
        startDate: d.startDate,
        endDate: d.endDate,
        hoursPerDay: Number(d.hoursPerDay) || 7.5,
        project: d.project || "Work",
        repeatId: "none",
        notes: "",
      });
    };

    window.addEventListener(ALLOC8_ASSISTANT_OPEN_ALLOCATION_MODAL_EVENT, onOpenModal);
    window.addEventListener(ALLOC8_ASSISTANT_CREATE_ALLOCATION_EVENT, onCreateDirect);
    return () => {
      window.removeEventListener(ALLOC8_ASSISTANT_OPEN_ALLOCATION_MODAL_EVENT, onOpenModal);
      window.removeEventListener(ALLOC8_ASSISTANT_CREATE_ALLOCATION_EVENT, onCreateDirect);
    };
  }, [people, handleCreateAllocation]);

  const handleEditAllocation = useCallback(
    async (payload, id) => {
      // ── Allow allocations across leave: skip off-days in totals, warn instead of blocking ──
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
            toast.warning(`Allocation includes time off for ${personName}`, {
              description: `${leaveTypeName} (${rangeLabel}). Allocation will still be saved; off days are skipped in working-day totals.`,
              duration: 4200,
            });
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

      setAllocations((prev) => prev.map((a) => (a.id === id ? merged : a)));
      setSelectedAllocation((prev) => (prev && prev.id === id ? merged : prev));
      setPendingAllocationKeys((k) => addPendingAllocationKey(k, id));

      try {
        const saved = isSupabaseConfigured ? await syncAllocationUpdate(merged) : merged;
        setAllocations((prev) => prev.map((a) => (a.id === id ? saved : a)));
        setSelectedAllocation((prev) => (prev && prev.id === id ? saved : prev));
        setPendingAllocationKeys((k) => removePendingAllocationKey(k, id));
        if (!payload.isLeave) pulseFreshAllocationTile(id);
        showCenterActionFeedback({
          action: "update",
          title: payload.isLeave ? "Leave updated" : "Updated",
          subtitle: payload.isLeave
            ? `${payload.startDate} → ${payload.endDate}`
            : `${shortenAllocLabel(payload.project, 42)} · ${Number(payload.hoursPerDay) || 0}h/day`,
        });
        return true;
      } catch (e) {
        setPendingAllocationKeys((k) => removePendingAllocationKey(k, id));
        if (prevAlloc) {
          setAllocations((prev) => prev.map((a) => (a.id === id ? prevAlloc : a)));
          setSelectedAllocation((prev) => (prev && prev.id === id ? prevAlloc : prev));
        }
        if (e?.name === "OptimisticLockError") {
          toast.error("Someone else edited this allocation", {
            description: "Refreshing the schedule from the server.",
          });
          refreshWorkspaceFromSupabase().catch(() => {});
        } else {
          toast.error("Update failed", { description: e?.message || String(e) });
        }
        return false;
      }
    },
    [
      setAllocations,
      setSelectedAllocation,
      projects,
      allocationsByPerson,
      people,
      syncAllocationUpdate,
      refreshWorkspaceFromSupabase,
      scheduleAllocations,
      pulseFreshAllocationTile,
    ]
  );

  const bulkExtendCtx = useMemo(
    () => ({
      allocations: scheduleAllocations,
      publicHolidayAllocations: visiblePublicHolidayAllocations,
      projects,
    }),
    [scheduleAllocations, visiblePublicHolidayAllocations, projects]
  );

  const handleExtendAllocation = useCallback(
    async (alloc, newEndDateKey) => {
      const isoEnd = String(newEndDateKey || "").slice(0, 10);
      if (!isoEnd) return false;
      const payload = buildExtendedAllocationPayload(alloc, isoEnd, bulkExtendCtx);
      return handleEditAllocation(payload, alloc.id);
    },
    [handleEditAllocation, bulkExtendCtx]
  );

  const warnLeaveOverlapForWorkPayload = useCallback(
    (payload, excludeAllocId) => {
      const pStart = payload.startDate;
      const pEnd = payload.endDate;
      for (const pid of payload.personIds || []) {
        let leaveConflict = null;
        let overlap = null;
        for (const a of getPersonAllocations(allocationsByPerson, pid)) {
          if (excludeAllocId && a.id === excludeAllocId) continue;
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
          toast.warning(`Allocation includes time off for ${personName}`, {
            description: `${leaveTypeName} (${rangeLabel}). Off days are skipped in working-day totals.`,
            duration: 4200,
          });
        }
      }
    },
    [allocationsByPerson, people]
  );

  const handleSplitAllocation = useCallback(
    async (alloc, input) => {
      const built = buildSplitSegments(alloc, input, bulkExtendCtx);
      if (built.error) {
        toast.error(built.error);
        return false;
      }

      const prevAlloc = scheduleAllocations.find((a) => a.id === alloc.id) || alloc;
      const payloads = [
        built.originalMerged,
        ...built.creates.map((c) => ({
          personIds: c.personIds,
          startDate: c.startDate,
          endDate: c.endDate,
        })),
      ];
      for (const p of payloads) {
        warnLeaveOverlapForWorkPayload(
          { personIds: p.personIds, startDate: p.startDate, endDate: p.endDate },
          alloc.id
        );
      }

      const createdSaved = [];

      try {
        const savedOriginal = isSupabaseConfigured
          ? await syncAllocationUpdate(built.originalMerged)
          : built.originalMerged;
        setAllocations((prev) => prev.map((a) => (a.id === alloc.id ? savedOriginal : a)));

        for (const draft of built.creates) {
          const createdDraft = {
            id:
              typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `tmp_${Date.now()}_${createdSaved.length}`,
            ...draft,
          };
          try {
            const saved = isSupabaseConfigured
              ? await syncAllocationCreate(createdDraft)
              : createdDraft;
            createdSaved.push(saved);
            setAllocations((prev) => [...prev, saved]);
            pulseFreshAllocationTile(saved.id);
          } catch (createErr) {
            try {
              if (isSupabaseConfigured) {
                await syncAllocationUpdate(prevAlloc);
              }
              setAllocations((prev) => {
                let next = prev.map((a) => (a.id === alloc.id ? prevAlloc : a));
                for (const s of createdSaved) {
                  next = next.filter((a) => a.id !== s.id);
                }
                return next;
              });
              for (const s of createdSaved) {
                if (isSupabaseConfigured) {
                  await syncAllocationDelete(s.id).catch(() => {});
                }
              }
            } catch {
              refreshWorkspaceFromSupabase().catch(() => {});
            }
            toast.error("Split failed", {
              description: createErr?.message || String(createErr),
            });
            return false;
          }
        }

        const rangeBits = [
          `${built.originalMerged.startDate} → ${built.originalMerged.endDate}`,
          ...createdSaved.map((s) => `${s.startDate} → ${s.endDate}`),
        ];
        showCenterActionFeedback({
          action: "update",
          title: "Split allocation",
          subtitle: `${shortenAllocLabel(built.originalMerged.project, 28)} · ${rangeBits.length} segments`,
        });
        setAllocDetailOpen(false);
        setSelectedAllocation(null);
        return true;
      } catch (e) {
        if (e?.name === "OptimisticLockError") {
          toast.error("Someone else edited this allocation", {
            description: "Refreshing the schedule from the server.",
          });
          refreshWorkspaceFromSupabase().catch(() => {});
        } else {
          toast.error("Split failed", { description: e?.message || String(e) });
        }
        return false;
      }
    },
    [
      bulkExtendCtx,
      scheduleAllocations,
      warnLeaveOverlapForWorkPayload,
      syncAllocationUpdate,
      syncAllocationCreate,
      syncAllocationDelete,
      isSupabaseConfigured,
      setAllocations,
      pulseFreshAllocationTile,
      setAllocDetailOpen,
      setSelectedAllocation,
      refreshWorkspaceFromSupabase,
    ]
  );

  const handleDeleteAllocation = useCallback(
    async (alloc) => {
      if (isAvailabilityDayOffAlloc(alloc)) {
        const pid = alloc?.personIds?.[0] ?? "";
        const dk = String(alloc?.startDate ?? "").slice(0, 10);
        if (pid && dk) {
          const key = `${pid}|${dk}`;
          setDismissedAvailOffKeys((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
          });
          showCenterActionFeedback({
            action: "remove",
            title: "Removed",
            subtitle: "That day is hidden. Weekly availability stays unchanged.",
          });
        } else {
          toast.error("Couldn't remove this block");
        }
        return;
      }
      if (alloc?.syntheticPublicHoliday) {
        const pid = alloc.personIds?.[0];
        if (!pid) return;
        const dismissKey = publicHolidayDismissKeyFromAlloc(alloc);
        let removedHoliday = null;
        if (dismissKey) {
          setDismissedPublicHolidayKeys((prev) => {
            const next = new Set(prev);
            next.add(dismissKey);
            return next;
          });
        }
        setPublicHolidayAllocations((cur) => {
          removedHoliday = cur.find((a) => a.id === alloc.id) || null;
          return cur.filter((a) => a.id !== alloc.id);
        });
        if (!isSupabaseConfigured) {
          showCenterActionFeedback({
            action: "remove",
            title: "Removed",
            subtitle: "This public holiday is hidden for this person only. Other holidays are unchanged.",
          });
          return;
        }
        try {
          await dismissPublicHolidayForPerson({
            personId: pid,
            holidayDate: alloc.startDate,
            name: alloc.notes,
          });
          await refreshWorkspaceFromSupabase();
          showCenterActionFeedback({
            action: "remove",
            title: "Removed",
            subtitle: "This public holiday is hidden for this person only. Other holidays are unchanged.",
          });
        } catch (e) {
          if (dismissKey) {
            setDismissedPublicHolidayKeys((prev) => {
              const next = new Set(prev);
              next.delete(dismissKey);
              return next;
            });
          }
          if (removedHoliday) {
            setPublicHolidayAllocations((cur) => {
              if (cur.some((a) => a.id === removedHoliday.id)) return cur;
              return [...cur, removedHoliday];
            });
          }
          toast.error("Delete failed", { description: e?.message || String(e) });
        }
        return;
      }
      const prev = alloc;
      setAllocations((cur) => cur.filter((a) => a.id !== alloc.id));
      try {
        if (isSupabaseConfigured) await syncAllocationDelete(alloc.id);
        showCenterActionFeedback({
          action: "remove",
          title: "Removed",
          subtitle: "Allocation removed from the schedule.",
        });
      } catch (e) {
        setAllocations((cur) => [...cur, prev]);
        toast.error("Delete failed", { description: e?.message || String(e) });
      }
    },
    [
      setAllocations,
      setPublicHolidayAllocations,
      syncAllocationDelete,
      refreshWorkspaceFromSupabase,
      setDismissedAvailOffKeys,
      setDismissedPublicHolidayKeys,
    ]
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

  const canManageSelectedAllocation = useMemo(() => {
    if (!selectedAllocation || selectedAllocation.syntheticPublicHoliday) return false;
    const ids =
      selectedAllocation.personIds?.length > 0
        ? selectedAllocation.personIds
        : selectedAllocation.personId != null
          ? [selectedAllocation.personId]
          : [];
    return ids.length > 0;
  }, [selectedAllocation]);

  const canDeleteSelectedAllocation = useMemo(() => {
    if (!selectedAllocation) return false;
    if (selectedAllocation.syntheticPublicHoliday) {
      return (selectedAllocation.personIds?.length ?? 0) > 0;
    }
    return canManageSelectedAllocation;
  }, [selectedAllocation, canManageSelectedAllocation]);

  /** Scope extend/off-day math to assignees — not the full workspace allocation list. */
  /** Smaller list for create/edit modal conflict checks when one person is preselected. */
  const createModalAllocations = useMemo(() => {
    if (!allocCreateOpen && !allocEditing) return [];
    const person = allocPreselectPerson ?? (allocEditing ? people.find((x) => {
      const ids =
        allocEditing.personIds?.length > 0
          ? allocEditing.personIds
          : allocEditing.personId != null
            ? [allocEditing.personId]
            : [];
      return ids.length ? x.id === ids[0] : false;
    }) : null);
    if (person?.id != null) {
      return getPersonAllocations(allocationsByPerson, person.id);
    }
    return scheduleAllocations;
  }, [
    allocCreateOpen,
    allocEditing,
    allocPreselectPerson,
    allocationsByPerson,
    scheduleAllocations,
    people,
  ]);

  const detailModalAllocations = useMemo(() => {
    if (!selectedAllocation) return [];
    const ids =
      selectedAllocation.personIds?.length > 0
        ? selectedAllocation.personIds.map(String)
        : selectedAllocation.personId != null
          ? [String(selectedAllocation.personId)]
          : [];
    if (ids.length === 0) return scheduleAllocations;
    return scheduleAllocations.filter((a) => ids.some((id) => allocationHasPerson(a, id)));
  }, [selectedAllocation, scheduleAllocations]);

  const handleDetailEditClick = useCallback(() => {
    if (!canManageSelectedAllocation || !selectedAllocation) return;
    setAllocEditing(selectedAllocation);
    setAllocDetailOpen(false);
    setAllocCreateOpen(true);
  }, [canManageSelectedAllocation, selectedAllocation]);

  const openEdit = useCallback((person) => {
    setEditingPerson(person);
    setModalOpen(true);
  }, []);

  const openBulkExtend = useCallback((person) => {
    setBulkExtendPerson(person);
  }, []);

  const closeBulkExtend = useCallback(() => {
    setBulkExtendPerson(null);
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
        showCenterActionFeedback({
          action: "update",
          title: "Updated",
          subtitle: (form.name || editingPerson.name || "").trim() || "Person",
        });
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
        showCenterActionFeedback({
          action: "add",
          title: "Saved",
          subtitle: (form.name || "").trim() || "New person",
        });
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
      showCenterActionFeedback({
        action: "update",
        title: next.archived ? "Archived" : "Restored",
        subtitle: editingPerson.name,
      });
      setModalOpen(false);
      setEditingPerson(null);
    } catch (e) {
      setPeople(people.map((p) => (p.id === editingPerson.id ? editingPerson : p)));
      toast.error("Update failed", { description: e?.message || String(e) });
    }
  };

  const viewLabel = VIEW_OPTIONS.find((v) => v.id === viewMode)?.label ?? "Months";

  const colMinPx =
    scheduleModel.columnCount > 28
      ? 88
      : viewMode === "week"
        ? 150
        : 105;
  const gridTemplate = `repeat(${scheduleModel.columnCount}, minmax(${colMinPx}px, 1fr))`;
  const timelineMinWidthPx = scheduleModel.columnCount * colMinPx;

  const layoutColumnRangeRef = useRef(
    getEffectiveLayoutColumnRange(scheduleModel, null)
  );
  const scheduleRowHeightRevisionRef = useRef("");

  const syncLayoutColumnRange = useCallback(() => {
    const el = scheduleViewportRef.current;
    const next = el
      ? readLayoutColumnRangeFromViewport(el, scheduleModel, colMinPx)
      : getEffectiveLayoutColumnRange(scheduleModel, null);
    if (!publishLayoutColumnRange(next)) return false;
    layoutColumnRangeRef.current = next;
    return true;
  }, [scheduleModel, colMinPx]);

  useLayoutEffect(() => {
    const next = getEffectiveLayoutColumnRange(scheduleModel, null);
    layoutColumnRangeRef.current = next;
    publishLayoutColumnRange(next);
  }, [scheduleModel.anchorDateKey, scheduleModel.columnCount]);

  const scheduleRowEstimatePx = useMemo(() => {
    if (density === "compact") return 116;
    if (density === "spacious") return 140;
    return 126;
  }, [density]);

  const scheduleAnchorJumpKey = useMemo(
    () =>
      `${scheduleModel.anchorDateKey}|${scheduleModel.columnCount}|${customRange?.start ?? ""}|${customRange?.end ?? ""}`,
    [scheduleModel.anchorDateKey, scheduleModel.columnCount, customRange]
  );

  const scheduleRowHeightRevision = useMemo(
    () =>
      `${scheduleAnchorJumpKey}|${scheduleAllocations.length}|${visiblePublicHolidayAllocations.length}|${dismissedAvailOffKeys?.size ?? 0}`,
    [
      scheduleAnchorJumpKey,
      scheduleAllocations.length,
      visiblePublicHolidayAllocations.length,
      dismissedAvailOffKeys,
    ]
  );

  useEffect(() => {
    scheduleRowHeightRevisionRef.current = scheduleRowHeightRevision;
    setScheduleRowHeightRevision(scheduleRowHeightRevision);
  }, [scheduleRowHeightRevision]);

  const resolveScheduleRowHeightPx = useMemo(
    () =>
      buildScheduleRowHeightResolver({
        schedulePeople,
        getPersonAllocations,
        allocationsByPerson,
        scheduleModel: scheduleModelForCanvas,
        density,
        dismissedAvailOffKeys,
        layoutColumnRangeRef,
        layoutRevisionRef: scheduleRowHeightRevisionRef,
        fallbackPx: scheduleRowEstimatePx,
      }),
    [
      schedulePeople,
      allocationsByPerson,
      scheduleModelForCanvas,
      density,
      dismissedAvailOffKeys,
      scheduleRowEstimatePx,
    ]
  );

  const estimateScheduleRowSize = useCallback(
    (index) => resolveScheduleRowHeightPx(index),
    [resolveScheduleRowHeightPx]
  );

  const remeasureScheduleRows = useCallback(() => {
    const v = scheduleRowVirtualizerRef.current;
    if (!v) return;
    const sizeByIndex = new Map(v.getVirtualItems().map((item) => [item.index, item.size]));
    remeasureVisibleScheduleRows(v, {
      indices: collectVirtualRowIndices(v),
      sizeByIndex,
      getRowHeightPx: resolveScheduleRowHeightPx,
    });
  }, [resolveScheduleRowHeightPx]);

  const queueRemeasureScheduleRows = useCallback(() => {
    queueScheduleRowRemeasure(remeasureScheduleRows);
  }, [remeasureScheduleRows]);

  const syncLayoutColumnRangeAndRemeasure = useCallback(() => {
    if (syncLayoutColumnRange()) queueRemeasureScheduleRows();
  }, [syncLayoutColumnRange, queueRemeasureScheduleRows]);

  const { onTimelineScroll } = useTimelineScrollController({
    scheduleViewportRef,
    scheduleHeaderInnerRef,
    scheduleModel,
    colMinPx,
    timelineOffsets,
    setTimelineOffsets,
    prevOffsetsRef: prevOffsets,
    prevColCountRef: prevColCount,
    lastAnchorKeyRef: lastAnchorKey,
    onLayoutRangeSync: syncLayoutColumnRangeAndRemeasure,
  });

  useEffect(() => () => cancelScheduledRowRemeasure(), []);

  const timelineRowProps = useMemo(
    () => ({
      projects,
      scheduleModel: scheduleModelForCanvas,
      viewMode,
      anchorDate,
      utilizationMode,
      density,
      gridTemplate,
      nCols: scheduleModel.columnCount,
      openEdit,
      openCreateAllocation,
      openBulkExtend,
      openAllocationDetail,
      handleTimelineClick,
      todayDateKey,
      dismissedAvailOffKeys,
      showPeakLoadStatus,
      allocationBoxStyle,
      allocationEnterAnim,
      freshEnteredAllocationKey,
      pendingAllocationKeys,
      premiumV2Enabled,
    }),
    [
      projects,
      scheduleModelForCanvas,
      scheduleModel.columnCount,
      viewMode,
      anchorDate,
      utilizationMode,
      density,
      gridTemplate,
      openEdit,
      openCreateAllocation,
      openBulkExtend,
      openAllocationDetail,
      handleTimelineClick,
      todayDateKey,
      dismissedAvailOffKeys,
      showPeakLoadStatus,
      allocationBoxStyle,
      allocationEnterAnim,
      freshEnteredAllocationKey,
      pendingAllocationKeys,
      premiumV2Enabled,
    ]
  );

  useLayoutEffect(() => {
    const el = scheduleViewportRef.current;
    if (el) el.scrollTop = 0;
  }, [schedulePeopleKey]);

  useLayoutEffect(() => {
    const el = scheduleViewportRef.current;
    const prevOffsets = prevTimelineOffsetsRef.current;
    const timelineWindowShrunk =
      timelineOffsets.next < prevOffsets.next || timelineOffsets.prev < prevOffsets.prev;
    prevTimelineOffsetsRef.current = timelineOffsets;

    const hardReset = resetScheduleVerticalScrollRef.current || timelineWindowShrunk;
    if (resetScheduleVerticalScrollRef.current) resetScheduleVerticalScrollRef.current = false;

    if (hardReset && el) el.scrollTop = 0;

    const v = scheduleRowVirtualizerRef.current;
    if (!v) return;

    v.measure();

    if (hardReset) {
      v.scrollToOffset(0, { align: "start" });
      return;
    }

    if (v.getVirtualItems().length === 0 && schedulePeople.length > 0) {
      v.scrollToIndex(0, { align: "start" });
      v.measure();
    }

    remeasureScheduleRows();
  }, [
    scheduleAnchorJumpKey,
    schedulePeopleKey,
    schedulePeople.length,
    timelineOffsets.prev,
    timelineOffsets.next,
    density,
    scheduleRowEstimatePx,
    remeasureScheduleRows,
  ]);

  useLayoutEffect(() => {
    queueRemeasureScheduleRows();
  }, [
    queueRemeasureScheduleRows,
    scheduleAllocations,
    visiblePublicHolidayAllocations,
    dismissedAvailOffKeys,
    scheduleRowHeightRevision,
  ]);

  return (
    <div
      className="lp-root"
      data-theme={theme === "light" ? "light" : "dark"}
      data-density={density}
      data-view={viewMode}
      data-alloc-box-style={allocationBoxStyle}
    >
      <AppSideNav />

      <main
        id="main-content"
        className="lp-main"
        aria-label="Schedule"
      >
        <div className="lp-header-block">
          <div className="lp-page-title-row">
            <div className="lp-schedule-title-cluster">
              <div className="lp-schedule-tag-dd-group">
                <div className="lp-dropdown-wrap" ref={scheduleFilterWrapRef}>
                  <button
                    type="button"
                    data-alloc8-guide="schedule-filter"
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
                    starredScheduleFilters={starredScheduleFilters}
                    toggleStarredPersonTagPreset={toggleStarredPersonTagPreset}
                    saveCurrentFilterAsStarred={saveCurrentFilterAsStarred}
                  />
                </div>

                {deptDashboardEnabled ? (
                  <div className="lp-dropdown-wrap">
                    <button
                      type="button"
                      className="lp-pill lp-pill-btn lp-tag-dd-trigger lp-tag-dd-trigger-active"
                      aria-label="Open department overview dashboard"
                      title="Department dashboard"
                      onClick={() => {
                        const norm = normalizeFilterRules(scheduleFilterRules);
                        const keys = visibleDateKeysForHours(scheduleModel);
                        const startDate = keys.length ? String(keys[0]).slice(0, 10) : "";
                        const endDate = keys.length ? String(keys[keys.length - 1]).slice(0, 10) : "";
                        navigate("/dept-dashboard", {
                          state: {
                            rules: norm,
                            startDate,
                            endDate,
                            viewMode,
                            customRange,
                          },
                        });
                      }}
                    >
                      <LayoutDashboard size={14} strokeWidth={2.15} />
                      Dashboard
                    </button>
                  </div>
                ) : null}

                <div className="lp-dropdown-wrap" ref={starredWrapRef}>
                  <button
                    type="button"
                    className={
                      "lp-pill lp-pill-btn lp-tag-dd-trigger" +
                      (starredScheduleFilters.length > 0 ? " lp-tag-dd-trigger-star" : "")
                    }
                    aria-expanded={starredPopoverOpen}
                    aria-haspopup="listbox"
                    aria-label="Starred filters — apply saved schedule filters"
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
                      className={starredScheduleFilters.length > 0 ? "lp-star-filled" : ""}
                      fill={starredScheduleFilters.length > 0 ? "currentColor" : "none"}
                    />
                    Starred filters
                    {starredScheduleFilters.length > 0 ? ` (${starredScheduleFilters.length})` : ""}
                    <ChevronDown size={14} />
                  </button>
                  {starredPopoverOpen && (
                    <div className="lp-popover lp-popover-tags" role="listbox">
                      <div className="lp-popover-title">Starred filters</div>
                      <p className="lp-tag-dd-hint">
                        Save filters with ★ in the Filter menu (or on a person tag). Click a row to apply; use
                        Remove to unstar.
                      </p>
                      <div className="lp-tag-check-scroll">
                        {starredScheduleFilters.length === 0 ? (
                          <p className="lp-tag-dd-empty">
                            No starred filters yet. Set filters, click “Save to starred”, or ★ a person tag in
                            Filter → Person tag.
                          </p>
                        ) : (
                          [...starredScheduleFilters]
                            .sort((a, b) => a.label.localeCompare(b.label))
                            .map((preset) => (
                              <div key={preset.id} className="lp-star-tag-row lp-star-tag-row-on">
                                <button
                                  type="button"
                                  className="lp-star-tag-row-main"
                                  onClick={() => applySavedStarredFilter(preset.id)}
                                >
                                  <Star size={16} className="lp-star-tag-icon" fill="currentColor" strokeWidth={2} />
                                  <span className="lp-star-tag-label">{preset.label}</span>
                                  <span className="lp-star-tag-remove-hint">Apply</span>
                                </button>
                                <button
                                  type="button"
                                  className="lp-star-tag-row-unstar"
                                  aria-label={`Remove starred filter ${preset.label}`}
                                  onClick={() => removeStarredFilterPreset(preset.id)}
                                >
                                  <X size={14} />
                                </button>
                              </div>
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
            <div
              ref={setAlloc8FeedbackDock}
              data-alloc8-action-feedback-mount
              className="lp-toolbar-right"
            >
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
                          writeScheduleDensity(opt.id);
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
              <div className="lp-subbar-people-icons">
                <button
                  type="button"
                  className="lp-icon-btn lp-subbar-core-icon"
                  aria-label="Add person"
                  onClick={openAdd}
                >
                  <UserPlus size={20} strokeWidth={2} />
                </button>
              </div>
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

        {showV2GettingStartedBanner ? (
          <div className="lp-v2-started-banner" role="status">
            <span className="lp-v2-started-banner__title">Getting started · Schedule v2</span>
            <ul className="lp-v2-started-banner__list">
              <li>Click empty space on a row or use the plus to add project hours.</li>
              <li>Press the slash key to open quick navigation (same idea as ⌘K).</li>
              <li>Expand Filter if you expected people here but rows are blank.</li>
            </ul>
          </div>
        ) : null}

        <div
          className="lp-schedule"
          style={{
            "--lp-cols": scheduleModel.columnCount,
            "--lp-col-min": `${colMinPx}px`,
            "--lp-timeline-min": `${timelineMinWidthPx}px`,
          }}
        >
          <div
            className="lp-schedule-header"
            data-today-pulse={scheduleTodayPulse ? "1" : undefined}
          >
            <div ref={scheduleHeaderInnerRef} className="lp-schedule-header-inner">
              <div ref={scheduleHeaderRef} className="lp-sched-row lp-sched-row-head">
                <div className="lp-sched-corner lp-sched-corner--empty" aria-hidden />
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
                              (slot.weekParity ? " lp-day-week-b" : " lp-day-week-a") +
                              (slot.weekBlockStart ? " lp-day-week-start" : "") +
                              (slot.weekBlockEnd ? " lp-day-week-end" : "")
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
            </div>
          </div>

          <div
            className="lp-schedule-viewport"
            ref={scheduleViewportRef}
            onScroll={onTimelineScroll}
          >
            <div
              key={scheduleMotionKey}
              className={
                "lp-schedule-canvas" +
                (scheduleCanvasSettling ? " lp-schedule-canvas--settle" : "")
              }
            >
              <ScheduleVirtualizedRows
                key={schedulePeopleKey}
                schedulePeople={schedulePeople}
                schedulePeopleKey={schedulePeopleKey}
                scheduleViewportRef={scheduleViewportRef}
                scheduleScrollMargin={0}
                estimateScheduleRowSize={estimateScheduleRowSize}
                onVirtualizer={registerScheduleRowVirtualizer}
                allocationsByPerson={allocationsByPerson}
                TimelineRow={TimelineRow}
                timelineRowProps={timelineRowProps}
              />
            </div>
          </div>
        </div>
      </main>

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
        contextAllocations={scheduleAllocations}
        publicHolidayAllocations={visiblePublicHolidayAllocations}
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

      <BulkExtendAllocationsDialog
        open={!!bulkExtendPerson}
        person={bulkExtendPerson}
        onClose={closeBulkExtend}
        accent={t.accent}
        allocations={allocations}
        contextAllocations={scheduleAllocations}
        publicHolidayAllocations={visiblePublicHolidayAllocations}
        projects={projects}
        setAllocations={setAllocations}
        syncAllocationUpdate={syncAllocationUpdate}
        onRefreshWorkspace={refreshWorkspaceFromSupabase}
        t={t}
      />

      {allocCreateOpen ? (
        <CreateAllocationModal
          open
          onClose={closeCreateAllocation}
          onCreate={handleCreateAllocation}
          onCreateLeave={handleCreateAllocation}
          allocations={createModalAllocations}
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
          publicHolidayAllocations={visiblePublicHolidayAllocations}
          t={t}
          premiumV2Enabled={premiumV2Enabled}
          premiumV2Templates={premiumV2Templates}
          externalPrefill={assistantExternalPrefill}
        />
      ) : null}

      {allocDetailOpen && selectedAllocation ? (
        <AllocationDetailModal
          open
          allocation={selectedAllocation}
          assigneeNames={selectedAssigneeNames}
          onClose={closeAllocationDetail}
          onDelete={canDeleteSelectedAllocation ? handleDeleteAllocation : undefined}
          onExtendAllocation={handleExtendAllocation}
          onSplitAllocation={handleSplitAllocation}
          allocations={detailModalAllocations}
          publicHolidayAllocations={visiblePublicHolidayAllocations}
          onEditClick={canManageSelectedAllocation ? handleDetailEditClick : undefined}
          t={t}
        />
      ) : null}

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
            showCenterActionFeedback({
              action: "add",
              title: "Saved",
              subtitle: (form.name || "").trim() || "New project",
            });
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
