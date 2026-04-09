import {
  createContext,
  useContext,
  useCallback,
  useRef,
  useMemo,
  useState,
} from "react";
import { motion } from "framer-motion";
import { isStaticUi } from "../config/uiMode.js";

const SlapContext = createContext(null);

const SHAKE = [0, -10, 8, -6, 4, -2, 0];
const SCALE = [1, 0.98, 1];
const DURATION = 0.42;
const EASE = [0.22, 1, 0.36, 1];

const shellStyle = { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" };

/**
 * Shakes the wrapped subtree; flash overlay is a fixed sibling (not affected by transform).
 * In static UI mode, resolves immediately with no motion.
 */
export function SlapAnimationProvider({ children }) {
  const staticUi = isStaticUi();
  const [slapOn, setSlapOn] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const doneRef = useRef(null);

  const triggerSlap = useCallback(() => {
    if (staticUi) return Promise.resolve();
    return new Promise((resolve) => {
      doneRef.current = resolve;
      setFlashOn(true);
      setSlapOn(true);
    });
  }, [staticUi]);

  const onShakeComplete = useCallback(() => {
    setSlapOn(false);
    const fn = doneRef.current;
    doneRef.current = null;
    fn?.();
  }, []);

  const onFlashComplete = useCallback(() => {
    setFlashOn(false);
  }, []);

  const value = useMemo(() => ({ triggerSlap }), [triggerSlap]);

  if (staticUi) {
    return (
      <SlapContext.Provider value={value}>
        <div className="slap-animation-wrapper" style={shellStyle}>
          {children}
        </div>
      </SlapContext.Provider>
    );
  }

  return (
    <SlapContext.Provider value={value}>
      <motion.div
        className="slap-animation-wrapper"
        initial={false}
        animate={slapOn ? { x: SHAKE, scale: SCALE } : { x: 0, scale: 1 }}
        transition={{ duration: DURATION, ease: EASE }}
        onAnimationComplete={slapOn ? onShakeComplete : undefined}
        style={shellStyle}
      >
        {children}
      </motion.div>
      <motion.div
        className="slap-flash-overlay"
        aria-hidden
        initial={false}
        animate={flashOn ? { opacity: [0, 0.16, 0] } : { opacity: 0 }}
        transition={{ duration: DURATION, ease: EASE }}
        onAnimationComplete={flashOn ? onFlashComplete : undefined}
        style={{
          pointerEvents: "none",
          position: "fixed",
          inset: 0,
          zIndex: 40,
          background:
            "linear-gradient(120deg, rgba(255,95,95,0.14) 0%, rgba(255,255,255,0.1) 45%, rgba(255,95,95,0.08) 100%)",
        }}
      />
    </SlapContext.Provider>
  );
}

export function useSlapAnimation() {
  const ctx = useContext(SlapContext);
  if (!ctx) {
    throw new Error("useSlapAnimation must be used within SlapAnimationProvider");
  }
  return ctx;
}

export function useSlapAnimationOptional() {
  return useContext(SlapContext);
}
