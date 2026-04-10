import { useState, useMemo, useRef, useEffect, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import AppSideNav from "../components/navigation/AppSideNav.jsx";
import { useAppData } from "../context/AppDataContext.jsx";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { allocationHasPersonSchedule } from "../utils/peopleSort.js";
import { projectToAllocationLabel } from "../utils/projectColors.js";
import "./ReportingPage.css";

const TABS = [
  { key: "People", count: null },
  { key: "Roles", count: null },
  { key: "Departments", count: null },
  { key: "Projects", count: null },
  { key: "Tasks", count: null },
  { key: "Time off", count: null },
];

const TIMEFRAMES = [
  { id: "1w", label: "1 week", weeks: 1 },
  { id: "2w", label: "2 weeks", weeks: 2 },
  { id: "3w", label: "3 weeks", weeks: 3 },
  { id: "4w", label: "4 weeks", weeks: 4 },
  { id: "8w", label: "8 weeks", weeks: 8 },
  { id: "12w", label: "12 weeks", weeks: 12 },
];

const fmt = (h) => h === 0 ? "0h" : `${h.toLocaleString()}h`;
const pct = (a, b) => b === 0 ? "0%" : `${Math.round((a / b) * 100)}%`;
const COST_PER_HOUR = 100;

const TIME_OFF_OPTIONS = ['Confirmed', 'Tentative'];
const PROJECT_STATUS_OPTIONS = ['Draft', 'Tentative', 'Confirmed', 'Completed', 'Canceled'];
const PEOPLE_OPTIONS = ['Employees', 'Contractors', 'Active', 'Archived', 'Unassigned'];

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

function breakdownKey(alloc, projects) {
  if (alloc.isLeave) return "Leave";
  const project = (alloc.project || "").trim();
  if (!project) return "Unspecified work";
  const match = projects.find((p) => projectToAllocationLabel(p) === project);
  return match ? projectToAllocationLabel(match) : project;
}

export default function ReportingPage() {
  const { theme } = useAppTheme();
  const { people, allocations, publicHolidayAllocations, projects, roles, depts } = useAppData();
  const [activeTab, setActiveTab] = useState("People");
  const [expanded, setExpanded] = useState({});
  const [viewType, setViewType] = useState("weeks");
  const [selectedTimeOff, setSelectedTimeOff] = useState(['confirmed', 'tentative']);
  const [selectedProjectStatus, setSelectedProjectStatus] = useState(['Tentative', 'Confirmed', 'Completed']);
  const [selectedPeople, setSelectedPeople] = useState(['Employees', 'Contractors', 'Active', 'Archived', 'Unassigned']);
  const [openFilter, setOpenFilter] = useState(null);
  const dropdownRef = useRef();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenFilter(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getFilterLabel = (type) => {
    if (type === 'people') {
      const selected = selectedPeople;
      if (selected.length === PEOPLE_OPTIONS.length) return 'All';
      return selected.join(', ');
    }
    if (type === 'project') {
      const selected = selectedProjectStatus;
      if (selected.length === PROJECT_STATUS_OPTIONS.length) return 'All';
      return selected.join(', ');
    }
    if (type === 'timeoff') {
      const selected = selectedTimeOff;
      if (selected.length === TIME_OFF_OPTIONS.length) return 'All';
      return selected.join(', ');
    }
    return 'All';
  };

  const timeframeData = (() => {
    if (viewType === 'days') {
      return { weeks: 4.3 }; // ~30 days
    } else if (viewType === 'weeks') {
      return { weeks: 12 };
    } else {
      return { weeks: 52 };
    }
  })();
  const weeks = timeframeData.weeks;
  const workingDays = weeks * 5;
  const hoursPerDay = 7.5;
  const totalCapacityHours = workingDays * hoursPerDay;

  const scheduleAllocations = useMemo(
    () => [...allocations, ...publicHolidayAllocations],
    [allocations, publicHolidayAllocations]
  );

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

  const personRows = useMemo(
    () =>
      activePeople.map((person) => {
        const capacity = totalCapacityHours;
        let billable = 0;
        let nonBillable = 0;
        let timeOff = 0;

        const allocationsForPerson = scheduleAllocations.filter((alloc) =>
          allocationHasPersonSchedule(alloc, person.id)
        );

        const projectTotals = new Map();
        for (const alloc of allocationsForPerson) {
          const hours = allocationHours(alloc);
          const key = breakdownKey(alloc, projects);
          projectTotals.set(key, (projectTotals.get(key) || 0) + hours);

          if (alloc.isLeave) {
            timeOff += hours;
          } else {
            const label = (alloc.project || "").trim();
            const isBillable = projectBillability.get(label);
            if (isBillable === false) {
              nonBillable += hours;
            } else {
              billable += hours;
            }
          }
        }

        const scheduled = billable + nonBillable;
        const overtime = Math.max(0, scheduled - capacity);
        const unscheduled = Math.max(0, capacity - scheduled - timeOff);

        return {
          ...person,
          dept: person.department || "—",
          capacity,
          scheduled,
          billable,
          nonBillable,
          timeOff,
          overtime,
          unscheduled,
          allocations: allocationsForPerson,
          projectTotals,
        };
      }),
    [activePeople, scheduleAllocations, projectBillability, projects, totalCapacityHours]
  );

  const totals = useMemo(() => {
    const sums = personRows.reduce(
      (acc, person) => {
        acc.cap += person.capacity;
        acc.sch += person.scheduled;
        acc.bil += person.billable;
        acc.non += person.nonBillable;
        acc.toff += person.timeOff;
        acc.ot += person.overtime;
        return acc;
      },
      { cap: 0, sch: 0, bil: 0, non: 0, toff: 0, ot: 0 }
    );
    return { ...sums, unsch: Math.max(0, sums.cap - sums.sch - sums.toff) };
  }, [personRows]);

  const roleRows = useMemo(() => {
    const groups = {};
    personRows.forEach(person => {
      const role = person.role || "Unassigned";
      if (!groups[role]) {
        groups[role] = { capacity: 0, scheduled: 0, billable: 0, nonBillable: 0, timeOff: 0, overtime: 0, unscheduled: 0, people: [], scheduledCost: 0 };
      }
      const g = groups[role];
      g.capacity += person.capacity;
      g.scheduled += person.scheduled;
      g.billable += person.billable;
      g.nonBillable += person.nonBillable;
      g.timeOff += person.timeOff;
      g.overtime += person.overtime;
      g.unscheduled += person.unscheduled;
      g.scheduledCost += person.billable * COST_PER_HOUR;
      g.people.push(person);
    });
    return Object.entries(groups).map(([role, data]) => ({ id: role, name: role, ...data }));
  }, [personRows]);

  const deptRows = useMemo(() => {
    const groups = {};
    personRows.forEach(person => {
      const dept = person.dept;
      if (!groups[dept]) {
        groups[dept] = { capacity: 0, scheduled: 0, billable: 0, nonBillable: 0, timeOff: 0, overtime: 0, unscheduled: 0, people: [], scheduledCost: 0 };
      }
      const g = groups[dept];
      g.capacity += person.capacity;
      g.scheduled += person.scheduled;
      g.billable += person.billable;
      g.nonBillable += person.nonBillable;
      g.timeOff += person.timeOff;
      g.overtime += person.overtime;
      g.unscheduled += person.unscheduled;
      g.scheduledCost += person.billable * COST_PER_HOUR;
      g.people.push(person);
    });
    return Object.entries(groups).map(([dept, data]) => ({ id: dept, name: dept, ...data }));
  }, [personRows]);

  const projectRows = useMemo(() => {
    const groups = {};
    for (const alloc of scheduleAllocations) {
      if (alloc.isLeave) continue;
      const project = alloc.project || "Unspecified work";
      const peopleIds = alloc.people || [];
      for (const pid of peopleIds) {
        if (!groups[project]) {
          groups[project] = { people: new Set() };
        }
        groups[project].people.add(pid);
      }
    }
    const result = [];
    for (const [project, { people: personIds }] of Object.entries(groups)) {
      const persons = personRows.filter(p => personIds.has(p.id));
      const aggregated = persons.reduce((acc, p) => {
        acc.capacity += p.capacity;
        acc.scheduled += p.scheduled;
        acc.billable += p.billable;
        acc.nonBillable += p.nonBillable;
        acc.timeOff += p.timeOff;
        acc.overtime += p.overtime;
        acc.unscheduled += p.unscheduled;
        acc.scheduledCost += p.billable * COST_PER_HOUR;
        return acc;
      }, { capacity: 0, scheduled: 0, billable: 0, nonBillable: 0, timeOff: 0, overtime: 0, unscheduled: 0, scheduledCost: 0 });
      result.push({ id: project, name: project, ...aggregated, people: persons });
    }
    return result;
  }, [scheduleAllocations, personRows]);

  const getTaskCategory = (alloc) => {
    if (!alloc || alloc.isLeave) return "No task allocation";
    const days = alloc.workingDays || Math.round((alloc.hoursPerDay || 0) / 7.5);
    if (days >= 5) return "ft";
    if (days >= 4) return "4d/w";
    if (days >= 3) return "3d/w";
    if (days >= 2) return "2d/w";
    if (days >= 1) return "1d/w";
    return "engineer";
  };

  const taskRows = useMemo(() => {
    const groups = {};
    for (const alloc of scheduleAllocations) {
      const category = getTaskCategory(alloc);
      const peopleIds = alloc.people || [];
      for (const pid of peopleIds) {
        if (!groups[category]) {
          groups[category] = { people: new Set() };
        }
        groups[category].people.add(pid);
      }
    }
    const result = [];
    for (const [category, { people: personIds }] of Object.entries(groups)) {
      const persons = personRows.filter(p => personIds.has(p.id));
      const aggregated = persons.reduce((acc, p) => {
        acc.capacity += p.capacity;
        acc.scheduled += p.scheduled;
        acc.billable += p.billable;
        acc.nonBillable += p.nonBillable;
        acc.timeOff += p.timeOff;
        acc.overtime += p.overtime;
        acc.unscheduled += p.unscheduled;
        acc.scheduledCost += p.billable * COST_PER_HOUR;
        return acc;
      }, { capacity: 0, scheduled: 0, billable: 0, nonBillable: 0, timeOff: 0, overtime: 0, unscheduled: 0, scheduledCost: 0 });
      result.push({ id: category, name: category, ...aggregated, people: persons });
    }
    return result;
  }, [scheduleAllocations, personRows]);

  const timeOffRows = useMemo(() => {
    const groups = {};
    for (const alloc of scheduleAllocations) {
      if (!alloc.isLeave) continue;
      const type = alloc.leaveType || "Unspecified";
      const peopleIds = alloc.people || [];
      for (const pid of peopleIds) {
        if (!groups[type]) {
          groups[type] = { people: new Set(), totalHours: 0 };
        }
        groups[type].people.add(pid);
        groups[type].totalHours += allocationHours(alloc);
      }
    }
    const result = [];
    for (const [type, { people: personIds, totalHours }] of Object.entries(groups)) {
      const persons = personRows.filter(p => personIds.has(p.id));
      const totalDays = totalHours / 7.5;
      result.push({ id: type, name: type, totalHours, totalDays, people: persons });
    }
    return result;
  }, [scheduleAllocations, personRows]);

  const tabCounts = useMemo(
    () => ({
      People: activePeople.length,
      Roles: roleRows.length,
      Departments: deptRows.length,
      Projects: projectRows.length,
      Tasks: taskRows.length,
      "Time off": timeOffRows.length,
    }),
    [activePeople.length, roleRows.length, deptRows.length, projectRows.length, taskRows.length, timeOffRows.length]
  );

  const chartRange = useMemo(() => {
    const dates = scheduleAllocations
      .map((alloc) => parseDate(alloc.startDate))
      .filter(Boolean);

    const endDate = dates.length
      ? new Date(Math.max(...dates.map((date) => date.valueOf())))
      : parseDate(new Date());
    
    let startDate;
    if (viewType === 'days') {
      startDate = addDays(endDate, -30);
    } else if (viewType === 'weeks') {
      startDate = addDays(endDate, -(12 * 7));
    } else {
      startDate = addDays(endDate, -(12 * 30));
    }

    const grouped = new Map();
    for (const alloc of scheduleAllocations) {
      const allocDate = parseDate(alloc.startDate);
      if (!allocDate || allocDate < startDate || allocDate > endDate) continue;
      
      let key;
      if (viewType === 'days') {
        key = allocDate.toISOString().split('T')[0];
      } else if (viewType === 'weeks') {
        const weekStart = new Date(allocDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        const monthDate = new Date(allocDate.getFullYear(), allocDate.getMonth(), 1);
        key = monthDate.toISOString().split('T')[0];
      }
      
      const hours = allocationHours(alloc);
      const existing = grouped.get(key) || { billable: 0, nonBillable: 0, timeOff: 0 };
      if (alloc.isLeave) {
        existing.timeOff += hours;
      } else {
        const label = (alloc.project || "").trim();
        const isBillable = projectBillability.get(label);
        if (isBillable === false) {
          existing.nonBillable += hours;
        } else {
          existing.billable += hours;
        }
      }
      grouped.set(key, existing);
    }

    const data = [];
    if (viewType === 'days') {
      for (let cursor = new Date(startDate); cursor <= endDate; cursor = addDays(cursor, 1)) {
        const key = cursor.toISOString().split('T')[0];
        const label = cursor.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
        const values = grouped.get(key) || { billable: 0, nonBillable: 0, timeOff: 0 };
        const total = values.billable + values.nonBillable + values.timeOff;
        data.push({ label, ...values, total });
      }
    } else if (viewType === 'weeks') {
      for (let cursor = new Date(startDate); cursor <= endDate; cursor = addDays(cursor, 7)) {
        const weekStart = new Date(cursor);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const key = weekStart.toISOString().split('T')[0];
        const label = cursor.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
        const values = grouped.get(key) || { billable: 0, nonBillable: 0, timeOff: 0 };
        const total = values.billable + values.nonBillable + values.timeOff;
        data.push({ label, ...values, total });
      }
    } else {
      for (let cursor = new Date(startDate); cursor <= endDate; cursor = addDays(cursor, 30)) {
        const monthDate = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const key = monthDate.toISOString().split('T')[0];
        const label = cursor.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });
        const values = grouped.get(key) || { billable: 0, nonBillable: 0, timeOff: 0 };
        const total = values.billable + values.nonBillable + values.timeOff;
        data.push({ label, ...values, total });
      }
    }

    const totalCapacity = totalCapacityHours * activePeople.length;
    return { startDate, endDate, data, totalCapacity };
  }, [scheduleAllocations, viewType, projectBillability, totalCapacityHours, activePeople.length]);

  const toggleRow = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const chartMax = useMemo(
    () => Math.max(...chartRange.data.map((d) => d.total), 1),
    [chartRange.data]
  );

  const chartStartLabel = chartRange.startDate ? weekLabel(chartRange.startDate) : "—";
  const chartEndLabel = chartRange.endDate ? weekLabel(chartRange.endDate) : "—";
  const isDark = theme !== "light";

  return (
    <div className="reporting-root" data-theme={theme === "light" ? "light" : "dark"}>
      <AppSideNav />

      <main className="reporting-main rp-full-main">
        {/* Toolbar */}
        <motion.div
          className="rp-toolbar"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="rp-date-nav">
            <button className="rp-icon-btn" aria-label="Previous period">
              <ChevronLeft size={14} />
            </button>
            <button className="rp-icon-btn" aria-label="Next period">
              <ChevronRight size={14} />
            </button>
            <span className="rp-date-label">
              {chartStartLabel}
              {" – "}
              <span className="rp-date-accent">{chartEndLabel}</span>
            </span>
            <button className="rp-date-caret" aria-label="Open date picker">
              <ChevronDown size={13} />
            </button>
          </div>

          <div className="rp-toolbar-right">
            <div className="rp-filters" ref={dropdownRef}>
              <div className="rp-filter-dropdown">
                <button className="rp-filter-pill" onClick={() => setOpenFilter(openFilter === 'people' ? null : 'people')}>
                  People: {getFilterLabel('people')} <ChevronDown size={12} />
                </button>
                {openFilter === 'people' && (
                  <div className="rp-filter-options">
                    {PEOPLE_OPTIONS.map(option => (
                      <label key={option} className="rp-filter-option">
                        <input
                          type="checkbox"
                          checked={selectedPeople.includes(option)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPeople([...selectedPeople, option]);
                            } else {
                              setSelectedPeople(selectedPeople.filter(s => s !== option));
                            }
                          }}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="rp-filter-dropdown">
                <button className="rp-filter-pill" onClick={() => setOpenFilter(openFilter === 'project' ? null : 'project')}>
                  Project status: {getFilterLabel('project')} <ChevronDown size={12} />
                </button>
                {openFilter === 'project' && (
                  <div className="rp-filter-options">
                    {PROJECT_STATUS_OPTIONS.map(option => (
                      <label key={option} className="rp-filter-option">
                        <input
                          type="checkbox"
                          checked={selectedProjectStatus.includes(option)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProjectStatus([...selectedProjectStatus, option]);
                            } else {
                              setSelectedProjectStatus(selectedProjectStatus.filter(s => s !== option));
                            }
                          }}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="rp-filter-dropdown">
                <button className="rp-filter-pill" onClick={() => setOpenFilter(openFilter === 'timeoff' ? null : 'timeoff')}>
                  Time off: {getFilterLabel('timeoff')} <ChevronDown size={12} />
                </button>
                {openFilter === 'timeoff' && (
                  <div className="rp-filter-options">
                    {TIME_OFF_OPTIONS.map(option => (
                      <label key={option} className="rp-filter-option">
                        <input
                          type="checkbox"
                          checked={selectedTimeOff.includes(option)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTimeOff([...selectedTimeOff, option]);
                            } else {
                              setSelectedTimeOff(selectedTimeOff.filter(s => s !== option));
                            }
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
                value={viewType}
                onChange={(e) => setViewType(e.target.value)}
                className="rp-view-type-select"
              >
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Chart (CSS-based bar visualization) */}
        <motion.div
          className="rp-chart-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "260px", padding: "12px 8px" }}>
            {chartRange.data.map((d, i) => {
              const height = chartMax > 0 ? Math.max(6, (d.total / chartMax) * 220) : 6;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${height}px`,
                    background: isDark ? "#2dd4bf" : "#0d9488",
                    borderRadius: "2px 2px 0 0",
                    minHeight: "6px",
                  }}
                  title={`${viewType.charAt(0).toUpperCase() + viewType.slice(1)}: ${d.label}\nBillable: ${fmt(d.billable)} (${pct(d.billable, d.total)})\nNon-billable: ${fmt(d.nonBillable)} (${pct(d.nonBillable, d.total)})\nTime off: ${fmt(d.timeOff)} (${pct(d.timeOff, d.total)})\nTotal: ${fmt(d.total)}\nCapacity: ${fmt(chartRange.totalCapacity)}`}
                />
              );
            })}
          </div>
        </motion.div>

        {/* Chart Legend */}
        <motion.div
          className="rp-chart-legend"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >

        </motion.div>

        {/* Stats Strip */}
        <motion.div
          className="rp-stats-strip"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <div className="rp-stat">
            <span className="rp-stat-label">Capacity</span>
            <span className="rp-stat-value">{fmt(totals.cap)}</span>
          </div>

          <div className="rp-stat-divider" />

          <div className="rp-stat rp-stat--wide">
            <span className="rp-stat-label">
              Scheduled <span className="rp-stat-pct">{pct(totals.sch, totals.cap)}</span>
            </span>
            <span className="rp-stat-value">{fmt(totals.sch)}</span>
            <div className="rp-stat-breakdown">
              <span className="rp-swatch rp-swatch--billable" />
              <span className="rp-stat-sub-label">Billable</span>
              <span className="rp-stat-sub-val">{fmt(totals.bil)}</span>
              <span className="rp-stat-sub-pct">{pct(totals.bil, totals.cap)}</span>
            </div>
            <div className="rp-stat-breakdown">
              <span className="rp-swatch rp-swatch--nonbill" />
              <span className="rp-stat-sub-label">Non-billable</span>
              <span className="rp-stat-sub-val">{fmt(totals.non)}</span>
              <span className="rp-stat-sub-pct">{pct(totals.non, totals.cap)}</span>
            </div>
          </div>

          <div className="rp-stat-divider" />

          <div className="rp-stat">
            <span className="rp-stat-label">
              Unscheduled <span className="rp-stat-pct">{pct(totals.unsch, totals.cap)}</span>
            </span>
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

        {/* ─── Tabs Row ─────────────────────────────────────────────────────────── */}
        <motion.div
          className="rp-tabs-row"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          {TABS.map(({ key }) => (
            <button
              key={key}
              className={`rp-tab ${activeTab === key ? "rp-tab--active" : ""}`}
              onClick={() => setActiveTab(key)}
            >
              {key}
              {tabCounts[key] != null && <span className="rp-tab-count">{tabCounts[key]}</span>}
            </button>
          ))}
        </motion.div>

        {/* ─── Table Section ────────────────────────────────────────────────────── */}
        <motion.div
          className="rp-table-wrap"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
        >
          {activeTab === "People" && (
            <table className="rp-table">
              <thead>
                <tr>
                  <th className="rp-th rp-th--expand" />
                  <th className="rp-th rp-th--name">
                    Person <ChevronDown size={12} className="rp-th-sort" />
                  </th>
                  <th className="rp-th">Department</th>
                  <th className="rp-th rp-th--num">Capacity</th>
                  <th className="rp-th rp-th--num rp-th--accent">Scheduled</th>
                  <th className="rp-th rp-th--num rp-th--accent">Billable</th>
                  <th className="rp-th rp-th--num rp-th--accent">Non-billable</th>
                  <th className="rp-th rp-th--num">Time off</th>
                  <th className="rp-th rp-th--num">Overtime</th>
                  <th className="rp-th rp-th--num">Sched.&nbsp;%</th>
                  <th className="rp-th">Scheduled Cost</th>
                </tr>
              </thead>
              <tbody>
                {/* Totals row */}
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
                  <td className="rp-td rp-td--num">
                    <div className="rp-sched-cell">
                      <span>{pct(totals.sch, totals.cap)}</span>
                      <div className="rp-sched-bar-wrap">
                        <div
                          className="rp-sched-bar"
                          style={{ width: `${Math.round((totals.sch / totals.cap) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="rp-td rp-td--num">{fmt(totals.bil * COST_PER_HOUR)}</td>
                </tr>

                {/* People rows */}
                {personRows.map((person, idx) => {
                  const schedPct = person.capacity > 0
                    ? Math.round((person.scheduled / person.capacity) * 100)
                    : 0;
                  const isExpanded = expanded[person.id];
                  return (
                    <tbody key={`person-${person.id}`}>
                      <tr
                        className={`rp-row ${idx % 2 === 0 ? "rp-row--even" : ""}`}
                      >
                        <td className="rp-td rp-td--expand">
                          <button
                            className="rp-expand-btn"
                            onClick={() => toggleRow(person.id)}
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                          >
                            <ChevronRight
                              size={13}
                              className={`rp-expand-icon ${isExpanded ? "rp-expand-icon--open" : ""}`}
                            />
                          </button>
                        </td>
                        <td className="rp-td rp-td--name">{person.name}</td>
                        <td className="rp-td rp-td--dept">{person.dept}</td>
                        <td className="rp-td rp-td--num">{fmt(person.capacity)}</td>
                        <td className="rp-td rp-td--num">{fmt(person.scheduled)}</td>
                        <td className="rp-td rp-td--num">{fmt(person.billable)}</td>
                        <td className="rp-td rp-td--num">{fmt(person.nonBillable)}</td>
                        <td className="rp-td rp-td--num">{fmt(person.timeOff)}</td>
                        <td className="rp-td rp-td--num">{fmt(person.overtime)}</td>
                        <td className="rp-td rp-td--num">
                          <div className="rp-sched-cell">
                            <span>{schedPct}%</span>
                            <div className="rp-sched-bar-wrap">
                              <div
                                className="rp-sched-bar"
                                style={{ width: `${schedPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="rp-td rp-td--num">{fmt(person.billable * COST_PER_HOUR)}</td>
                      </tr>
                      <AnimatePresence>
                        {isExpanded && (
                          <tr>
                            className="rp-row rp-row--detail"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <td colSpan={11} className="rp-td rp-td--detail">
                              <div className="rp-detail-inner">
                                {person.projectTotals.size > 0 ? (
                                  <div>
                                    {Array.from(person.projectTotals.entries()).map(([label, hours]) => (
                                      <div key={label} style={{ marginBottom: 6 }}>
                                        <strong>{label}</strong>: {fmt(hours)}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  "No project breakdowns in this date range."
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </tbody>
                  );
                })}
              </tbody>
            </table>
          )}

          {activeTab === "Roles" && (
            <table className="rp-table">
              <thead>
                <tr>
                  <th className="rp-th rp-th--expand" />
                  <th className="rp-th rp-th--name">
                    Role <ChevronDown size={12} className="rp-th-sort" />
                  </th>
                  <th className="rp-th">Department</th>
                  <th className="rp-th rp-th--num">Capacity</th>
                  <th className="rp-th rp-th--num rp-th--accent">Scheduled</th>
                  <th className="rp-th rp-th--num rp-th--accent">Billable</th>
                  <th className="rp-th rp-th--num rp-th--accent">Non-billable</th>
                  <th className="rp-th rp-th--num">Time off</th>
                  <th className="rp-th rp-th--num">Overtime</th>
                  <th className="rp-th rp-th--num">Sched.&nbsp;%</th>
                  <th className="rp-th">Scheduled Cost</th>
                </tr>
              </thead>
              <tbody>
                {roleRows.map((row, idx) => {
                  const schedPct = row.capacity > 0 ? Math.round((row.scheduled / row.capacity) * 100) : 0;
                  const isExpanded = expanded[row.id];
                  return (
                    <tbody key={`role-${row.id}`}>
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
                        <td className="rp-td rp-td--muted">—</td>
                        <td className="rp-td rp-td--num">{fmt(row.capacity)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.scheduled)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.billable)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.nonBillable)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.timeOff)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.overtime)}</td>
                        <td className="rp-td rp-td--num">
                          <div className="rp-sched-cell">
                            <span>{schedPct}%</span>
                            <div className="rp-sched-bar-wrap">
                              <div
                                className="rp-sched-bar"
                                style={{ width: `${schedPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="rp-td rp-td--num">{fmt(row.scheduledCost)}</td>
                      </tr>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.tr
                            className="rp-row rp-row--detail"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <td colSpan={11} className="rp-td rp-td--detail">
                              <div className="rp-detail-inner">
                                {row.people.map(person => (
                                  <div key={person.id} style={{ marginBottom: 6 }}>
                                    <strong>{person.name}</strong>: Capacity {fmt(person.capacity)}, Scheduled {fmt(person.scheduled)}, Billable {fmt(person.billable)}, etc.
                                  </div>
                                ))}
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </tbody>
                  );
                })}
              </tbody>
            </table>
          )}

          {activeTab === "Departments" && (
            <table className="rp-table">
              <thead>
                <tr>
                  <th className="rp-th rp-th--expand" />
                  <th className="rp-th rp-th--name">
                    Department <ChevronDown size={12} className="rp-th-sort" />
                  </th>
                  <th className="rp-th">Department</th>
                  <th className="rp-th rp-th--num">Capacity</th>
                  <th className="rp-th rp-th--num rp-th--accent">Scheduled</th>
                  <th className="rp-th rp-th--num rp-th--accent">Billable</th>
                  <th className="rp-th rp-th--num rp-th--accent">Non-billable</th>
                  <th className="rp-th rp-th--num">Time off</th>
                  <th className="rp-th rp-th--num">Overtime</th>
                  <th className="rp-th rp-th--num">Sched.&nbsp;%</th>
                  <th className="rp-th">Scheduled Cost</th>
                </tr>
              </thead>
              <tbody>
                {deptRows.map((row, idx) => {
                  const schedPct = row.capacity > 0 ? Math.round((row.scheduled / row.capacity) * 100) : 0;
                  const isExpanded = expanded[row.id];
                  return (
                    <tbody key={`dept-${row.id}`}>
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
                        <td className="rp-td rp-td--muted">—</td>
                        <td className="rp-td rp-td--num">{fmt(row.capacity)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.scheduled)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.billable)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.nonBillable)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.timeOff)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.overtime)}</td>
                        <td className="rp-td rp-td--num">
                          <div className="rp-sched-cell">
                            <span>{schedPct}%</span>
                            <div className="rp-sched-bar-wrap">
                              <div
                                className="rp-sched-bar"
                                style={{ width: `${schedPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="rp-td rp-td--num">{fmt(row.scheduledCost)}</td>
                      </tr>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.tr
                            className="rp-row rp-row--detail"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <td colSpan={11} className="rp-td rp-td--detail">
                              <div className="rp-detail-inner">
                                {row.people.map(person => (
                                  <div key={person.id} style={{ marginBottom: 6 }}>
                                    <strong>{person.name}</strong>: Capacity {fmt(person.capacity)}, Scheduled {fmt(person.scheduled)}, Billable {fmt(person.billable)}, etc.
                                  </div>
                                ))}
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </tbody>
                  );
                })}
              </tbody>
            </table>
          )}

          {activeTab === "Projects" && (
            <table className="rp-table">
              <thead>
                <tr>
                  <th className="rp-th rp-th--expand" />
                  <th className="rp-th rp-th--name">
                    Project <ChevronDown size={12} className="rp-th-sort" />
                  </th>
                  <th className="rp-th">Department</th>
                  <th className="rp-th rp-th--num">Capacity</th>
                  <th className="rp-th rp-th--num rp-th--accent">Scheduled</th>
                  <th className="rp-th rp-th--num rp-th--accent">Billable</th>
                  <th className="rp-th rp-th--num rp-th--accent">Non-billable</th>
                  <th className="rp-th rp-th--num">Time off</th>
                  <th className="rp-th rp-th--num">Overtime</th>
                  <th className="rp-th rp-th--num">Sched.&nbsp;%</th>
                  <th className="rp-th">Scheduled Cost</th>
                </tr>
              </thead>
              <tbody>
                {projectRows.map((row, idx) => {
                  const schedPct = row.capacity > 0 ? Math.round((row.scheduled / row.capacity) * 100) : 0;
                  const isExpanded = expanded[row.id];
                  return (
                    <tbody key={`project-${row.id}`}>
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
                        <td className="rp-td rp-td--muted">—</td>
                        <td className="rp-td rp-td--num">{fmt(row.capacity)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.scheduled)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.billable)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.nonBillable)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.timeOff)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.overtime)}</td>
                        <td className="rp-td rp-td--num">
                          <div className="rp-sched-cell">
                            <span>{schedPct}%</span>
                            <div className="rp-sched-bar-wrap">
                              <div
                                className="rp-sched-bar"
                                style={{ width: `${schedPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="rp-td rp-td--num">{fmt(row.scheduledCost)}</td>
                      </tr>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.tr
                            className="rp-row rp-row--detail"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <td colSpan={11} className="rp-td rp-td--detail">
                              <div className="rp-detail-inner">
                                {row.people.map(person => (
                                  <div key={person.id} style={{ marginBottom: 6 }}>
                                    <strong>{person.name}</strong>: Capacity {fmt(person.capacity)}, Scheduled {fmt(person.scheduled)}, Billable {fmt(person.billable)}, etc.
                                  </div>
                                ))}
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </tbody>
                  );
                })}
              </tbody>
            </table>
          )}

          {activeTab === "Tasks" && (
            <table className="rp-table">
              <thead>
                <tr>
                  <th className="rp-th rp-th--expand" />
                  <th className="rp-th rp-th--name">
                    Task Category <ChevronDown size={12} className="rp-th-sort" />
                  </th>
                  <th className="rp-th">Department</th>
                  <th className="rp-th rp-th--num">Capacity</th>
                  <th className="rp-th rp-th--num rp-th--accent">Scheduled</th>
                  <th className="rp-th rp-th--num rp-th--accent">Billable</th>
                  <th className="rp-th rp-th--num rp-th--accent">Non-billable</th>
                  <th className="rp-th rp-th--num">Time off</th>
                  <th className="rp-th rp-th--num">Overtime</th>
                  <th className="rp-th rp-th--num">Sched.&nbsp;%</th>
                  <th className="rp-th">Scheduled Cost</th>
                </tr>
              </thead>
              <tbody>
                {taskRows.map((row, idx) => {
                  const schedPct = row.capacity > 0 ? Math.round((row.scheduled / row.capacity) * 100) : 0;
                  const isExpanded = expanded[row.id];
                  return (
                    <tbody key={`task-${row.id}`}>
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
                        <td className="rp-td rp-td--muted">—</td>
                        <td className="rp-td rp-td--num">{fmt(row.capacity)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.scheduled)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.billable)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.nonBillable)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.timeOff)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.overtime)}</td>
                        <td className="rp-td rp-td--num">
                          <div className="rp-sched-cell">
                            <span>{schedPct}%</span>
                            <div className="rp-sched-bar-wrap">
                              <div
                                className="rp-sched-bar"
                                style={{ width: `${schedPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="rp-td rp-td--num">{fmt(row.scheduledCost)}</td>
                      </tr>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.tr
                            className="rp-row rp-row--detail"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <td colSpan={11} className="rp-td rp-td--detail">
                              <div className="rp-detail-inner">
                                {row.people.map(person => (
                                  <div key={person.id} style={{ marginBottom: 6 }}>
                                    <strong>{person.name}</strong>: Capacity {fmt(person.capacity)}, Scheduled {fmt(person.scheduled)}, Billable {fmt(person.billable)}, etc.
                                  </div>
                                ))}
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </tbody>
                  );
                })}
              </tbody>
            </table>
          )}

          {activeTab === "Time off" && (
            <table className="rp-table">
              <thead>
                <tr>
                  <th className="rp-th rp-th--expand" />
                  <th className="rp-th rp-th--name">
                    Leave Type <ChevronDown size={12} className="rp-th-sort" />
                  </th>
                  <th className="rp-th rp-th--num">Total Days</th>
                  <th className="rp-th rp-th--num">Total Hours</th>
                </tr>
              </thead>
              <tbody>
                {timeOffRows.map((row, idx) => {
                  const isExpanded = expanded[row.id];
                  return (
                    <tbody key={`timeoff-${row.id}`}>
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
                        <td className="rp-td rp-td--num">{row.totalDays.toFixed(1)}</td>
                        <td className="rp-td rp-td--num">{fmt(row.totalHours)}</td>
                      </tr>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.tr
                            className="rp-row rp-row--detail"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <td colSpan={4} className="rp-td rp-td--detail">
                              <div className="rp-detail-inner">
                                {row.people.map(person => (
                                  <div key={person.id} style={{ marginBottom: 6 }}>
                                    <strong>{person.name}</strong>: {fmt(person.timeOff)} hours ({ (person.timeOff / 7.5).toFixed(1)} days)
                                  </div>
                                ))}
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </tbody>
                  );
                })}
              </tbody>
            </table>
          )}

          { !["People", "Roles", "Departments", "Projects", "Tasks", "Time off"].includes(activeTab) && (
            <div className="rp-empty-tab">
              <span>No data available for <strong>{activeTab}</strong> in this period.</span>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}