import { Navigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import AppSideNav from "../components/navigation/AppSideNav.jsx";
import { WorkspaceAccessManager } from "../components/settings/WorkspaceAccessManager.jsx";
import "./AccessPage.css";

export default function AccessPage() {
  const { theme } = useAppTheme();
  const { isWorkspaceAdmin, workspaceEmail, sessionDisplayName } = useAuth();
  const reduceMotion = useReducedMotion();

  if (!isWorkspaceAdmin) {
    return <Navigate to="/settings" replace />;
  }

  const signedInAs = workspaceEmail || sessionDisplayName || "Workspace admin";

  return (
    <div className="access-page" data-theme={theme === "light" ? "light" : "dark"}>
      <AppSideNav />

      <div className="access-page-body">
        <main id="main-content" className="access-page-main">
          <motion.header
            className="access-page-header"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <div>
              <p className="access-page-eyebrow">Workspace</p>
              <h1 className="access-page-title">Access control</h1>
              <p className="access-page-lede">
                Manage who can sign in with Deloitte SSO. Updates apply on the next login.
              </p>
            </div>
            <div className="access-page-session" title={signedInAs}>
              <span className="access-page-session-label">Signed in</span>
              <span className="access-page-session-value">{signedInAs}</span>
            </div>
          </motion.header>

          <WorkspaceAccessManager isWorkspaceAdmin={isWorkspaceAdmin} layout="page" />
        </main>
      </div>
    </div>
  );
}
