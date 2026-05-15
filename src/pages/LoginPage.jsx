import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  Users,
  FolderOpen,
  BarChart3,
  Filter,
  Lock,
  ArrowRight,
  User,
} from "lucide-react";
import { siJira, siMicrosoftoutlook } from "simple-icons";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAppDialog } from "../context/AppDialogContext.jsx";
import { useAppStore } from "../context/AppDataContext.jsx";
import { isSupabaseConfigured } from "../lib/supabase.js";
import { personAccessLabelToRbacRole } from "../constants/permissions.js";
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

/** Select value for full-access demo identity (not tied to a roster row). */
const SIGN_IN_AS_ADMIN = "__admin__";

const SIGN_IN_HOLD_MS = 5000;
const SSO_TRIPLE_WINDOW_MS = 720;
const SSO_WELCOME_MS = 3000;
const SSO_WELCOME_MS_REDUCED = 750;

const SSO_PROVIDERS = [
  { id: "google", label: "Google", toneClass: "login-page-sso-btn--google" },
  { id: "jira", label: "Jira", icon: siJira, toneClass: "login-page-sso-btn--jira" },
  { id: "outlook", label: "Outlook", icon: siMicrosoftoutlook, toneClass: "login-page-sso-btn--outlook" },
  { id: "slack", label: "Slack", toneClass: "login-page-sso-btn--slack" },
];

/** Slack octothorpe — eight subpaths from Simple Icons geometry, Slack core palette (media kit). */
const SLACK_MARK_PATHS = [
  "M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z",
  "M6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z",
  "M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834z",
  "M8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z",
  "M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834z",
  "M17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z",
  "M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52z",
  "M15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z",
];
const SLACK_MARK_FILLS = ["#E01E5A", "#E01E5A", "#36C5F0", "#36C5F0", "#2EB67D", "#2EB67D", "#ECB22E", "#ECB22E"];

