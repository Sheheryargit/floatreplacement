import { useState, useMemo, useRef, useEffect, Fragment, useReducer, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Plus,
  Users,
  FolderOpen,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppSideNav from "../components/navigation/AppSideNav.jsx";
import { useAppData } from "../context/AppDataContext.jsx";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { allocationHasPersonSchedule } from "../utils/peopleSort.js";
import { advanceRepeatWindow } from "../utils/allocationRepeatWindow.js";
import { projectToAllocationLabel } from "../utils/projectColors.js";
import { downloadCSV, arrayToCSV, formatDateDDMmmYY } from "../utils/reportingExport.js";
import "./ReportingPage.css";
 
const PEOPLE_TABS = [
  { key: "People" },
  { key: "Roles" },
  { key: "Departments" },
  { key: "Projects" },
  { key: "Tasks" },
  { key: "Time off" },
];

const VIEW_MODES = [
  { key: "People", icon: Users },
  { key: "Projects", icon: FolderOpen }
];

const FILTER_OPTIONS = {
  people: ['Employees', 'Contractors', 'Active', 'Archived', 'Unassigned'],
  project: ['Draft', 'Tentative', 'Confirmed', 'Completed', 'Canceled'],
  timeoff: ['Confirmed', 'Tentative'],
};
 
const fmt = (h) => {
  if (!h || h === 0) return "0h";
  const rounded = Math.round(h * 10) / 10;
  return `${rounded.toLocaleString("en-AU")}h`;
};
const pct = (a, b) => b === 0 ? "0%" : `${Math.round((a / b) * 100)}%`;
const COST_PER_HOUR = 100;

const CHART_COLORS = {
  billable:    "#22d3ee",
  nonBillable: "#818cf8",
  timeOff:     "#fbbf24",
};

function niceChartTicks(maxVal, targetCount = 5) {
  if (maxVal <= 0) return [0];
  const rawStep = maxVal / (targetCount - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  const niceStep = normalized <= 1.5 ? 1 : normalized <= 3.5 ? 2 : normalized <= 7.5 ? 5 : 10;
  const step = niceStep * magnitude;
  const ticks = [0];
  for (let v = step; v <= maxVal * 1.1 + step; v += step) {
    ticks.push(Math.round(v));
    if (ticks.length >= targetCount + 2) break;
  }
  return ticks;
}

function fmtYLabel(h) {
  if (h >= 10000) return `${Math.round(h / 1000)}k`;
  if (h >= 1000) return `${(h / 1000).toFixed(1)}k`;
  return String(h);
}
 
function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}
 
function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthLabel(date) {
  return date.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

function buildCalendarDays(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(gridStart, i);
    return {
      date,
      inMonth: date.getMonth() === monthDate.getMonth(),
    };
  });
}
 
