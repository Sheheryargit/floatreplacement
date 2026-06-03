import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  registerAdminAllocationPulseEmitter,
  setAdminAllocationPulseEnabled,
} from "../../lib/adminAllocationPulse.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useAlloc8ActionFeedbackDock } from "../../context/CenterActionFeedbackContext.jsx";
import "./AdminAllocationPulse.css";

const DEFAULT_DURATION_MS = 3400;

const enter = {
  opacity: 0,
  y: -14,
  scale: 0.94,
  filter: "blur(6px)",
};
const center = {
  opacity: 1,
  y: 0,
  scale: 1,
  filter: "blur(0px)",
};
const exit = {
  opacity: 0,
  y: -10,
  scale: 0.97,
  filter: "blur(4px)",
};

function PulseIcon({ action }) {
  const size = 18;
  const stroke = 2.35;
  if (action === "update") return <Pencil size={size} strokeWidth={stroke} aria-hidden />;
  if (action === "remove") return <Trash2 size={size} strokeWidth={stroke} aria-hidden />;
  return <Plus size={size} strokeWidth={stroke} aria-hidden />;
}

/** Allocation save feedback toast (session-local, all signed-in users). */
export function AdminAllocationPulseHost() {
  const { isAuthenticated } = useAuth();
  const feedbackDock = useAlloc8ActionFeedbackDock();
  const reduceMotion = useReducedMotion();
  const [item, setItem] = useState(
    /** @type {null | { id: number; action: string; title: string; subtitle: string; duration: number; onUndo?: () => void }} */ (
      null
    )
  );
  const timerRef = useRef(null);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setItem((cur) => (cur && cur.id === id ? null : cur));
  }, []);

  const show = useCallback(
    (/** @type {import("../../lib/adminAllocationPulse.js").AdminAllocationPulseOpts} */ opts) => {
      const duration = Math.max(2200, opts.duration ?? DEFAULT_DURATION_MS);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      idRef.current += 1;
      const id = idRef.current;
      setItem({
        id,
        action: opts.action,
        title: opts.title,
        subtitle: opts.subtitle ?? "",
        duration,
        onUndo: opts.onUndo,
      });
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        dismiss(id);
      }, duration);
    },
    [dismiss]
  );

  useEffect(() => {
    setAdminAllocationPulseEnabled(isAuthenticated);
    if (!isAuthenticated) {
      setItem(null);
      return () => setAdminAllocationPulseEnabled(false);
    }
    return registerAdminAllocationPulseEmitter(show);
  }, [isAuthenticated, show]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setAdminAllocationPulseEnabled(false);
    };
  }, []);

  if (typeof document === "undefined") return null;

  const portalTarget = feedbackDock ?? document.body;
  const anchored = Boolean(feedbackDock);
  const hostClass = "aap-host" + (anchored ? " aap-host--anchored" : " aap-host--floating");

  const transition = reduceMotion
    ? { duration: 0.12 }
    : { type: "spring", stiffness: 420, damping: 32, mass: 0.82 };

  const progressTransition = reduceMotion
    ? { duration: item?.duration ? item.duration / 1000 : 3.4, ease: "linear" }
    : { duration: item?.duration ? item.duration / 1000 : 3.4, ease: [0.33, 0, 0.2, 1] };

  return createPortal(
    <div className={hostClass} aria-live="polite">
      <AnimatePresence mode="wait">
        {item ? (
          <motion.div
            key={item.id}
            role="status"
            className={`aap-card aap-card--${item.action}`}
            initial={enter}
            animate={center}
            exit={exit}
            transition={transition}
          >
            {!reduceMotion ? (
              <motion.span
                className="aap-shimmer"
                aria-hidden
                initial={{ x: "-120%" }}
                animate={{ x: "120%" }}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
              />
            ) : null}
            <span className="aap-icon">
              <PulseIcon action={item.action} />
            </span>
            <div className="aap-body">
              <div className="aap-head">
                <span className="aap-title">{item.title}</span>
                <span className="aap-badge">Saved</span>
              </div>
              {item.subtitle ? <span className="aap-sub">{item.subtitle}</span> : null}
              {item.onUndo ? (
                <button
                  type="button"
                  className="aap-undo"
                  onClick={() => {
                    item.onUndo?.();
                    dismiss(item.id);
                  }}
                >
                  Undo
                </button>
              ) : null}
            </div>
            <motion.span
              className="aap-progress"
              aria-hidden
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={progressTransition}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>,
    portalTarget
  );
}
