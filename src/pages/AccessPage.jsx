import { Navigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Shield } from "lucide-react";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import AppSideNav from "../components/navigation/AppSideNav.jsx";
import { WorkspaceAccessManager } from "../components/settings/WorkspaceAccessManager.jsx";
import "./AccessPage.css";

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
};

export default function AccessPage() {
  const { theme } = useAppTheme();
  const { isWorkspaceAdmin, workspaceEmail, sessionDisplayName } = useAuth();
  const reduceMotion = useReducedMotion();

  if (!isWorkspaceAdmin) {
    return <Navigate to="/settings" replace />;
  }

  const signedInAs = workspaceEmail || sessionDisplayName || "Workspace admin";
  const motionProps = reduceMotion ? {} : { variants: stagger, initial: "hidden", animate: "show" };

  return (
    <div className="access-page" data-theme={theme === "light" ? "light" : "dark"}>
      <div className="access-page-ambient" aria-hidden />
      <AppSideNav />

      <div className="access-page-body">
        <motion.main
          id="main-content"
          className="access-page-main"
          {...motionProps}
        >
          <motion.header className="access-page-header" variants={reduceMotion ? undefined : fadeUp}>
            <div className="access-page-header-main">
              <div className="access-page-icon" aria-hidden>
                <Shield size={20} strokeWidth={2} />
              </div>
              <div>
                <p className="access-page-eyebrow">Workspace security</p>
                <h1 className="access-page-title">Access control</h1>
                <p className="access-page-lede">
                  Manage Deloitte SSO allowlist. Changes apply on the next sign-in.
                </p>
              </div>
            </div>
            <div className="access-page-session" title={signedInAs}>
              <span className="access-page-session-dot" aria-hidden />
              <div>
                <span className="access-page-session-label">Signed in</span>
                <span className="access-page-session-value">{signedInAs}</span>
              </div>
            </div>
          </motion.header>

          <motion.div variants={reduceMotion ? undefined : fadeUp}>
            <WorkspaceAccessManager isWorkspaceAdmin={isWorkspaceAdmin} layout="page" />
          </motion.div>
        </motion.main>
      </div>
    </div>
  );
}
