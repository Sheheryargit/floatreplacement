import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { motion } from "framer-motion";
import { isStaticUi } from "../../config/uiMode.js";
import "../../styles/global-bg.css";

function createParticles(count) {
  return Array.from({ length: count }, (_, i) => {
    const size = Math.random() * 8 + 4;
    return {
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size,
      delay: Math.random() * 5,
      duration: 5.5 + (i % 5) * 1.2,
    };
  });
}

export default function GlobalBackground() {
  const reduceMotion = useReducedMotion();
  const staticUi = isStaticUi();
  const lowGpu =
    typeof document !== "undefined" && document.documentElement.dataset.lowGpu === "1";
  const particles = useMemo(
    () => createParticles(reduceMotion || lowGpu || staticUi ? 0 : 12),
    [reduceMotion, lowGpu, staticUi]
  );
  const rafRef = useRef(0);
  const pendingRef = useRef(null);

  useEffect(() => {
    if (staticUi) return undefined;
    const applyPointer = () => {
      rafRef.current = 0;
      const e = pendingRef.current;
      if (!e) return;
      pendingRef.current = null;
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      document.documentElement.style.setProperty("--mx", `${x}%`);
      document.documentElement.style.setProperty("--my", `${y}%`);
    };

    const handlePointerMove = (e) => {
      pendingRef.current = e;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(applyPointer);
    };

    document.documentElement.style.setProperty("--mx", "50%");
    document.documentElement.style.setProperty("--my", "50%");

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [staticUi]);

  if (staticUi) {
    return <div className="global-bg-container global-bg-container--static" aria-hidden />;
  }

  return (
    <div className="global-bg-container" aria-hidden="true">
      <div className="global-bg" />
      <div className="global-aurora" />
      <div className="global-spotlight" />
      <div className="global-vignette" />
      <div className="global-grid" />
      <div className="global-noise" />
      {!reduceMotion && (
        <>
          <div className="global-scanline" />
          <div className="global-particles">
            {particles.map((p) => (
              <span
                key={p.id}
                className="global-particle"
                style={{
                  left: p.left,
                  top: p.top,
                  width: p.size,
                  height: p.size,
                  animation: `particleFloat ${p.duration}s ease-in-out ${p.delay}s infinite`,
                }}
              />
            ))}
          </div>
        </>
      )}
      <motion.div
        className="global-orb global-orb--a"
        animate={
          reduceMotion || lowGpu
            ? { opacity: 0.4 }
            : { opacity: [0.32, 0.48, 0.32], scale: [1, 1.06, 1] }
        }
        transition={
          reduceMotion || lowGpu ? { duration: 0 } : { duration: 10, repeat: Infinity, ease: "easeInOut" }
        }
      />
      <motion.div
        className="global-orb global-orb--b"
        animate={reduceMotion || lowGpu ? { opacity: 0.18 } : { opacity: [0.16, 0.32, 0.16] }}
        transition={
          reduceMotion || lowGpu ? { duration: 0 } : { duration: 12, repeat: Infinity, ease: "easeInOut" }
        }
      />
    </div>
  );
}
