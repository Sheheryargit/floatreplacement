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
  User,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAppDialog } from "../../context/AppDialogContext.jsx";
import { useSlapAnimation } from "../../context/SlapAnimationContext.jsx";
import "./AppSideNav.css";

const NAV = [
  { to: "/", end: true, icon: CalendarDays, label: "Schedule" },
  { to: null, icon: ClipboardList, label: "Project plan", soon: true },
  { to: "/people", icon: Users, label: "People" },
  { to: "/projects", icon: FolderOpen, label: "Projects" },
  { to: null, icon: BarChart3, label: "Report", soon: true },
];

const V2_MODAL = {
  title: "🚧 Not ready yet",
  message:
    "This feature is part of Version 2 release.\nContact Sheher on Slack if needed.",
};

export default function AppSideNav() {
  const navigate = useNavigate();
  const { openDialog } = useAppDialog();
  const { triggerSlap } = useSlapAnimation();

  const slapThenDialog = (opts) => {
    void (async () => {
      await triggerSlap();
      openDialog(opts);
    })();
  };

  const onSoon = () => slapThenDialog(V2_MODAL);

  const onHelp = () =>
    slapThenDialog({
      title: "😂 Need help?",
      message: "Contact Sheher on Slack.",
    });

  const onNotifications = () =>
    slapThenDialog({
      title: "🚧 Notifications are part of Version 2.",
      message: "Contact Sheher on Slack.",
    });

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
          if (item.soon) {
            return (
              <motion.button
                key={item.label}
                type="button"
                className="app-sidenav-item app-sidenav-item--soon"
                title="Version 2 — tap for details"
                onClick={onSoon}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
              >
                <Icon size={19} strokeWidth={1.75} aria-hidden />
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
                  <Icon size={19} strokeWidth={isActive ? 2.2 : 1.85} aria-hidden />
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
        </NavLink>
        <motion.button
          type="button"
          className="app-sidenav-foot-btn"
          title="Need help?"
          onClick={onHelp}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
        >
          <HelpCircle size={18} strokeWidth={1.9} aria-hidden />
        </motion.button>
        <motion.button
          type="button"
          className="app-sidenav-foot-btn app-sidenav-foot-btn--muted"
          title="Notifications — Version 2"
          onClick={onNotifications}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
        >
          <Bell size={18} strokeWidth={1.9} aria-hidden />
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
          <span className="visually-hidden">Open profile</span>
        </motion.button>
      </div>
    </aside>
  );
}
