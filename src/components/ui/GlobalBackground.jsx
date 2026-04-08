import { useState, useEffect, useCallback, useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { motion } from "framer-motion";
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
  const particles = useMemo(() => createParticles(reduceMotion ? 0 : 28), [reduceMotion]);

  useEffect(() => {
    const handlePointerMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      document.documentElement.style.setProperty("--mx", `${x}%`);
      document.documentElement.style.setProperty("--my", `${y}%`);
    };
    
    document.documentElement.style.setProperty("--mx", "50%");
    document.documentElement.style.setProperty("--my", "50%");
    
    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

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
          reduceMotion
            ? { opacity: 0.4 }
            : { opacity: [0.32, 0.48, 0.32], scale: [1, 1.06, 1] }
        }
        transition={
          reduceMotion ? { duration: 0 } : { duration: 10, repeat: Infinity, ease: "easeInOut" }
        }
      />
      <motion.div
        className="global-orb global-orb--b"
        animate={reduceMotion ? { opacity: 0.18 } : { opacity: [0.16, 0.32, 0.16] }}
        transition={
          reduceMotion ? { duration: 0 } : { duration: 12, repeat: Infinity, ease: "easeInOut" }
        }
      />
    </div>
  );
}
