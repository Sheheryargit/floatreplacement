import { useMemo, useState } from "react";
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
} from "lucide-react";
import "./LandingPage.css";

const weekLabels = [
  "14 Mar – Apr",
  "15 Apr",
  "18 Apr – May",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
];

const dayNums = [30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

const people = [
  {
    initials: "AB",
    name: "Aditi Bali",
    sub: "Fire Nation",
    tag: "Firenation",
    hours: "16h",
    grad: "linear-gradient(135deg,#667eea,#764ba2)",
  },
  {
    initials: "AP",
    name: "Akhil Prasad",
    sub: "Graduate · Eaas",
    tag: "Cloud Secure",
    hours: "134.5h",
    grad: "linear-gradient(135deg,#4facfe,#00f2fe)",
  },
];

export default function LandingPage() {
  const [theme, setTheme] = useState("dark");

  const muted = useMemo(() => (theme === "dark" ? "#636d84" : "#858da3"), [theme]);

  return (
    <div className="lp-root" data-theme={theme === "light" ? "light" : "dark"}>
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
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
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
                <button type="button" aria-label="Previous">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" className="lp-today">
                  Today
                </button>
                <button type="button" aria-label="Next">
                  <ChevronRight size={16} />
                </button>
              </div>
              <span className="lp-pill">
                <Calendar size={14} />
                Months
                <ChevronDown size={14} />
              </span>
              <button type="button" className="lp-icon-btn" aria-label="View settings">
                <SlidersHorizontal size={18} />
              </button>
              <button type="button" className="lp-icon-btn" aria-label="Share">
                <Share size={18} />
              </button>
              <button type="button" className="lp-btn-primary" aria-label="Add">
                <Plus size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="lp-subbar">
            <div className="lp-subbar-left">
              <button type="button" className="lp-icon-btn" aria-label="Add person">
                <UserPlus size={18} />
              </button>
              <span className="lp-pill">
                This month
                <ChevronDown size={14} />
              </span>
              <span className="lp-hours-total">4,040.14h</span>
            </div>
          </div>
        </div>

        <div className="lp-schedule">
          <div className="lp-people-col">
            {people.map((p) => (
              <div key={p.name} className="lp-person-row">
                <div className="lp-avatar" style={{ background: p.grad }}>
                  {p.initials}
                </div>
                <div className="lp-person-meta">
                  <div className="lp-person-name">{p.name}</div>
                  <div className="lp-person-sub">{p.sub}</div>
                  <span className="lp-tag">{p.tag}</span>
                </div>
                <div className="lp-person-hours">{p.hours}</div>
              </div>
            ))}
          </div>

          <div className="lp-grid-wrap">
            <div className="lp-cal-head">
              <div className="lp-weeks">
                {weekLabels.map((w) => (
                  <div key={w} className="lp-week-cell">
                    {w}
                  </div>
                ))}
              </div>
              <div className="lp-days">
                {dayNums.map((d, i) => (
                  <div key={`day-${i}-${d}`} className="lp-day-cell">
                    {d}
                  </div>
                ))}
              </div>
            </div>
            <div className="lp-rows">
              {people.map((p) => (
                <div key={p.name} className="lp-grid-row">
                  <div className="lp-hatch">Annual Leave</div>
                  <div className="lp-block lp-block-orange">
                    ASF Managed Servi
                    <br />
                    ASF · 2h
                  </div>
                  <div className="lp-block lp-block-pink">
                    Cloud Managed Ser
                    <br />
                    ARTC · 1.5h
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button type="button" className="lp-fab" aria-label="Pointer tool">
        <MousePointer2 size={16} />
      </button>
    </div>
  );
}
