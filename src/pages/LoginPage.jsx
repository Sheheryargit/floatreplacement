import { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  Users,
  FolderOpen,
  BarChart3,
  Filter,
  Lock,
  ArrowRight,
  Loader2,
  Mail,
} from "lucide-react";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAppDialog } from "../context/AppDialogContext.jsx";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import "./LoginPage.css";

function HudTicker() {
  const [hudTick, setHudTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setHudTick((t) => (t + 1) % 1000), 1200);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="login-page-hud-seg">AGENT {String(hudTick).padStart(3, "0")}</span>
  );
}

const ACCESS_PASSWORD =
  String(import.meta.env.VITE_APP_ACCESS_PASSWORD ?? "").trim() ||
  "Engineering1";

const SESSION_DEFAULT_NAME =
  String(import.meta.env.VITE_SESSION_DISPLAY_NAME ?? "").trim() || "Workspace session";

/** Optional—for Azure AD, steers corporate login (e.g. deloitte.com). Set `VITE_SSO_EMAIL_DOMAIN` in `.env.local`. */
const SSO_EMAIL_DOMAIN_HINT =
  String(import.meta.env.VITE_SSO_EMAIL_DOMAIN ?? "").trim() || "";

const heroStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.065, delayChildren: 0.04 },
  },
};

const heroStaggerVisible = {
  hidden: { opacity: 1 },
  show: { opacity: 1 },
};

const heroItem = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  },
};

const heroItemVisible = {
  hidden: { opacity: 1, y: 0 },
  show: { opacity: 1, y: 0 },
};

const featureLoopSlides = [
  {
    icon: CalendarDays,
    title:
      "Schedule — week-based timeline with allocations per person, drag-adjust bars, holidays, and conflict visibility.",
  },
  {
    icon: Users,
    title:
      "People — roster by role, department, and tags with availability surfaced next to allocations.",
  },
  {
    icon: FolderOpen,
    title:
      "Projects — clients and projects drive allocation labels and colors across delivery views.",
  },
  {
    icon: BarChart3,
    title:
      "Reporting — utilization, scheduled views, grouping, filters, and export for stakeholder packs.",
  },
  {
    icon: Filter,
    title:
      "Filters — saved slices, starred people, and density controls tuned for large teams.",
  },
];

function randomLoopMs() {
  return 5000 + Math.floor(Math.random() * 5001);
}

