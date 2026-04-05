import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { LayoutGrid, Users, ShieldCheck, Lock, ArrowRight } from "lucide-react";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import "./LoginPage.css";

const ACCESS_PASSWORD =
  String(import.meta.env.VITE_APP_ACCESS_PASSWORD ?? "").trim() ||
  "Engineering";

function GoogleMark() {
  return (
    <svg className="login-google-mark" viewBox="0 0 24 24" aria-hidden>
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

const heroBullets = [
  {
    icon: LayoutGrid,
    title: "Live allocation graph",
    text: "People, projects, and time — one coherent surface.",
  },
  {
    icon: Users,
    title: "Built for org-wide scale",
    text: "Directory and schedules that stay in sync.",
  },
  {
    icon: ShieldCheck,
    title: "Control without friction",
    text: "Audit-ready clarity at every layer.",
  },
];

const heroStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.065, delayChildren: 0.04 },
  },
};

const heroItem = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  },
};

const listStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

function createParticles(count) {
  return Array.from({ length: count }, (_, i) => {
    const s = Math.sin(i * 12.9898 + i * i * 0.01) * 43758.5453;
    const t = s - Math.floor(s);
    const u = Math.cos(i * 78.233 + 2.1) * 12345.6789;
    const v = u - Math.floor(u);
    return {
      id: i,
      left: `${8 + t * 84}%`,
      top: `${6 + v * 88}%`,
      delay: i * 0.12,
      size: 1.5 + (i % 4) * 0.85,
      duration: 5.5 + (i % 5) * 1.2,
    };
  });
}

