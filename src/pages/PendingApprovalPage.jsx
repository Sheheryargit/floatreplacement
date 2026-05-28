import { useAuth } from "../context/AuthContext.jsx";
import { useAppTheme } from "../context/ThemeContext.jsx";
import "./PendingApprovalPage.css";

export default function PendingApprovalPage() {
  const { lock, sessionDisplayName, rbacProfile } = useAuth();
  const { theme } = useAppTheme();

  return (
    <div className="pending-approval-page" data-theme={theme === "light" ? "light" : "dark"}>
      <div className="pending-approval-card">
        <div className="pending-approval-icon" aria-hidden>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" opacity="0.3" />
            <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="2" opacity="0.5" />
            <circle cx="24" cy="24" r="4" fill="currentColor" opacity="0.7" />
          </svg>
        </div>
        <h1 className="pending-approval-title">Access pending</h1>
        <p className="pending-approval-message">
          You&apos;ve signed in as <strong>{rbacProfile?.email || sessionDisplayName || "unknown"}</strong>, but your
          account hasn&apos;t been approved yet.
        </p>
        <p className="pending-approval-sub">
          Ask your workspace admin to approve your access. Once approved, refresh this page.
        </p>
        <div className="pending-approval-actions">
          <button
            type="button"
            className="pending-approval-btn pending-approval-btn--refresh"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
          <button
            type="button"
            className="pending-approval-btn pending-approval-btn--signout"
            onClick={lock}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
