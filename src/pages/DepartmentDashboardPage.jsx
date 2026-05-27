import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarRange, ChevronLeft } from "lucide-react";
import AppSideNav from "../components/navigation/AppSideNav.jsx";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAppData } from "../context/AppDataContext.jsx";
import { Button } from "../components/ui/Button.jsx";
import { KpiCards } from "../components/dashboard/KpiCards.jsx";
import { ClientProjectTreemapGrid } from "../components/dashboard/ClientProjectTreemapGrid.jsx";
import { PeopleUtilizationStrip } from "../components/dashboard/PeopleUtilizationStrip.jsx";
import { PersonDetailDrawer } from "../components/dashboard/PersonDetailDrawer.jsx";
import { KpiBreakdownDrawer } from "../components/dashboard/KpiBreakdownDrawer.jsx";
import {
  computeDashboardAggregates,
  derivePeopleSets,
} from "../dashboards/departmentDashboardModel.js";
import "./DepartmentDashboardPage.css";

export default function DepartmentDashboardPage() {
  const { theme } = useAppTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { people, projects, allocations, publicHolidayAllocations, scheduleFilterRules } = useAppData();

  // Dashboard owns its range. Default: try to use range passed from Schedule (location.state),
  // else fall back to "today +/- 14 days" (2 work weeks-ish).
  const initialRange = useMemo(() => {
    const st = location.state && typeof location.state === "object" ? location.state : null;
    const start = typeof st?.startDate === "string" ? st.startDate : "";
    const end = typeof st?.endDate === "string" ? st.endDate : "";
    return { start, end };
  }, [location.state]);

  const [range, setRange] = useState(() => initialRange);
  const [scopeMode, setScopeMode] = useState("both_toggle"); // filtered vs dept vs both
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [pickedPerson, setPickedPerson] = useState(null);
  const [kpiDrawerKey, setKpiDrawerKey] = useState(null);

  useEffect(() => {
    const onPick = (e) => {
      const r = e?.detail?.personRow;
      if (r) setPickedPerson(r);
    };
    window.addEventListener("alloc8:kpi-breakdown:pick-person", onPick);
    return () => window.removeEventListener("alloc8:kpi-breakdown:pick-person", onPick);
  }, []);

  useEffect(() => {
    // If navigation passes a range later, sync once.
    setRange((cur) => (cur.start || cur.end ? cur : initialRange));
  }, [initialRange]);

  const visibleKeys = useMemo(() => {
    // Approx: dashboard uses whole weekdays in range; filter logic expects visibleKeys.
    // We use daily keys from range to keep allocation filters consistent.
    if (!range.start || !range.end) return [];
    const start = range.start;
    const end = range.end;
    if (end < start) return [];
    const out = [];
    const dt = new Date(`${start}T12:00:00`);
    const endDt = new Date(`${end}T12:00:00`);
    while (dt <= endDt) {
      const dow = dt.getDay();
      if (dow !== 0 && dow !== 6) out.push(dt.toISOString().slice(0, 10));
      dt.setDate(dt.getDate() + 1);
    }
    return out;
  }, [range.start, range.end]);

  const peopleSets = useMemo(
    () =>
      derivePeopleSets({
        people,
        scheduleFilterRules: location.state?.rules ?? scheduleFilterRules,
        allocations,
        projects,
        visibleKeys,
      }),
    [people, scheduleFilterRules, allocations, projects, visibleKeys, location.state]
  );

  const scopedPeople = useMemo(() => {
    if (scopeMode === "filtered") return peopleSets.filteredPeople;
    if (scopeMode === "department") return peopleSets.departmentPeople;
    // both_toggle: default to filtered, with ability to compare later; for now union.
    const ids = new Set(peopleSets.filteredPeople.map((p) => String(p.id)));
    const union = [...peopleSets.filteredPeople];
    for (const p of peopleSets.departmentPeople) {
      if (!ids.has(String(p.id))) union.push(p);
    }
    return union;
  }, [peopleSets, scopeMode]);

  const dashboard = useMemo(
    () =>
      computeDashboardAggregates({
        peopleSet: scopedPeople,
        allocations,
        publicHolidayAllocations,
        projects,
        rangeStartIso: range.start,
        rangeEndIso: range.end,
      }),
    [scopedPeople, allocations, publicHolidayAllocations, projects, range.start, range.end]
  );

  const filteredPeopleRows = useMemo(() => {
    if (!dashboard.ok) return [];
    let rows = dashboard.peopleRows;
    if (selectedClient) {
      rows = rows.filter((r) => (r.byClient?.get?.(selectedClient) || 0) > 1e-6);
    }
    if (selectedProject) {
      rows = rows.filter((r) => (r.byProject?.get?.(selectedProject) || 0) > 1e-6);
    }
    return rows;
  }, [dashboard, selectedClient, selectedProject]);

  const peopleRowsForLoad = useMemo(() => (dashboard.ok ? dashboard.peopleRows : []), [dashboard]);

  const scopeLabel = scopeMode === "both_toggle" ? "Both" : scopeMode === "filtered" ? "Filtered" : "Department";

  return (
    <div className="deptdash-root" data-theme={theme === "light" ? "light" : "dark"}>
      <AppSideNav />

      <main id="main-content" className="deptdash-main" aria-label="Department dashboard">
        <header className="deptdash-header">
          <div className="deptdash-title-row">
            <Button
              variant="ghost"
              size="md"
              className="deptdash-back"
              onClick={() => navigate("/")}
            >
              <ChevronLeft size={16} strokeWidth={2.2} aria-hidden />
              Back to Schedule
            </Button>

            <div className="deptdash-title-block">
              <motion.h1
                className="deptdash-title"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                Department overview
              </motion.h1>
              <p className="deptdash-subtitle">
                Interactive snapshot of time, capacity, leave, holidays, and client mix.
              </p>
            </div>
          </div>

          <div className="deptdash-controls" role="group" aria-label="Dashboard controls">
            <div className="deptdash-range">
              <span className="deptdash-control-ic" aria-hidden>
                <CalendarRange size={16} strokeWidth={2.1} />
              </span>
              <label className="deptdash-label">
                Start
                <input
                  type="date"
                  value={range.start || ""}
                  onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
                />
              </label>
              <span className="deptdash-range-sep" aria-hidden>
                –
              </span>
              <label className="deptdash-label">
                End
                <input
                  type="date"
                  value={range.end || ""}
                  onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
                />
              </label>
            </div>

            <Button
              variant="secondary"
              size="md"
              className="deptdash-scope"
              onClick={() =>
                setScopeMode((m) => (m === "both_toggle" ? "filtered" : m === "filtered" ? "department" : "both_toggle"))
              }
              title="Toggle scope"
            >
              Scope: {scopeLabel}
            </Button>
          </div>
        </header>

        {dashboard.ok ? (
          <section className="deptdash-shell">
            <div className="deptdash-grid">
              <div className="deptdash-section-head">
                <div className="deptdash-section-title">Overview</div>
                <div className="deptdash-section-meta">
                  {dashboard.kpis.peopleCount} people · {dashboard.rangeStart} → {dashboard.rangeEnd} · Scope: {scopeLabel}
                </div>
              </div>
              <KpiCards
                kpis={dashboard.kpis}
                onPick={(key) => {
                  // KPI click opens ranked breakdown drawer
                  setKpiDrawerKey(key);
                }}
              />

              <div className="deptdash-split">
                <ClientProjectTreemapGrid
                  byClient={dashboard.byClient}
                  byProject={dashboard.byProject}
                  selectedClient={selectedClient}
                  onSelectClient={(c) => {
                    setSelectedClient(c);
                    setSelectedProject(null);
                  }}
                  onSelectProject={(p) => setSelectedProject(p)}
                />
                <PeopleUtilizationStrip
                  peopleRows={peopleRowsForLoad}
                  onPickPerson={(row) => setPickedPerson(row)}
                />
              </div>
            </div>
          </section>
        ) : (
          <section className="deptdash-shell">
            <div className="deptdash-empty">
              <div className="deptdash-empty-card">
                <p className="deptdash-placeholder-eyebrow">Set a valid range</p>
                <h2 className="deptdash-placeholder-title">Pick start + end dates</h2>
                <p className="deptdash-placeholder-copy">
                  The dashboard needs a start and end date (weekdays only) to compute capacity and allocation rollups.
                </p>
              </div>
            </div>
          </section>
        )}

        <PersonDetailDrawer
          open={Boolean(pickedPerson)}
          onOpenChange={(o) => !o && setPickedPerson(null)}
          personRow={pickedPerson}
        />

        <KpiBreakdownDrawer
          open={Boolean(kpiDrawerKey)}
          onOpenChange={(o) => !o && setKpiDrawerKey(null)}
          kpiKey={kpiDrawerKey}
          peopleRows={dashboard.ok ? dashboard.peopleRows : []}
          rangeLabel={dashboard.ok ? `${dashboard.rangeStart} → ${dashboard.rangeEnd}` : ""}
        />
      </main>
    </div>
  );
}

