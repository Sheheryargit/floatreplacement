import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Lock,
  ArrowRight,
  Loader2,
  Mail,
  Sparkles,
  LifeBuoy,
} from "lucide-react";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAppDialog } from "../context/AppDialogContext.jsx";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import { SupportSlackModal } from "../components/support/SupportSlackModal.jsx";
import "./LoginPage.css";

const ACCESS_PASSWORD =
  String(import.meta.env.VITE_APP_ACCESS_PASSWORD ?? "").trim() ||
  "EaaS1807";

const SESSION_DEFAULT_NAME =
  String(import.meta.env.VITE_SESSION_DISPLAY_NAME ?? "").trim() || "Workspace session";

const SSO_EMAIL_DOMAIN_HINT =
  String(import.meta.env.VITE_SSO_EMAIL_DOMAIN ?? "").trim() || "";

const PROMPT_CHIPS = [
  "Who’s free next Tuesday?",
  "Move Jordan onto Project Atlas",
  "Show capacity for Design this week",
];

const CONTACT_SHEHER = "Contact Sheher on Slack 🙂";
const SLACK_SUPPORT_URL = "https://app.slack.com/client/T02879QRU/C0B68PYE3EZ";

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
  const [supportOpen, setSupportOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);

  const showContactSheher = useCallback(() => {
    setError(CONTACT_SHEHER);
    openDialog({
      title: "Sign-in didn’t work",
      message: CONTACT_SHEHER,
    });
    setSupportOpen(true);
  }, [openDialog]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const u = new URL(window.location.href);
    const code = u.searchParams.get("error") || u.searchParams.get("error_code");
    const desc = u.searchParams.get("error_description");
    if (!code && !desc) return;
    showContactSheher();
    u.searchParams.delete("error");
    u.searchParams.delete("error_code");
    u.searchParams.delete("error_description");
    window.history.replaceState({}, "", `${u.pathname}${u.search}${u.hash}`);
  }, [showContactSheher]);

  const submit = useCallback(() => {
    const p = password.trim();
    if (!p) {
      setPwdRejected(false);
      setError("Enter password.");
      return;
    }
    if (p !== ACCESS_PASSWORD) {
      setPwdRejected(true);
      setShake(false);
      requestAnimationFrame(() => setShake(true));
      showContactSheher();
      return;
    }
    setError("");
    setPwdRejected(false);
    setAuthExit(true);
    window.setTimeout(() => {
      unlock({ displayName: SESSION_DEFAULT_NAME, userSub: null });
    }, 320);
  }, [password, unlock, showContactSheher]);

  const startSamlSso = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      showContactSheher();
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
        showContactSheher();
        setSsoLoading(false);
      }
    } catch {
      showContactSheher();
      setSsoLoading(false);
    }
  }, [showContactSheher]);

  const gateBusy = authExit || ssoLoading;
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={`login-page${authExit ? " login-page--auth-exit" : ""}`}
      data-theme={theme === "light" ? "light" : "dark"}
    >
      <SupportSlackModal
        open={supportOpen}
        onOpenChange={setSupportOpen}
        variant="login"
        slackUrl={SLACK_SUPPORT_URL}
        title="Contact Sheher on Slack 🙂"
        subtitle="Sign-in issue? Drop Sheher a message on Slack — a screenshot helps."
      />

      <div className="login-page-bg" aria-hidden>
        <div className="login-page-bg-grid" />
        <div className="login-page-bg-glow login-page-bg-glow--a" />
        <div className="login-page-bg-glow login-page-bg-glow--b" />
      </div>

      <header className="login-page-header">
        <div className="login-page-brand" aria-label="Alloc8">
          <span className="login-page-brand-mark" aria-hidden>
            <Sparkles size={16} strokeWidth={2.25} />
          </span>
          <span className="login-page-brand-name">
            Alloc<span className="login-page-brand-eight">8</span>
          </span>
        </div>
        <button
          type="button"
          className="login-page-help-link"
          onClick={() => setSupportOpen(true)}
        >
          <LifeBuoy size={15} strokeWidth={2.1} aria-hidden />
          Support
        </button>
      </header>

      <main id="main-content" className="login-page-main">
        <section className="login-page-hero" aria-label="About Alloc8">
          <motion.p
            className="login-page-eyebrow"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            Agentic workforce planning
          </motion.p>
          <motion.h1
            className="login-page-title"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: reduceMotion ? 0 : 0.06, ease: [0.22, 1, 0.36, 1] }}
          >
            Alloc<span className="login-page-brand-eight">8</span>
          </motion.h1>
          <motion.p
            className="login-page-lead"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            Ask for capacity, move people, and shape the schedule — in conversation,
            not in a maze of filters.
          </motion.p>

          <motion.div
            className="login-page-prompt"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: reduceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden
          >
            <div className="login-page-prompt-bar">
              <Sparkles size={16} strokeWidth={2} className="login-page-prompt-icon" />
              <span className="login-page-prompt-text">Ask Alloc8 anything about the schedule…</span>
              <span className="login-page-prompt-caret" />
            </div>
            <ul className="login-page-chips">
              {PROMPT_CHIPS.map((chip, i) => (
                <motion.li
                  key={chip}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: reduceMotion ? 0 : 0.28 + i * 0.07,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {chip}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </section>

        <motion.section
          className="login-page-panel"
          aria-label="Sign in"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="login-page-card">
            <h2 className="login-page-card-title">Enter workspace</h2>
            <p className="login-page-card-sub">Sign in with SAML to continue.</p>

            <button
              type="button"
              className="login-page-sso-btn"
              onClick={() => void startSamlSso()}
              disabled={gateBusy}
              aria-label="Continue with SAML"
              autoFocus
            >
              {ssoLoading ? (
                <Loader2 className="login-page-sso-spinner" size={18} strokeWidth={2.2} aria-hidden />
              ) : (
                <Mail size={18} strokeWidth={2} aria-hidden />
              )}
              <span>{ssoLoading ? "Opening SAML…" : "Continue with SAML"}</span>
              {!ssoLoading && <ArrowRight size={17} strokeWidth={2.25} aria-hidden />}
            </button>

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

            <div className="login-page-pwd-slot">
              {!pwdOpen ? (
                <button
                  type="button"
                  className="login-page-pwd-icon-btn"
                  onClick={() => setPwdOpen(true)}
                  disabled={gateBusy}
                  aria-label="Use workspace password"
                  title="Password"
                >
                  <Lock size={14} strokeWidth={2} aria-hidden />
                </button>
              ) : (
                <form
                  className="login-page-form login-page-form--icon"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (gateBusy) return;
                    submit();
                  }}
                >
                  <div className={`login-page-field login-page-field--icon${shake && pwdRejected ? " login-page-field--error" : ""}`}>
                    <Lock className="login-page-field-icon" size={12} strokeWidth={2} aria-hidden />
                    <input
                      id="login-workspace-password"
                      type="password"
                      className={`login-page-input login-page-input--minimal${shake && pwdRejected ? " login-page-input--error" : ""}`}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                        setPwdRejected(false);
                        setShake(false);
                      }}
                      onAnimationEnd={() => setShake(false)}
                      onBlur={() => {
                        if (!password.trim()) setPwdOpen(false);
                      }}
                      autoComplete="current-password"
                      disabled={gateBusy}
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="login-page-submit login-page-submit--icon"
                      disabled={gateBusy || !password.trim()}
                      aria-label="Sign in with password"
                    >
                      <ArrowRight size={12} strokeWidth={2.4} aria-hidden />
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </motion.section>
      </main>

      <footer className="login-page-footer">
        <span className="login-page-footer-love">Made with ❤️ by Sheher</span>
        <span className="login-page-footer-muted">
          {isSupabaseConfigured ? "SAML ready" : "Local mode"}
        </span>
      </footer>
    </div>
  );
}
