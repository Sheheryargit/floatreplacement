import { useState, useMemo, useRef, useEffect, Fragment, useReducer, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Filter,
  Plus,
  Users,
  FolderOpen,
  Search,
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
 
// Tab labels shown in the People view — each maps to a different grouping of the same underlying data.
// Keeping them in a constant array means adding a new tab is a one-line change here rather than
// hunting through JSX.
const PEOPLE_TABS = [
  { key: "People" },
  { key: "Roles" },
  { key: "Departments" },
  { key: "Projects" },
  { key: "Tasks" },
  { key: "Time off" },
];

// Top-level view modes — People focuses on who is scheduled; Projects focuses on what is scheduled.
// Separating them avoids overwhelming the user with all dimensions at once.
const VIEW_MODES = [
  { key: "People", icon: Users },
  { key: "Projects", icon: FolderOpen }
];

const ADVANCED_FILTER_CATEGORIES = [
  { key: "person", label: "Person" },
  { key: "department", label: "Department" },
  { key: "role", label: "Role" },
  { key: "project", label: "Project" },
  { key: "client", label: "Client" },
];

const EMPTY_ADVANCED_FILTERS = {
  person: [],
  department: [],
  role: [],
  project: [],
  client: [],
};
 
// fmt — formats a raw hour number into a human-readable string like "37.5h".
// Rounds to 1 decimal so we don't show unnecessary precision (e.g. "37.500001h").
// Returns "0h" for falsy/zero values so table cells never show blank or "NaNh".
const fmt = (h) => {
  if (!h || h === 0) return "0h";
  const rounded = Math.round(h * 10) / 10;
  return `${rounded.toLocaleString("en-AU")}h`;
};

// pct — calculates a percentage string from two numbers.
// Guards against division-by-zero (e.g. a person with 0 capacity) by returning "0%".
const pct = (a, b) => b === 0 ? "0%" : `${Math.round((a / b) * 100)}%`;

// Hardcoded billing rate used to calculate "Scheduled Cost" (billable hours × rate).
// A single constant makes it easy to change without hunting through the file.
// Limitation: this is not per-person or per-project — a future enhancement could
// pull this from project or person metadata.
const COST_PER_HOUR = 100;

// Chart bar colours — defined once here so they stay consistent between the
// stacked bars, the hover tooltip swatches, and the legend.
const CHART_COLORS = {
  billable:    "#22d3ee", // cyan — revenue-generating work
  nonBillable: "#818cf8", // indigo — internal/overhead work
  timeOff:     "#fbbf24", // amber — leave/public holidays
};

// Generates "nice" round Y-axis tick values (e.g. 0, 50, 100, 150 rather than 0, 47, 94, 141).
// Why: raw data maxima are rarely round numbers, so we snap to the nearest human-friendly
// magnitude (1, 2, 5, or 10 × power of 10) that still fits ~targetCount labels.
// How: divide max by desired tick count to get a raw step, find the nearest "nice" multiplier
// within the same order of magnitude, then build the tick array upward from 0.
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

// Compact Y-axis label formatter — large numbers are abbreviated (e.g. 1500 → "1.5k")
// so tick labels don't overflow the narrow Y-axis column.
function fmtYLabel(h) {
  if (h >= 10000) return `${Math.round(h / 1000)}k`;
  if (h >= 1000) return `${(h / 1000).toFixed(1)}k`;
  return String(h);
}
 
// Safe date parser — returns null for missing/invalid values instead of an Invalid Date object.
// Strips the time component (setHours 0,0,0,0) so all date comparisons work at day granularity
// and are not affected by timezone offsets that could shift dates by ±1 day.
function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}
 
// ── Date utility functions ───────────────────────────────────────────────────
// Pure helpers used throughout this file. All return new Date instances rather
// than mutating in place, so date arithmetic stays predictable across memos.

// Adds a fixed number of calendar days — handles month and year rollovers.
function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// Adds a fixed number of months — JS setMonth handles wrapping (e.g. Jan - 1 = Dec).
function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

// Returns true if two dates fall on the same calendar day regardless of time.
function sameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Clamps a date to midnight on the 1st of its month.
function toMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// Formats a date as "July 2025" — used as the calendar picker month heading.
function monthLabel(date) {
  return date.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

// Builds a 6-row × 7-column (42 cell) calendar grid for a given month.
// Why 42: a month can start on any day of the week and span at most 6 rows.
// Starts from the Sunday before the 1st of the month so the grid always
// begins on Sunday — cells outside the current month are flagged with inMonth:false
// so the calendar UI can dim them while still filling the grid.
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
 
// setHours(0,0,0,0) / (23,59,59,999) gives full-day-inclusive boundaries so that
// allocations starting or ending exactly on the boundary day are still included.
function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // rewind to Sunday (day 0)
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() + (6 - d.getDay())); // advance to Saturday (day 6)
  d.setHours(23, 59, 59, 999);
  return d;
}

// Month boundary helpers.
function startOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date) {
  // day 0 of next month = last day of this month
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

// Quarter boundary helpers — quarter index is 0–3 (Jan–Mar = 0, Apr–Jun = 1, …).
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

// Full-year boundary helpers.
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

// Maps a preset label (e.g. "this-quarter") to an exact { start, end } Date pair.
// Why a function rather than hardcoded values: the correct range depends on when the
// user opens the page ("this week" is different every day), so it must be computed at runtime.
// End dates are set to 23:59:59.999 so that allocations starting on the last day of the range
// are still included in overlap checks (end >= rangeStart).
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

// Formats a date as "15 Apr" — used for chart X-axis labels and the date range header.
function weekLabel(date) {
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
 
// Returns the total hours for a single allocation record.
// Why the fallback chain: older records may not have totalHours pre-calculated,
// so we fall back to hoursPerDay × workingDays if totalHours is 0 or missing.
// This ensures we don't lose data for records created before totalHours was stored.
function allocationHours(alloc) {
  if (!alloc) return 0;
  const total = Number(alloc.totalHours) || 0;
  if (total > 0) return total;
  const hoursPerDay = Number(alloc.hoursPerDay) || 0;
  const workingDays = Number(alloc.workingDays) || 0;
  return hoursPerDay * workingDays;
}

// Counts working days (Mon–Fri) in a date range, inclusive of both endpoints.
// Why needed: capacity and pro-rated hours must exclude weekends — a 10-day range
// spanning a weekend has only 8 working days, not 10.
// This is used by allocationHoursInRange and personCapacityInRange.
function countWeekdaysInRange(startDate, endDate) {
  let n = 0;
  const end = new Date(endDate);
  for (const d = new Date(startDate); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) n++; // 0 = Sunday, 6 = Saturday
  }
  return n;
}

// Calculates how many hours of an allocation fall within the chosen date range.
//
// Why pro-rating: an allocation from April 20 – May 20 should only contribute
// May's portion of hours when the user is viewing May 1-31. Without pro-rating,
// the full allocation hours would be counted even for partially-overlapping work.
//
// How it works:
//   1. Repeating allocations are already pre-clipped to one occurrence window
//      (done in rangedAllocations memo), so they use full hours without pro-rating.
//   2. If the allocation fits entirely inside the range, use the full hours directly.
//   3. If hoursPerDay is known, multiply it by the number of overlapping working days
//      (most accurate — avoids assumptions about totalHours pre-calculation).
//   4. Otherwise fall back to scaling totalHours by the fraction of working days
//      that fall inside the range (handles legacy records without hoursPerDay).
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
    // Clamp the allocation to the visible range and count working days in that overlap
    const overlapStart = aStart < rangeStart ? rangeStart : aStart;
    const overlapEnd = aEnd > rangeEnd ? rangeEnd : aEnd;
    return hoursPerDay * countWeekdaysInRange(overlapStart, overlapEnd);
  }

  // Fall back: pro-rate totalHours by the fraction of working days that overlap
  const total = allocationHours(alloc);
  const allocDays = countWeekdaysInRange(aStart, aEnd);
  if (allocDays === 0) return total;
  const overlapStart = aStart < rangeStart ? rangeStart : aStart;
  const overlapEnd = aEnd > rangeEnd ? rangeEnd : aEnd;
  const overlapDays = countWeekdaysInRange(overlapStart, overlapEnd);
  return total * (overlapDays / allocDays);
}

