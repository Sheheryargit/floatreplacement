import { useState, useMemo, useRef, useEffect, Fragment } from "react";
import { motion } from "framer-motion";
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
  { key: "People" },
  { key: "Roles" },
  { key: "Departments" },
  { key: "Projects" },
  { key: "Tasks" },
  { key: "Time off" },
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
function StandardRow({ row, idx, expanded, toggleRow, showDept = true }) {
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
                <strong>{person.name}</strong>: Capacity {fmt(person.capacity)}, Scheduled {fmt(person.scheduled)}, Billable {fmt(person.billable)}
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
    if (type === 'people') return selectedPeople.length === PEOPLE_OPTIONS.length ? 'All' : selectedPeople.join(', ');
    if (type === 'project') return selectedProjectStatus.length === PROJECT_STATUS_OPTIONS.length ? 'All' : selectedProjectStatus.join(', ');
    if (type === 'timeoff') return selectedTimeOff.length === TIME_OFF_OPTIONS.length ? 'All' : selectedTimeOff.join(', ');
    return 'All';
  };
 
  const totalCapacityHours = useMemo(() => {
    if (viewType === 'days') return 4.3 * 5 * 7.5;
    if (viewType === 'weeks') return 12 * 5 * 7.5;
    return 52 * 5 * 7.5;
  }, [viewType]);
 
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
 
  // ── Person rows — source of truth for all tabs ───────────────────────────────
  // Each person row stores their resolved allocations so downstream tabs
  // don't need to re-run allocationHasPersonSchedule.
  const personRows = useMemo(
    () =>
      activePeople.map((person) => {
        const capacity = totalCapacityHours;
        let billable = 0, nonBillable = 0, timeOff = 0;
 
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
      }),
    [activePeople, scheduleAllocations, projectBillability, projects, totalCapacityHours]
  );
 
  // ── Totals ──────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const sums = personRows.reduce(
      (acc, p) => {
        acc.cap += p.capacity; acc.sch += p.scheduled;
        acc.bil += p.billable; acc.non += p.nonBillable;
        acc.toff += p.timeOff; acc.ot += p.overtime;
        return acc;
      },
      { cap: 0, sch: 0, bil: 0, non: 0, toff: 0, ot: 0 }
    );
    return { ...sums, unsch: Math.max(0, sums.cap - sums.sch - sums.toff) };
  }, [personRows]);
 
  // ── Role rows ───────────────────────────────────────────────────────────────
  const roleRows = useMemo(() => {
    const groups = {};
    personRows.forEach(person => {
      const role = person.role || "Unassigned";
      if (!groups[role]) groups[role] = { capacity: 0, scheduled: 0, billable: 0, nonBillable: 0, timeOff: 0, overtime: 0, unscheduled: 0, people: [], scheduledCost: 0 };
      const g = groups[role];
      g.capacity += person.capacity; g.scheduled += person.scheduled;
      g.billable += person.billable; g.nonBillable += person.nonBillable;
      g.timeOff += person.timeOff; g.overtime += person.overtime;
      g.unscheduled += person.unscheduled;
      g.scheduledCost += person.billable * COST_PER_HOUR;
      g.people.push(person);
    });
    return Object.entries(groups).map(([role, data]) => ({ id: role, name: role, ...data }));
  }, [personRows]);
 
  // ── Dept rows ───────────────────────────────────────────────────────────────
  const deptRows = useMemo(() => {
    const groups = {};
    personRows.forEach(person => {
      const dept = person.dept;
      if (!groups[dept]) groups[dept] = { capacity: 0, scheduled: 0, billable: 0, nonBillable: 0, timeOff: 0, overtime: 0, unscheduled: 0, people: [], scheduledCost: 0 };
      const g = groups[dept];
      g.capacity += person.capacity; g.scheduled += person.scheduled;
      g.billable += person.billable; g.nonBillable += person.nonBillable;
      g.timeOff += person.timeOff; g.overtime += person.overtime;
      g.unscheduled += person.unscheduled;
      g.scheduledCost += person.billable * COST_PER_HOUR;
      g.people.push(person);
    });
    return Object.entries(groups).map(([dept, data]) => ({ id: dept, name: dept, ...data }));
  }, [personRows]);
 
  // ── Project rows ─────────────────────────────────────────────────────────────
  // Iterates person.allocations — already resolved, no need to re-run
  // allocationHasPersonSchedule. This is why it now shows data.
  const projectRows = useMemo(() => {
    const groups = {};
 
    for (const person of personRows) {
      for (const alloc of person.allocations) {
        if (alloc.isLeave) continue;
        const projectLabel = (alloc.project || "").trim() || "Unspecified work";
        const hours = allocationHours(alloc);
        const isBillable = projectBillability.get(projectLabel) !== false;
 
        if (!groups[projectLabel]) {
          groups[projectLabel] = { scheduled: 0, billable: 0, nonBillable: 0, scheduledCost: 0, personIds: new Set() };
        }
        const g = groups[projectLabel];
        g.scheduled += hours;
        if (isBillable) { g.billable += hours; g.scheduledCost += hours * COST_PER_HOUR; }
        else g.nonBillable += hours;
        g.personIds.add(person.id);
      }
    }
 
    return Object.entries(groups).map(([projectLabel, data]) => {
      const projectMeta = projects.find(p => projectToAllocationLabel(p) === projectLabel) || {};
      const persons = personRows.filter(p => data.personIds.has(p.id));
      return {
        id: projectLabel,
        name: projectMeta.name || projectLabel,
        code: projectMeta.code || "—",
        client: projectMeta.client || "—",
        owner: projectMeta.owner || "—",
        scheduled: data.scheduled,
        billable: data.billable,
        nonBillable: data.nonBillable,
        scheduledCost: data.scheduledCost,
        people: persons,
      };
    });
  }, [personRows, projects, projectBillability]);
 
  // ── Task rows ─────────────────────────────────────────────────────────────────
  // Same pattern — iterate person.allocations directly.
  const taskRows = useMemo(() => {
    const groups = {};
 
    for (const person of personRows) {
      for (const alloc of person.allocations) {
        const category = getTaskCategory(alloc);
        const hours = allocationHours(alloc);
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
      const persons = personRows.filter(p => data.personIds.has(p.id));
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
  }, [personRows, projectBillability]);
 
  // ── Time off rows ─────────────────────────────────────────────────────────────
  // Same pattern — iterate person.allocations directly.
  const timeOffRows = useMemo(() => {
    const groups = {};
 
    for (const person of personRows) {
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
      const persons = personRows.filter(p => data.personIds.has(p.id));
      return {
        id: type,
        name: type,
        totalHours: data.totalHours,
        totalDays: data.totalHours / 7.5,
        people: persons,
      };
    });
  }, [personRows]);
 
  // ── Tab counts ───────────────────────────────────────────────────────────────
  const tabCounts = useMemo(() => ({
    People: activePeople.length,
    Roles: roleRows.length,
    Departments: deptRows.length,
    Projects: projectRows.length,
    Tasks: taskRows.length,
    "Time off": timeOffRows.length,
  }), [activePeople.length, roleRows.length, deptRows.length, projectRows.length, taskRows.length, timeOffRows.length]);
 
  // ── Chart ────────────────────────────────────────────────────────────────────
  const chartRange = useMemo(() => {
    const dates = scheduleAllocations.map((a) => parseDate(a.startDate)).filter(Boolean);
    const endDate = dates.length ? new Date(Math.max(...dates.map(d => d.valueOf()))) : new Date();
    let startDate;
    if (viewType === 'days') startDate = addDays(endDate, -30);
    else if (viewType === 'weeks') startDate = addDays(endDate, -(12 * 7));
    else startDate = addDays(endDate, -(12 * 30));
 
    const grouped = new Map();
    for (const alloc of scheduleAllocations) {
      const allocDate = parseDate(alloc.startDate);
      if (!allocDate || allocDate < startDate || allocDate > endDate) continue;
      let key;
      if (viewType === 'days') key = allocDate.toISOString().split('T')[0];
      else if (viewType === 'weeks') {
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
    if (viewType === 'days') {
      for (let c = new Date(startDate); c <= endDate; c = addDays(c, 1)) {
        const key = c.toISOString().split('T')[0];
        const v = grouped.get(key) || { billable: 0, nonBillable: 0, timeOff: 0 };
        data.push({ label: c.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), ...v, total: v.billable + v.nonBillable + v.timeOff });
      }
    } else if (viewType === 'weeks') {
      for (let c = new Date(startDate); c <= endDate; c = addDays(c, 7)) {
        const ws = new Date(c); ws.setDate(ws.getDate() - ws.getDay());
        const key = ws.toISOString().split('T')[0];
        const v = grouped.get(key) || { billable: 0, nonBillable: 0, timeOff: 0 };
        data.push({ label: c.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), ...v, total: v.billable + v.nonBillable + v.timeOff });
      }
    } else {
      for (let c = new Date(startDate); c <= endDate; c = addDays(c, 30)) {
        const key = new Date(c.getFullYear(), c.getMonth(), 1).toISOString().split('T')[0];
        const v = grouped.get(key) || { billable: 0, nonBillable: 0, timeOff: 0 };
        data.push({ label: c.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }), ...v, total: v.billable + v.nonBillable + v.timeOff });
      }
    }
    return { startDate, endDate, data, totalCapacity: totalCapacityHours * activePeople.length };
  }, [scheduleAllocations, viewType, projectBillability, totalCapacityHours, activePeople.length]);
 
  const toggleRow = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const chartMax = useMemo(() => Math.max(...chartRange.data.map(d => d.total), 1), [chartRange.data]);
  const chartStartLabel = chartRange.startDate ? weekLabel(chartRange.startDate) : "—";
  const chartEndLabel = chartRange.endDate ? weekLabel(chartRange.endDate) : "—";
  const isDark = theme !== "light";
 
  return (
    <div className="reporting-root" data-theme={theme === "light" ? "light" : "dark"}>
      <AppSideNav />
 
      <main className="reporting-main rp-full-main">
 
        {/* ── Toolbar ── */}
        <motion.div className="rp-toolbar" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="rp-date-nav">
            <button className="rp-icon-btn" aria-label="Previous period"><ChevronLeft size={14} /></button>
            <button className="rp-icon-btn" aria-label="Next period"><ChevronRight size={14} /></button>
            <span className="rp-date-label">
              {chartStartLabel}{" – "}<span className="rp-date-accent">{chartEndLabel}</span>
            </span>
            <button className="rp-date-caret" aria-label="Open date picker"><ChevronDown size={13} /></button>
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
                        <input type="checkbox" checked={selectedPeople.includes(option)}
                          onChange={(e) => e.target.checked
                            ? setSelectedPeople([...selectedPeople, option])
                            : setSelectedPeople(selectedPeople.filter(s => s !== option))} />
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
                        <input type="checkbox" checked={selectedProjectStatus.includes(option)}
                          onChange={(e) => e.target.checked
                            ? setSelectedProjectStatus([...selectedProjectStatus, option])
                            : setSelectedProjectStatus(selectedProjectStatus.filter(s => s !== option))} />
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
                        <input type="checkbox" checked={selectedTimeOff.includes(option)}
                          onChange={(e) => e.target.checked
                            ? setSelectedTimeOff([...selectedTimeOff, option])
                            : setSelectedTimeOff(selectedTimeOff.filter(s => s !== option))} />
                        {option}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="rp-view-type-dropdown">
              <select value={viewType} onChange={(e) => setViewType(e.target.value)} className="rp-view-type-select">
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>
          </div>
        </motion.div>
 
        {/* ── Chart ── */}
        <motion.div className="rp-chart-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.05 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "260px", padding: "12px 8px" }}>
            {chartRange.data.map((d, i) => (
              <div key={i} style={{
                flex: 1,
                height: `${chartMax > 0 ? Math.max(6, (d.total / chartMax) * 220) : 6}px`,
                background: isDark ? "#2dd4bf" : "#0d9488",
                borderRadius: "2px 2px 0 0",
                minHeight: "6px",
              }} title={`${viewType}: ${d.label}\nBillable: ${fmt(d.billable)}\nNon-billable: ${fmt(d.nonBillable)}\nTime off: ${fmt(d.timeOff)}\nTotal: ${fmt(d.total)}`} />
            ))}
          </div>
        </motion.div>
 
        {/* ── Stats Strip ── */}
        <motion.div className="rp-stats-strip" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}>
          <div className="rp-stat">
            <span className="rp-stat-label">Capacity</span>
            <span className="rp-stat-value">{fmt(totals.cap)}</span>
          </div>
          <div className="rp-stat-divider" />
          <div className="rp-stat rp-stat--wide">
            <span className="rp-stat-label">Scheduled <span className="rp-stat-pct">{pct(totals.sch, totals.cap)}</span></span>
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
        <motion.div className="rp-tabs-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.15 }}>
          {TABS.map(({ key }) => (
            <button key={key} className={`rp-tab ${activeTab === key ? "rp-tab--active" : ""}`} onClick={() => setActiveTab(key)}>
              {key}
              {tabCounts[key] != null && <span className="rp-tab-count">{tabCounts[key]}</span>}
            </button>
          ))}
        </motion.div>
 
        {/* ── Tables ── */}
        <motion.div className="rp-table-wrap" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.2 }}>
 
          {/* ── People ── */}
          {activeTab === "People" && (
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
                {personRows.map((person, idx) => {
                  const isExpanded = expanded[person.id];
                  return (
                    <Fragment key={`person-${person.id}`}>
                      <tr className={`rp-row ${idx % 2 === 0 ? "rp-row--even" : ""}`}>
                        <td className="rp-td rp-td--expand">
                          <button className="rp-expand-btn" onClick={() => toggleRow(person.id)} aria-label={isExpanded ? "Collapse" : "Expand"}>
                            <ChevronRight size={13} className={`rp-expand-icon ${isExpanded ? "rp-expand-icon--open" : ""}`} />
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
                        <td className="rp-td rp-td--num"><SchedCell scheduled={person.scheduled} capacity={person.capacity} /></td>
                        <td className="rp-td rp-td--num">{fmt(person.billable * COST_PER_HOUR)}</td>
                      </tr>
                      <DetailRow isExpanded={isExpanded} colSpan={11}>
                        {person.projectTotals.size > 0
                          ? Array.from(person.projectTotals.entries()).map(([label, hours]) => (
                              <div key={label} style={{ marginBottom: 6 }}><strong>{label}</strong>: {fmt(hours)}</div>
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
          {activeTab === "Roles" && (
            <table className="rp-table">
              <StandardThead firstColLabel="Role" />
              <tbody>
                {roleRows.map((row, idx) => (
                  <StandardRow key={`role-${row.id}`} row={row} idx={idx} expanded={expanded} toggleRow={toggleRow} />
                ))}
              </tbody>
            </table>
          )}
 
          {/* ── Departments ── */}
          {activeTab === "Departments" && (
            <table className="rp-table">
              <StandardThead firstColLabel="Department" showDept={false} />
              <tbody>
                {deptRows.map((row, idx) => (
                  <StandardRow key={`dept-${row.id}`} row={row} idx={idx} expanded={expanded} toggleRow={toggleRow} showDept={false} />
                ))}
              </tbody>
            </table>
          )}
 
          {/* ── Projects ── */}
          {activeTab === "Projects" && (
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
                {projectRows.length === 0
                  ? <tr><td colSpan={10} className="rp-td"><div className="rp-empty-tab">No project data in this period.</div></td></tr>
                  : projectRows.map((row, idx) => {
                      const isExpanded = expanded[row.id];
                      return (
                        <Fragment key={`project-${row.id}`}>
                          <tr className={`rp-row ${idx % 2 === 0 ? "rp-row--even" : ""}`}>
                            <td className="rp-td rp-td--expand">
                              <button className="rp-expand-btn" onClick={() => toggleRow(row.id)} aria-label={isExpanded ? "Collapse" : "Expand"}>
                                <ChevronRight size={13} className={`rp-expand-icon ${isExpanded ? "rp-expand-icon--open" : ""}`} />
                              </button>
                            </td>
                            <td className="rp-td rp-td--name">{row.name}</td>
                            <td className="rp-td rp-td--dept">{row.code}</td>
                            <td className="rp-td rp-td--dept">{row.client}</td>
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
                                    <strong>{person.name}</strong>: Scheduled {fmt(person.scheduled)}, Billable {fmt(person.billable)}
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
          {activeTab === "Tasks" && (
            <table className="rp-table">
              <StandardThead firstColLabel="Allocation Type" showDept={false} />
              <tbody>
                {taskRows.length === 0
                  ? <tr><td colSpan={10} className="rp-td"><div className="rp-empty-tab">No task data in this period.</div></td></tr>
                  : taskRows.map((row, idx) => (
                      <StandardRow key={`task-${row.id}`} row={row} idx={idx} expanded={expanded} toggleRow={toggleRow} showDept={false} />
                    ))}
              </tbody>
            </table>
          )}
 
          {/* ── Time off ── */}
          {activeTab === "Time off" && (
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
                      const isExpanded = expanded[row.id];
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
                                    <strong>{person.name}</strong>: {fmt(person.timeOff)} ({(person.timeOff / 7.5).toFixed(1)} days)
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
 
        </motion.div>
      </main>
    </div>
  );
}