/** Google “G” — standard four-color mark used on enterprise login rows */
function GoogleMulticolorMark() {
  return (
    <svg
      className="login-page-sso-brand-svg login-page-sso-brand-svg--google"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function SsoBrandIcon({ icon, fill, className }) {
  const cn = ["login-page-sso-brand-svg", className].filter(Boolean).join(" ");
  return (
    <svg className={cn} viewBox="0 0 24 24" role="img" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <path fill={fill ?? `#${icon.hex}`} d={icon.path} />
    </svg>
  );
}

/** Official four-color Slack mark (Slack media kit palette); white tile per brand guidelines */
function SlackMulticolorMark() {
  return (
    <svg
      className="login-page-sso-brand-svg login-page-sso-brand-svg--slack-official"
      viewBox="0 0 24 24"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      {SLACK_MARK_PATHS.map((d, i) => (
        <path key={`slack-seg-${i}`} fill={SLACK_MARK_FILLS[i]} d={d} />
      ))}
    </svg>
  );
}

function SsoTileIcon({ provider }) {
  if (provider.id === "google") return <GoogleMulticolorMark />;
  if (provider.id === "slack") return <SlackMulticolorMark />;
  if (provider.icon) {
    const onBrand = provider.id === "jira" || provider.id === "outlook";
    return (
      <SsoBrandIcon
        icon={provider.icon}
        fill={onBrand ? "#ffffff" : undefined}
        className={onBrand ? "login-page-sso-brand-svg--on-brand" : undefined}
      />
    );
  }
  return null;
}

const WELCOME_FLOAT = ["🎯", "✨", "📊", "🚀", "💼", "🧠", "⚡", "🎉", "🔮", "📈"];

/** Percent [left, top] for floating emoji layer */
const WELCOME_FLOAT_POS = [
  [8, 14],
  [82, 10],
  [18, 68],
  [88, 52],
  [12, 42],
  [62, 78],
  [48, 22],
  [34, 58],
  [72, 36],
  [52, 48],
];

const WELCOME_TAGLINE = {
  google: "Google workspace — synced.",
  jira: "Jira streams — wired in.",
  outlook: "Outlook calendar — locked.",
  slack: "Slack signals — live.",
};

function SsoWelcomeCeremony({ providerId, reduceMotion, onDone }) {
  useEffect(() => {
    const ms = reduceMotion ? SSO_WELCOME_MS_REDUCED : SSO_WELCOME_MS;
    const id = window.setTimeout(onDone, ms);
    return () => window.clearTimeout(id);
  }, [reduceMotion, onDone]);

  const tag = WELCOME_TAGLINE[providerId] ?? "Your command surface is ready.";
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: reduceMotion ? { duration: 0.2 } : { staggerChildren: 0.14, delayChildren: 0.08 },
    },
  };
  const item = {
    hidden: reduceMotion
      ? { opacity: 0 }
      : { opacity: 0, y: 22, scale: 0.92, filter: "blur(10px)" },
    show: reduceMotion
      ? { opacity: 1, transition: { duration: 0.2 } }
      : {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
          transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
        },
  };

  return (
    <motion.div
      className="login-welcome-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-welcome-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="login-welcome-aurora" aria-hidden />
      <div className="login-welcome-floaties" aria-hidden>
        {!reduceMotion &&
          WELCOME_FLOAT.map((ch, i) => (
            <motion.span
              key={`${ch}-${i}`}
              className="login-welcome-floaty"
              initial={{ opacity: 0, scale: 0, rotate: -20 }}
              animate={{
                opacity: [0, 1, 0.85],
                scale: [0.2, 1.15, 1],
                rotate: [0, 8, -6],
                y: [0, -6, 0],
              }}
              transition={{
                duration: 2.2,
                delay: 0.15 + i * 0.09,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                left: `${WELCOME_FLOAT_POS[i % WELCOME_FLOAT_POS.length][0]}%`,
                top: `${WELCOME_FLOAT_POS[i % WELCOME_FLOAT_POS.length][1]}%`,
              }}
            >
              {ch}
            </motion.span>
          ))}
      </div>
      <motion.div
        className="login-welcome-card"
        initial={reduceMotion ? false : { scale: 0.92, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0.2 } : { type: "spring", stiffness: 280, damping: 24 }}
      >
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.p id="login-welcome-title" className="login-welcome-kicker" variants={item}>
            You did the triple-tap handshake 🤝
          </motion.p>
          <motion.h2 className="login-welcome-title" variants={item}>
            Welcome to Alloc8
          </motion.h2>
          <motion.p className="login-welcome-sub" variants={item}>
            {tag}
          </motion.p>
          <motion.p className="login-welcome-lede" variants={item}>
            Spinning up people, projects, and allocations…
            <br />
            <span className="login-welcome-em">Hold tight — magic loading bar not included.</span> ✨
          </motion.p>
          <motion.div className="login-welcome-pulse-row" variants={item} aria-hidden>
            <span className="login-welcome-pulse" />
            <span className="login-welcome-pulse login-welcome-pulse--delay" />
            <span className="login-welcome-pulse login-welcome-pulse--delay2" />
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/** Live tiles — real Alloc8 areas (Schedule, People, Projects, Report, filters). */
const featureLoopSlides = [
  {
    icon: CalendarDays,
    title:
      "Schedule — week-based timeline: allocations per person, drag to move or resize bars, and spot conflicts next to public holidays.",
  },
  {
    icon: Users,
    title:
      "People — roster with roles, departments, tags, and availability; open a person to edit details synced with your workspace.",
  },
  {
    icon: FolderOpen,
    title:
      "Projects — clients and projects drive allocation labels and colors so hours roll up cleanly for delivery and finance.",
  },
  {
    icon: BarChart3,
    title:
      "Report — utilization and scheduled cost, group by people or projects, advanced filters, and CSV export for leadership packs.",
  },
  {
    icon: Filter,
    title:
      "Schedule filters — starred people and tags, saved rules, and density controls so the board shows exactly the slice you need.",
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
      <ul className="login-page-feature-loop login-page-feature-loop--static" aria-label="Alloc8 features">
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
      aria-label="Alloc8 product features"
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

const heroStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.065, delayChildren: 0.04 },
  },
};

/** Reduced / static-ui: avoids `opacity: 0` initial state when CSS kills motion timing (hero must not stay blank). */
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

export default function LoginPage() {
  const { theme } = useAppTheme();
  const { unlock } = useAuth();
  const { openDialog } = useAppDialog();
  const people = useAppStore((s) => s.people);
  const reduceMotion = useReducedMotion();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  /** After correct password — full-screen fade then `unlock` (no lingering “authenticating” chrome). */
  const [authExit, setAuthExit] = useState(false);
  const [shake, setShake] = useState(false);
  const [pwdRejected, setPwdRejected] = useState(false);
  const [emptyPulse, setEmptyPulse] = useState(false);
  const [creditHot, setCreditHot] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [holdShrinking, setHoldShrinking] = useState(false);
  const holdRafRef = useRef(null);
  const holdShrinkTimerRef = useRef(null);
  const holdPointerIdRef = useRef(null);
  const holdAnchorRef = useRef(0);
  const holdCompletingRef = useRef(false);
  const ssoTapRef = useRef({ id: null, count: 0, timer: null });
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [welcomeProvider, setWelcomeProvider] = useState(null);

  const rosterReady = !isSupabaseConfigured || people.length > 0;
  const signInChoices = useMemo(
    () =>
      [...(people || [])]
        .filter((p) => !p.archived)
        .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [people]
  );

  const [signInAsKey, setSignInAsKey] = useState(SIGN_IN_AS_ADMIN);

  useEffect(() => {
    if (signInAsKey === SIGN_IN_AS_ADMIN) return;
    const id = Number(signInAsKey);
    if (!signInChoices.some((p) => p.id === id)) {
      setSignInAsKey(SIGN_IN_AS_ADMIN);
    }
  }, [signInChoices, signInAsKey]);

  const resolveUnlockIdentity = useCallback(() => {
    if (signInAsKey === SIGN_IN_AS_ADMIN) {
      return {
        displayName: SESSION_DEFAULT_NAME,
        id: null,
        access: "admin",
      };
    }
    const id = Number(signInAsKey);
    const person = signInChoices.find((p) => p.id === id);
    if (!person) {
      return {
        displayName: SESSION_DEFAULT_NAME,
        id: null,
        access: "admin",
      };
    }
    return {
      displayName: person.name,
      id: person.id,
      access: personAccessLabelToRbacRole(person.access),
    };
  }, [signInAsKey, signInChoices]);

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

  const clearHoldTracking = useCallback(() => {
    if (holdRafRef.current != null) {
      cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    if (holdShrinkTimerRef.current != null) {
      clearTimeout(holdShrinkTimerRef.current);
      holdShrinkTimerRef.current = null;
    }
    holdPointerIdRef.current = null;
    holdCompletingRef.current = false;
    setHoldProgress(0);
  }, []);

  useEffect(() => () => {
    if (holdRafRef.current != null) cancelAnimationFrame(holdRafRef.current);
    if (holdShrinkTimerRef.current != null) clearTimeout(holdShrinkTimerRef.current);
  }, []);

  const submit = useCallback(() => {
    setHoldShrinking(false);
    setHoldProgress(0);
    holdCompletingRef.current = false;
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
      unlock(resolveUnlockIdentity());
    }, 440);
  }, [password, unlock, openDialog, resolveUnlockIdentity]);

  const finishHoldAndSubmit = useCallback(() => {
    holdPointerIdRef.current = null;
    if (holdRafRef.current != null) {
      cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    if (reduceMotion) {
      setHoldProgress(0);
      setHoldShrinking(false);
      submit();
      holdCompletingRef.current = false;
      return;
    }
    setHoldShrinking(true);
    holdShrinkTimerRef.current = window.setTimeout(() => {
      holdShrinkTimerRef.current = null;
      setHoldShrinking(false);
      setHoldProgress(0);
      submit();
      holdCompletingRef.current = false;
    }, 480);
  }, [reduceMotion, submit]);

  const onSignInPointerDown = useCallback(
    (e) => {
      if (authExit || emptyPulse || welcomeOpen || e.button !== 0) return;
      e.preventDefault();
      holdCompletingRef.current = false;
      holdPointerIdRef.current = e.pointerId;
      holdAnchorRef.current = performance.now();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const tick = () => {
        const elapsed = performance.now() - holdAnchorRef.current;
        const p = Math.min(1, elapsed / SIGN_IN_HOLD_MS);
        setHoldProgress(p);
        if (p >= 1) {
          if (holdRafRef.current != null) {
            cancelAnimationFrame(holdRafRef.current);
            holdRafRef.current = null;
          }
          holdCompletingRef.current = true;
          finishHoldAndSubmit();
          return;
        }
        holdRafRef.current = requestAnimationFrame(tick);
      };
      holdRafRef.current = requestAnimationFrame(tick);
    },
    [authExit, emptyPulse, welcomeOpen, finishHoldAndSubmit]
  );

  const onSignInPointerEnd = useCallback(
    (e) => {
      if (holdPointerIdRef.current !== e.pointerId) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (holdCompletingRef.current || holdShrinkTimerRef.current != null) return;
      clearHoldTracking();
    },
    [clearHoldTracking]
  );

  const flushSsoTriple = useCallback(() => {
    const r = ssoTapRef.current;
    if (r.timer != null) {
      window.clearTimeout(r.timer);
      r.timer = null;
    }
    r.id = null;
    r.count = 0;
  }, []);

  const completeSsoWelcome = useCallback(() => {
    flushSsoTriple();
    const label = SSO_PROVIDERS.find((p) => p.id === welcomeProvider)?.label ?? "Signed in";
    const identity = resolveUnlockIdentity();
    const displayName = identity.id != null ? identity.displayName : label;
    unlock({ displayName, id: identity.id, access: identity.access });
  }, [unlock, flushSsoTriple, welcomeProvider, resolveUnlockIdentity]);

  const handleSsoActivate = useCallback(
    (id) => {
      if (authExit || welcomeOpen || emptyPulse) return;
      const r = ssoTapRef.current;
      if (r.timer != null) {
        window.clearTimeout(r.timer);
        r.timer = null;
      }
      if (r.id !== id) {
        r.id = id;
        r.count = 0;
      }
      r.count += 1;
      if (r.count >= 3) {
        r.count = 0;
        r.id = null;
        setWelcomeProvider(id);
        setWelcomeOpen(true);
        return;
      }
      r.timer = window.setTimeout(() => {
        r.count = 0;
        r.id = null;
        r.timer = null;
      }, SSO_TRIPLE_WINDOW_MS);
    },
    [authExit, welcomeOpen, emptyPulse]
  );

  useEffect(
    () => () => {
      const r = ssoTapRef.current;
      if (r.timer != null) window.clearTimeout(r.timer);
    },
    []
  );

  const cardSpring = reduceMotion
    ? {}
    : { type: "spring", stiffness: 420, damping: 36, mass: 0.85 };

  return (
    <div
      className={`login-page${welcomeOpen ? " login-page--welcome" : ""}${authExit ? " login-page--auth-exit" : ""}`}
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
            <motion.div
              variants={reduceMotion ? heroItemVisible : heroItem}
              className="login-page-hero-badge-wrap"
            >
              <div className="login-page-hero-badge login-page-hero-badge--futurist">
                <span className="login-page-hero-badge-pulse" aria-hidden />
                AI-operated workforce intelligence
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
              <span className="login-page-hero-title-line">Operate the future of work.</span>
              <span className="login-page-hero-title-line login-page-hero-title-line--grad">
                Agents, people, one command surface.
              </span>
            </motion.h1>
            <motion.p
              className="login-page-hero-lead"
              variants={reduceMotion ? heroItemVisible : heroItem}
            >
              Enterprise-grade workforce intelligence — AI agents amplify planners while
              governance, audit trails, and role-aware controls stay in command.
            </motion.p>
            <motion.div
              variants={reduceMotion ? heroItemVisible : heroItem}
              className="login-page-feature-loop-wrap"
            >
              <p className="login-page-feature-loop-label">
                <span className="login-page-feature-loop-label-cursor" aria-hidden />
                Live capability stream
              </p>
              <FeatureRotator reduceMotion={reduceMotion} />
            </motion.div>
            <motion.p
              className="login-page-hero-trust"
              variants={reduceMotion ? heroItemVisible : heroItem}
            >
              <span className="login-page-hero-trust-dot" aria-hidden />
              <span className="login-page-hero-trust-text">
                Models nominal · human-in-the-loop · audit-ready telemetry
              </span>
            </motion.p>
          </motion.div>
        </section>

        <motion.div
          className="login-page-card-tilt"
          initial={reduceMotion ? false : { opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={cardSpring}
        >
          <div className="login-page-card-wrap">
            <div className="login-page-card-ring" aria-hidden />
            <div className="login-page-card">
              <div className="login-page-card-sheen" aria-hidden />
              <div className="login-page-card-inner">
                <div className="login-page-card-header-accent" aria-hidden />
                <p className="login-page-card-kicker">Secure access</p>
                <h2 className="login-page-card-title">Sign in to Alloc8</h2>
                <p className="login-page-card-sub">
                  Enterprise workspace gate. Use your password until SSO is connected — same
                  policies, full audit trail.
                </p>

                <div className="login-page-sso">
                  <div className="login-page-sso-row" role="group" aria-label="Sign-in options">
                    {SSO_PROVIDERS.map((p) => (
                      <motion.button
                        key={p.id}
                        type="button"
                        className={`login-page-sso-btn ${p.toneClass}`}
                        onClick={() => handleSsoActivate(p.id)}
                        disabled={authExit || welcomeOpen || emptyPulse}
                        whileHover={reduceMotion || authExit || welcomeOpen || emptyPulse ? {} : { y: -3, scale: 1.03 }}
                        whileTap={reduceMotion ? {} : { scale: 0.94 }}
                        aria-label={`${p.label}: triple-click for demo sign-in`}
                        title={`${p.label}: triple-click to unlock (demo)`}
                      >
                        <span className="login-page-sso-btn-glow" aria-hidden />
                        <SsoTileIcon provider={p} />
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div
                  className="login-page-divider login-page-divider--or"
                  role="separator"
                  aria-hidden
                >
                  <span className="login-page-divider-line" />
                  <span className="login-page-divider-or">Password</span>
                  <span className="login-page-divider-line" />
                </div>

                {!rosterReady && isSupabaseConfigured ? (
                  <p className="login-page-roster-hint" role="status">
                    Loading workspace roster…
                  </p>
                ) : null}

                <div className="login-page-sign-in-as">
                  <label className="login-page-pwd-label" htmlFor="login-sign-in-as">
                    Sign in as
                  </label>
                  <div className="login-page-field-wrapper login-page-field-wrapper--signin-as">
                    <div className="login-page-field">
                      <User className="login-page-field-icon" size={18} strokeWidth={2} aria-hidden />
                      <select
                        id="login-sign-in-as"
                        className="login-page-input login-page-select"
                        value={signInAsKey}
                        onChange={(e) => setSignInAsKey(e.target.value)}
                        disabled={authExit || welcomeOpen}
                        aria-describedby="login-sign-in-as-hint"
                      >
                        <option value={SIGN_IN_AS_ADMIN}>Workspace admin (full access)</option>
                        {signInChoices.map((p) => (
                          <option key={p.id} value={String(p.id)}>
                            {p.name} · {String(p.access || "User")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p id="login-sign-in-as-hint" className="login-page-roster-hint login-page-roster-hint--hint">
                    Roster access drives permissions (member / manager). Admin is unrestricted.
                  </p>
                </div>

                <form
                  className="login-page-pwd-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                  }}
                >
                  <label className="login-page-pwd-label" htmlFor="login-workspace-password">
                    Workspace password
                  </label>
                  <motion.div 
                    className={`login-page-field-wrapper ${emptyPulse ? "is-empty-lock" : ""}`}
                    animate={emptyPulse ? { width: 50, x: "calc(50% - 25px)", background: "rgba(255, 60, 60, 0.15)", borderColor: "rgba(255, 60, 60, 0.6)" } : { width: "100%", x: 0, background: "rgba(0, 0, 0, 0)", borderColor: "rgba(255, 255, 255, 0.08)" }}
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 20 }}
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
                        placeholder={emptyPulse ? "" : "Enter password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setError("");
                          setPwdRejected(false);
                          setShake(false);
                          setEmptyPulse(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !authExit && !emptyPulse && !welcomeOpen) {
                            e.preventDefault();
                            submit();
                          }
                        }}
                        onAnimationEnd={() => setShake(false)}
                        autoComplete="current-password"
                        autoFocus
                        disabled={authExit || emptyPulse || welcomeOpen}
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

                  <motion.div
                    className="login-page-submit-wrap"
                    initial={false}
                    animate={
                      holdShrinking
                        ? {
                            width: 56,
                            x: "calc(50% - 28px)",
                            transition: { duration: 0.42, ease: [0.32, 0, 0.67, 1] },
                          }
                        : {
                            width: "100%",
                            x: 0,
                            transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
                          }
                    }
                  >
                    <motion.button
                      type="button"
                      className={`login-page-submit${holdProgress > 0 && !holdShrinking && !authExit ? " login-page-submit--holding" : ""}`}
                      disabled={authExit || emptyPulse || welcomeOpen}
                      aria-label="Sign in: hold five seconds, or press Enter in the password field"
                      onPointerDown={onSignInPointerDown}
                      onPointerUp={onSignInPointerEnd}
                      onPointerCancel={onSignInPointerEnd}
                      onLostPointerCapture={onSignInPointerEnd}
                      whileHover={
                        reduceMotion || authExit || emptyPulse || welcomeOpen || holdProgress > 0
                          ? {}
                          : { scale: 1.02 }
                      }
                      whileTap={{}}
                    >
                      <span
                        className="login-page-submit-hold-track"
                        aria-hidden
                        style={{ "--hold-p": String(holdProgress) }}
                      />
                      <span className="login-page-submit-inner">
                        <span className="login-page-button-text">Sign in</span>
                        <ArrowRight className="login-page-arrow" size={20} strokeWidth={2.25} aria-hidden />
                      </span>
                    </motion.button>
                  </motion.div>
                </form>

                <p className="login-page-legal">
                  By continuing you agree to your organization&apos;s policies.
                </p>

                <p className="login-page-footer">
                  Alloc8
                  <span className="login-page-tagline">Every person. Every project. In place.</span>
                </p>
              </div>
            </div>
          </div>
        </motion.div>
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

      <AnimatePresence>
        {welcomeOpen && welcomeProvider ? (
          <SsoWelcomeCeremony
            key="welcome"
            providerId={welcomeProvider}
            reduceMotion={reduceMotion}
            onDone={completeSsoWelcome}
          />
        ) : null}
      </AnimatePresence>

      <footer className="login-page-hud" aria-hidden>
        <span className="login-page-hud-seg">ALLOC8</span>
        <span className="login-page-hud-sep">·</span>
        <span className="login-page-hud-seg login-page-hud-seg--ai">AI OPS</span>
        <span className="login-page-hud-sep">·</span>
        <span className="login-page-hud-seg login-page-hud-seg--ok">ENV READY</span>
        <span className="login-page-hud-sep">·</span>
        <HudTicker />
        <span className="login-page-hud-sep">·</span>
        <span className="login-page-hud-seg login-page-hud-blink">LIVE</span>
      </footer>
    </div>
  );
}