export default function LoginPage() {
  const { theme } = useAppTheme();
  const { unlock } = useAuth();
  const reduceMotion = useReducedMotion();
  const rootRef = useRef(null);
  const cardRef = useRef(null);
  const tiltMx = useMotionValue(0);
  const tiltMy = useMotionValue(0);
  const springTiltX = useSpring(tiltMx, { stiffness: 260, damping: 32, mass: 0.4 });
  const springTiltY = useSpring(tiltMy, { stiffness: 260, damping: 32, mass: 0.4 });
  const rotateY = useTransform(springTiltX, [-0.5, 0.5], [13, -13]);
  const rotateX = useTransform(springTiltY, [-0.5, 0.5], [-9, 9]);

  const particles = useMemo(() => createParticles(28), []);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [hudTick, setHudTick] = useState(0);
  const [creditHot, setCreditHot] = useState(false);

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

  useEffect(() => {
    const id = window.setInterval(() => setHudTick((t) => (t + 1) % 1000), 1200);
    return () => window.clearInterval(id);
  }, []);

  const onPointerMove = useCallback((e) => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    el.style.setProperty("--mx", `${x}%`);
    el.style.setProperty("--my", `${y}%`);
  }, []);

  const onPointerLeave = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "42%");
  }, []);

  const onCardPointerMove = useCallback(
    (e) => {
      if (reduceMotion) return;
      const el = cardRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      tiltMx.set(Math.max(-0.5, Math.min(0.5, px)));
      tiltMy.set(Math.max(-0.5, Math.min(0.5, py)));
    },
    [reduceMotion, tiltMx, tiltMy]
  );

  const onCardPointerLeave = useCallback(() => {
    tiltMx.set(0);
    tiltMy.set(0);
  }, [tiltMx, tiltMy]);

  const submit = useCallback(() => {
    const p = password.trim();
    if (!p) {
      setError("Enter your workspace password.");
      setShake(false);
      requestAnimationFrame(() => setShake(true));
      return;
    }
    if (p !== ACCESS_PASSWORD) {
      setError("That password doesn’t match. Try again.");
      setShake(false);
      requestAnimationFrame(() => setShake(true));
      return;
    }
    setError("");
    setBusy(true);
    window.setTimeout(() => {
      unlock();
    }, 420);
  }, [password, unlock]);

  const cardSpring = reduceMotion
    ? {}
    : { type: "spring", stiffness: 420, damping: 36, mass: 0.85 };

  return (
    <div
      ref={rootRef}
      className="login-page"
      data-theme={theme === "light" ? "light" : "dark"}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <div className="login-page-bg" aria-hidden />
      <div className="login-page-aurora" aria-hidden />
      <div className="login-page-spotlight" aria-hidden />
      <div className="login-page-vignette" aria-hidden />
      <div className="login-page-grid" aria-hidden />
      <div className="login-page-noise" aria-hidden />
      {!reduceMotion ? (
        <>
          <div className="login-page-scanline" aria-hidden />
          <div className="login-page-particles" aria-hidden>
            {particles.map((p) => (
              <motion.span
                key={p.id}
                className="login-page-particle"
                style={{
                  left: p.left,
                  top: p.top,
                  width: p.size,
                  height: p.size,
                }}
                animate={{
                  opacity: [0.08, 0.45, 0.1],
                  y: [0, -18, 0],
                  scale: [1, 1.4, 1],
                }}
                transition={{
                  duration: p.duration,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: p.delay,
                }}
              />
            ))}
          </div>
        </>
      ) : null}
      <motion.div
        className="login-page-orb login-page-orb--a"
        aria-hidden
        animate={
          reduceMotion
            ? { opacity: 0.4 }
            : { opacity: [0.32, 0.48, 0.32], scale: [1, 1.06, 1] }
        }
        transition={
          reduceMotion ? { duration: 0 } : { duration: 10, repeat: Infinity, ease: "easeInOut" }
        }
      />
      <motion.div
        className="login-page-orb login-page-orb--b"
        aria-hidden
        animate={reduceMotion ? { opacity: 0.18 } : { opacity: [0.16, 0.32, 0.16] }}
        transition={
          reduceMotion ? { duration: 0 } : { duration: 12, repeat: Infinity, ease: "easeInOut" }
        }
      />

      <div className="login-page-shell">
        <section className="login-page-hero" aria-label="Alloc8 overview">
          <motion.div
            className="login-page-hero-inner"
            variants={heroStagger}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={heroItem} className="login-page-hero-badge-wrap">
              <div className="login-page-hero-badge">
                <span className="login-page-hero-badge-pulse" aria-hidden />
                Next-gen workforce OS
              </div>
            </motion.div>
            <motion.div variants={heroItem}>
              <span className="alloc8-wordmark login-page-hero-wordmark" aria-label="Alloc8">
                Alloc<span className="alloc8-wordmark-eight">8</span>
              </span>
            </motion.div>
            <motion.h1 className="login-page-hero-title" variants={heroItem}>
              <span className="login-page-hero-title-line">Precision allocation.</span>
              <span className="login-page-hero-title-line login-page-hero-title-line--grad">
                Engineered for scale.
              </span>
            </motion.h1>
            <motion.p className="login-page-hero-lead" variants={heroItem}>
              A calm, decisive surface for how people and projects move — minimal noise, maximum
              signal.
            </motion.p>
            <motion.ul className="login-page-hero-list" variants={listStagger}>
              {heroBullets.map(({ icon: Icon, title, text }) => (
                <motion.li
                  key={title}
                  className="login-page-hero-item"
                  variants={heroItem}
                  whileHover={
                    reduceMotion
                      ? {}
                      : {
                          x: 8,
                          scale: 1.02,
                          transition: { type: "spring", stiffness: 400, damping: 26 },
                        }
                  }
                >
                  <span className="login-page-hero-item-icon" aria-hidden>
                    <Icon size={20} strokeWidth={1.65} />
                  </span>
                  <span>
                    <span className="login-page-hero-item-title">{title}</span>
                    <span className="login-page-hero-item-text">{text}</span>
                  </span>
                </motion.li>
              ))}
            </motion.ul>
            <motion.p className="login-page-hero-trust" variants={heroItem}>
              <span className="login-page-hero-trust-dot" aria-hidden />
              <span className="login-page-hero-trust-text">
                System nominal · design tokens · WCAG-minded contrast
              </span>
            </motion.p>
          </motion.div>
        </section>

        <motion.div
          ref={cardRef}
          className="login-page-card-tilt"
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0, scale: busy ? 0.988 : 1 }}
          transition={cardSpring}
          style={
            reduceMotion
              ? undefined
              : {
                  rotateX,
                  rotateY,
                  transformPerspective: 1400,
                  transformStyle: "preserve-3d",
                }
          }
          onPointerMove={onCardPointerMove}
          onPointerLeave={onCardPointerLeave}
        >
          <div className="login-page-card-wrap">
            <div className="login-page-card-ring" aria-hidden />
            <div className="login-page-card">
              <div className="login-page-card-sheen" aria-hidden />
              <div className="login-page-card-inner">
                <p className="login-page-card-kicker">Authenticate</p>
                <h2 className="login-page-card-title">Sign in to Alloc8</h2>
                <p className="login-page-card-sub">
                  SSO when connected — or use your workspace password today.
                </p>

                <div className="login-page-sso">
                  <button
                    type="button"
                    className="login-page-google"
                    disabled
                    aria-disabled="true"
                    title="Google sign-in will be enabled when SSO is connected"
                  >
                    <GoogleMark />
                    <span>Continue with Google</span>
                  </button>
                  <p className="login-page-sso-note">SSO pending — visual placeholder.</p>
                </div>

                <div
                  className="login-page-divider login-page-divider--or"
                  role="separator"
                  aria-hidden
                >
                  <span className="login-page-divider-line" />
                  <span className="login-page-divider-or">or</span>
                  <span className="login-page-divider-line" />
                </div>

                <form
                  className="login-page-pwd-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                >
                  <label className="login-page-pwd-label" htmlFor="login-workspace-password">
                    Workspace password
                  </label>
                  <div className="login-page-field">
                    <Lock size={18} strokeWidth={2} aria-hidden />
                    <input
                      id="login-workspace-password"
                      type="password"
                      className={`login-page-input${shake && error ? " login-page-input--error" : ""}`}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                        setShake(false);
                      }}
                      onAnimationEnd={() => setShake(false)}
                      autoComplete="current-password"
                      autoFocus
                      disabled={busy}
                    />
                  </div>

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
                    disabled={busy}
                    whileHover={reduceMotion || busy ? {} : { scale: 1.02 }}
                    whileTap={reduceMotion || busy ? {} : { scale: 0.98 }}
                  >
                    {busy ? (
                      <span className="login-page-submit-busy">
                        <span className="login-page-submit-dots" aria-hidden />
                        Opening…
                      </span>
                    ) : (
                      <span className="login-page-submit-inner">
                        Continue <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
                      </span>
                    )}
                  </motion.button>
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
      </div>

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
        <span className="login-page-hud-seg login-page-hud-seg--ok">ENV READY</span>
        <span className="login-page-hud-sep">·</span>
        <span className="login-page-hud-seg">SIG {String(hudTick).padStart(3, "0")}</span>
        <span className="login-page-hud-sep">·</span>
        <span className="login-page-hud-seg login-page-hud-blink">LIVE</span>
      </footer>
    </div>
  );
}