function FeatureRotator({ reduceMotion }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const id = window.setTimeout(() => {
      setIndex((i) => (i + 1) % featureLoopSlides.length);
    }, randomLoopMs());
    return () => window.clearTimeout(id);
  }, [index, reduceMotion]);

  if (reduceMotion) {
    return (
      <ul className="login-page-feature-loop login-page-feature-loop--static" aria-label="Alloc8 capabilities">
        {featureLoopSlides.map(({ icon: Icon, title }) => (
          <li key={title} className="login-page-feature-loop-static-item">
            <span className="login-page-feature-loop-icon" aria-hidden>
              <Icon size={18} strokeWidth={1.65} />
            </span>
            <span className="login-page-feature-loop-title">{title}</span>
          </li>
        ))}
      </ul>
    );
  }

  const { icon: Icon, title } = featureLoopSlides[index];

  return (
    <div
      className="login-page-feature-loop"
      role="region"
      aria-roledescription="carousel"
      aria-label="Alloc8 capability highlights"
      aria-live="polite"
    >
      <div className="login-page-feature-loop-frame">
        <AnimatePresence mode="wait">
          <motion.div
            key={title}
            className="login-page-feature-loop-slide"
            initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="login-page-feature-loop-icon" aria-hidden>
              <Icon size={22} strokeWidth={1.6} />
            </span>
            <p className="login-page-feature-loop-title">{title}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="login-page-feature-loop-dots" aria-hidden>
        {featureLoopSlides.map((_, i) => (
          <span
            key={featureLoopSlides[i].title}
            className={`login-page-feature-loop-dot${i === index ? " is-active" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { theme } = useAppTheme();
  const { unlock } = useAuth();
  const { openDialog } = useAppDialog();
  const reduceMotion = useReducedMotion();

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [authExit, setAuthExit] = useState(false);
  const [shake, setShake] = useState(false);
  const [pwdRejected, setPwdRejected] = useState(false);
  const [emptyPulse, setEmptyPulse] = useState(false);
  const [creditHot, setCreditHot] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);

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
    const next = `${u.pathname}${u.search}${u.hash}`;
    window.history.replaceState({}, "", next);
  }, [openDialog]);

  const creditZoneVariants = useMemo(() => {
    if (reduceMotion) {
      return {
        idle: { opacity: 0.92 },
        hover: { opacity: 1, transition: { duration: 0.2 } },
      };
    }
    return {
      idle: {
        scale: 0.84,
        y: 26,
        opacity: 0.52,
        transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
      },
      hover: {
        scale: 1.2,
        y: -14,
        opacity: 1,
        transition: {
          type: "spring",
          stiffness: 265,
          damping: 17,
          mass: 0.46,
        },
      },
    };
  }, [reduceMotion]);

  const creditTextVariants = useMemo(() => {
    if (reduceMotion) {
      return {
        idle: { opacity: 0 },
        hover: { opacity: 1, transition: { duration: 0.2 } },
      };
    }
    return {
      idle: {
        opacity: 0,
        scale: 0.5,
        y: 28,
        filter: "blur(16px)",
      },
      hover: {
        opacity: 1,
        scale: 1.08,
        y: 0,
        filter: "blur(0px)",
        transition: {
          type: "spring",
          stiffness: 380,
          damping: 24,
          delay: 0.07,
        },
      },
    };
  }, [reduceMotion]);

  const creditGlowVariants = useMemo(() => {
    if (reduceMotion) {
      return { idle: { opacity: 0 }, hover: { opacity: 0 } };
    }
    return {
      idle: { scale: 0.35, opacity: 0 },
      hover: {
        scale: 1.35,
        opacity: 0.65,
        transition: { type: "spring", stiffness: 320, damping: 20 },
      },
    };
  }, [reduceMotion]);

  const creditTriggerVariants = useMemo(() => {
    if (reduceMotion) {
      return {
        idle: { opacity: 0.35 },
        hover: { opacity: 1, transition: { duration: 0.2 } },
      };
    }
    return {
      idle: { opacity: 0.2, scale: 0.55 },
      hover: {
        opacity: 1,
        scale: 1.28,
        transition: { type: "spring", stiffness: 440, damping: 23, delay: 0.02 },
      },
    };
  }, [reduceMotion]);

  const handleCreditBlur = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setCreditHot(false);
    }
  }, []);

  const submit = useCallback(() => {
    const p = password.trim();
    if (!p) {
      setPwdRejected(false);
      setError("Authorization required.");
      setEmptyPulse(false);
      requestAnimationFrame(() => setEmptyPulse(true));
      return;
    }
    if (p !== ACCESS_PASSWORD) {
      setError("");
      setPwdRejected(true);
      setShake(false);
      requestAnimationFrame(() => setShake(true));
      openDialog({
        title: "Incorrect password",
        message:
          "Please contact Sheher. Changes are being done in production.",
      });
      return;
    }
    setError("");
    setPwdRejected(false);
    setEmptyPulse(false);
    setAuthExit(true);
    window.setTimeout(() => {
      unlock({ displayName: SESSION_DEFAULT_NAME });
    }, 440);
  }, [password, unlock, openDialog]);

  const startDeloitteEmailSso = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      openDialog({
        title: "Deloitte email SSO isn’t wired up yet",
        message:
          "Add your Supabase URL and anon key, then enable Authentication → Microsoft (Azure AD). That verifies your Deloitte work email through SSO. Add this site’s URL to redirect allowlists.",
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo,
          scopes: "openid profile email",
          queryParams,
        },
      });
      if (error) {
        openDialog({
          title: "Email sign-in couldn’t start",
          message:
            error.message ??
            "Ask your administrator to confirm Azure AD and redirect URLs are configured for Deloitte email SSO.",
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

  const cardSpring = reduceMotion
    ? {}
    : { type: "spring", stiffness: 420, damping: 36, mass: 0.85 };

  const gateBusy = authExit || emptyPulse || ssoLoading;

  return (
    <div
      className={`login-page${authExit ? " login-page--auth-exit" : ""}`}
      data-theme={theme === "light" ? "light" : "dark"}
    >
      <div className="login-page-atmosphere" aria-hidden>
        <div className="login-page-bg" />
        <div className="login-page-aurora" />
        <div className="login-page-orb login-page-orb--a" />
        <div className="login-page-orb login-page-orb--b" />
        <div className="login-page-orb login-page-orb--deloitte" />
        <div className="login-page-grid" />
        <div className="login-page-vignette" />
        <div className="login-page-noise" />
        <div className="login-page-scanline" />
      </div>

      <aside className="login-page-corner-deloitte" aria-label="Deloitte">
        <div className="login-page-corner-deloitte-inner">
          <img
            src="/branding/deloitte-logo.png"
            alt="Deloitte"
            className="login-page-corner-deloitte-logo"
            width={300}
            height={50}
            decoding="async"
          />
        </div>
      </aside>

      <aside className="login-page-corner-eaas" aria-label="Built by EaaS Engineers for EaaS">
        <span className="login-page-corner-eaas-pulse" aria-hidden />
        <span className="login-page-corner-eaas-text">Built by EaaS Engineers for EaaS</span>
      </aside>

      <main id="main-content" className="login-page-shell">
        <section className="login-page-hero" aria-label="Alloc8 overview">
          <motion.div
            className="login-page-hero-inner"
            variants={reduceMotion ? heroStaggerVisible : heroStagger}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={reduceMotion ? heroItemVisible : heroItem} className="login-page-hero-badge-wrap">
              <div className="login-page-hero-badge login-page-hero-badge--futurist">
                <span className="login-page-hero-badge-pulse" aria-hidden />
                Deloitte · Workforce scheduling · Email SSO ready
              </div>
            </motion.div>
            <motion.div variants={reduceMotion ? heroItemVisible : heroItem}>
              <span className="alloc8-wordmark login-page-hero-wordmark" aria-label="Alloc8">
                Alloc<span className="alloc8-wordmark-eight">8</span>
              </span>
            </motion.div>
            <motion.h1
              className="login-page-hero-title"
              variants={reduceMotion ? heroItemVisible : heroItem}
            >
              <span className="login-page-hero-title-line">Capacity, people, and projects in one place.</span>
              <span className="login-page-hero-title-line login-page-hero-title-line--grad">
                Trusted planning for regulated delivery teams.
              </span>
            </motion.h1>
            <motion.p
              className="login-page-hero-lead"
              variants={reduceMotion ? heroItemVisible : heroItem}
            >
              Internal resource scheduling for portfolio delivery — streamlined shell, audited access,
              and clear ownership across engagements.
            </motion.p>
            <motion.div variants={reduceMotion ? heroItemVisible : heroItem} className="login-page-feature-loop-wrap">
              <p className="login-page-feature-loop-label">
                <span className="login-page-feature-loop-label-cursor" aria-hidden />
                Platform overview
              </p>
              <FeatureRotator reduceMotion={reduceMotion} />
            </motion.div>
            <motion.p className="login-page-hero-trust" variants={reduceMotion ? heroItemVisible : heroItem}>
              <span className="login-page-hero-trust-dot" aria-hidden />
              <span className="login-page-hero-trust-text">
                Deloitte work email SSO (Azure AD) · audited gate · fallback workspace password
              </span>
            </motion.p>
          </motion.div>
        </section>

        <div className="login-page-card-sticky-shell">
        <motion.div
          className="login-page-card-tilt"
          initial={reduceMotion ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={cardSpring}
        >
          <div className="login-page-card-wrap">
            <div className="login-page-card-ring" aria-hidden />
            <div className="login-page-card">
              <div className="login-page-card-sheen" aria-hidden />
              <div className="login-page-card-inner">
                <div className="login-page-card-masthead">
                  <div className="login-page-card-masthead-ribbon" aria-hidden />
                  <div className="login-page-card-masthead-core">
                    <div className="login-page-card-masthead-plate">
                      <img
                        src="/branding/deloitte-logo.png"
                        alt="Deloitte"
                        width={296}
                        height={48}
                        decoding="async"
                        className="login-page-card-deloitte-logo"
                      />
                    </div>
                    <div className="login-page-card-masthead-meta">
                      <span className="login-page-card-masthead-chip">Authorized access only</span>
                      <div className="login-page-card-masthead-brand">
                        <span className="login-page-card-masthead-brand-mark">
                          Alloc<span className="alloc8-wordmark-eight">8</span>
                        </span>
                        <span className="login-page-card-masthead-brand-sub">Scheduling workspace</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="login-page-card-body">
                <p className="login-page-card-kicker">Enterprise access</p>
                <h2 className="login-page-card-title">Sign in with your Deloitte email</h2>

                <div className="login-page-sso-enterprise login-sso-modern" aria-labelledby="sso-primary-label">
                  <div className="login-sso-modern-toolbar">
                    <span id="sso-primary-label" className="login-sso-modern-pill">
                      SSO · Deloitte work email
                    </span>
                    <span className="login-sso-modern-hint">Encrypted session</span>
                  </div>
                  <button
                    type="button"
                    className="login-sso-enterprise-btn login-sso-modern-cta"
                    onClick={() => void startDeloitteEmailSso()}
                    disabled={gateBusy}
                    aria-label="Continue with Deloitte work email via single sign-on"
                  >
                    <span className="login-sso-enterprise-btn-inner">
                      {ssoLoading ? (
                        <span className="login-sso-email-icon-wrap login-sso-email-icon-wrap--busy" aria-hidden>
                          <Loader2 className="login-sso-enterprise-spinner" size={22} strokeWidth={2.2} />
                        </span>
                      ) : (
                        <span className="login-sso-email-icon-wrap" aria-hidden>
                          <Mail className="login-sso-email-icon" size={22} strokeWidth={2.05} />
                        </span>
                      )}
                      <span className="login-sso-enterprise-btn-text-wrap">
                        <span className="login-sso-enterprise-btn-title">
                          {ssoLoading ? "Opening sign-in…" : "Continue with Deloitte email"}
                        </span>
                        <span className="login-sso-enterprise-btn-sub">
                          Opens your firm&apos;s Microsoft work account • Returns here when done
                        </span>
                      </span>
                    </span>
                  </button>
                </div>

                <div className="login-page-divider login-page-divider--or" role="separator">
                  <span className="login-page-divider-line" />
                  <span className="login-page-divider-or">Alternative</span>
                  <span className="login-page-divider-line" />
                </div>

                <form
                  className="login-page-pwd-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (authExit || ssoLoading) return;
                    submit();
                  }}
                >
                  <label className="login-page-pwd-label" htmlFor="login-workspace-password">
                    Workspace password
                  </label>
                  <motion.div
                    className={`login-page-field-wrapper ${emptyPulse ? "is-empty-lock" : ""}`}
                    animate={
                      emptyPulse
                        ? {
                            scale: 0.995,
                          }
                        : { scale: 1 }
                    }
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 28 }}
                    onAnimationComplete={() => {
                      if (emptyPulse) {
                        setTimeout(() => setEmptyPulse(false), 900);
                      }
                    }}
                  >
                    <div className="login-page-field">
                      <Lock className="login-page-field-icon" size={18} strokeWidth={2} aria-hidden />
                      <input
                        id="login-workspace-password"
                        type="password"
                        className={`login-page-input${shake && (error || pwdRejected) && !emptyPulse ? " login-page-input--error" : ""}`}
                        placeholder={emptyPulse ? "" : "Enter workspace password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setError("");
                          setPwdRejected(false);
                          setShake(false);
                          setEmptyPulse(false);
                        }}
                        onAnimationEnd={() => setShake(false)}
                        autoComplete="current-password"
                        autoFocus={!ssoLoading}
                        disabled={authExit || ssoLoading || emptyPulse}
                      />
                    </div>
                  </motion.div>

                  <AnimatePresence mode="wait">
                    {error ? (
                      <motion.p
                        key="err"
                        className="login-page-error"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        {error}
                      </motion.p>
                    ) : (
                      <div className="login-page-error" aria-hidden />
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    className="login-page-submit"
                    disabled={authExit || ssoLoading || emptyPulse}
                    whileHover={reduceMotion ? {} : { scale: gateBusy ? 1 : 1.02 }}
                    whileTap={reduceMotion ? {} : { scale: gateBusy ? 1 : 0.99 }}
                    aria-label="Sign in with workspace password"
                  >
                    <span className="login-page-submit-inner">
                      <span className="login-page-button-text">Sign in with password</span>
                      <ArrowRight className="login-page-arrow" size={20} strokeWidth={2.25} aria-hidden />
                    </span>
                  </motion.button>
                </form>

                <p className="login-page-legal">
                  By continuing you agree to your organisation&apos;s acceptable use policies and Deloitte
                  data-handling guidelines.
                </p>

                <p className="login-page-footer">
                  Alloc8
                  <span className="login-page-tagline">Every person. Every project. In place.</span>
                </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
        </div>
      </main>

      <div className="login-page-attribution" aria-label="Credit">
        <motion.div
          className="login-page-attribution-zone"
          role="group"
          data-credit-hot={creditHot ? "true" : undefined}
          variants={creditZoneVariants}
          initial="idle"
          animate={creditHot ? "hover" : "idle"}
          onMouseEnter={() => setCreditHot(true)}
          onMouseLeave={() => setCreditHot(false)}
          onFocusCapture={() => setCreditHot(true)}
          onBlurCapture={handleCreditBlur}
        >
          <div className="login-page-attribution-glow-wrap" aria-hidden>
            <motion.span
              className="login-page-attribution-glow"
              variants={creditGlowVariants}
              initial="idle"
              animate={creditHot ? "hover" : "idle"}
            />
          </div>
          <motion.button
            type="button"
            className="login-page-attribution-trigger"
            aria-label="Show creator credit"
            variants={creditTriggerVariants}
            initial="idle"
            animate={creditHot ? "hover" : "idle"}
            whileTap={reduceMotion ? {} : { scale: 0.9 }}
          />
          <motion.p
            className="login-page-attribution-text"
            variants={creditTextVariants}
            initial="idle"
            animate={creditHot ? "hover" : "idle"}
          >
            Made with <span className="login-page-attribution-heart">❤️</span> by Sheher
          </motion.p>
        </motion.div>
      </div>

      <footer className="login-page-hud" aria-hidden>
        <span className="login-page-hud-seg">ALLOC8</span>
        <span className="login-page-hud-sep">·</span>
        <span className="login-page-hud-seg login-page-hud-seg--ok">ACCESS GATE</span>
        <span className="login-page-hud-sep">·</span>
        <span className="login-page-hud-seg">{isSupabaseConfigured ? "EMAIL SSO" : "SSO IDLE"}</span>
        <span className="login-page-hud-sep">·</span>
        <HudTicker />
        <span className="login-page-hud-sep">·</span>
        <span className="login-page-hud-seg login-page-hud-blink">SECURE CH</span>
      </footer>
    </div>
  );
}
