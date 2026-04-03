import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useAppTheme } from "../../context/ThemeContext.jsx";
import "./AnimatedAppLoader.css";

const ORBIT = 0;
const BARS = 1;
const BLOOM = 2;
const MESH = 3;
const RIPPLE = 4;
const MODES = [ORBIT, BARS, BLOOM, MESH, RIPPLE];

function OrbitDots({ light }) {
  const c = light ? "rgba(79,106,230,0.85)" : "rgba(139,168,255,0.9)";
  const dim = light ? "rgba(79,106,230,0.2)" : "rgba(139,168,255,0.15)";
  return (
    <div className="float-loader-orbit" aria-hidden>
      <motion.div
        className="float-loader-orbit-ring"
        animate={{ rotate: 360 }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
      >
        {[0, 120, 240].map((deg) => (
          <span
            key={deg}
            className="float-loader-orbit-dot"
            style={{
              background: c,
              boxShadow: `0 0 14px ${c}`,
              transform: `rotate(${deg}deg) translateY(-22px)`,
            }}
          />
        ))}
      </motion.div>
      <span className="float-loader-orbit-core" style={{ background: dim, borderColor: c }} />
    </div>
  );
}

function WaveBars({ light }) {
  const c = light ? "#4f6ae6" : "#8ba8ff";
  return (
    <div className="float-loader-bars" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span
          key={i}
          className="float-loader-bar"
          style={{ background: c }}
          animate={{ scaleY: [0.35, 1, 0.35], opacity: [0.45, 1, 0.45] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.12,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function WaveBarsStatic({ light }) {
  const c = light ? "#4f6ae6" : "#8ba8ff";
  const heights = [0.45, 0.72, 1, 0.68, 0.52];
  return (
    <div className="float-loader-bars" aria-hidden>
      {heights.map((s, i) => (
        <span
          key={i}
          className="float-loader-bar"
          style={{ background: c, transform: `scaleY(${s})`, opacity: 0.85 }}
        />
      ))}
    </div>
  );
}

function BloomPulse({ light }) {
  const c = light ? "rgba(79,106,230,0.45)" : "rgba(108,140,255,0.5)";
  return (
    <div className="float-loader-bloom" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="float-loader-bloom-ring"
          style={{ borderColor: c }}
          initial={{ scale: 0.4, opacity: 0.8 }}
          animate={{ scale: 1.8 + i * 0.35, opacity: 0 }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            delay: i * 0.45,
            ease: "easeOut",
          }}
        />
      ))}
      <span className="float-loader-bloom-core" style={{ background: c }} />
    </div>
  );
}

function MeshGlow({ light }) {
  const a = light
    ? "radial-gradient(circle at 30% 30%, rgba(79,106,230,0.55), transparent 55%)"
    : "radial-gradient(circle at 30% 30%, rgba(108,140,255,0.5), transparent 55%)";
  const b = light
    ? "radial-gradient(circle at 70% 70%, rgba(167,139,250,0.4), transparent 50%)"
    : "radial-gradient(circle at 70% 70%, rgba(167,139,250,0.35), transparent 50%)";
  return (
    <motion.div
      className="float-loader-mesh"
      style={{ background: `${a}, ${b}`, backgroundSize: "200% 200%" }}
      animate={{
        backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
        opacity: [0.75, 1, 0.75],
      }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    />
  );
}

function RippleGrid({ light }) {
  const c = light ? "rgba(79,106,230,0.35)" : "rgba(139,168,255,0.3)";
  return (
    <div className="float-loader-ripple-grid" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => i).map((i) => (
        <motion.span
          key={i}
          className="float-loader-ripple-cell"
          style={{ background: c }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.85, 0.25] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: (i % 3 + Math.floor(i / 3)) * 0.1,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/**
 * Full-viewport loader — random visual mode on each mount (refresh, Suspense, workspace boot).
 */
export default function AnimatedAppLoader() {
  const { theme } = useAppTheme();
  const light = theme === "light";
  const reduceMotion = useReducedMotion();
  const mode = useMemo(() => MODES[Math.floor(Math.random() * MODES.length)], []);

  return (
    <motion.div
      className="float-app-loader"
      role="status"
      aria-busy="true"
      aria-label="Loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="float-app-loader-rail" aria-hidden>
        {!reduceMotion ? (
          <motion.div
            className="float-app-loader-rail-glow"
            animate={{ x: ["-40%", "140%"] }}
            transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : (
          <div className="float-app-loader-rail-glow float-app-loader-rail-glow-static" />
        )}
      </div>
      <div className="float-app-loader-stage">
        <motion.div
          className="float-app-loader-mark"
          initial={reduceMotion ? false : { scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduceMotion ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 28 }}
        >
          {reduceMotion ? (
            <WaveBarsStatic light={light} />
          ) : (
            <>
              {mode === ORBIT && <OrbitDots light={light} />}
              {mode === BARS && <WaveBars light={light} />}
              {mode === BLOOM && <BloomPulse light={light} />}
              {mode === MESH && <MeshGlow light={light} />}
              {mode === RIPPLE && <RippleGrid light={light} />}
            </>
          )}
        </motion.div>
        <motion.p
          className="float-app-loader-caption"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduceMotion ? 0 : 0.12, duration: 0.35 }}
        >
          Loading workspace…
        </motion.p>
      </div>
    </motion.div>
  );
}
