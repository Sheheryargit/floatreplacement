import { useState, useCallback, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ClipboardList,
  Users,
  FolderOpen,
  BarChart3,
  Settings,
  HelpCircle,
  Bell,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAppDialog } from "../../context/AppDialogContext.jsx";
import { useSlapAnimation } from "../../context/SlapAnimationContext.jsx";
import { useAppTheme } from "../../context/ThemeContext.jsx";
import "./AppSideNav.css";

const COLLAPSE_KEY = "alloc8-sidenav-collapsed";

const NAV = [
  { to: "/", end: true, icon: CalendarDays, label: "Schedule" },
  { to: null, icon: ClipboardList, label: "Project plan", soon: true },
  { to: "/people", icon: Users, label: "People" },
  { to: "/projects", icon: FolderOpen, label: "Projects" },
  { to: null, icon: BarChart3, label: "Report", soon: true },
];

const V2_MODAL = {
  title: "Not available yet",
  message:
    "This feature ships in a future release.\nContact Sheher on Slack if needed.",
};

export default function AppSideNav() {
  const navigate = useNavigate();
  const { openDialog } = useAppDialog();
  const { triggerSlap } = useSlapAnimation();
  const { theme } = useAppTheme();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => !c);
  }, []);

  const slapThenDialog = (opts) => {
    void (async () => {
      await triggerSlap();
      openDialog(opts);
    })();
  };

  const onSoon = () => slapThenDialog(V2_MODAL);

  const onHelp = () =>
    slapThenDialog({
      title: "Need help?",
      message: "Contact Sheher on Slack.",
    });

  const onNotifications = () =>
    slapThenDialog({
      title: "Notifications",
      message: "Notifications are planned for a future release.",
    });

  return (
    <aside
      className={
        "app-sidenav" +
        (collapsed ? " app-sidenav--collapsed" : " app-sidenav--expanded")
      }
      data-theme={theme === "light" ? "light" : "dark"}
      aria-label="Primary navigation"
    >
      <div className="app-sidenav-noise" aria-hidden />

      <div className="app-sidenav-head">
        <motion.div
          className="app-sidenav-brand-wrap"
          initial={false}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 26 }}
        >
          <NavLink to="/" end className="app-sidenav-logo-link" title="Alloc8 — home">
            {collapsed ? (
              <span className="app-sidenav-glyph" aria-hidden>
                8
              </span>
            ) : (
              <span className="alloc8-wordmark-nav" aria-label="Alloc8">
                Alloc
                <span className="alloc8-wordmark-nav-eight">8</span>
              </span>
            )}
          </NavLink>
        </motion.div>
        <button
          type="button"
          className="app-sidenav-collapse"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? (
            <ChevronRight size={18} strokeWidth={2} aria-hidden />
          ) : (
            <ChevronLeft size={18} strokeWidth={2} aria-hidden />
          )}
        </button>
      </div>

      <nav className="app-sidenav-links">
        {NAV.map((item) => {
          const Icon = item.icon;
          if (item.soon) {
            return (
              <motion.button
                key={item.label}
                type="button"
                className="app-sidenav-item app-sidenav-item--soon"
                title="Coming in a future release — tap for details"
                onClick={onSoon}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
              >
                <Icon size={19} strokeWidth={1.85} aria-hidden />
                <span className="app-sidenav-label">{item.label}</span>
              </motion.button>
            );
          }
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
                  <Icon size={19} strokeWidth={isActive ? 2.15 : 1.85} aria-hidden />
                  <span className="app-sidenav-label">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="app-sidenav-spacer" />

      <div className="app-sidenav-footer" role="group" aria-label="Account and help">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            "app-sidenav-foot-btn" + (isActive ? " app-sidenav-foot-btn--active" : "")
          }
          title="Settings"
        >
          <Settings size={18} strokeWidth={1.9} aria-hidden />
          {!collapsed && <span className="app-sidenav-foot-label">Settings</span>}
        </NavLink>
        <motion.button
          type="button"
          className="app-sidenav-foot-btn"
          title="Help"
          onClick={onHelp}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
        >
          <HelpCircle size={18} strokeWidth={1.9} aria-hidden />
          {!collapsed && <span className="app-sidenav-foot-label">Help</span>}
        </motion.button>
        <motion.button
          type="button"
          className="app-sidenav-foot-btn app-sidenav-foot-btn--muted"
          title="Notifications — coming later"
          onClick={onNotifications}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
        >
          <Bell size={18} strokeWidth={1.9} aria-hidden />
          {!collapsed && <span className="app-sidenav-foot-label">Alerts</span>}
        </motion.button>
        <motion.button
          type="button"
          className="app-sidenav-avatar"
          title="Profile"
          onClick={() => navigate("/settings#profile")}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
        >
          <span className="app-sidenav-avatar-letter" aria-hidden>
            S
          </span>
          <span className="app-sidenav-avatar-dot" aria-hidden />
          <span className="visually-hidden">Open profile</span>
        </motion.button>
      </div>
    </aside>
  );
}