function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() + (6 - d.getDay()));
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfQuarter(date) {
  const quarter = Math.floor(date.getMonth() / 3);
  const d = new Date(date.getFullYear(), quarter * 3, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfQuarter(date) {
  const quarter = Math.floor(date.getMonth() / 3);
  const d = new Date(date.getFullYear(), (quarter + 1) * 3, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfYear(date) {
  const d = new Date(date.getFullYear(), 0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfYear(date) {
  const d = new Date(date.getFullYear(), 11, 31);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getDateRangeForTimeframe(timeframe) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  switch (timeframe) {
    case 'this-week':
      return { start: startOfWeek(today), end: endOfWeek(today) };
    case 'last-week': {
      const lastWeekEnd = addDays(startOfWeek(today), -1);
      return { start: startOfWeek(lastWeekEnd), end: endOfWeek(lastWeekEnd) };
    }
    case 'next-12-weeks': {
      const end = addDays(today, 83);
      end.setHours(23, 59, 59, 999);
      return { start: today, end };
    }
    case 'this-month':
      return { start: startOfMonth(today), end: endOfMonth(today) };
    case 'last-month': {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    }
    case 'this-quarter':
      return { start: startOfQuarter(today), end: endOfQuarter(today) };
    case 'last-quarter': {
      const lastQuarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 - 3, 1);
      return { start: startOfQuarter(lastQuarterStart), end: endOfQuarter(lastQuarterStart) };
    }
    case 'this-year':
      return { start: startOfYear(today), end: endOfYear(today) };
    case 'last-year': {
      const lastYear = new Date(today.getFullYear() - 1, 0, 1);
      return { start: startOfYear(lastYear), end: endOfYear(lastYear) };
    }
    default:
      return { start: today, end: addDays(today, 84) };
  }
}

function weekLabel(date) {
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
 
function allocationHours(alloc) {
  if (!alloc) return 0;
  const total = Number(alloc.totalHours) || 0;
  if (total > 0) return total;
  const hoursPerDay = Number(alloc.hoursPerDay) || 0;
  const workingDays = Number(alloc.workingDays) || 0;
  return hoursPerDay * workingDays;
}

/** Count weekdays (Mon–Fri) between two Date objects (inclusive). */
function countWeekdaysInRange(startDate, endDate) {
  let n = 0;
  const end = new Date(endDate);
  for (const d = new Date(startDate); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

/**
 * Hours attributed to a non-repeating allocation within [rangeStart, rangeEnd].
 * Pro-rates by the fraction of working days that fall inside the range.
 * For repeating occurrences (already clipped to one occurrence window) the
 * full allocationHours() value is used as-is.
 */
function allocationHoursInRange(alloc, rangeStart, rangeEnd) {
  if (!alloc) return 0;
  // Repeating occurrences are already one-occurrence-sized — use full hours
  if (alloc.repeatId && alloc.repeatId !== "none") return allocationHours(alloc);

  const aStart = parseDate(alloc.startDate);
  const aEnd = parseDate(alloc.endDate) ?? aStart;
  if (!aStart || !aEnd) return 0;

  // If perfectly contained, no need to pro-rate
  if (aStart >= rangeStart && aEnd <= rangeEnd) return allocationHours(alloc);

  const hoursPerDay = Number(alloc.hoursPerDay) || 0;
  if (hoursPerDay > 0) {
    const overlapStart = aStart < rangeStart ? rangeStart : aStart;
    const overlapEnd = aEnd > rangeEnd ? rangeEnd : aEnd;
    return hoursPerDay * countWeekdaysInRange(overlapStart, overlapEnd);
  }

  // Fall back: pro-rate totalHours by working-day fraction
  const total = allocationHours(alloc);
  const allocDays = countWeekdaysInRange(aStart, aEnd);
  if (allocDays === 0) return total;
  const overlapStart = aStart < rangeStart ? rangeStart : aStart;
  const overlapEnd = aEnd > rangeEnd ? rangeEnd : aEnd;
  const overlapDays = countWeekdaysInRange(overlapStart, overlapEnd);
  return total * (overlapDays / allocDays);
}

function normalizeText(value) {
  return (value || "").toString().trim().toLowerCase();
}

/** Groups filteredPersonRows by a string key, summing all numeric stats. */
function groupPeopleBy(rows, getKey) {
  const groups = {};
  for (const person of rows) {
    const key = getKey(person);
    if (!groups[key]) {
      groups[key] = { capacity: 0, scheduled: 0, billable: 0, nonBillable: 0, timeOff: 0, overtime: 0, unscheduled: 0, scheduledCost: 0, people: [] };
    }
    const g = groups[key];
    g.capacity     += person.capacity;
    g.scheduled    += person.scheduled;
    g.billable     += person.billable;
    g.nonBillable  += person.nonBillable;
    g.timeOff      += person.timeOff;
    g.overtime     += person.overtime;
    g.unscheduled  += person.unscheduled;
    g.scheduledCost += person.billable * COST_PER_HOUR;
    g.people.push(person);
  }
  return Object.entries(groups).map(([key, data]) => ({ id: key, name: key, ...data }));
}
 
function breakdownKey(alloc, projects) {
  if (alloc.isLeave) return "Leave";
  const project = (alloc.project || "").trim();
  if (!project) return "Unspecified work";
  const match = projects.find((p) => projectToAllocationLabel(p) === project);
  return match ? projectToAllocationLabel(match) : project;
}
 
function getTaskCategory(alloc) {
  if (!alloc || alloc.isLeave) return "Leave";
  const days = alloc.workingDays || Math.round((alloc.hoursPerDay || 0) / 7.5);
  if (days >= 5) return "Full time (5d/w)";
  if (days >= 4) return "4 days/week";
  if (days >= 3) return "3 days/week";
  if (days >= 2) return "2 days/week";
  if (days >= 1) return "1 day/week";
  return "Ad hoc";
}
 
// ── Expandable detail row ─────────────────────────────────────────────────────
function DetailRow({ isExpanded, colSpan, children }) {
  if (!isExpanded) return null;
  return (
    <tr className="rp-row rp-row--detail">
      <td colSpan={colSpan} className="rp-td rp-td--detail">
        <motion.div
          className="rp-detail-inner"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.18 }}
        >
          {children}
        </motion.div>
      </td>
    </tr>
  );
}
 
// ── Sched % bar ───────────────────────────────────────────────────────────────
function SchedCell({ scheduled, capacity }) {
  const schedPct = capacity > 0 ? Math.round((scheduled / capacity) * 100) : 0;
  return (
    <div className="rp-sched-cell">
      <span>{schedPct}%</span>
      <div className="rp-sched-bar-wrap">
        <div className="rp-sched-bar" style={{ width: `${schedPct}%` }} />
      </div>
    </div>
  );
}
 
// ── Standard thead ────────────────────────────────────────────────────────────
function StandardThead({ firstColLabel, showDept = true }) {
  return (
    <thead>
      <tr>
        <th className="rp-th rp-th--expand" />
        <th className="rp-th rp-th--name">
          {firstColLabel} <ChevronDown size={12} className="rp-th-sort" />
        </th>
        {showDept && <th className="rp-th">Department</th>}
        <th className="rp-th rp-th--num">Capacity</th>
        <th className="rp-th rp-th--num rp-th--accent">Scheduled</th>
        <th className="rp-th rp-th--num rp-th--accent">Billable</th>
        <th className="rp-th rp-th--num rp-th--accent">Non-billable</th>
        <th className="rp-th rp-th--num">Time off</th>
        <th className="rp-th rp-th--num">Overtime</th>
        <th className="rp-th rp-th--num">Sched.&nbsp;%</th>
        <th className="rp-th rp-th--num">Scheduled Cost</th>
      </tr>
    </thead>
  );
}
 
// ── Standard grouped row ──────────────────────────────────────────────────────
function StandardRow({ row, idx, expanded, toggleRow, showDept = true, onPersonClick }) {
  const isExpanded = expanded[row.id];
  const colSpan = showDept ? 11 : 10;
  return (
    <Fragment>
      <tr className={`rp-row ${idx % 2 === 0 ? "rp-row--even" : ""}`}>
        <td className="rp-td rp-td--expand">
          <button
            className="rp-expand-btn"
            onClick={() => toggleRow(row.id)}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <ChevronRight
              size={13}
              className={`rp-expand-icon ${isExpanded ? "rp-expand-icon--open" : ""}`}
            />
          </button>
        </td>
        <td className="rp-td rp-td--name">{row.name}</td>
        {showDept && <td className="rp-td rp-td--muted">—</td>}
        <td className="rp-td rp-td--num">{fmt(row.capacity)}</td>
        <td className="rp-td rp-td--num">{fmt(row.scheduled)}</td>
        <td className="rp-td rp-td--num">{fmt(row.billable)}</td>
        <td className="rp-td rp-td--num">{fmt(row.nonBillable)}</td>
        <td className="rp-td rp-td--num">{fmt(row.timeOff)}</td>
        <td className="rp-td rp-td--num">{fmt(row.overtime)}</td>
        <td className="rp-td rp-td--num">
          <SchedCell scheduled={row.scheduled} capacity={row.capacity} />
        </td>
        <td className="rp-td rp-td--num">{fmt(row.scheduledCost)}</td>
      </tr>
      <DetailRow isExpanded={isExpanded} colSpan={colSpan}>
        {row.people?.length > 0
          ? row.people.map(person => (
              <div key={person.id} style={{ marginBottom: 6 }}>
                {onPersonClick ? (
                  <button
                    type="button"
                    className="rp-cell-link"
                    onClick={() => onPersonClick(person)}
                  >
                    <strong>{person.name}</strong>
                  </button>
                ) : (
                  <strong>{person.name}</strong>
                )}
                : Capacity {fmt(person.capacity)}, Scheduled {fmt(person.scheduled)}, Billable {fmt(person.billable)}
              </div>
            ))
          : "No people assigned."}
      </DetailRow>
    </Fragment>
  );
}
 
export default function ReportingPage() {
  const { theme } = useAppTheme();
  const { people, allocations, publicHolidayAllocations, projects } = useAppData();

  // ── Consolidated State ────────────────────────────────────────────────────
  const initialState = {
    viewMode: "People",
    activeTab: "People",
    projectGrouping: "projects",
    viewType: "weeks",
    expanded: {},
    openFilter: null,
    openExport: false,
    filters: {
      people: FILTER_OPTIONS.people,
      project: FILTER_OPTIONS.project,
      timeoff: FILTER_OPTIONS.timeoff,
    },
  };

  const stateReducer = (state, action) => {
    switch (action.type) {
      case "SET_VIEW_MODE":
        return { ...state, viewMode: action.payload, activeTab: "People" };
      case "SET_ACTIVE_TAB":
        return { ...state, activeTab: action.payload };
      case "SET_PROJECT_GROUPING":
        return { ...state, projectGrouping: action.payload };
      case "SET_VIEW_TYPE":
        return { ...state, viewType: action.payload };
      case "TOGGLE_ROW":
        return { ...state, expanded: { ...state.expanded, [action.payload]: !state.expanded[action.payload] } };
      case "SET_OPEN_FILTER":
        return { ...state, openFilter: action.payload };
      case "SET_OPEN_EXPORT":
        return { ...state, openExport: action.payload };
      case "UPDATE_FILTER":
        return {
          ...state,
          filters: {
            ...state.filters,
            [action.filterType]: action.payload,
          },
        };
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(stateReducer, initialState);
  const [openQuickAdd, setOpenQuickAdd] = useState(false);
  const [timeframeMode, setTimeframeMode] = useState('next-12-weeks');
  const [dateRange, setDateRange] = useState(() => getDateRangeForTimeframe('next-12-weeks'));
  const [startMonthView, setStartMonthView] = useState(() => toMonthStart(getDateRangeForTimeframe('next-12-weeks').start));
  const [endMonthView, setEndMonthView] = useState(() => toMonthStart(getDateRangeForTimeframe('next-12-weeks').end));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [drilldown, setDrilldown] = useState({ personId: null, personName: null, project: null, client: null });
  const [hoveredBar, setHoveredBar] = useState(null);
  const [hoveredHoliday, setHoveredHoliday] = useState(null);
  const dropdownRef = useRef();
  const exportRef = useRef();
  const quickAddRef = useRef();
  const datePickerRef = useRef();
  const chartRef = useRef();  
  const navigate = useNavigate();
 
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        dispatch({ type: "SET_OPEN_FILTER", payload: null });
      }
      if (exportRef.current && !exportRef.current.contains(event.target)) {
        dispatch({ type: "SET_OPEN_EXPORT", payload: false });
      }
      if (quickAddRef.current && !quickAddRef.current.contains(event.target)) {
        setOpenQuickAdd(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setDatePickerOpen(false);
      }
    };
    if (datePickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [datePickerOpen]);

  useEffect(() => {
    setStartMonthView(toMonthStart(dateRange.start));
    setEndMonthView(toMonthStart(dateRange.end));
  }, [dateRange.start, dateRange.end]);

  // ── Filter Label Helper ───────────────────────────────────────────────────
  const getFilterLabel = useCallback((filterType) => {
    const current = state.filters[filterType];
    const all = FILTER_OPTIONS[filterType];
    return current.length === all.length ? 'All' : current.join(', ');
  }, [state.filters]);

  const toggleDrilldown = useCallback((nextFilter) => {
    setDrilldown((prev) => {
      const samePerson = Object.prototype.hasOwnProperty.call(nextFilter, "personId")
        && prev.personId === (nextFilter.personId || null);
      const sameProject = Object.prototype.hasOwnProperty.call(nextFilter, "project")
        && normalizeText(prev.project) === normalizeText(nextFilter.project);
      const sameClient = Object.prototype.hasOwnProperty.call(nextFilter, "client")
        && normalizeText(prev.client) === normalizeText(nextFilter.client);

      if (samePerson || sameProject || sameClient) {
        return { personId: null, personName: null, project: null, client: null };
      }

      return {
        personId: nextFilter.personId || null,
        personName: nextFilter.personName || null,
        project: nextFilter.project || null,
        client: nextFilter.client || null,
      };
    });
  }, []);

  const clearDrilldown = useCallback(() => {
    setDrilldown({ personId: null, personName: null, project: null, client: null });
  }, []);

  const handleBarHover = useCallback((e, d, schedPct, bilPct, nonPct) => {
    setHoveredBar({ d, x: e.clientX, y: e.clientY, schedPct, bilPct, nonPct });
  }, []);

  const handleHolidayEnter = useCallback((e, names) => {
    setHoveredHoliday({ names, x: e.clientX, y: e.clientY });
  }, []);

  const handleHolidayLeave = useCallback(() => {
    setHoveredHoliday(null);
  }, []);

  // ── Holiday buckets for chart X-axis dots ────────────────────────────────────
  const holidaysByKey = useMemo(() => {
    const map = new Map();
    const start = new Date(dateRange.start); start.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.end); end.setHours(23, 59, 59, 999);
    for (const alloc of publicHolidayAllocations) {
      if (!alloc.syntheticPublicHoliday) continue;
      const d = parseDate(alloc.startDate);
      if (!d || d < start || d > end) continue;
      let key;
      if (state.viewType === 'days') key = d.toISOString().split('T')[0];
      else if (state.viewType === 'weeks') {
        const ws = new Date(d); ws.setDate(ws.getDate() - ws.getDay());
        key = ws.toISOString().split('T')[0];
      } else {
        key = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
      }
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(alloc.notes || "Public holiday");
    }
    return map;
  }, [publicHolidayAllocations, dateRange.start, dateRange.end, state.viewType]);

  // ── Date Range Management ─────────────────────────────────────────────────
  const navigateDateRange = useCallback((direction) => {
    setDateRange((prev) => {
      const start = new Date(prev.start);
      const end = new Date(prev.end);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      const msPerDay = 24 * 60 * 60 * 1000;
      const days = Math.max(1, Math.floor((end.valueOf() - start.valueOf()) / msPerDay) + 1);
      const delta = direction === 'next' ? days : -days;
      const nextStart = addDays(start, delta);
      const nextEnd = addDays(end, delta);
      nextStart.setHours(0, 0, 0, 0);
      nextEnd.setHours(23, 59, 59, 999);
      return { start: nextStart, end: nextEnd };
    });
    setTimeframeMode('custom');
  }, []);

  const handleTimeframeSelect = useCallback((mode) => {
    if (mode === 'custom') {
      setTimeframeMode('custom');
      return;
    }
    const nextRange = getDateRangeForTimeframe(mode);
    setDateRange(nextRange);
    setTimeframeMode(mode);
    setDatePickerOpen(false);
  }, []);
 
  const scheduleAllocations = useMemo(
    () => [...allocations, ...publicHolidayAllocations],
    [allocations, publicHolidayAllocations]
  );

  const rangedAllocations = useMemo(() => {
    const rangeStart = new Date(dateRange.start);
    const rangeEnd = new Date(dateRange.end);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(23, 59, 59, 999);
    const rsKey = rangeStart.toISOString().slice(0, 10);
    const reKey = rangeEnd.toISOString().slice(0, 10);

    const result = [];
    for (const alloc of scheduleAllocations) {
      const s = parseDate(alloc.startDate);
      if (!s) continue;
      const e = parseDate(alloc.endDate) ?? s;

      if (!alloc.repeatId || alloc.repeatId === "none") {
        // Non-repeating: include if allocation window overlaps the selected range
        if (s <= rangeEnd && e >= rangeStart) result.push(alloc);
      } else {
        // Repeating: walk occurrences and collect every one that overlaps the range
        let ws = s.toISOString().slice(0, 10);
        let we = e.toISOString().slice(0, 10);
        for (let guard = 0; guard < 520; guard++) {
          if (ws > reKey) break; // occurrence starts after range end — done
          if (we >= rsKey) {
            // This occurrence overlaps the range — push a clipped copy
            result.push({ ...alloc, startDate: ws, endDate: we });
          }
          const next = advanceRepeatWindow(ws, we, alloc.repeatId);
          if (!next) break;
          ws = next.start;
          we = next.end;
        }
      }
    }
    return result;
  }, [scheduleAllocations, dateRange.start, dateRange.end]);
 
  const projectBillability = useMemo(() => {
    const map = new Map();
    for (const project of projects) {
      map.set(projectToAllocationLabel(project), project.billable !== false);
    }
    return map;
  }, [projects]);
 
  const activePeople = useMemo(
    () => people.filter((person) => !person.archived),
    [people]
  );

  const rangeWeekdays = useMemo(() => {
    const rangeStart = new Date(dateRange.start);
    const rangeEnd = new Date(dateRange.end);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(23, 59, 59, 999);
    return countWeekdaysInRange(rangeStart, rangeEnd);
  }, [dateRange.start, dateRange.end]);
 
  // ── Person rows — source of truth for all tabs ───────────────────────────────
  // Each person row stores their resolved allocations so downstream tabs
  // don't need to re-run allocationHasPersonSchedule.
  const personRows = useMemo(
    () => {
      const rangeStart = new Date(dateRange.start);
      const rangeEnd = new Date(dateRange.end);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd.setHours(23, 59, 59, 999);
      return activePeople.map((person) => {
        const capacity = rangeWeekdays * 7.5;
        let billable = 0, nonBillable = 0, timeOff = 0;

        // Attach _rangedHours so projectRows/taskRows don't need to re-derive them
        const allocationsForPerson = rangedAllocations
          .filter((alloc) => allocationHasPersonSchedule(alloc, person.id))
          .map((alloc) => ({ ...alloc, _rangedHours: allocationHoursInRange(alloc, rangeStart, rangeEnd) }));

        const projectTotals = new Map();
        for (const alloc of allocationsForPerson) {
          const hours = alloc._rangedHours;
          const key = breakdownKey(alloc, projects);
          projectTotals.set(key, (projectTotals.get(key) || 0) + hours);

          if (alloc.isLeave) {
            timeOff += hours;
          } else {
            const label = (alloc.project || "").trim();
            if (projectBillability.get(label) === false) nonBillable += hours;
            else billable += hours;
          }
        }

        const scheduled = billable + nonBillable;
        return {
          ...person,
          dept: person.department || "—",
          capacity,
          scheduled,
          billable,
          nonBillable,
          timeOff,
          overtime: Math.max(0, scheduled - capacity),
          unscheduled: Math.max(0, capacity - scheduled - timeOff),
          // Keep resolved allocations so downstream tabs can iterate them directly
          allocations: allocationsForPerson,
          projectTotals,
        };
      });
    },
    [activePeople, rangedAllocations, projectBillability, projects, rangeWeekdays, dateRange.start, dateRange.end]
  );
 
  const projectClientByLabel = useMemo(() => {
    const map = new Map();
    for (const project of projects) {
      map.set(projectToAllocationLabel(project), project.client || "—");
    }
    return map;
  }, [projects]);

  const filteredPersonRows = useMemo(() => {
    const personIdFilter = drilldown.personId;
    const projectFilter = normalizeText(drilldown.project);
    const clientFilter = normalizeText(drilldown.client);

    return personRows.filter((person) => {
      if (personIdFilter && person.id !== personIdFilter) return false;

      if (!projectFilter && !clientFilter) return true;
      if (!person.allocations?.length) return false;

      return person.allocations.some((alloc) => {
        const projectLabel = (alloc.project || "").trim() || "Unspecified work";
        const allocationClient = (alloc.client || "").trim() || projectClientByLabel.get(projectLabel) || "—";

        if (projectFilter && normalizeText(projectLabel) !== projectFilter) return false;
        if (clientFilter && normalizeText(allocationClient) !== clientFilter) return false;
        return true;
      });
    });
  }, [personRows, drilldown.personId, drilldown.project, drilldown.client, projectClientByLabel]);

  // ── Per-bar capacity for chart scaling (depends on filteredPersonRows) ───────
  const capacityPerBar = useMemo(() => {
    const perPerson = state.viewType === 'days' ? 7.5 : state.viewType === 'weeks' ? 37.5 : 157.5;
    return perPerson * filteredPersonRows.length;
  }, [state.viewType, filteredPersonRows.length]);

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const sums = filteredPersonRows.reduce(
      (acc, p) => {
        acc.cap += p.capacity; acc.sch += p.scheduled;
        acc.bil += p.billable; acc.non += p.nonBillable;
        acc.toff += p.timeOff; acc.ot += p.overtime;
        return acc;
      },
      { cap: 0, sch: 0, bil: 0, non: 0, toff: 0, ot: 0 }
    );
    return { ...sums, unsch: Math.max(0, sums.cap - sums.sch - sums.toff) };
  }, [filteredPersonRows]);
 
  // ── Role rows ───────────────────────────────────────────────────────────────
  const roleRows = useMemo(
    () => groupPeopleBy(filteredPersonRows, (p) => p.role || "Unassigned"),
    [filteredPersonRows]
  );

  // ── Dept rows ───────────────────────────────────────────────────────────────
  const deptRows = useMemo(
    () => groupPeopleBy(filteredPersonRows, (p) => p.dept),
    [filteredPersonRows]
  );

  // ── Project rows ─────────────────────────────────────────────────────────────
  const projectRows = useMemo(() => {
    const groups = {};
    
    // First, collect all projects and initialize their stats
    for (const project of projects) {
      const projectLabel = projectToAllocationLabel(project);
      groups[projectLabel] = {
        scheduled: 0,
        billable: 0,
        nonBillable: 0,
        scheduledCost: 0,
        personIds: new Set(),
        projectMeta: project,
      };
    }
    
    // Then, accumulate allocations
    for (const person of filteredPersonRows) {
      for (const alloc of person.allocations) {
        if (alloc.isLeave) continue;
        const projectLabel = (alloc.project || "").trim() || "Unspecified work";
        const hours = alloc._rangedHours ?? allocationHours(alloc);
        const isBillable = projectBillability.get(projectLabel) !== false;
 
        if (!groups[projectLabel]) {
          groups[projectLabel] = { scheduled: 0, billable: 0, nonBillable: 0, scheduledCost: 0, personIds: new Set(), projectMeta: {} };
        }
        const g = groups[projectLabel];
        g.scheduled += hours;
        if (isBillable) { g.billable += hours; g.scheduledCost += hours * COST_PER_HOUR; }
        else g.nonBillable += hours;
        g.personIds.add(person.id);
      }
    }
 
    return Object.entries(groups).map(([projectLabel, data]) => {
      const projectMeta = data.projectMeta || {};
      const persons = filteredPersonRows.filter(p => data.personIds.has(p.id));
      return {
        id: projectLabel,
        name: projectMeta.name || projectLabel,
        code: projectMeta.code || "—",
        client: projectMeta.client || "—",
        owner: projectMeta.owner || "—",
        stage: projectMeta.stage || null,
        scheduled: data.scheduled,
        billable: data.billable,
        nonBillable: data.nonBillable,
        scheduledCost: data.scheduledCost,
        people: persons,
      };
    });
  }, [filteredPersonRows, projects, projectBillability]);
 
  // ── Task rows ─────────────────────────────────────────────────────────────────
  // Same pattern — iterate person.allocations directly.
  const taskRows = useMemo(() => {
    const groups = {};
 
    for (const person of filteredPersonRows) {
      for (const alloc of person.allocations) {
        const category = getTaskCategory(alloc);
        const hours = alloc._rangedHours ?? allocationHours(alloc);
        const isBillable = projectBillability.get((alloc.project || "").trim()) !== false;
 
        if (!groups[category]) {
          groups[category] = { scheduled: 0, billable: 0, nonBillable: 0, timeOff: 0, scheduledCost: 0, personIds: new Set() };
        }
        const g = groups[category];
 
        if (alloc.isLeave) {
          g.timeOff += hours;
        } else {
          g.scheduled += hours;
          if (isBillable) { g.billable += hours; g.scheduledCost += hours * COST_PER_HOUR; }
          else g.nonBillable += hours;
        }
        g.personIds.add(person.id);
      }
    }
 
    return Object.entries(groups).map(([category, data]) => {
      const persons = filteredPersonRows.filter(p => data.personIds.has(p.id));
      const capacity = persons.reduce((sum, p) => sum + p.capacity, 0);
      return {
        id: category,
        name: category,
        capacity,
        scheduled: data.scheduled,
        billable: data.billable,
        nonBillable: data.nonBillable,
        timeOff: data.timeOff,
        overtime: Math.max(0, data.scheduled - capacity),
        unscheduled: Math.max(0, capacity - data.scheduled - data.timeOff),
        scheduledCost: data.scheduledCost,
        people: persons,
      };
    });
  }, [filteredPersonRows, projectBillability]);
 
  // ── Time off rows ─────────────────────────────────────────────────────────────
  // Same pattern — iterate person.allocations directly.
  const timeOffRows = useMemo(() => {
    const groups = {};
 
    for (const person of filteredPersonRows) {
      for (const alloc of person.allocations) {
        if (!alloc.isLeave) continue;
        const type = alloc.leaveType || alloc.project || "Unspecified leave";
        const hours = allocationHours(alloc);
 
        if (!groups[type]) groups[type] = { totalHours: 0, personIds: new Set() };
        groups[type].totalHours += hours;
        groups[type].personIds.add(person.id);
      }
    }
 
    return Object.entries(groups).map(([type, data]) => {
      const persons = filteredPersonRows.filter(p => data.personIds.has(p.id));
      return {
        id: type,
        name: type,
        totalHours: data.totalHours,
        totalDays: data.totalHours / 7.5,
        people: persons,
      };
    });
  }, [filteredPersonRows]);
 
  // ── Tab counts ───────────────────────────────────────────────────────────────
  const tabCounts = useMemo(() => ({
    People: filteredPersonRows.length,
    Roles: roleRows.length,
    Departments: deptRows.length,
    Projects: projectRows.length,
    Tasks: taskRows.length,
    "Time off": timeOffRows.length,
  }), [filteredPersonRows.length, roleRows.length, deptRows.length, projectRows.length, taskRows.length, timeOffRows.length]);

  // projectRows is already scoped to filteredPersonRows (which applies personId + client drilldown).
  // Only need to additionally filter by project name when drilling into a specific project.
  const visibleProjectRows = useMemo(() => {
    const projectFilter = normalizeText(drilldown.project);
    if (!projectFilter) return projectRows;
    return projectRows.filter((row) => normalizeText(row.id) === projectFilter);
  }, [projectRows, drilldown.project]);

  const visibleClientRows = useMemo(() => {
    const groups = {};
    for (const project of visibleProjectRows) {
      const client = project.client || "—";
      if (!groups[client]) {
        groups[client] = { scheduled: 0, billable: 0, nonBillable: 0, scheduledCost: 0, projects: [] };
      }
      groups[client].scheduled += project.scheduled;
      groups[client].billable += project.billable;
      groups[client].nonBillable += project.nonBillable;
      groups[client].scheduledCost += project.scheduledCost;
      groups[client].projects.push(project);
    }
    return Object.entries(groups).map(([client, data]) => ({ id: client, name: client, ...data }));
  }, [visibleProjectRows]);

  const projectCountsByGrouping = useMemo(() => ({
    projects: visibleProjectRows.length,
    clients: visibleClientRows.length,
  }), [visibleProjectRows.length, visibleClientRows.length]);

  const filteredRangedAllocations = useMemo(() => {
    const personIdFilter = drilldown.personId;
    const projectFilter = normalizeText(drilldown.project);
    const clientFilter = normalizeText(drilldown.client);

    return rangedAllocations.filter((alloc) => {
      if (personIdFilter && !allocationHasPersonSchedule(alloc, personIdFilter)) return false;

      const projectLabel = (alloc.project || "").trim() || "Unspecified work";
      const allocationClient = (alloc.client || "").trim() || projectClientByLabel.get(projectLabel) || "—";

      if (projectFilter && normalizeText(projectLabel) !== projectFilter) return false;
      if (clientFilter && normalizeText(allocationClient) !== clientFilter) return false;
      return true;
    });
  }, [rangedAllocations, drilldown.personId, drilldown.project, drilldown.client, projectClientByLabel]);
 
  // ── Chart ────────────────────────────────────────────────────────────────────
  const chartRange = useMemo(() => {
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
 
    const grouped = new Map();
    for (const alloc of filteredRangedAllocations) {
      const allocDate = parseDate(alloc.startDate);
      if (!allocDate || allocDate < startDate || allocDate > endDate) continue;
      let key;
      if (state.viewType === 'days') key = allocDate.toISOString().split('T')[0];
      else if (state.viewType === 'weeks') {
        const ws = new Date(allocDate); ws.setDate(ws.getDate() - ws.getDay());
        key = ws.toISOString().split('T')[0];
      } else {
        key = new Date(allocDate.getFullYear(), allocDate.getMonth(), 1).toISOString().split('T')[0];
      }
      const hours = allocationHours(alloc);
      const existing = grouped.get(key) || { billable: 0, nonBillable: 0, timeOff: 0 };
      if (alloc.isLeave) existing.timeOff += hours;
      else if (projectBillability.get((alloc.project || "").trim()) === false) existing.nonBillable += hours;
      else existing.billable += hours;
      grouped.set(key, existing);
    }
 
    const data = [];
    if (state.viewType === 'days') {
      for (let c = new Date(startDate); c <= endDate; c = addDays(c, 1)) {
        const key = c.toISOString().split('T')[0];
        const v = grouped.get(key) || { billable: 0, nonBillable: 0, timeOff: 0 };
        data.push({ label: c.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), key, ...v, total: v.billable + v.nonBillable + v.timeOff, holidays: Array.from(holidaysByKey.get(key) || []) });
      }
    } else if (state.viewType === 'weeks') {
      for (let c = startOfWeek(startDate); c <= endDate; c = addDays(c, 7)) {
        const ws = new Date(c); ws.setDate(ws.getDate() - ws.getDay());
        const key = ws.toISOString().split('T')[0];
        const v = grouped.get(key) || { billable: 0, nonBillable: 0, timeOff: 0 };
        data.push({ label: c.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), key, ...v, total: v.billable + v.nonBillable + v.timeOff, holidays: Array.from(holidaysByKey.get(key) || []) });
      }
    } else {
      for (let c = new Date(startDate.getFullYear(), startDate.getMonth(), 1); c <= endDate; c = new Date(c.getFullYear(), c.getMonth() + 1, 1)) {
        const key = new Date(c.getFullYear(), c.getMonth(), 1).toISOString().split('T')[0];
        const v = grouped.get(key) || { billable: 0, nonBillable: 0, timeOff: 0 };
        data.push({ label: c.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }), key, ...v, total: v.billable + v.nonBillable + v.timeOff, holidays: Array.from(holidaysByKey.get(key) || []) });
      }
    }
    return { startDate, endDate, data, totalCapacity: (filteredPersonRows[0]?.capacity ?? 0) * filteredPersonRows.length };
  }, [filteredRangedAllocations, state.viewType, projectBillability, filteredPersonRows, dateRange.start, dateRange.end, holidaysByKey]);
 
  const toggleRow = useCallback((id) => {
    dispatch({ type: "TOGGLE_ROW", payload: id });
  }, []);

  const chartMax = useMemo(() => Math.max(...chartRange.data.map(d => d.total), 1), [chartRange.data]);
  const yMax = useMemo(() => Math.max(chartMax, capacityPerBar, 1), [chartMax, capacityPerBar]);
  const yTicks = useMemo(() => niceChartTicks(yMax), [yMax]);
  const labelStep = useMemo(() => {
    const n = chartRange.data.length;
    if (n <= 20) return 1;
    if (n <= 40) return 2;
    if (n <= 84) return 7;
    return 14;
  }, [chartRange.data.length]);
  const chartStartLabel = dateRange.start ? weekLabel(dateRange.start) : "—";
  const chartEndLabel = dateRange.end ? weekLabel(dateRange.end) : "—";

  // ── Export Functions ─────────────────────────────────────────────────────────
  const exportChartData = useCallback(() => {
    const header = [
      "Date",
      "Capacity hrs",
      "Scheduled hrs",
      "Scheduled %",
      "Scheduled Billable hrs",
      "Scheduled Billable %",
      "Scheduled Non-billable hrs",
      "Scheduled Non-billable %",
      "Time off hrs",
      "Time off days",
    ];
    
    const rows = chartRange.data.map((d) => {
      const dateStr = d.label;
      
      const totalCapacity = chartRange.totalCapacity / chartRange.data.length;
      const totalScheduled = d.billable + d.nonBillable;
      const schedPct = totalCapacity > 0 ? Math.round((totalScheduled / totalCapacity) * 100) : 0;
      const billablePct = totalScheduled > 0 ? Math.round((d.billable / totalScheduled) * 100) : 0;
      const nonbillablePct = totalScheduled > 0 ? Math.round((d.nonBillable / totalScheduled) * 100) : 0;
      const timeoffDays = d.timeOff / 7.5;
      
      return [
        dateStr,
        totalCapacity.toFixed(1),
        totalScheduled.toFixed(1),
        `${schedPct}%`,
        d.billable.toFixed(1),
        `${billablePct}%`,
        d.nonBillable.toFixed(1),
        `${nonbillablePct}%`,
        d.timeOff.toFixed(1),
        timeoffDays.toFixed(1),
      ];
    });
    
    const csv = arrayToCSV([header, ...rows]);
    downloadCSV(csv, `chart-data-${new Date().toISOString().split('T')[0]}.csv`);
  }, [chartRange, filteredPersonRows]);

  const exportTableData = useCallback(() => {
    const header = [
      "Person",
      "Role",
      "Department",
      "Capacity hrs",
      "Client",
      "Project",
      "Project code",
      "Task",
      "Is leave",
      "Scheduled hrs",
      "Scheduled billable hrs",
      "Scheduled non-billable hrs",
      "Overtime hrs",
      "Unscheduled hrs",
      "Time off hrs",
      "Time off days",
      "Scheduled % of capacity",
      "Billable % of capacity",
      "Billable % of scheduled",
    ];
    
    const rows = [];
    for (const person of filteredPersonRows) {
      if (person.allocations.length === 0) {
        rows.push([
          person.name,
          person.role || "—",
          person.dept,
          person.capacity.toFixed(1),
          "—", "—", "—", "—", "—",
          "0", "0", "0",
          person.overtime.toFixed(1),
          person.unscheduled.toFixed(1),
          "0", "0",
          pct(0, person.capacity), pct(0, person.capacity), "0%",
        ]);
      } else {
        for (const alloc of person.allocations) {
          const hours = allocationHours(alloc);
          const hoursDays = (hours / 7.5).toFixed(1);
          rows.push([
            person.name,
            person.role || "—",
            person.dept,
            person.capacity.toFixed(1),
            alloc.client || projectClientByLabel.get((alloc.project || "").trim()) || "—",
            alloc.project || "—",
            alloc.projectCode || "—",
            alloc.task || "—",
            alloc.isLeave ? "Yes" : "No",
            person.scheduled.toFixed(1),
            person.billable.toFixed(1),
            person.nonBillable.toFixed(1),
            person.overtime.toFixed(1),
            person.unscheduled.toFixed(1),
            alloc.isLeave ? hours.toFixed(1) : "0",
            alloc.isLeave ? hoursDays : "0",
            pct(person.scheduled, person.capacity),
            pct(person.billable, person.capacity),
            pct(person.billable, person.scheduled),
          ]);
        }
      }
    }
    const csv = arrayToCSV([header, ...rows]);
    downloadCSV(csv, `table-data-${new Date().toISOString().split('T')[0]}.csv`);
  }, [filteredPersonRows, projectClientByLabel]);
 
  return (
    <div className="reporting-root" data-theme={theme === "light" ? "light" : "dark"}>
      <AppSideNav />
 
      <main className="reporting-main rp-full-main">
 
        {/* ── Top View Mode Selector ── */}
        <motion.div className="rp-view-mode-selector-container" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <div className="rp-view-mode-selector">
            {VIEW_MODES.map(modeObj => {
              const Icon = modeObj.icon;
              const count = modeObj.key === "People" ? activePeople.length : projectRows.length;
              const isActive = state.viewMode === modeObj.key;
              return (
                <button
                  key={modeObj.key}
                  className={`rp-view-mode-btn ${isActive ? "rp-view-mode-btn--active" : ""}`}
                  onClick={() => dispatch({ type: "SET_VIEW_MODE", payload: modeObj.key })}
                >
                  <Icon size={14} />
                  {modeObj.key}
                  <span className="rp-view-mode-count">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="rp-top-actions">
            <div className="rp-export-dropdown" ref={exportRef}>
              <button
                className="rp-export-btn"
                onClick={() => dispatch({ type: "SET_OPEN_EXPORT", payload: !state.openExport })}
                title="Export data"
              >
                <Download size={14} /> Export
              </button>
              {state.openExport && (
                <div className="rp-export-options">
                  <button className="rp-export-option" onClick={exportChartData}>Export Chart Data</button>
                  <button className="rp-export-option" onClick={exportTableData}>Export Table Data</button>
                </div>
              )}
            </div>

            <div className="rp-quickadd-dropdown" ref={quickAddRef}>
              <button
                className="rp-add-btn"
                onClick={() => setOpenQuickAdd((v) => !v)}
                title="Quick add"
                aria-label="Quick add"
              >
                <Plus size={14} />
              </button>
              {openQuickAdd && (
                <div className="rp-export-options rp-quickadd-options">
                  <button
                    className="rp-export-option"
                    onClick={() => {
                      setOpenQuickAdd(false);
                      navigate("/", { state: { quickCreate: "allocation" } });
                    }}
                  >
                    Add allocation
                  </button>
                  <button
                    className="rp-export-option"
                    onClick={() => {
                      setOpenQuickAdd(false);
                      navigate("/", { state: { quickCreate: "leave" } });
                    }}
                  >
                    Add leave
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Toolbar ── */}
        <motion.div className="rp-toolbar" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="rp-date-nav">
            <button className="rp-icon-btn" onClick={() => navigateDateRange('prev')} aria-label="Previous period"><ChevronLeft size={14} /></button>
            <button className="rp-icon-btn" onClick={() => navigateDateRange('next')} aria-label="Next period"><ChevronRight size={14} /></button>
            <button className="rp-date-label rp-date-label-btn" onClick={() => setDatePickerOpen(!datePickerOpen)}>
              <span className="rp-date-accent">{chartStartLabel}</span>{" – "}<span className="rp-date-accent">{chartEndLabel}</span>
            </button>
            <button 
              className="rp-date-caret" 
              onClick={() => setDatePickerOpen(!datePickerOpen)}
              aria-label="Open date picker"
            >
              <ChevronDown size={13} />
            </button>
            {datePickerOpen && (
              <div className="rp-date-picker" ref={datePickerRef}>
                <div className="rp-date-picker-title">Select Timeframe</div>
                <div className="rp-date-picker-custom-row">
                  <label className="rp-date-picker-custom-label" htmlFor="rp-timeframe-select">Range</label>
                  <select
                    id="rp-timeframe-select"
                    className="rp-date-picker-select"
                    value={timeframeMode}
                    onChange={(e) => handleTimeframeSelect(e.target.value)}
                  >
                    <option value="custom">Custom</option>
                    <option value="next-12-weeks">Next 12 Weeks</option>
                    <option value="this-week">This Week</option>
                    <option value="this-month">This Month</option>
                    <option value="this-quarter">This Quarter</option>
                    <option value="this-year">This Year</option>
                    <option value="last-week">Last Week</option>
                    <option value="last-month">Last Month</option>
                    <option value="last-quarter">Last Quarter</option>
                    <option value="last-year">Last Year</option>
                  </select>
                </div>
                <div className="rp-date-picker-calendars">
                  <div className="rp-inline-calendar">
                    <div className="rp-inline-calendar-title">Start Date</div>
                    <div className="rp-inline-calendar-header">
                      <button className="rp-inline-calendar-nav" onClick={() => setStartMonthView((prev) => addMonths(prev, -1))} aria-label="Previous month">
                        <ChevronLeft size={12} />
                      </button>
                      <span className="rp-inline-calendar-month">{monthLabel(startMonthView)}</span>
                      <button className="rp-inline-calendar-nav" onClick={() => setStartMonthView((prev) => addMonths(prev, 1))} aria-label="Next month">
                        <ChevronRight size={12} />
                      </button>
                    </div>
                    <div className="rp-inline-calendar-weekdays">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, i) => <span key={`sw-${i}`}>{label}</span>)}
                    </div>
                    <div className="rp-inline-calendar-grid">
                      {buildCalendarDays(startMonthView).map(({ date, inMonth }) => {
                        const inRange = date >= dateRange.start && date <= dateRange.end;
                        const isStart = sameDay(date, dateRange.start);
                        const isEnd = sameDay(date, dateRange.end);
                        return (
                          <button
                            key={`start-${date.toISOString()}`}
                            className={`rp-inline-calendar-day ${inMonth ? '' : 'is-outside'} ${inRange ? 'is-range' : ''} ${isStart ? 'is-start' : ''} ${isEnd ? 'is-end' : ''}`}
                            onClick={() => {
                              const nextStart = new Date(date);
                              nextStart.setHours(0, 0, 0, 0);
                              setTimeframeMode('custom');
                              setDateRange((prev) => ({
                                start: nextStart,
                                end: prev.end < nextStart ? new Date(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate(), 23, 59, 59, 999) : prev.end,
                              }));
                            }}
                          >
                            {date.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rp-inline-calendar">
                    <div className="rp-inline-calendar-title">End Date</div>
                    <div className="rp-inline-calendar-header">
                      <button className="rp-inline-calendar-nav" onClick={() => setEndMonthView((prev) => addMonths(prev, -1))} aria-label="Previous month">
                        <ChevronLeft size={12} />
                      </button>
                      <span className="rp-inline-calendar-month">{monthLabel(endMonthView)}</span>
                      <button className="rp-inline-calendar-nav" onClick={() => setEndMonthView((prev) => addMonths(prev, 1))} aria-label="Next month">
                        <ChevronRight size={12} />
                      </button>
                    </div>
                    <div className="rp-inline-calendar-weekdays">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, i) => <span key={`ew-${i}`}>{label}</span>)}
                    </div>
                    <div className="rp-inline-calendar-grid">
                      {buildCalendarDays(endMonthView).map(({ date, inMonth }) => {
                        const inRange = date >= dateRange.start && date <= dateRange.end;
                        const isStart = sameDay(date, dateRange.start);
                        const isEnd = sameDay(date, dateRange.end);
                        return (
                          <button
                            key={`end-${date.toISOString()}`}
                            className={`rp-inline-calendar-day ${inMonth ? '' : 'is-outside'} ${inRange ? 'is-range' : ''} ${isStart ? 'is-start' : ''} ${isEnd ? 'is-end' : ''}`}
                            onClick={() => {
                              const nextEnd = new Date(date);
                              nextEnd.setHours(23, 59, 59, 999);
                              setTimeframeMode('custom');
                              setDateRange((prev) => ({
                                start: prev.start > nextEnd ? new Date(nextEnd.getFullYear(), nextEnd.getMonth(), nextEnd.getDate()) : prev.start,
                                end: nextEnd,
                              }));
                            }}
                          >
                            {date.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="rp-toolbar-right">
            <div className="rp-filters" ref={dropdownRef}>
              <div className="rp-filter-dropdown">
                <button 
                  className="rp-filter-pill" 
                  onClick={() => dispatch({ type: "SET_OPEN_FILTER", payload: state.openFilter === 'people' ? null : 'people' })}
                >
                  People: {getFilterLabel('people')} <ChevronDown size={12} />
                </button>
                {state.openFilter === 'people' && (
                  <div className="rp-filter-options">
                    {FILTER_OPTIONS.people.map(option => (
                      <label key={option} className="rp-filter-option">
                        <input 
                          type="checkbox" 
                          checked={state.filters.people.includes(option)}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...state.filters.people, option]
                              : state.filters.people.filter(s => s !== option);
                            dispatch({ type: "UPDATE_FILTER", filterType: 'people', payload: updated });
                          }}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="rp-filter-dropdown">
                <button 
                  className="rp-filter-pill" 
                  onClick={() => dispatch({ type: "SET_OPEN_FILTER", payload: state.openFilter === 'project' ? null : 'project' })}
                >
                  Project status: {getFilterLabel('project')} <ChevronDown size={12} />
                </button>
                {state.openFilter === 'project' && (
                  <div className="rp-filter-options">
                    {FILTER_OPTIONS.project.map(option => (
                      <label key={option} className="rp-filter-option">
                        <input 
                          type="checkbox" 
                          checked={state.filters.project.includes(option)}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...state.filters.project, option]
                              : state.filters.project.filter(s => s !== option);
                            dispatch({ type: "UPDATE_FILTER", filterType: 'project', payload: updated });
                          }}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="rp-filter-dropdown">
                <button 
                  className="rp-filter-pill" 
                  onClick={() => dispatch({ type: "SET_OPEN_FILTER", payload: state.openFilter === 'timeoff' ? null : 'timeoff' })}
                >
                  Time off: {getFilterLabel('timeoff')} <ChevronDown size={12} />
                </button>
                {state.openFilter === 'timeoff' && (
                  <div className="rp-filter-options">
                    {FILTER_OPTIONS.timeoff.map(option => (
                      <label key={option} className="rp-filter-option">
                        <input 
                          type="checkbox" 
                          checked={state.filters.timeoff.includes(option)}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...state.filters.timeoff, option]
                              : state.filters.timeoff.filter(s => s !== option);
                            dispatch({ type: "UPDATE_FILTER", filterType: 'timeoff', payload: updated });
                          }}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="rp-view-type-dropdown">
              <select 
                value={state.viewType} 
                onChange={(e) => dispatch({ type: "SET_VIEW_TYPE", payload: e.target.value })}
                className="rp-view-type-select"
              >
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>
            {/* Legend — inline with toolbar */}
            <div className="rp-chart-legend rp-chart-legend--toolbar">
              <span className="rp-chart-legend-item"><span className="rp-chart-legend-swatch" style={{ background: CHART_COLORS.billable }} />Billable</span>
              <span className="rp-chart-legend-item"><span className="rp-chart-legend-swatch" style={{ background: CHART_COLORS.nonBillable }} />Non-billable</span>
              <span className="rp-chart-legend-item"><span className="rp-chart-legend-swatch" style={{ background: CHART_COLORS.timeOff }} />Time off</span>
              <span className="rp-chart-legend-item"><span className="rp-chart-legend-swatch rp-chart-legend-swatch--cap" />Capacity</span>
              <span className="rp-chart-legend-item"><span className="rp-chart-legend-dot" />Public holiday</span>
            </div>
          </div>
        </motion.div>
 
        {/* ── Chart ── */}
        <motion.div className="rp-chart-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.05 }}>
          <div className="rp-chart-body" ref={chartRef} onMouseLeave={() => { setHoveredBar(null); setHoveredHoliday(null); }}>

            {/* Y-axis labels */}
            <div className="rp-chart-yaxis">
              {yTicks.map((tick) => (
                <div key={tick} className="rp-chart-ytick" style={{ bottom: `${(tick / yMax) * 100}%` }}>
                  {fmtYLabel(tick)}
                </div>
              ))}
            </div>

            {/* Chart plot + axes */}
            <div className="rp-chart-main">
              <div className="rp-chart-plot">
                {/* Horizontal grid lines */}
                {yTicks.map((tick) => (
                  <div key={tick} className="rp-chart-gridline" style={{ bottom: `${(tick / yMax) * 100}%` }} />
                ))}

                {/* Bar columns */}
                {chartRange.data.map((d, i) => {
                  const capH  = Math.min((capacityPerBar / yMax) * 100, 100);
                  const bilH  = yMax > 0 ? (d.billable    / yMax) * 100 : 0;
                  const nonH  = yMax > 0 ? (d.nonBillable / yMax) * 100 : 0;
                  const tofH  = yMax > 0 ? (d.timeOff     / yMax) * 100 : 0;
                  const totalH = bilH + nonH + tofH;
                  const sPct = capacityPerBar > 0 ? Math.round((d.total        / capacityPerBar) * 100) : 0;
                  const bPct = capacityPerBar > 0 ? Math.round((d.billable     / capacityPerBar) * 100) : 0;
                  const nPct = capacityPerBar > 0 ? Math.round((d.nonBillable  / capacityPerBar) * 100) : 0;
                  return (
                    <div key={i} className="rp-chart-bar-col">
                      {/* Capacity ghost */}
                      <div className="rp-chart-cap-bar" style={{ height: `${capH}%` }} />
                      {/* Stacked segments (rendered bottom→top via column-reverse) */}
                      {totalH > 0 && (
                        <div
                          className="rp-chart-stack"
                          style={{ height: `${totalH}%` }}
                          onMouseEnter={(e) => handleBarHover(e, d, sPct, bPct, nPct)}
                        >
                          {d.billable    > 0 && <div className="rp-chart-seg" style={{ flex: d.billable,    background: CHART_COLORS.billable    }} />}
                          {d.nonBillable > 0 && <div className="rp-chart-seg" style={{ flex: d.nonBillable, background: CHART_COLORS.nonBillable }} />}
                          {d.timeOff     > 0 && <div className="rp-chart-seg" style={{ flex: d.timeOff,     background: CHART_COLORS.timeOff     }} />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* X-axis date labels */}
              <div className="rp-chart-xaxis">
                {chartRange.data.map((d, i) => (
                  <div key={i} className={`rp-chart-xlabel${i % labelStep !== 0 ? " rp-chart-xlabel--hidden" : ""}`}>
                    {d.label}
                  </div>
                ))}
              </div>

              {/* Holiday dots */}
              <div className="rp-chart-holiday-row">
                {chartRange.data.map((d, i) => (
                  <div key={i} className="rp-chart-holiday-cell">
                    {d.holidays?.length > 0 && (
                      <div
                        className="rp-chart-holiday-dot"
                        onMouseEnter={(e) => handleHolidayEnter(e, d.holidays)}
                        onMouseLeave={handleHolidayLeave}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Hover tooltip — position:fixed so it never bleeds into adjacent elements */}
            {hoveredBar && (
              <div
                className="rp-chart-tooltip"
                style={{
                  left: Math.min(hoveredBar.x + 16, window.innerWidth - 225),
                  top: Math.max(hoveredBar.y - 120, 8),
                }}
              >
                <div className="rp-chart-tooltip-title">{hoveredBar.d.label}</div>
                <div className="rp-chart-tooltip-row">
                  <span className="rp-chart-tooltip-label">Capacity</span>
                  <span className="rp-chart-tooltip-val">{fmt(capacityPerBar)}</span>
                </div>
                <div className="rp-chart-tooltip-row">
                  <span className="rp-chart-tooltip-label">Scheduled <span className="rp-chart-tooltip-pct">{hoveredBar.schedPct}%</span></span>
                  <span className="rp-chart-tooltip-val">{fmt(hoveredBar.d.total)}</span>
                </div>
                <div className="rp-chart-tooltip-row">
                  <span className="rp-chart-tooltip-label">
                    <span className="rp-chart-tooltip-swatch" style={{ background: CHART_COLORS.billable }} />
                    Billable <span className="rp-chart-tooltip-pct">{hoveredBar.bilPct}%</span>
                  </span>
                  <span className="rp-chart-tooltip-val">{fmt(hoveredBar.d.billable)}</span>
                </div>
                <div className="rp-chart-tooltip-row">
                  <span className="rp-chart-tooltip-label">
                    <span className="rp-chart-tooltip-swatch" style={{ background: CHART_COLORS.nonBillable }} />
                    Non-billable <span className="rp-chart-tooltip-pct">{hoveredBar.nonPct}%</span>
                  </span>
                  <span className="rp-chart-tooltip-val">{fmt(hoveredBar.d.nonBillable)}</span>
                </div>
                <div className="rp-chart-tooltip-row">
                  <span className="rp-chart-tooltip-label">
                    <span className="rp-chart-tooltip-swatch" style={{ background: CHART_COLORS.timeOff }} />
                    Time off
                  </span>
                  <span className="rp-chart-tooltip-val">{fmt(hoveredBar.d.timeOff)}</span>
                </div>
              </div>
            )}
          </div>

        </motion.div>

        {/* Holiday tooltip — rendered outside chart, position:fixed */}
        {hoveredHoliday && (
          <div
            className="rp-chart-holiday-tooltip"
            style={{
              left: Math.min(hoveredHoliday.x + 12, window.innerWidth - 240),
              top: hoveredHoliday.y - 40,
            }}
          >
            {hoveredHoliday.names.map((n, i) => <div key={i}>{n}</div>)}
          </div>
        )}
 
        {/* ── Stats Strip ── */}
        <motion.div className="rp-stats-strip" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}>
          <div className="rp-stat">
            <span className="rp-stat-label">Capacity</span>
            <span className="rp-stat-value">{fmt(totals.cap)}</span>
          </div>
          <div className="rp-stat-divider" />
          <div className="rp-stat">
            <span className="rp-stat-label">Scheduled <span className="rp-stat-pct">{pct(totals.sch, totals.cap)}</span></span>
            <span className="rp-stat-value">{fmt(totals.sch)}</span>
          </div>
          <div className="rp-stat-divider" />
          <div className="rp-stat">
            <span className="rp-stat-label"><span className="rp-swatch rp-swatch--billable" />Billable <span className="rp-stat-pct">{pct(totals.bil, totals.cap)}</span></span>
            <span className="rp-stat-value">{fmt(totals.bil)}</span>
          </div>
          <div className="rp-stat-divider" />
          <div className="rp-stat">
            <span className="rp-stat-label"><span className="rp-swatch rp-swatch--nonbill" />Non-billable <span className="rp-stat-pct">{pct(totals.non, totals.cap)}</span></span>
            <span className="rp-stat-value">{fmt(totals.non)}</span>
          </div>
          <div className="rp-stat-divider" />
          <div className="rp-stat">
            <span className="rp-stat-label">Unscheduled <span className="rp-stat-pct">{pct(totals.unsch, totals.cap)}</span></span>
            <span className="rp-stat-value">{fmt(totals.unsch)}</span>
          </div>
          <div className="rp-stat-divider" />
          <div className="rp-stat">
            <span className="rp-stat-label">Time off</span>
            <span className="rp-stat-value">{fmt(totals.toff)}</span>
          </div>
          <div className="rp-stat-divider" />
          <div className="rp-stat">
            <span className="rp-stat-label">Overtime</span>
            <span className="rp-stat-value">{fmt(totals.ot)}</span>
          </div>
        </motion.div>
 
        {/* ── Tabs ── */}
        {state.viewMode === "People" ? (
          <motion.div className="rp-tabs-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.15 }}>
            {PEOPLE_TABS.map(({ key }) => (
              <button key={key} className={`rp-tab ${state.activeTab === key ? "rp-tab--active" : ""}`} onClick={() => dispatch({ type: "SET_ACTIVE_TAB", payload: key })}>
                {key}
                {tabCounts[key] != null && <span className="rp-tab-count">{tabCounts[key]}</span>}
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.div className="rp-tabs-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.15 }}>
            <button
              className={`rp-tab ${state.projectGrouping === "projects" ? "rp-tab--active" : ""}`}
              onClick={() => dispatch({ type: "SET_PROJECT_GROUPING", payload: "projects" })}
            >
              Projects
              <span className="rp-tab-count">{projectCountsByGrouping.projects}</span>
            </button>
            <button
              className={`rp-tab ${state.projectGrouping === "clients" ? "rp-tab--active" : ""}`}
              onClick={() => dispatch({ type: "SET_PROJECT_GROUPING", payload: "clients" })}
            >
              Clients
              <span className="rp-tab-count">{projectCountsByGrouping.clients}</span>
            </button>
          </motion.div>
        )}

        {(drilldown.personId || drilldown.project || drilldown.client) && (
          <div className="rp-active-filters" role="status" aria-live="polite">
            <span className="rp-active-filters-label">Filtered by:</span>
            {drilldown.personName && <span className="rp-active-filter-chip">Person: {drilldown.personName}</span>}
            {drilldown.project && <span className="rp-active-filter-chip">Project: {drilldown.project}</span>}
            {drilldown.client && <span className="rp-active-filter-chip">Client: {drilldown.client}</span>}
            <button type="button" className="rp-active-filter-clear" onClick={clearDrilldown}>Clear</button>
          </div>
        )}
 
        {/* ── Tables ── */}
        <motion.div className="rp-table-wrap" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.2 }}>
 
          {state.viewMode === "People" ? (
            <>
              {/* ── People ── */}
              {state.activeTab === "People" && (
                <table className="rp-table">
                  <StandardThead firstColLabel="Person" />
                  <tbody>
                    <tr className="rp-row rp-row--totals">
                      <td className="rp-td rp-td--expand" />
                      <td className="rp-td rp-td--name rp-td--bold">Total</td>
                      <td className="rp-td rp-td--muted">—</td>
                      <td className="rp-td rp-td--num rp-td--bold">{fmt(totals.cap)}</td>
                      <td className="rp-td rp-td--num">{fmt(totals.sch)}</td>
                      <td className="rp-td rp-td--num">{fmt(totals.bil)}</td>
                      <td className="rp-td rp-td--num">{fmt(totals.non)}</td>
                      <td className="rp-td rp-td--num">{fmt(totals.toff)}</td>
                      <td className="rp-td rp-td--num">{fmt(totals.ot)}</td>
                      <td className="rp-td rp-td--num"><SchedCell scheduled={totals.sch} capacity={totals.cap} /></td>
                      <td className="rp-td rp-td--num">{fmt(totals.bil * COST_PER_HOUR)}</td>
                    </tr>
                    {filteredPersonRows.map((person, idx) => {
                      const isExpanded = state.expanded[person.id];
                      return (
                        <Fragment key={`person-${person.id}`}>
                          <tr className={`rp-row ${idx % 2 === 0 ? "rp-row--even" : ""}`}>
                            <td className="rp-td rp-td--expand">
                              <button className="rp-expand-btn" onClick={() => toggleRow(person.id)} aria-label={isExpanded ? "Collapse" : "Expand"}>
                                <ChevronRight size={13} className={`rp-expand-icon ${isExpanded ? "rp-expand-icon--open" : ""}`} />
                              </button>
                            </td>
                            <td className="rp-td rp-td--name">
                              <button
                                type="button"
                                className="rp-cell-link"
                                onClick={() => toggleDrilldown({ personId: person.id, personName: person.name })}
                              >
                                {person.name}
                              </button>
                            </td>
                            <td className="rp-td rp-td--dept">{person.dept}</td>
                            <td className="rp-td rp-td--num">{fmt(person.capacity)}</td>
                            <td className="rp-td rp-td--num">{fmt(person.scheduled)}</td>
                            <td className="rp-td rp-td--num">{fmt(person.billable)}</td>
                            <td className="rp-td rp-td--num">{fmt(person.nonBillable)}</td>
                            <td className="rp-td rp-td--num">{fmt(person.timeOff)}</td>
                            <td className="rp-td rp-td--num">{fmt(person.overtime)}</td>
                            <td className="rp-td rp-td--num"><SchedCell scheduled={person.scheduled} capacity={person.capacity} /></td>
                            <td className="rp-td rp-td--num">{fmt(person.billable * COST_PER_HOUR)}</td>
                          </tr>
                          <DetailRow isExpanded={isExpanded} colSpan={11}>
                            {person.projectTotals.size > 0
                              ? Array.from(person.projectTotals.entries()).map(([label, hours]) => (
                                  <div key={label} style={{ marginBottom: 6 }}>
                                    <button
                                      type="button"
                                      className="rp-cell-link"
                                      onClick={() => toggleDrilldown({ project: label })}
                                    >
                                      <strong>{label}</strong>
                                    </button>
                                    : {fmt(hours)}
                                  </div>
                                ))
                              : "No project breakdowns in this date range."}
                          </DetailRow>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
 
              {/* ── Roles ── */}
              {state.activeTab === "Roles" && (
                <table className="rp-table">
                  <StandardThead firstColLabel="Role" />
                  <tbody>
                    {roleRows.map((row, idx) => (
                      <StandardRow
                        key={`role-${row.id}`}
                        row={row}
                        idx={idx}
                        expanded={state.expanded}
                        toggleRow={toggleRow}
                        onPersonClick={(person) => toggleDrilldown({ personId: person.id, personName: person.name })}
                      />
                    ))}
                  </tbody>
                </table>
              )}
 
              {/* ── Departments ── */}
              {state.activeTab === "Departments" && (
                <table className="rp-table">
                  <StandardThead firstColLabel="Department" showDept={false} />
                  <tbody>
                    {deptRows.map((row, idx) => (
                      <StandardRow
                        key={`dept-${row.id}`}
                        row={row}
                        idx={idx}
                        expanded={state.expanded}
                        toggleRow={toggleRow}
                        showDept={false}
                        onPersonClick={(person) => toggleDrilldown({ personId: person.id, personName: person.name })}
                      />
                    ))}
                  </tbody>
                </table>
              )}
 
              {/* ── Projects ── */}
              {state.activeTab === "Projects" && (
                <table className="rp-table">
                  <thead>
                    <tr>
                      <th className="rp-th rp-th--expand" />
                      <th className="rp-th rp-th--name">Project <ChevronDown size={12} className="rp-th-sort" /></th>
                      <th className="rp-th">Code</th>
                      <th className="rp-th">Client</th>
                      <th className="rp-th">Owner</th>
                      <th className="rp-th rp-th--num rp-th--accent">Scheduled</th>
                      <th className="rp-th rp-th--num rp-th--accent">Billable</th>
                      <th className="rp-th rp-th--num rp-th--accent">Non-billable</th>
                      <th className="rp-th rp-th--num">Billable %</th>
                      <th className="rp-th rp-th--num">Scheduled Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProjectRows.length === 0
                      ? <tr><td colSpan={10} className="rp-td"><div className="rp-empty-tab">No project data in this period.</div></td></tr>
                      : visibleProjectRows.map((row, idx) => {
                          const isExpanded = state.expanded[row.id];
                          return (
                            <Fragment key={`project-${row.id}`}>
                              <tr className={`rp-row ${idx % 2 === 0 ? "rp-row--even" : ""}`}>
                                <td className="rp-td rp-td--expand">
                                  <button className="rp-expand-btn" onClick={() => toggleRow(row.id)} aria-label={isExpanded ? "Collapse" : "Expand"}>
                                    <ChevronRight size={13} className={`rp-expand-icon ${isExpanded ? "rp-expand-icon--open" : ""}`} />
                                  </button>
                                </td>
                                <td className="rp-td rp-td--name">
                                  <button
                                    type="button"
                                    className="rp-cell-link"
                                    onClick={() => toggleDrilldown({ project: row.id })}
                                  >
                                    {row.name}
                                  </button>
                                </td>
                                <td className="rp-td rp-td--dept">{row.code}</td>
                                <td className="rp-td rp-td--dept">
                                  <button
                                    type="button"
                                    className="rp-cell-link"
                                    onClick={() => toggleDrilldown({ client: row.client })}
                                  >
                                    {row.client}
                                  </button>
                                </td>
                                <td className="rp-td rp-td--dept">{row.owner}</td>
                                <td className="rp-td rp-td--num">{fmt(row.scheduled)}</td>
                                <td className="rp-td rp-td--num">{fmt(row.billable)}</td>
                                <td className="rp-td rp-td--num">{fmt(row.nonBillable)}</td>
                                <td className="rp-td rp-td--num">{pct(row.billable, row.scheduled)}</td>
                                <td className="rp-td rp-td--num">{fmt(row.scheduledCost)}</td>
                              </tr>
                              <DetailRow isExpanded={isExpanded} colSpan={10}>
                                {row.people.length > 0
                                  ? row.people.map(person => (
                                      <div key={person.id} style={{ marginBottom: 6 }}>
                                        <button
                                          type="button"
                                          className="rp-cell-link"
                                          onClick={() => toggleDrilldown({ personId: person.id, personName: person.name })}
                                        >
                                          <strong>{person.name}</strong>
                                        </button>
                                        : Scheduled {fmt(person.scheduled)}, Billable {fmt(person.billable)}
                                      </div>
                                    ))
                                  : "No people assigned."}
                              </DetailRow>
                            </Fragment>
                          );
                        })}
                  </tbody>
                </table>
              )}
 
              {/* ── Tasks ── */}
              {state.activeTab === "Tasks" && (
                <table className="rp-table">
                  <StandardThead firstColLabel="Allocation Type" showDept={false} />
                  <tbody>
                    {taskRows.length === 0
                      ? <tr><td colSpan={10} className="rp-td"><div className="rp-empty-tab">No task data in this period.</div></td></tr>
                      : taskRows.map((row, idx) => (
                          <StandardRow
                            key={`task-${row.id}`}
                            row={row}
                            idx={idx}
                            expanded={state.expanded}
                            toggleRow={toggleRow}
                            showDept={false}
                            onPersonClick={(person) => toggleDrilldown({ personId: person.id, personName: person.name })}
                          />
                        ))}
                  </tbody>
                </table>
              )}
 
              {/* ── Time off ── */}
              {state.activeTab === "Time off" && (
                <table className="rp-table">
                  <thead>
                    <tr>
                      <th className="rp-th rp-th--expand" />
                      <th className="rp-th rp-th--name">Leave Type <ChevronDown size={12} className="rp-th-sort" /></th>
                      <th className="rp-th rp-th--num">People</th>
                      <th className="rp-th rp-th--num">Total Days</th>
                      <th className="rp-th rp-th--num">Total Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeOffRows.length === 0
                      ? <tr><td colSpan={5} className="rp-td"><div className="rp-empty-tab">No time off data in this period.</div></td></tr>
                      : timeOffRows.map((row, idx) => {
                          const isExpanded = state.expanded[row.id];
                          return (
                            <Fragment key={`timeoff-${row.id}`}>
                              <tr className={`rp-row ${idx % 2 === 0 ? "rp-row--even" : ""}`}>
                                <td className="rp-td rp-td--expand">
                                  <button className="rp-expand-btn" onClick={() => toggleRow(row.id)} aria-label={isExpanded ? "Collapse" : "Expand"}>
                                    <ChevronRight size={13} className={`rp-expand-icon ${isExpanded ? "rp-expand-icon--open" : ""}`} />
                                  </button>
                                </td>
                                <td className="rp-td rp-td--name">{row.name}</td>
                                <td className="rp-td rp-td--num">{row.people.length}</td>
                                <td className="rp-td rp-td--num">{row.totalDays.toFixed(1)}</td>
                                <td className="rp-td rp-td--num">{fmt(row.totalHours)}</td>
                              </tr>
                              <DetailRow isExpanded={isExpanded} colSpan={5}>
                                {row.people.length > 0
                                  ? row.people.map(person => (
                                      <div key={person.id} style={{ marginBottom: 6 }}>
                                        <button
                                          type="button"
                                          className="rp-cell-link"
                                          onClick={() => toggleDrilldown({ personId: person.id, personName: person.name })}
                                        >
                                          <strong>{person.name}</strong>
                                        </button>
                                        : {fmt(person.timeOff)} ({(person.timeOff / 7.5).toFixed(1)} days)
                                      </div>
                                    ))
                                  : "No people on this leave type."}
                              </DetailRow>
                            </Fragment>
                          );
                        })}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <>
              {/* ── Projects Grouping ── */}
              {state.projectGrouping === "projects" && (
                <table className="rp-table">
                  <thead>
                    <tr>
                      <th className="rp-th rp-th--expand" />
                      <th className="rp-th rp-th--name">Project <ChevronDown size={12} className="rp-th-sort" /></th>
                      <th className="rp-th">Project Code</th>
                      <th className="rp-th">Client</th>
                      <th className="rp-th">Stage</th>
                      <th className="rp-th">Owner</th>
                      <th className="rp-th rp-th--num">Budget</th>
                      <th className="rp-th rp-th--num rp-th--accent">Scheduled %</th>
                      <th className="rp-th rp-th--num rp-th--accent">Scheduled Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProjectRows.length === 0
                      ? <tr><td colSpan={9} className="rp-td"><div className="rp-empty-tab">No project data in this period.</div></td></tr>
                      : visibleProjectRows.map((row, idx) => {
                          const isExpanded = state.expanded[row.id];
                          return (
                            <Fragment key={`project-${row.id}`}>
                              <tr className={`rp-row ${idx % 2 === 0 ? "rp-row--even" : ""}`}>
                                <td className="rp-td rp-td--expand">
                                  <button className="rp-expand-btn" onClick={() => toggleRow(row.id)} aria-label={isExpanded ? "Collapse" : "Expand"}>
                                    <ChevronRight size={13} className={`rp-expand-icon ${isExpanded ? "rp-expand-icon--open" : ""}`} />
                                  </button>
                                </td>
                                <td className="rp-td rp-td--name">
                                  <button
                                    type="button"
                                    className="rp-cell-link"
                                    onClick={() => toggleDrilldown({ project: row.id })}
                                  >
                                    {row.name}
                                  </button>
                                </td>
                                <td className="rp-td rp-td--dept">{row.code}</td>
                                <td className="rp-td rp-td--dept">
                                  <button
                                    type="button"
                                    className="rp-cell-link"
                                    onClick={() => toggleDrilldown({ client: row.client })}
                                  >
                                    {row.client}
                                  </button>
                                </td>
                                <td className="rp-td rp-td--dept">{row.stage ? row.stage.charAt(0).toUpperCase() + row.stage.slice(1) : "—"}</td>
                                <td className="rp-td rp-td--dept">{row.owner}</td>
                                <td className="rp-td rp-td--num">—</td>
                                <td className="rp-td rp-td--num">100%</td>
                                <td className="rp-td rp-td--num">{fmt(row.scheduled)}</td>
                              </tr>
                              <DetailRow isExpanded={isExpanded} colSpan={9}>
                                <div>
                                  <strong>No Phases</strong>
                                </div>
                              </DetailRow>
                            </Fragment>
                          );
                        })}
                  </tbody>
                </table>
              )}

              {/* ── Clients Grouping ── */}
              {state.projectGrouping === "clients" && (
                <table className="rp-table">
                  <thead>
                    <tr>
                      <th className="rp-th rp-th--expand" />
                      <th className="rp-th rp-th--name">Client</th>
                      <th className="rp-th rp-th--num">Budget</th>
                      <th className="rp-th rp-th--num rp-th--accent">Scheduled Hours</th>
                      <th className="rp-th rp-th--num rp-th--accent">Scheduled %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleClientRows.length === 0
                      ? <tr><td colSpan={5} className="rp-td"><div className="rp-empty-tab">No client data in this period.</div></td></tr>
                      : visibleClientRows.map((row, idx) => {
                          const isExpanded = state.expanded[`client-${row.id}`];
                          const schedPct = row.scheduled > 0 ? 100 : 0;
                          return (
                            <Fragment key={`client-${row.id}`}>
                              <tr className={`rp-row ${idx % 2 === 0 ? "rp-row--even" : ""}`}>
                                <td className="rp-td rp-td--expand">
                                  <button className="rp-expand-btn" onClick={() => toggleRow(`client-${row.id}`)} aria-label={isExpanded ? "Collapse" : "Expand"}>
                                    <ChevronRight size={13} className={`rp-expand-icon ${isExpanded ? "rp-expand-icon--open" : ""}`} />
                                  </button>
                                </td>
                                <td className="rp-td rp-td--name">
                                  <button
                                    type="button"
                                    className="rp-cell-link"
                                    onClick={() => toggleDrilldown({ client: row.name })}
                                  >
                                    {row.name}
                                  </button>
                                </td>
                                <td className="rp-td rp-td--num">—</td>
                                <td className="rp-td rp-td--num">{fmt(row.scheduled)}</td>
                                <td className="rp-td rp-td--num">{schedPct}%</td>
                              </tr>
                              <DetailRow isExpanded={isExpanded} colSpan={5}>
                                {row.projects.length > 0
                                  ? row.projects.map((project) => (
                                      <div key={`${row.id}-${project.id}`} style={{ marginBottom: 6 }}>
                                        <button
                                          type="button"
                                          className="rp-cell-link"
                                          onClick={() => toggleDrilldown({ project: project.id })}
                                        >
                                          <strong>{project.name}</strong>
                                        </button>
                                        {` (${project.code || "—"})`} - {fmt(project.scheduled)}
                                      </div>
                                    ))
                                  : "No projects for this client in the selected period."}
                              </DetailRow>
                            </Fragment>
                          );
                        })}
                  </tbody>
                </table>
              )}
            </>
          )}
 
        </motion.div>
      </main>
    </div>
  );
}