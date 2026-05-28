import { useCallback, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, LifeBuoy, ShieldAlert, Mail } from "lucide-react";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { SupportSlackModal } from "../components/support/SupportSlackModal.jsx";
import "./AccessDeniedPage.css";

const REASON_COPY = {
  "not-allowlisted": {
    title: "Access not granted",
    lead: "Your Deloitte email isn’t on the workspace allowlist yet.",
    detail: "Ask a Workspace Admin to add you under Settings → Access, then try signing in again.",
  },
  disabled: {
    title: "Access turned off",
    lead: "Your access to this workspace has been disabled.",
    detail: "Contact a Workspace Admin if you believe this is a mistake.",
  },
  "missing-email": {
    title: "Sign-in incomplete",
    lead: "We couldn’t read an email address from your Deloitte account.",
    detail: "Try signing in again with your work email, or contact support.",
  },
  "query-failed": {
    title: "Couldn’t verify access",
    lead: "We couldn’t confirm your workspace access right now.",
    detail: "Check your connection and try again in a moment.",
  },
};

function copyForReason(reason) {
  return REASON_COPY[reason] ?? REASON_COPY["query-failed"];
}

export default function AccessDeniedPage() {
  const { theme } = useAppTheme();
  const { accessDenied, clearAccessDenied } = useAuth();
  const reduceMotion = useReducedMotion();
  const [supportOpen, setSupportOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const reason = accessDenied?.reason ?? "query-failed";
  const email = accessDenied?.email ?? "";
  const copy = copyForReason(reason);

  const onGoBack = useCallback(() => {
    clearAccessDenied();
  }, [clearAccessDenied]);

  return (
    <div className="access-denied-page" data-theme={theme === "light" ? "light" : "dark"}>
      <SupportSlackModal
        open={supportOpen}
        onOpenChange={setSupportOpen}
        variant="login"
        slackUrl="https://app.slack.com/client/T02879QRU/C0B68PYE3EZ"
        title="Contact Alloc8 Support"
        subtitle="Need help with workspace access? Open Slack support and include your Deloitte email."
      />
      <div className="access-denied-bg" aria-hidden />

      <header className="access-denied-header">
        <div className="access-denied-header-brand">
          {!logoFailed ? (
            <img
              src="/branding/deloitte-logo.png"
              alt="Deloitte"
              className="access-denied-deloitte-logo"
              width={168}
              height={32}
              decoding="async"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <span className="access-denied-deloitte-wordmark" aria-label="Deloitte">
              Deloitte<span className="access-denied-deloitte-dot">.</span>
            </span>
          )}
        </div>
        <span className="access-denied-header-divider" aria-hidden />
        <span className="access-denied-header-product">
          Alloc<span className="access-denied-eight">8</span>
        </span>
      </header>

      <main id="main-content" className="access-denied-main">
        <motion.section
          className="access-denied-card"
          initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          aria-labelledby="access-denied-title"
        >
          <div className="access-denied-icon-wrap" aria-hidden>
            <ShieldAlert size={34} strokeWidth={1.75} />
          </div>

          <p className="access-denied-eyebrow">Workspace access</p>
          <h1 id="access-denied-title" className="access-denied-title">
            {copy.title}
          </h1>
          <p className="access-denied-lead">{copy.lead}</p>
          <p className="access-denied-detail">{copy.detail}</p>

          {email ? (
            <div className="access-denied-email-chip">
              <Mail size={16} strokeWidth={2} aria-hidden />
              <span>{email}</span>
            </div>
          ) : null}

          <div className="access-denied-actions">
            <button type="button" className="access-denied-primary" onClick={onGoBack}>
              <ArrowLeft size={18} strokeWidth={2.25} aria-hidden />
              Go back to sign in
            </button>
            <button
              type="button"
              className="access-denied-secondary"
              onClick={() => setSupportOpen(true)}
            >
              <LifeBuoy size={17} strokeWidth={2.1} aria-hidden />
              Contact support
            </button>
          </div>
        </motion.section>
      </main>

      <footer className="access-denied-footer">
        <span>Alloc8 · Engineering as a Service</span>
        <span className="access-denied-footer-muted">Authorized Deloitte users only</span>
      </footer>
    </div>
  );
}
