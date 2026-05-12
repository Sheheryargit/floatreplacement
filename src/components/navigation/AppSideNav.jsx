import { useState, useCallback, useEffect, memo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Users,
  FolderOpen,
  BarChart3,
  Settings,
  HelpCircle,
  Bell,
  ChevronLeft,
  ChevronRight,
  Shield,
  // DEV: Testing RBAC - Remove after testing
  LogIn,
  // DEV: End
} from "lucide-react";
import { motion } from "framer-motion";
import { useAppDialog } from "../../context/AppDialogContext.jsx";
import { useSlapAnimation } from "../../context/SlapAnimationContext.jsx";
import { useAppTheme } from "../../context/ThemeContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { can } from "../../constants/permissions.js";
// DEV: Testing RBAC - Remove after testing
import { DevLoginSelector } from "../DevLoginSelector.jsx";
// DEV: End
import "./AppSideNav.css";

const COLLAPSE_KEY = "alloc8-sidenav-collapsed";

const NAV = [
  { to: "/", end: true, icon: CalendarDays, label: "Schedule" },
  { to: "/people", icon: Users, label: "People", requiresPermission: { page: "peoplePage", action: "viewPeoplePage" }},
  { to: "/projects", icon: FolderOpen, label: "Projects", requiresPermission: { page: "projectsPage", action: "viewProjectsPage" }},
  { to: "/report", icon: BarChart3, label: "Report", requiresPermission: { page: "reporting", action: "viewReportingPage" } },
];

const V2_MODAL = {
  title: "Not available yet",
  message:
    "This feature ships in a future release.\nContact Sheher on Slack if needed.",
};

function AppSideNav() {
  const navigate = useNavigate();
  const { openDialog } = useAppDialog();
  const { triggerSlap } = useSlapAnimation();
  const { theme } = useAppTheme();
  const { currentUser } = useAuth();
  const [, setRoleToggle] = useState(0); // Force re-render on role change

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  // Filter nav items based on permissions
  const visibleNav = NAV.filter(
    (item) => !item.requiresPermission || can((currentUser?.access || "").toLowerCase(), item.requiresPermission.page, item.requiresPermission.action)
  );

  const isDevMode = import.meta.env.VITE_LOGIN_SKIP_AUTH === "true";
  const ROLE_CYCLE = ["Member", "Manager", "Admin"];
  // DEV: Testing RBAC - Remove after testing
  const [loginSelectorOpen, setLoginSelectorOpen] = useState(false);

  const handleSelectPerson = useCallback((person) => {
    const updated = { ...person };
    try {
      localStorage.setItem("float_current_user", JSON.stringify(updated));
    } catch {
      /* ignore */
    }
    setLoginSelectorOpen(false);
    setRoleToggle((t) => t + 1);
    window.location.reload();
  }, []);
  // DEV: End

  const cycleRole = useCallback(() => {
    const currentRole = currentUser?.access || "Member";
    const currentIndex = ROLE_CYCLE.indexOf(currentRole);
    const nextIndex = (currentIndex + 1) % ROLE_CYCLE.length;
    const nextRole = ROLE_CYCLE[nextIndex];

    const updated = { ...currentUser, access: nextRole };
    try {
      localStorage.setItem("float_current_user", JSON.stringify(updated));
    } catch {
      /* ignore */
    }
    setRoleToggle((t) => t + 1);
    window.location.reload();
  }, [currentUser]);

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
        {visibleNav.map((item) => {
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
        {isDevMode && (
          <>
            {/* DEV: Testing RBAC - Remove after testing */}
            <motion.button
              type="button"
              className="app-sidenav-foot-btn"
              title="Switch to a different person from Supabase"
              onClick={() => setLoginSelectorOpen(true)}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
            >
              <LogIn size={18} strokeWidth={1.9} aria-hidden />
              {!collapsed && (
                <span className="app-sidenav-foot-label" style={{ fontSize: "11px", fontWeight: 600 }}>
                  Login As
                </span>
              )}
            </motion.button>
            {/* DEV: End */}
            <motion.button
              type="button"
              className="app-sidenav-foot-btn"
              title={`Current role: ${currentUser?.access || "Member"} — click to cycle`}
              onClick={cycleRole}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
            >
              <Shield size={18} strokeWidth={1.9} aria-hidden />
              {!collapsed && (
                <span className="app-sidenav-foot-label" style={{ fontSize: "11px", fontWeight: 600 }}>
                  {currentUser?.access || "Member"}
                </span>
              )}
            </motion.button>
          </>
        )}
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

      {/* DEV: Testing RBAC - Remove after testing */}
      {isDevMode && <DevLoginSelector isOpen={loginSelectorOpen} onSelectPerson={handleSelectPerson} />}
      {/* DEV: End */}
    </aside>
  );
}

export default memo(AppSideNav);
