import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Lock, ArrowRight, Loader2, Mail, CalendarDays, Users, BarChart3, LifeBuoy, HelpCircle } from "lucide-react";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAppDialog } from "../context/AppDialogContext.jsx";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import { SupportSlackModal } from "../components/support/SupportSlackModal.jsx";
import "./LoginPage.css";

const ACCESS_PASSWORD =
  String(import.meta.env.VITE_APP_ACCESS_PASSWORD ?? "").trim() ||
  "Engineering1";

const SESSION_DEFAULT_NAME =
  String(import.meta.env.VITE_SESSION_DISPLAY_NAME ?? "").trim() || "Workspace session";

const SSO_EMAIL_DOMAIN_HINT =
  String(import.meta.env.VITE_SSO_EMAIL_DOMAIN ?? "").trim() || "";

const CAPABILITIES = [
  { icon: CalendarDays, label: "Schedule allocations and capacity by week" },
  { icon: Users, label: "People, roles, and departments in one roster" },
  { icon: BarChart3, label: "Reporting and filters for delivery leads" },
];

export default function LoginPage() {
  const { theme } = useAppTheme();
  const { unlock } = useAuth();
  const { openDialog } = useAppDialog();

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [authExit, setAuthExit] = useState(false);
  const [shake, setShake] = useState(false);
  const [pwdRejected, setPwdRejected] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [pwdPeek, setPwdPeek] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const pwdPeekCloseTRef = useRef(null);

  const cancelPwdPeekClose = useCallback(() => {
    if (pwdPeekCloseTRef.current) {
      window.clearTimeout(pwdPeekCloseTRef.current);
      pwdPeekCloseTRef.current = null;
    }
  }, []);

  const schedulePwdPeekClose = useCallback(() => {
    cancelPwdPeekClose();
    pwdPeekCloseTRef.current = window.setTimeout(() => {
      setPwdPeek(false);
      pwdPeekCloseTRef.current = null;
    }, 160);
  }, [cancelPwdPeekClose]);

  useEffect(() => () => cancelPwdPeekClose(), [cancelPwdPeekClose]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const u = new URL(window.location.href);
    const code = u.searchParams.get("error") || u.searchParams.get("error_code");
    const desc = u.searchParams.get("error_description");
    if (!code && !desc) return;
    const message = [desc, code].filter(Boolean).join(" — ");
    let readable = message.replace(/\+/g, " ");
    try {
      readable = decodeURIComponent(readable);
    } catch {
      /* keep as-is */
    }
    openDialog({
      title: "Deloitte email sign-in could not complete",
      message: readable,
    });
    u.searchParams.delete("error");
    u.searchParams.delete("error_code");
    u.searchParams.delete("error_description");
    window.history.replaceState({}, "", `${u.pathname}${u.search}${u.hash}`);
  }, [openDialog]);

  const submit = useCallback(() => {
    const p = password.trim();
    if (!p) {
      setPwdRejected(false);
      setError("Enter your workspace password.");
      return;
    }
    if (p !== ACCESS_PASSWORD) {
      setError("");
      setPwdRejected(true);
      setShake(false);
      requestAnimationFrame(() => setShake(true));
      openDialog({
        title: "Incorrect password",
        message: "Please contact Sheher. Changes are being done in production.",
      });
      return;
    }
    setError("");
    setPwdRejected(false);
    setAuthExit(true);
    window.setTimeout(() => {
      unlock({ displayName: SESSION_DEFAULT_NAME, userSub: null });
    }, 320);
  }, [password, unlock, openDialog]);

  const startDeloitteEmailSso = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      openDialog({
        title: "Deloitte email SSO isn’t wired up yet",
        message:
          "Add your Supabase URL and anon key, then enable Authentication → Microsoft (Azure AD). Add this site’s URL to redirect allowlists.",
      });
      return;
    }
    setSsoLoading(true);
    try {
      const pathname = window.location.pathname || "/";
      const redirectTo = `${window.location.origin}${pathname}`;
      const queryParams = { prompt: "select_account" };
      if (SSO_EMAIL_DOMAIN_HINT) {
        queryParams.domain_hint = SSO_EMAIL_DOMAIN_HINT;
      }
      const { error: ssoError } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo,
          scopes: "openid profile email",
          queryParams,
        },
      });
      if (ssoError) {
        openDialog({
          title: "Email sign-in couldn’t start",
          message:
            ssoError.message ??
            "Confirm Azure AD and redirect URLs are configured for Deloitte email SSO.",
        });
        setSsoLoading(false);
      }
    } catch (e) {
      openDialog({
        title: "Email sign-in couldn’t start",
        message: e instanceof Error ? e.message : "Unexpected error starting Deloitte email SSO.",
      });
      setSsoLoading(false);
    }
  }, [openDialog]);

  const gateBusy = authExit || ssoLoading;
  const reduceMotion = useReducedMotion();

  const signInArrowTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 1.35, repeat: Infinity, ease: "easeInOut" };

  return (
    <div
      className={`login-page${authExit ? " login-page--auth-exit" : ""}`}
      data-theme={theme === "light" ? "light" : "dark"}
    >
      <SupportSlackModal
        open={supportOpen}
        onOpenChange={setSupportOpen}
        variant="login"
        slackUrl="https://app.slack.com/client/T02879QRU/C0B68PYE3EZ"
        title="Contact Alloc8 Support"
        subtitle="Having trouble signing in? Open Slack support and drop a message — include a screenshot if you can."
      />
      <div className="login-page-bg" aria-hidden />

      <header className="login-page-header">
        <div className="login-page-header-brand">
          {!logoFailed ? (
            <img
              src="/branding/deloitte-logo.png"
              alt="Deloitte"
              className="login-page-deloitte-logo"
              width={168}
              height={32}
              decoding="async"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <span className="login-page-deloitte-wordmark" aria-label="Deloitte">
              Deloitte<span className="login-page-deloitte-dot">.</span>
            </span>
          )}
        </div>
        <span className="login-page-header-divider" aria-hidden />
        <span className="login-page-header-product">
          Alloc<span className="login-page-eight">8</span>
        </span>
        <div className="login-page-header-status" aria-label="System status">
          <span className="login-page-status-dot" aria-hidden />
          <span className="login-page-status-text">Secure session</span>
        </div>
      </header>

      <main id="main-content" className="login-page-main">
        <section className="login-page-intro" aria-label="About Alloc8">
          <p className="login-page-eyebrow">Workforce scheduling</p>
          <h1 className="login-page-title">Plan capacity with clarity.</h1>
          <p className="login-page-lead">
            Internal resource planning for portfolio delivery teams — allocations, people,
            and projects in a single audited workspace.
          </p>
          <ul className="login-page-capabilities">
            {CAPABILITIES.map(({ icon: Icon, label }) => (
              <li key={label}>
                <Icon size={18} strokeWidth={1.75} aria-hidden />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="login-page-panel" aria-label="Sign in">
          <div className="login-page-card">
            <p className="login-page-card-eyebrow">Authorized access</p>
            <h2 className="login-page-card-title">Sign in</h2>
            <p className="login-page-card-sub">
              Use your Deloitte work email. Workspace password is available as a fallback.
            </p>

            <div className="login-page-sso-block">
              {!gateBusy && (
                <motion.p
                  className="login-page-sso-hint"
                  aria-hidden
                  initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduceMotion ? 0 : 0.35, duration: 0.4 }}
                >
                  <motion.span
                    className="login-page-sso-hint-arrow"
                    animate={reduceMotion ? undefined : { y: [0, 5, 0] }}
                    transition={signInArrowTransition}
                  >
                    <ArrowRight size={14} strokeWidth={2.4} />
                  </motion.span>
                  <span>Tap to continue</span>
                </motion.p>
              )}

              <button
                type="button"
                className="login-page-sso-btn"
                onClick={() => void startDeloitteEmailSso()}
                disabled={gateBusy}
                aria-label="Continue with Deloitte work email"
              >
                {ssoLoading ? (
                  <Loader2 className="login-page-sso-spinner" size={20} strokeWidth={2.2} aria-hidden />
                ) : (
                  <Mail size={20} strokeWidth={2} aria-hidden />
                )}
                <span className="login-page-sso-btn-text">
                  <span className="login-page-sso-btn-title">
                    {ssoLoading ? "Opening sign-in…" : "Continue with Deloitte email"}
                  </span>
                </span>
                {!ssoLoading && (
                  <motion.span
                    className="login-page-sso-btn-nudge"
                    aria-hidden
                    animate={reduceMotion ? undefined : { x: [0, 5, 0] }}
                    transition={signInArrowTransition}
                  >
                    <ArrowRight size={18} strokeWidth={2.35} />
                  </motion.span>
                )}
              </button>
            </div>

            <div className="login-page-divider" role="separator" aria-label="Alternative sign-in">
              <span>Password</span>
            </div>

            <div
              className="login-page-pwd-peek login-page-pwd-peek--icon-only"
              onMouseEnter={() => {
                cancelPwdPeekClose();
                setPwdPeek(true);
              }}
              onMouseLeave={() => schedulePwdPeekClose()}
              onFocusCapture={() => {
                cancelPwdPeekClose();
                setPwdPeek(true);
              }}
              onBlurCapture={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) schedulePwdPeekClose();
              }}
            >
              <button
                type="button"
                className="login-page-pwd-peek-btn"
                aria-label="Show password sign-in"
                onClick={() => setPwdPeek((v) => !v)}
              >
                <HelpCircle size={18} strokeWidth={2.1} aria-hidden />
              </button>
            </div>

            <AnimatePresence initial={false}>
              {pwdPeek ? (
                <motion.form
                  key="pwd"
                  className="login-page-form login-page-form--peek"
                  initial={{ opacity: 0, height: 0, y: -6 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -6 }}
                  transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                  onMouseEnter={() => cancelPwdPeekClose()}
                  onMouseLeave={() => schedulePwdPeekClose()}
                  onFocusCapture={() => cancelPwdPeekClose()}
                  onBlurCapture={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) schedulePwdPeekClose();
                  }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (authExit || ssoLoading) return;
                    submit();
                  }}
                >
                  <label className="login-page-label" htmlFor="login-workspace-password">
                    Workspace password
                  </label>
                  <div className="login-page-field">
                    <Lock className="login-page-field-icon" size={18} strokeWidth={2} aria-hidden />
                    <input
                      id="login-workspace-password"
                      type="password"
                      className={`login-page-input${shake && pwdRejected ? " login-page-input--error" : ""}`}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                        setPwdRejected(false);
                        setShake(false);
                      }}
                      onAnimationEnd={() => setShake(false)}
                      autoComplete="current-password"
                      disabled={gateBusy}
                      autoFocus
                    />
                  </div>

                  <AnimatePresence mode="wait">
                    {error ? (
                      <motion.p
                        key="err"
                        className="login-page-error"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        {error}
                      </motion.p>
                    ) : null}
                  </AnimatePresence>

                  <button type="submit" className="login-page-submit" disabled={gateBusy}>
                    Continue
                    <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
                  </button>
                </motion.form>
              ) : null}
            </AnimatePresence>
          </div>
        </section>
      </main>

      <footer className="login-page-footer">
        <span>Alloc8 · Engineering as a Service</span>
        <span className="login-page-footer-muted">
          {isSupabaseConfigured ? "SSO enabled" : "SSO not configured"}
        </span>
      </footer>

      <button
        type="button"
        className="login-page-help-fab"
        aria-label="Help with sign-in"
        title="Having login issues? Contact support"
        onClick={() => setSupportOpen(true)}
      >
        <LifeBuoy size={18} strokeWidth={2.15} aria-hidden />
      </button>
    </div>
  );
}
