import { NavLink } from "react-router-dom";
import {
  CalendarDays,
  ClipboardList,
  Users,
  FolderOpen,
  BarChart3,
  Sun,
  Moon,
} from "lucide-react";
import { motion } from "framer-motion";
import "./AppSideNav.css";

const NAV = [
  { to: "/", end: true, icon: CalendarDays, label: "Schedule" },
  { to: null, icon: ClipboardList, label: "Project plan", soon: true },
  { to: "/people", icon: Users, label: "People" },
  { to: "/projects", icon: FolderOpen, label: "Projects" },
  { to: null, icon: BarChart3, label: "Report", soon: true },
];

export default function AppSideNav({ theme, onToggleTheme }) {
  const isDark = theme === "dark";

  return (
    <aside className="app-sidenav" aria-label="Primary navigation">
      <motion.div
        className="app-sidenav-brand"
        initial={false}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <NavLink to="/" end className="app-sidenav-logo" title="Home">
          R1
        </NavLink>
      </motion.div>

      <nav className="app-sidenav-links">
        {NAV.map((item) => {
          const Icon = item.icon;
          if (item.to) {
            return (
              <NavLink
                key={item.label}
                to={item.to}
                end={!!item.end}
                className={({ isActive }) =>
                  "app-sidenav-item" + (isActive ? " app-sidenav-item--active" : "")
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive ? (
                      <motion.span
                        layoutId="sidenav-pip"
                        className="app-sidenav-pip"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    ) : null}
                    <Icon size={19} strokeWidth={isActive ? 2.2 : 1.85} aria-hidden />
                    <span className="app-sidenav-label">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          }
          return (
            <span
              key={item.label}
              className="app-sidenav-item app-sidenav-item--disabled"
              title="Coming soon"
            >
              <Icon size={19} strokeWidth={1.75} aria-hidden />
              <span className="app-sidenav-label">{item.label}</span>
            </span>
          );
        })}
      </nav>

      <div className="app-sidenav-spacer" />

      <motion.button
        type="button"
        className="app-sidenav-theme"
        title={isDark ? "Light mode" : "Dark mode"}
        onClick={onToggleTheme}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
      >
        {isDark ? <Sun size={16} strokeWidth={2} aria-hidden /> : <Moon size={16} strokeWidth={2} aria-hidden />}
      </motion.button>
    </aside>
  );
}