// Calculates the total hours a person is available to work within a date range.
//
// Why per-person: people have different work patterns — a 4-day worker on Mon-Thu
// has different capacity than a 5-day worker, even over the same date range.
//
// How it works:
//   1. Get the person's hours-per-day (defaults to 7.5 if not set — a standard AU work day).
//   2. Build a lookup for which days of the week they work (availMon–availFri flags).
//      Defaults to true for all weekdays if flags aren't set (backwards compatibility).
//   3. Walk every calendar day in the range; if the person works that day-of-week, add it.
//   4. Multiply the count of working days by hours-per-day.
//
// Limitation: does not subtract public holidays from capacity — those must be entered
// as leave entries to affect scheduled hours, not capacity.
function personCapacityInRange(person, rangeStart, rangeEnd) {
  const hpd = person.hoursPerDay ?? 7.5;
  // Map JS getDay() (0=Sun…6=Sat) to person availability flags
  const worksDow = [
    false,                        // Sunday — never a work day
    person.availMon ?? true,      // Monday
    person.availTue ?? true,      // Tuesday
    person.availWed ?? true,      // Wednesday
    person.availThu ?? true,      // Thursday
    person.availFri ?? true,      // Friday
    false,                        // Saturday — never a work day
  ];
  let days = 0;
  for (const d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    if (worksDow[d.getDay()]) days++;
  }
  return days * hpd;
}

// Normalises strings for case-insensitive comparisons (drilldown filters, project matching).
// Why: project names may be stored with inconsistent casing; normalising both sides
// prevents "ARTC" and "artc" from being treated as different projects.
function normalizeText(value) {
  return (value || "").toString().trim().toLowerCase();
}

