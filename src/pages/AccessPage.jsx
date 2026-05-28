import { Navigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { KeyRound, ShieldCheck, Users, UserCog } from "lucide-react";
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
            className="access-page-hero"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="access-page-hero-icon" aria-hidden>
              <KeyRound size={22} strokeWidth={2} />
            </div>
            <div className="access-page-hero-text">
              <p className="access-page-eyebrow">Workspace admin</p>
              <h1 className="access-page-title">Access</h1>
              <p className="access-page-lede">
                Control who can sign in with Deloitte SSO. Changes apply on the next sign-in attempt.
              </p>
              <p className="access-page-signed-in">
                Signed in as <strong>{signedInAs}</strong>
              </p>
            </div>
          </motion.header>

          <div className="access-page-stats" aria-label="Access summary">
            <div className="access-page-stat">
              <Users size={18} strokeWidth={2} aria-hidden />
              <span className="access-page-stat-label">Allowlisted</span>
              <span className="access-page-stat-hint">Deloitte emails on the list</span>
            </div>
            <div className="access-page-stat">
              <ShieldCheck size={18} strokeWidth={2} aria-hidden />
              <span className="access-page-stat-label">Enforced at SSO</span>
              <span className="access-page-stat-hint">No access = blocked at login</span>
            </div>
            <div className="access-page-stat">
              <UserCog size={18} strokeWidth={2} aria-hidden />
              <span className="access-page-stat-label">Admins</span>
              <span className="access-page-stat-hint">Can manage this page</span>
            </div>
          </div>

          <section className="access-page-panel" aria-labelledby="access-page-panel-title">
            <h2 id="access-page-panel-title" className="visually-hidden">
              Manage workspace access
            </h2>
            <WorkspaceAccessManager isWorkspaceAdmin={isWorkspaceAdmin} layout="page" />
          </section>
        </main>
      </div>
    </div>
  );
}