function uniqueSorted(values) {
  return Array.from(
    new Set(
      values
        .map((value) => (value || "").toString().trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

// Generic grouping helper used by roleRows, deptRows etc.
// Why generic: Roles, Departments, and Tasks all need the same pattern — group person rows
// by a string key and sum their numeric fields. A single function avoids duplicating the
// reduce logic three times and ensures all tabs aggregate consistently.
// How: builds a plain object map (key → aggregated stats + people array), then converts
// to an array so it can be rendered as table rows.
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
 
// Returns the display key for grouping an allocation by project in the breakdown.
// Why: leave entries should all group under "Leave" regardless of their project field.
// Allocations without a project string fall back to "Unspecified work" to avoid a blank
// group key in the table. The project match lookup ensures we use the canonical project label
// (code/name) even if the allocation was saved with a slightly different string.
function breakdownKey(alloc, projects) {
  if (alloc.isLeave) return "Leave";
  const project = (alloc.project || "").trim();
  if (!project) return "Unspecified work";
  const match = projects.find((p) => projectToAllocationLabel(p) === project);
  return match ? projectToAllocationLabel(match) : project;
}
 
// Classifies an allocation into a "task intensity" category for the Tasks tab.
// Why: the Tasks tab answers the question "how much of our team is on full-time vs part-time
// engagements?" — bucketing by days/week makes that immediately visible.
// How: uses workingDays from the allocation if available; falls back to estimating days
// from hoursPerDay ÷ 7.5 (a standard AU working day) when workingDays isn't stored.
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

function classifyLeaveType(alloc) {
  const raw = `${alloc?.leaveType || ""} ${alloc?.project || ""} ${alloc?.notes || ""}`
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();

  if (raw.includes("public holiday")) return "Public Holiday";
  if (
    raw.includes("parental")
    || raw.includes("maternity")
    || raw.includes("paternity")
    || raw.includes("adoption")
  ) return "Parental Leave";
  if (raw.includes("carer") || raw.includes("carers")) return "Carers Leave";
  if (raw.includes("sick")) return "Sick Leave";
  if (raw.includes("study")) return "Study Leave";
  if (raw.includes("annual")) return "Annual Leave";
  return "Other";
}

const CANONICAL_LEAVE_TYPES = [
  "Annual Leave",
  "Carers Leave",
  "Parental Leave",
  "Public Holiday",
  "Sick Leave",
  "Study Leave",
  "Other",
];
 
// getBucketKey — maps a Date to the ISO-string key for the current chart viewType bucket.
// Extracted to eliminate three verbatim copies of this 5-line branch in holidaysByKey,
// the chartRange grouping pass, and the chartRange data-building pass.
function getBucketKey(date, viewType) {
  if (viewType === 'days') return date.toISOString().split('T')[0];
  if (viewType === 'weeks') {
    const ws = new Date(date);
    ws.setDate(ws.getDate() - ws.getDay()); // rewind to Sunday
    return ws.toISOString().split('T')[0];
  }
  // months — clamp to the 1st of the month
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
}

function compareSortValues(a, b) {
  const aIsNil = a == null;
  const bIsNil = b == null;
  if (aIsNil && bIsNil) return 0;
  if (aIsNil) return 1;
  if (bIsNil) return -1;

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  return String(a).localeCompare(String(b), "en-AU", {
    numeric: true,
    sensitivity: "base",
  });
}

function sortRows(rows, sortConfig, accessorMap) {
  if (!sortConfig?.column || !sortConfig?.direction) return rows;
  const accessor = accessorMap[sortConfig.column];
  if (!accessor) return rows;
  const multiplier = sortConfig.direction === "desc" ? -1 : 1;

  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const cmp = compareSortValues(accessor(a.row), accessor(b.row));
      if (cmp !== 0) return cmp * multiplier;
      return a.index - b.index;
    })
    .map((entry) => entry.row);
}

function AdvancedFilterDropdown({
  openFilter,
  dispatch,
  searchText,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  options,
  selected,
  onToggleOption,
  totalSelections,
  onClearFilters,
}) {
  const categoryLabel = ADVANCED_FILTER_CATEGORIES.find((category) => category.key === activeCategory)?.label || "Category";
  const buttonLabel = totalSelections > 0 || searchText.trim()
    ? `Search / Filter (${totalSelections}${searchText.trim() ? " + search" : ""})`
    : "Search / Filter";

  return (
    <div className="rp-filter-dropdown rp-filter-dropdown--advanced">
      <button
        className="rp-filter-pill"
        onClick={() => dispatch({ type: "SET_OPEN_FILTER", payload: openFilter === "advanced" ? null : "advanced" })}
      >
        <span className="rp-filter-pill-icons" aria-hidden="true">
          <Search size={13} className="rp-filter-pill-icon" />
          <Filter size={13} className="rp-filter-pill-icon" />
        </span>
        {buttonLabel} <ChevronDown size={12} />
      </button>

      {openFilter === "advanced" && (
        <div className="rp-filter-options rp-filter-options--advanced">
          <div className="rp-filter-search-wrap">
            <input
              type="search"
              className="rp-filter-search-input"
              placeholder="Search people, departments, roles, projects..."
              value={searchText}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>

          <div className="rp-filter-category-row">
            <span className="rp-filter-category-label">Category</span>
            <select
              className="rp-filter-category-select"
              value={activeCategory}
              onChange={(event) => onCategoryChange(event.target.value)}
            >
              {ADVANCED_FILTER_CATEGORIES.map((category) => (
                <option key={category.key} value={category.key}>{category.label}</option>
              ))}
            </select>
          </div>

          <div className="rp-filter-category-caption">
            Select one or more {categoryLabel.toLowerCase()} options
          </div>

          <div className="rp-filter-options-list">
            {options.length === 0 && (
              <div className="rp-filter-empty">No options available for this period.</div>
            )}
            {options.map((option) => (
              <label key={option} className="rp-filter-option">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(event) => onToggleOption(activeCategory, option, event.target.checked)}
              />
              {option}
            </label>
            ))}
          </div>

          <div className="rp-filter-actions">
            <button type="button" className="rp-filter-clear-btn" onClick={onClearFilters}>
              Clear filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Initial UI state — defined at module scope so it is a stable object reference
// and is not reallocated on every render of ReportingPage.
const initialState = {
  viewMode: "People",
  activeTab: "People",
  projectGrouping: "projects",
  viewType: "weeks",
  expanded: {},
  openFilter: null,
  openExport: false,
  tableSorts: {},
};

// UI state reducer — defined at module scope so it is a stable function reference.
// Pure: only reads action.payload; never closes over component state.
function stateReducer(state, action) {
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
    case "TOGGLE_TABLE_SORT": {
      const { tableKey, column } = action.payload;
      const prev = state.tableSorts[tableKey] || { column: null, direction: null };
      let next;
      if (prev.column !== column) {
        next = { column, direction: "asc" };
      } else if (prev.direction === "asc") {
        next = { column, direction: "desc" };
      } else {
        next = { column: null, direction: null };
      }
      return {
        ...state,
        tableSorts: {
          ...state.tableSorts,
          [tableKey]: next,
        },
      };
    }
    default:
      return state;
  }
}

// DetailRow — renders the collapsible sub-row beneath a summary row in the table.
// Why a separate component: all tabs (People, Roles, Departments, etc.) need the same
// expand/collapse behaviour — extracting it avoids repeating the animation and colSpan
// logic in every tab's render.
// How: renders null when collapsed (avoids DOM nodes); when expanded, animates open
// using framer-motion so the reveal feels smooth rather than a jarring jump.
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
 
// SchedCell — renders the "Sched. %" column as a number + inline progress bar.
// Why a visual bar: a raw percentage like "87%" is harder to scan quickly across
// many rows than a filled bar that communicates utilization at a glance.
// Guards division by zero (capacity = 0 for archived/unavailable people).
function SchedCell({ scheduled, capacity }) {
  const schedPct = capacity > 0 ? Math.round((scheduled / capacity) * 100) : 0;
  const isOverScheduled = schedPct > 100;
  return (
    <div className={`rp-sched-cell${isOverScheduled ? " rp-sched-cell--over" : ""}`}>
      <span className="rp-sched-label">{schedPct}%</span>
      <div className="rp-sched-bar-wrap">
        <div className="rp-sched-bar" style={{ width: `${schedPct}%` }} />
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  direction,
  onClick,
  className = "",
  align = "left",
}) {
  return (
    <button
      type="button"
      className={`rp-th-btn ${align === "right" ? "rp-th-btn--num" : ""} ${direction ? "is-active" : ""} ${className}`.trim()}
      onClick={onClick}
      aria-label={`Sort by ${label}`}
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
    >
      <span>{label}</span>
      <ChevronDown
        size={12}
        className={`rp-th-sort ${direction === "asc" ? "rp-th-sort--asc" : ""} ${direction === "desc" ? "rp-th-sort--desc" : ""}`.trim()}
      />
    </button>
  );
}
 
// ── Standard thead ────────────────────────────────────────────────────────────
function StandardThead({ firstColLabel, showDept = true, tableKey, tableSorts, onSort }) {
  const sortDirection = (column) => {
    const tableSort = tableSorts?.[tableKey];
    if (!tableSort || tableSort.column !== column) return null;
    return tableSort.direction;
  };

  return (
    <thead>
      <tr>
        <th className="rp-th rp-th--expand" />
        <th className="rp-th rp-th--name">
          <SortableHeader
            label={firstColLabel}
            direction={sortDirection("name")}
            onClick={() => onSort(tableKey, "name")}
          />
        </th>
        {showDept && (
          <th className="rp-th">
            <SortableHeader
              label="Department"
              direction={sortDirection("dept")}
              onClick={() => onSort(tableKey, "dept")}
            />
          </th>
        )}
        <th className="rp-th rp-th--num">
          <SortableHeader
            label="Capacity"
            direction={sortDirection("capacity")}
            onClick={() => onSort(tableKey, "capacity")}
            align="right"
          />
        </th>
        <th className="rp-th rp-th--num rp-th--accent">
          <SortableHeader
            label="Scheduled"
            direction={sortDirection("scheduled")}
            onClick={() => onSort(tableKey, "scheduled")}
            align="right"
          />
        </th>
        <th className="rp-th rp-th--num rp-th--accent">
          <SortableHeader
            label="Billable"
            direction={sortDirection("billable")}
            onClick={() => onSort(tableKey, "billable")}
            align="right"
          />
        </th>
        <th className="rp-th rp-th--num rp-th--accent">
          <SortableHeader
            label="Non-billable"
            direction={sortDirection("nonBillable")}
            onClick={() => onSort(tableKey, "nonBillable")}
            align="right"
          />
        </th>
        <th className="rp-th rp-th--num">
          <SortableHeader
            label="Time off"
            direction={sortDirection("timeOff")}
            onClick={() => onSort(tableKey, "timeOff")}
            align="right"
          />
        </th>
        <th className="rp-th rp-th--num">
          <SortableHeader
            label="Overtime"
            direction={sortDirection("overtime")}
            onClick={() => onSort(tableKey, "overtime")}
            align="right"
          />
        </th>
        <th className="rp-th rp-th--num">
          <SortableHeader
            label="Sched. %"
            direction={sortDirection("scheduledPct")}
            onClick={() => onSort(tableKey, "scheduledPct")}
            align="right"
          />
        </th>
        <th className="rp-th rp-th--num">
          <SortableHeader
            label="Scheduled Cost"
            direction={sortDirection("scheduledCost")}
            onClick={() => onSort(tableKey, "scheduledCost")}
            align="right"
          />
        </th>
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
  // Pull all data from the global app store — people, work allocations, synthetic public holiday
  // allocations (generated from the holidays calendar), and project metadata.
  // publicHolidayAllocations are kept separate from allocations in the store so they can be
  // dismissed/re-added independently; they're merged here for reporting purposes.
  const { people, allocations, publicHolidayAllocations, projects } = useAppData();

  // ── Consolidated State ────────────────────────────────────────────────────
  // initialState and stateReducer are defined at module scope above the component
  // so they are not reallocated on every render. The reducer handles all UI toggles
  // in one place — opening a filter, changing tabs, expanding rows, etc.
  const [state, dispatch] = useReducer(stateReducer, initialState);

  // openQuickAdd is separate from the reducer because it doesn't interact with other UI state.
  const [openQuickAdd, setOpenQuickAdd] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [activeFilterCategory, setActiveFilterCategory] = useState("person");
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState(EMPTY_ADVANCED_FILTERS);

  // timeframeMode tracks which preset is active ("this-month", "next-12-weeks", "custom" etc.).
  // It's separate from dateRange so pressing prev/next can switch to "custom" without
  // losing the knowledge of which preset the user last applied.
  const [timeframeMode, setTimeframeMode] = useState('next-12-weeks');

  // dateRange is the actual { start, end } Date pair used in all data computations.
  // Initialised to "next 12 weeks" as a sensible default for capacity planning.
  const [dateRange, setDateRange] = useState(() => getDateRangeForTimeframe('next-12-weeks'));

  // startMonthView / endMonthView track which month is displayed in the two calendar pickers.
  // Kept in sync with the current dateRange via a useEffect below.
  const [startMonthView, setStartMonthView] = useState(() => toMonthStart(getDateRangeForTimeframe('next-12-weeks').start));
  const [endMonthView, setEndMonthView] = useState(() => toMonthStart(getDateRangeForTimeframe('next-12-weeks').end));

  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // drilldown holds the active focus filter — clicking a person/project/client row populates
  // this, causing all downstream memos to re-filter. null values mean "show everything".
  const [drilldown, setDrilldown] = useState({ personId: null, personName: null, project: null, client: null });

  // hoveredBar / hoveredHoliday drive the chart tooltip — storing x/y coordinates and
  // the hovered data so the tooltip can be positioned with position:fixed (avoids overflow clipping).
  const [hoveredBar, setHoveredBar] = useState(null);
  const [hoveredHoliday, setHoveredHoliday] = useState(null);

  // Refs for click-outside detection on dropdowns — attached to the wrapper divs so clicks
  // inside the dropdown don't close it, but clicks anywhere else do.
  const dropdownRef = useRef();
  const exportRef = useRef();
  const quickAddRef = useRef();
  const datePickerRef = useRef();
  const chartRef = useRef();  
  const navigate = useNavigate();
 
  // Close any open filter/export/quickadd dropdown when the user clicks outside it.
  // Why: dropdowns don't have a natural close event — without this, clicking anywhere on
  // the page (other than a close button) would leave them open indefinitely.
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

  // Date picker close-on-outside-click is registered separately so it's only active
  // while the picker is open — avoids an extra listener on every page interaction.
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

  // Keep the calendar month pickers in sync when the date range changes via preset or prev/next.
  // Why: without this, the calendars would still show whatever month the user previously navigated
  // to, making the highlighted range appear disconnected from the visible month.
  useEffect(() => {
    setStartMonthView(toMonthStart(dateRange.start));
    setEndMonthView(toMonthStart(dateRange.end));
  }, [dateRange.start, dateRange.end]);

  // Drilldown toggle — clicking the same person/project/client a second time clears the filter
  // (acting as a toggle). This allows users to "zoom in" on one dimension and then "zoom out"
  // by clicking the same row again, without needing a separate "clear" button.
  const toggleDrilldown = useCallback((nextFilter) => {
    setDrilldown((prev) => {
      const samePerson = Object.prototype.hasOwnProperty.call(nextFilter, "personId")
        && String(prev.personId ?? "") === String(nextFilter.personId ?? "");
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

  // clearDrilldown — explicit reset used by breadcrumb/clear buttons in the UI.
  const clearDrilldown = useCallback(() => {
    setDrilldown({ personId: null, personName: null, project: null, client: null });
  }, []);

  const toggleCategoryFilterOption = useCallback((category, option, checked) => {
    setSelectedCategoryFilters((prev) => {
      const current = prev[category] || [];
      const next = checked
        ? current.includes(option) ? current : [...current, option]
        : current.filter((value) => value !== option);
      return { ...prev, [category]: next };
    });
  }, []);

  const clearToolbarFilters = useCallback(() => {
    setSearchText("");
    setSelectedCategoryFilters(EMPTY_ADVANCED_FILTERS);
    setDrilldown({ personId: null, personName: null, project: null, client: null });
  }, []);

  // Stores the hovered bar's data + mouse position for the floating tooltip.
  // Using clientX/Y (viewport-relative) rather than element-relative so we can
  // position the tooltip with position:fixed and avoid overflow clipping inside the chart container.
  const handleBarHover = useCallback((e, d, schedPct, bilPct, nonPct) => {
    setHoveredBar({ d, x: e.clientX, y: e.clientY, schedPct, bilPct, nonPct });
  }, []);

  // Same pattern for the holiday dot tooltip — stores the holiday name(s) + mouse position.
  const handleHolidayEnter = useCallback((e, names) => {
    setHoveredHoliday({ names, x: e.clientX, y: e.clientY });
  }, []);

  const handleHolidayLeave = useCallback(() => {
    setHoveredHoliday(null);
  }, []);

  // ── Holiday buckets for chart X-axis dots ────────────────────────────────────
  // Pre-processes public holidays into a Map keyed by the same day/week/month bucket
  // that the chart bars use. Why pre-process: the chart renders one dot per bucket
  // and needs to know all holiday names for that bucket at render time without re-scanning
  // all allocations per bar. Using a Set per bucket deduplicates holiday names automatically
  // (the same national holiday may appear once per person in the allocations array).
  const holidaysByKey = useMemo(() => {
    const map = new Map();
    const start = new Date(dateRange.start); start.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.end); end.setHours(23, 59, 59, 999);
    for (const alloc of publicHolidayAllocations) {
      if (!alloc.syntheticPublicHoliday) continue;
      const d = parseDate(alloc.startDate);
      if (!d || d < start || d > end) continue;
      const key = getBucketKey(d, state.viewType);
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(alloc.notes || "Public holiday");
    }
    return map;
  }, [publicHolidayAllocations, dateRange.start, dateRange.end, state.viewType]);

  // ── Date Range Management ─────────────────────────────────────────────────
  // Shifts the date range by exactly its own length (e.g. viewing 4 weeks → jump forward 4 weeks).
  // Why: this makes prev/next feel consistent regardless of the current range size —
  // a 12-week view jumps 12 weeks, a month view jumps one month, etc.
  // Resets timeframeMode to 'custom' so the preset selector shows "Custom" after navigation.
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
 
  // Merge regular work/leave allocations with synthetic public holiday allocations into one list.
  // Why merge: downstream memos (rangedAllocations, personRows, chartRange) all need to treat
  // public holidays the same as leave — they affect hours, capacity, and chart totals.
  // Merging here means every consumer only iterates one array instead of two.
  const scheduleAllocations = useMemo(
    () => [...allocations, ...publicHolidayAllocations],
    [allocations, publicHolidayAllocations]
  );

  // Expands all allocations to only those (or parts of those) that fall within the chosen date range.
  // Why this matters: a project running Jan–Dec should only contribute hours for the month
  // you're viewing, and repeating allocations (e.g. "every Monday") need each occurrence extracted.
  //
  // How it works:
  //   - Non-repeating: simple overlap check — include if [allocStart, allocEnd] intersects [rangeStart, rangeEnd].
  //   - Repeating: walk forward through occurrences using advanceRepeatWindow until we pass rangeEnd.
  //     Each overlapping occurrence is pushed as a clipped copy with its own startDate/endDate.
  //     The guard of 520 prevents infinite loops on malformed repeat data (~10 years of weekly repeats).
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
            // This occurrence overlaps the range — push a clipped copy with its own dates
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
 
  // Pre-builds a Map from project label → boolean billable flag.
  // Why a Map: classifying hours as billable/non-billable is done inside tight loops
  // (personRows, chartRange). A Map lookup is O(1) vs. O(n) for Array.find per allocation.
  // Default is true (billable) — only projects explicitly marked billable:false are non-billable.
  const projectBillability = useMemo(() => {
    const map = new Map();
    for (const project of projects) {
      map.set(projectToAllocationLabel(project), project.billable !== false);
    }
    return map;
  }, [projects]);
 
  // Filter out archived people — they shouldn't appear in capacity reports since
  // they're no longer actively working. Archived records are kept in the DB for history.
  const activePeople = useMemo(
    () => people.filter((person) => !person.archived),
    [people]
  );

  // ── Person rows — source of truth for all tabs ───────────────────────────────
  // This is the most important memo in the page — everything else (roleRows, deptRows,
  // projectRows, chartRange) derives from this. Computing it once and caching the result
  // means the role/dept/project tabs don't each re-scan all allocations independently.
  //
  // Each row pre-attaches _rangedHours to each allocation so downstream tabs only need
  // to read that field rather than re-running allocationHoursInRange per allocation.
  const personRows = useMemo(
    () => {
      const rangeStart = new Date(dateRange.start);
      const rangeEnd = new Date(dateRange.end);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd.setHours(23, 59, 59, 999);
      return activePeople.map((person) => {
        const capacity = personCapacityInRange(person, rangeStart, rangeEnd);
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
    [activePeople, rangedAllocations, projectBillability, projects, dateRange.start, dateRange.end]
  );

  // Maps each project label → its client name for O(1) client lookups in filteredPersonRows
  // and filteredRangedAllocations. Built alongside projectBillability so both fast-lookup
  // Maps are ready before any allocation iteration begins.
  const projectClientByLabel = useMemo(() => {
    const map = new Map();
    for (const project of projects) {
      map.set(projectToAllocationLabel(project), project.client || "—");
    }
    return map;
  }, [projects]);

  const filterOptionsByCategory = useMemo(() => {
    const projectOptions = [];
    const clientOptions = [];

    for (const person of personRows) {
      for (const alloc of person.allocations || []) {
        if (alloc.isLeave) continue;
        const project = (alloc.project || "").trim() || "Unspecified work";
        const client = (alloc.client || "").trim() || projectClientByLabel.get(project) || "—";
        projectOptions.push(project);
        clientOptions.push(client);
      }
    }

    const options = {
      person: uniqueSorted(personRows.map((person) => person.name)),
      department: uniqueSorted(personRows.map((person) => person.dept || "—")),
      role: uniqueSorted(personRows.map((person) => person.role || "Unassigned")),
      project: uniqueSorted(projectOptions),
      client: uniqueSorted(clientOptions),
    };

    // Keep selected options visible even if they don't exist in the currently scoped date range.
    for (const category of Object.keys(EMPTY_ADVANCED_FILTERS)) {
      options[category] = uniqueSorted([...(options[category] || []), ...(selectedCategoryFilters[category] || [])]);
    }
    return options;
  }, [personRows, projectClientByLabel, selectedCategoryFilters]);

  const toolbarFilteredPersonRows = useMemo(() => {
    const query = normalizeText(searchText);
    const selectedSets = {
      person: new Set((selectedCategoryFilters.person || []).map(normalizeText)),
      department: new Set((selectedCategoryFilters.department || []).map(normalizeText)),
      role: new Set((selectedCategoryFilters.role || []).map(normalizeText)),
      project: new Set((selectedCategoryFilters.project || []).map(normalizeText)),
      client: new Set((selectedCategoryFilters.client || []).map(normalizeText)),
    };

    return personRows.filter((person) => {
      const normalizedName = normalizeText(person.name);
      const normalizedDept = normalizeText(person.dept || "—");
      const normalizedRole = normalizeText(person.role || "Unassigned");

      const personProjects = [];
      const personClients = [];
      for (const alloc of person.allocations || []) {
        if (alloc.isLeave) continue;
        const project = (alloc.project || "").trim() || "Unspecified work";
        const client = (alloc.client || "").trim() || projectClientByLabel.get(project) || "—";
        personProjects.push(normalizeText(project));
        personClients.push(normalizeText(client));
      }

      if (selectedSets.person.size > 0 && !selectedSets.person.has(normalizedName)) return false;
      if (selectedSets.department.size > 0 && !selectedSets.department.has(normalizedDept)) return false;
      if (selectedSets.role.size > 0 && !selectedSets.role.has(normalizedRole)) return false;

      if (selectedSets.project.size > 0) {
        const hasProjectMatch = personProjects.some((project) => selectedSets.project.has(project));
        if (!hasProjectMatch) return false;
      }

      if (selectedSets.client.size > 0) {
        const hasClientMatch = personClients.some((client) => selectedSets.client.has(client));
        if (!hasClientMatch) return false;
      }

      if (!query) return true;

      const searchableFields = [
        person.name,
        person.dept,
        person.role,
        ...personProjects,
        ...personClients,
      ];
      return searchableFields.some((field) => normalizeText(field).includes(query));
    });
  }, [personRows, selectedCategoryFilters, searchText, projectClientByLabel]);
 
  // Applies drilldown filters to the person rows so all tabs reflect the same focus.
  // Why filter at this level: every tab (Roles, Departments, Projects, Tasks, Time off)
  // derives from filteredPersonRows, so narrowing here automatically updates all tabs
  // without each tab needing its own filter logic.
  // How: if a personId drilldown is active, keep only that person; if a project/client
  // drilldown is active, keep only people who have at least one allocation matching it.
  const filteredPersonRows = useMemo(() => {
    const personIdFilter = drilldown.personId;
    const projectFilter = normalizeText(drilldown.project);
    const clientFilter = normalizeText(drilldown.client);

    return toolbarFilteredPersonRows.filter((person) => {
      if (personIdFilter && String(person.id) !== String(personIdFilter)) return false;

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
  }, [toolbarFilteredPersonRows, drilldown.personId, drilldown.project, drilldown.client, projectClientByLabel]);

  const hasToolbarFilters = useMemo(() => {
    const hasSearch = searchText.trim().length > 0;
    const hasCategorySelections = Object.values(selectedCategoryFilters).some((values) => values.length > 0);
    return hasSearch || hasCategorySelections;
  }, [searchText, selectedCategoryFilters]);

  // ── Totals ──────────────────────────────────────────────────────────────────
  // Sums all numeric fields across filteredPersonRows for the stats strip at the top of the tables.
  // unscheduled is derived (not stored per person) so it's calculated here as:
  //   capacity - scheduled - timeOff (floored at 0 to avoid showing negative free time).
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
  // Groups people by their role title and sums their hours/capacity.
  // Answers the question: "How much capacity does the Design team vs Engineering have?"
  const roleRows = useMemo(
    () => groupPeopleBy(filteredPersonRows, (p) => p.role || "Unassigned"),
    [filteredPersonRows]
  );

  // ── Dept rows ───────────────────────────────────────────────────────────────
  // Groups people by department — same pattern as roleRows but using the department field.
  const deptRows = useMemo(
    () => groupPeopleBy(filteredPersonRows, (p) => p.dept),
    [filteredPersonRows]
  );

  // ── Project rows ─────────────────────────────────────────────────────────────
  // Builds one row per project showing total scheduled hours, billable/non-billable split,
  // and which people are assigned.
  // Why two-pass: first initialise all known projects (even unscheduled ones show as 0h),
  // then accumulate allocations. This ensures projects with no allocations still appear
  // in the list so managers can see that nothing is scheduled for them yet.
  const projectRows = useMemo(() => {
    const groups = {};
    
    // First, collect all projects and initialize their stats so zero-hour projects appear
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
  // Groups allocations by their "task intensity" category (full-time, 4d/w, 3d/w, etc.).
  // Why: helps managers see at a glance whether the team is mostly on long full-time
  // engagements or spread across many part-time ones — useful for resourcing decisions.
  // Iterates person.allocations directly (pre-filtered in personRows) rather than
  // re-scanning all allocations, for performance.
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
  // Groups leave allocations by leave type (annual, sick, public holiday, etc.).
  // Why: gives HR/managers a quick view of how leave is distributed across the team
  // and whether people are taking mostly annual leave or sick leave.
  // Only isLeave allocations are included — work allocations are ignored in this tab.
  const timeOffRows = useMemo(() => {
    const groups = {};

    // Pre-seed categories so they stay visible even when they have zero hours.
    for (const leaveType of CANONICAL_LEAVE_TYPES) {
      groups[leaveType] = { totalHours: 0, personIds: new Set() };
    }
 
    for (const person of filteredPersonRows) {
      for (const alloc of person.allocations) {
        if (!alloc.isLeave) continue;
        const type = classifyLeaveType(alloc);
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
  // Badge numbers shown next to each tab label (e.g. "People 12").
  // Derived from the lengths of each row array so they stay in sync with drilldown filters.
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

  // Groups visible projects by their client field for the "Clients" tab in Projects view.
  // Why a separate memo: client grouping is only needed in the Projects view, so computing
  // it lazily here (rather than always in projectRows) avoids unnecessary work in People view.
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

  const handleTableSort = useCallback((tableKey, column) => {
    dispatch({ type: "TOGGLE_TABLE_SORT", payload: { tableKey, column } });
  }, []);

  const sortedPersonRows = useMemo(
    () => sortRows(filteredPersonRows, state.tableSorts.people, {
      name: (row) => row.name,
      dept: (row) => row.dept,
      capacity: (row) => row.capacity,
      scheduled: (row) => row.scheduled,
      billable: (row) => row.billable,
      nonBillable: (row) => row.nonBillable,
      timeOff: (row) => row.timeOff,
      overtime: (row) => row.overtime,
      scheduledPct: (row) => (row.capacity > 0 ? row.scheduled / row.capacity : 0),
      scheduledCost: (row) => row.billable * COST_PER_HOUR,
    }),
    [filteredPersonRows, state.tableSorts.people]
  );

  const sortedRoleRows = useMemo(
    () => sortRows(roleRows, state.tableSorts.roles, {
      name: (row) => row.name,
      dept: (row) => row.dept,
      capacity: (row) => row.capacity,
      scheduled: (row) => row.scheduled,
      billable: (row) => row.billable,
      nonBillable: (row) => row.nonBillable,
      timeOff: (row) => row.timeOff,
      overtime: (row) => row.overtime,
      scheduledPct: (row) => (row.capacity > 0 ? row.scheduled / row.capacity : 0),
      scheduledCost: (row) => row.scheduledCost,
    }),
    [roleRows, state.tableSorts.roles]
  );

  const sortedDeptRows = useMemo(
    () => sortRows(deptRows, state.tableSorts.departments, {
      name: (row) => row.name,
      dept: (row) => row.dept,
      capacity: (row) => row.capacity,
      scheduled: (row) => row.scheduled,
      billable: (row) => row.billable,
      nonBillable: (row) => row.nonBillable,
      timeOff: (row) => row.timeOff,
      overtime: (row) => row.overtime,
      scheduledPct: (row) => (row.capacity > 0 ? row.scheduled / row.capacity : 0),
      scheduledCost: (row) => row.scheduledCost,
    }),
    [deptRows, state.tableSorts.departments]
  );

  const sortedTaskRows = useMemo(
    () => sortRows(taskRows, state.tableSorts.tasks, {
      name: (row) => row.name,
      dept: (row) => row.dept,
      capacity: (row) => row.capacity,
      scheduled: (row) => row.scheduled,
      billable: (row) => row.billable,
      nonBillable: (row) => row.nonBillable,
      timeOff: (row) => row.timeOff,
      overtime: (row) => row.overtime,
      scheduledPct: (row) => (row.capacity > 0 ? row.scheduled / row.capacity : 0),
      scheduledCost: (row) => row.scheduledCost,
    }),
    [taskRows, state.tableSorts.tasks]
  );

  const sortedVisibleProjectRowsForPeople = useMemo(
    () => sortRows(visibleProjectRows, state.tableSorts.peopleProjects, {
      name: (row) => row.name,
      code: (row) => row.code,
      client: (row) => row.client,
      owner: (row) => row.owner,
      scheduled: (row) => row.scheduled,
      billable: (row) => row.billable,
      nonBillable: (row) => row.nonBillable,
      billablePct: (row) => (row.scheduled > 0 ? row.billable / row.scheduled : 0),
      scheduledCost: (row) => row.scheduledCost,
    }),
    [visibleProjectRows, state.tableSorts.peopleProjects]
  );

  const sortedTimeOffRows = useMemo(
    () => sortRows(timeOffRows, state.tableSorts.timeOff, {
      name: (row) => row.name,
      peopleCount: (row) => row.people.length,
      totalDays: (row) => row.totalDays,
      totalHours: (row) => row.totalHours,
    }),
    [timeOffRows, state.tableSorts.timeOff]
  );

  const sortedVisibleProjectRowsForProjectsView = useMemo(
    () => sortRows(visibleProjectRows, state.tableSorts.projectsView, {
      name: (row) => row.name,
      code: (row) => row.code,
      client: (row) => row.client,
      stage: (row) => row.stage || "",
      owner: (row) => row.owner,
      scheduled: (row) => row.scheduled,
      scheduledPct: () => 1,
    }),
    [visibleProjectRows, state.tableSorts.projectsView]
  );

  const sortedVisibleClientRows = useMemo(
    () => sortRows(visibleClientRows, state.tableSorts.clientsView, {
      name: (row) => row.name,
      scheduled: (row) => row.scheduled,
      scheduledPct: (row) => (row.scheduled > 0 ? 1 : 0),
    }),
    [visibleClientRows, state.tableSorts.clientsView]
  );

  // Filters rangedAllocations to the same people currently visible in the tables,
  // then applies active drilldown filters for project/client/person.
  // This keeps chart bars consistent with top Search/Filter + table selections.
  const filteredRangedAllocations = useMemo(() => {
    const personIdFilter = drilldown.personId;
    const projectFilter = normalizeText(drilldown.project);
    const clientFilter = normalizeText(drilldown.client);
    const allowedPersonIds = new Set(filteredPersonRows.map((person) => String(person.id)));

    return rangedAllocations.filter((alloc) => {
      // Respect toolbar/table scope first: allocation must belong to at least one visible person.
      const allocPersonIds = Array.isArray(alloc.personIds)
        ? alloc.personIds.map((id) => String(id))
        : alloc.personId != null
          ? [String(alloc.personId)]
          : [];
      if (allocPersonIds.length === 0) return false;
      const inVisibleScope = allocPersonIds.some((id) => allowedPersonIds.has(id));
      if (!inVisibleScope) return false;

      if (personIdFilter && !allocationHasPersonSchedule(alloc, personIdFilter)) return false;

      const projectLabel = (alloc.project || "").trim() || "Unspecified work";
      const allocationClient = (alloc.client || "").trim() || projectClientByLabel.get(projectLabel) || "—";

      if (projectFilter && normalizeText(projectLabel) !== projectFilter) return false;
      if (clientFilter && normalizeText(allocationClient) !== clientFilter) return false;
      return true;
    });
  }, [rangedAllocations, filteredPersonRows, drilldown.personId, drilldown.project, drilldown.client, projectClientByLabel]);
 
  // ── Chart ────────────────────────────────────────────────────────────────────
  // Bins all filtered allocations into day/week/month buckets and splits each bucket
  // into billable/nonBillable/timeOff for the stacked bar chart.
  //
  // How it works:
  //   1. Group allocations by bucket key (ISO date string for day/week-start/month-start).
  //   2. Sum hours per bucket by work type (billable, non-billable, leave).
  //   3. Walk the full date range to build a data point for every bar, even empty ones
  //      (so the X-axis stays evenly spaced — empty bars show as flat, not gaps).
  //   4. Attach the list of public holidays for each bucket (for X-axis dots).
  const chartRange = useMemo(() => {
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
 
    const grouped = new Map();
    for (const alloc of filteredRangedAllocations) {
      const allocDate = parseDate(alloc.startDate);
      if (!allocDate || allocDate < startDate || allocDate > endDate) continue;
      const key = getBucketKey(allocDate, state.viewType);
      const hours = allocationHours(alloc);
      const existing = grouped.get(key) || { billable: 0, nonBillable: 0, timeOff: 0 };
      if (alloc.isLeave) existing.timeOff += hours;
      else if (projectBillability.get((alloc.project || "").trim()) === false) existing.nonBillable += hours;
      else existing.billable += hours;
      grouped.set(key, existing);
    }
 
    const data = [];
    // Build one data point per bar, even for empty bars (so the X-axis stays evenly spaced).
    if (state.viewType === 'days') {
      for (let c = new Date(startDate); c <= endDate; c = addDays(c, 1)) {
        const key = getBucketKey(c, 'days');
        const v = grouped.get(key) || { billable: 0, nonBillable: 0, timeOff: 0 };
        data.push({ label: c.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), key, ...v, total: v.billable + v.nonBillable + v.timeOff, holidays: Array.from(holidaysByKey.get(key) || []) });
      }
    } else if (state.viewType === 'weeks') {
      for (let c = startOfWeek(startDate); c <= endDate; c = addDays(c, 7)) {
        const key = getBucketKey(c, 'weeks');
        const v = grouped.get(key) || { billable: 0, nonBillable: 0, timeOff: 0 };
        data.push({ label: c.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), key, ...v, total: v.billable + v.nonBillable + v.timeOff, holidays: Array.from(holidaysByKey.get(key) || []) });
      }
    } else {
      for (let c = new Date(startDate.getFullYear(), startDate.getMonth(), 1); c <= endDate; c = new Date(c.getFullYear(), c.getMonth() + 1, 1)) {
        const key = getBucketKey(c, 'months');
        const v = grouped.get(key) || { billable: 0, nonBillable: 0, timeOff: 0 };
        data.push({ label: c.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }), key, ...v, total: v.billable + v.nonBillable + v.timeOff, holidays: Array.from(holidaysByKey.get(key) || []) });
      }
    }
    return {
      startDate,
      endDate,
      data,
      totalCapacity: filteredPersonRows.reduce((sum, person) => sum + (person.capacity || 0), 0),
    };
  }, [filteredRangedAllocations, state.viewType, projectBillability, filteredPersonRows, dateRange.start, dateRange.end, holidaysByKey]);

  // ── Per-bar capacity for chart scaling ───────────────────────────────────────
  // Uses total visible capacity divided across rendered bars for a consistent
  // capacity reference line in the chart and exports.
  const capacityPerBar = useMemo(() => {
    const bars = chartRange.data.length;
    if (bars <= 0) return 0;
    return chartRange.totalCapacity / bars;
  }, [chartRange.totalCapacity, chartRange.data.length]);
 
  const toggleRow = useCallback((id) => {
    dispatch({ type: "TOGGLE_ROW", payload: id });
  }, []);

  // Y-axis maximum — the larger of the peak bar total and the capacity line,
  // so both the bars and the capacity line always fit within the chart area.
  const chartMax = useMemo(() => Math.max(...chartRange.data.map(d => d.total), 1), [chartRange.data]);
  const yMax = useMemo(() => Math.max(chartMax, capacityPerBar, 1), [chartMax, capacityPerBar]);
  const yTicks = useMemo(() => niceChartTicks(yMax), [yMax]);

  // Controls how many X-axis labels to show — skips labels to avoid text overlap
  // when there are many bars (e.g. 365 days would render ~365 overlapping labels without skipping).
  const labelStep = useMemo(() => {
    const n = chartRange.data.length;
    if (n <= 20) return 1;  // show every label
    if (n <= 40) return 2;  // show every 2nd label
    if (n <= 84) return 7;  // show weekly labels (every 7th bar)
    return 14;              // show fortnightly labels for very long ranges
  }, [chartRange.data.length]);
  const chartStartLabel = dateRange.start ? weekLabel(dateRange.start) : "—";
  const chartEndLabel = dateRange.end ? weekLabel(dateRange.end) : "—";

  // ── Export Functions ─────────────────────────────────────────────────────────
  // Exports the chart's time-series data as a CSV — one row per bar (day/week/month)
  // with capacity, scheduled, billable/non-billable, and time off hours + percentages.
  // Why: managers often need to paste this into Excel/Sheets for stakeholder reporting.
  // Uses arrayToCSV (a utility that escapes commas/quotes) and downloadCSV (creates a
  // temporary anchor element to trigger the browser download dialog).
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
      
      const totalCapacity = capacityPerBar;
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
  // filteredPersonRows is intentionally omitted — this callback only reads chartRange.
  }, [chartRange, capacityPerBar]);

  // Exports the full detail table as a CSV — one row per person-allocation combination.
  // Why per-allocation (not per-person): stakeholders often need to see which project
  // each hour was on, not just the person totals. The flat format works in any pivot tool.
  // People with no allocations still get a row (with 0h) so they're visible as unscheduled.
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

          <div className="rp-view-mode-filter" ref={dropdownRef}>
            <AdvancedFilterDropdown
              openFilter={state.openFilter}
              dispatch={dispatch}
              searchText={searchText}
              onSearchChange={setSearchText}
              activeCategory={activeFilterCategory}
              onCategoryChange={setActiveFilterCategory}
              options={filterOptionsByCategory[activeFilterCategory] || []}
              selected={selectedCategoryFilters[activeFilterCategory] || []}
              onToggleOption={toggleCategoryFilterOption}
              totalSelections={Object.values(selectedCategoryFilters).reduce((sum, values) => sum + values.length, 0)}
              onClearFilters={clearToolbarFilters}
            />
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

        {(drilldown.personId || drilldown.project || drilldown.client || hasToolbarFilters) && (
          <div className="rp-active-filters" role="status" aria-live="polite">
            <span className="rp-active-filters-label">Filtered by:</span>
            {drilldown.personName && <span className="rp-active-filter-chip">Person: {drilldown.personName}</span>}
            {drilldown.project && <span className="rp-active-filter-chip">Project: {drilldown.project}</span>}
            {drilldown.client && <span className="rp-active-filter-chip">Client: {drilldown.client}</span>}
            {searchText.trim() && <span className="rp-active-filter-chip">Search: {searchText.trim()}</span>}
            {Object.entries(selectedCategoryFilters).flatMap(([category, values]) =>
              values.map((value) => (
                <span key={`${category}-${value}`} className="rp-active-filter-chip">
                  {(ADVANCED_FILTER_CATEGORIES.find((item) => item.key === category)?.label || category)}: {value}
                </span>
              ))
            )}
            <button type="button" className="rp-active-filter-clear" onClick={clearToolbarFilters}>Clear filters</button>
            <button type="button" className="rp-active-filter-clear" onClick={clearDrilldown}>Clear drilldown</button>
          </div>
        )}
 
        {/* ── Tables ── */}
        <motion.div className="rp-table-wrap" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.2 }}>
 
          {state.viewMode === "People" ? (
            <>
              {/* ── People ── */}
              {state.activeTab === "People" && (
                <table className="rp-table">
                  <StandardThead
                    firstColLabel="Person"
                    tableKey="people"
                    tableSorts={state.tableSorts}
                    onSort={handleTableSort}
                  />
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
                    {sortedPersonRows.map((person, idx) => {
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
                  <StandardThead
                    firstColLabel="Role"
                    tableKey="roles"
                    tableSorts={state.tableSorts}
                    onSort={handleTableSort}
                  />
                  <tbody>
                    {sortedRoleRows.map((row, idx) => (
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
                  <StandardThead
                    firstColLabel="Department"
                    showDept={false}
                    tableKey="departments"
                    tableSorts={state.tableSorts}
                    onSort={handleTableSort}
                  />
                  <tbody>
                    {sortedDeptRows.map((row, idx) => (
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
                      <th className="rp-th rp-th--name">
                        <SortableHeader
                          label="Project"
                          direction={state.tableSorts.peopleProjects?.column === "name" ? state.tableSorts.peopleProjects?.direction : null}
                          onClick={() => handleTableSort("peopleProjects", "name")}
                        />
                      </th>
                      <th className="rp-th">
                        <SortableHeader
                          label="Code"
                          direction={state.tableSorts.peopleProjects?.column === "code" ? state.tableSorts.peopleProjects?.direction : null}
                          onClick={() => handleTableSort("peopleProjects", "code")}
                        />
                      </th>
                      <th className="rp-th">
                        <SortableHeader
                          label="Client"
                          direction={state.tableSorts.peopleProjects?.column === "client" ? state.tableSorts.peopleProjects?.direction : null}
                          onClick={() => handleTableSort("peopleProjects", "client")}
                        />
                      </th>
                      <th className="rp-th">
                        <SortableHeader
                          label="Owner"
                          direction={state.tableSorts.peopleProjects?.column === "owner" ? state.tableSorts.peopleProjects?.direction : null}
                          onClick={() => handleTableSort("peopleProjects", "owner")}
                        />
                      </th>
                      <th className="rp-th rp-th--num rp-th--accent">
                        <SortableHeader
                          label="Scheduled"
                          direction={state.tableSorts.peopleProjects?.column === "scheduled" ? state.tableSorts.peopleProjects?.direction : null}
                          onClick={() => handleTableSort("peopleProjects", "scheduled")}
                          align="right"
                        />
                      </th>
                      <th className="rp-th rp-th--num rp-th--accent">
                        <SortableHeader
                          label="Billable"
                          direction={state.tableSorts.peopleProjects?.column === "billable" ? state.tableSorts.peopleProjects?.direction : null}
                          onClick={() => handleTableSort("peopleProjects", "billable")}
                          align="right"
                        />
                      </th>
                      <th className="rp-th rp-th--num rp-th--accent">
                        <SortableHeader
                          label="Non-billable"
                          direction={state.tableSorts.peopleProjects?.column === "nonBillable" ? state.tableSorts.peopleProjects?.direction : null}
                          onClick={() => handleTableSort("peopleProjects", "nonBillable")}
                          align="right"
                        />
                      </th>
                      <th className="rp-th rp-th--num">
                        <SortableHeader
                          label="Billable %"
                          direction={state.tableSorts.peopleProjects?.column === "billablePct" ? state.tableSorts.peopleProjects?.direction : null}
                          onClick={() => handleTableSort("peopleProjects", "billablePct")}
                          align="right"
                        />
                      </th>
                      <th className="rp-th rp-th--num">
                        <SortableHeader
                          label="Scheduled Cost"
                          direction={state.tableSorts.peopleProjects?.column === "scheduledCost" ? state.tableSorts.peopleProjects?.direction : null}
                          onClick={() => handleTableSort("peopleProjects", "scheduledCost")}
                          align="right"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedVisibleProjectRowsForPeople.length === 0
                      ? <tr><td colSpan={10} className="rp-td"><div className="rp-empty-tab">No project data in this period.</div></td></tr>
                      : sortedVisibleProjectRowsForPeople.map((row, idx) => {
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
                  <StandardThead
                    firstColLabel="Allocation Type"
                    showDept={false}
                    tableKey="tasks"
                    tableSorts={state.tableSorts}
                    onSort={handleTableSort}
                  />
                  <tbody>
                    {sortedTaskRows.length === 0
                      ? <tr><td colSpan={10} className="rp-td"><div className="rp-empty-tab">No task data in this period.</div></td></tr>
                      : sortedTaskRows.map((row, idx) => (
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
                      <th className="rp-th rp-th--name">
                        <SortableHeader
                          label="Leave Type"
                          direction={state.tableSorts.timeOff?.column === "name" ? state.tableSorts.timeOff?.direction : null}
                          onClick={() => handleTableSort("timeOff", "name")}
                        />
                      </th>
                      <th className="rp-th rp-th--num">
                        <SortableHeader
                          label="People"
                          direction={state.tableSorts.timeOff?.column === "peopleCount" ? state.tableSorts.timeOff?.direction : null}
                          onClick={() => handleTableSort("timeOff", "peopleCount")}
                          align="right"
                        />
                      </th>
                      <th className="rp-th rp-th--num">
                        <SortableHeader
                          label="Total Days"
                          direction={state.tableSorts.timeOff?.column === "totalDays" ? state.tableSorts.timeOff?.direction : null}
                          onClick={() => handleTableSort("timeOff", "totalDays")}
                          align="right"
                        />
                      </th>
                      <th className="rp-th rp-th--num">
                        <SortableHeader
                          label="Total Hours"
                          direction={state.tableSorts.timeOff?.column === "totalHours" ? state.tableSorts.timeOff?.direction : null}
                          onClick={() => handleTableSort("timeOff", "totalHours")}
                          align="right"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTimeOffRows.length === 0
                      ? <tr><td colSpan={5} className="rp-td"><div className="rp-empty-tab">No time off data in this period.</div></td></tr>
                      : sortedTimeOffRows.map((row, idx) => {
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
                      <th className="rp-th rp-th--name">
                        <SortableHeader
                          label="Project"
                          direction={state.tableSorts.projectsView?.column === "name" ? state.tableSorts.projectsView?.direction : null}
                          onClick={() => handleTableSort("projectsView", "name")}
                        />
                      </th>
                      <th className="rp-th">
                        <SortableHeader
                          label="Project Code"
                          direction={state.tableSorts.projectsView?.column === "code" ? state.tableSorts.projectsView?.direction : null}
                          onClick={() => handleTableSort("projectsView", "code")}
                        />
                      </th>
                      <th className="rp-th">
                        <SortableHeader
                          label="Client"
                          direction={state.tableSorts.projectsView?.column === "client" ? state.tableSorts.projectsView?.direction : null}
                          onClick={() => handleTableSort("projectsView", "client")}
                        />
                      </th>
                      <th className="rp-th">
                        <SortableHeader
                          label="Stage"
                          direction={state.tableSorts.projectsView?.column === "stage" ? state.tableSorts.projectsView?.direction : null}
                          onClick={() => handleTableSort("projectsView", "stage")}
                        />
                      </th>
                      <th className="rp-th">
                        <SortableHeader
                          label="Owner"
                          direction={state.tableSorts.projectsView?.column === "owner" ? state.tableSorts.projectsView?.direction : null}
                          onClick={() => handleTableSort("projectsView", "owner")}
                        />
                      </th>
                      <th className="rp-th rp-th--num">Budget</th>
                      <th className="rp-th rp-th--num rp-th--accent">
                        <SortableHeader
                          label="Scheduled %"
                          direction={state.tableSorts.projectsView?.column === "scheduledPct" ? state.tableSorts.projectsView?.direction : null}
                          onClick={() => handleTableSort("projectsView", "scheduledPct")}
                          align="right"
                        />
                      </th>
                      <th className="rp-th rp-th--num rp-th--accent">
                        <SortableHeader
                          label="Scheduled Hours"
                          direction={state.tableSorts.projectsView?.column === "scheduled" ? state.tableSorts.projectsView?.direction : null}
                          onClick={() => handleTableSort("projectsView", "scheduled")}
                          align="right"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedVisibleProjectRowsForProjectsView.length === 0
                      ? <tr><td colSpan={9} className="rp-td"><div className="rp-empty-tab">No project data in this period.</div></td></tr>
                      : sortedVisibleProjectRowsForProjectsView.map((row, idx) => {
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
                      <th className="rp-th rp-th--name">
                        <SortableHeader
                          label="Client"
                          direction={state.tableSorts.clientsView?.column === "name" ? state.tableSorts.clientsView?.direction : null}
                          onClick={() => handleTableSort("clientsView", "name")}
                        />
                      </th>
                      <th className="rp-th rp-th--num">Budget</th>
                      <th className="rp-th rp-th--num rp-th--accent">
                        <SortableHeader
                          label="Scheduled Hours"
                          direction={state.tableSorts.clientsView?.column === "scheduled" ? state.tableSorts.clientsView?.direction : null}
                          onClick={() => handleTableSort("clientsView", "scheduled")}
                          align="right"
                        />
                      </th>
                      <th className="rp-th rp-th--num rp-th--accent">
                        <SortableHeader
                          label="Scheduled %"
                          direction={state.tableSorts.clientsView?.column === "scheduledPct" ? state.tableSorts.clientsView?.direction : null}
                          onClick={() => handleTableSort("clientsView", "scheduledPct")}
                          align="right"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedVisibleClientRows.length === 0
                      ? <tr><td colSpan={5} className="rp-td"><div className="rp-empty-tab">No client data in this period.</div></td></tr>
                      : sortedVisibleClientRows.map((row, idx) => {
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