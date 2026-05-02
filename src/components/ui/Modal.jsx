import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "./Button.jsx";
import "./Modal.css";

export function Modal({ title, message, onClose }) {
  const reduceMotion = useReducedMotion();
  const panelSpring = reduceMotion
    ? { duration: 0.18, ease: [0.16, 1, 0.3, 1] }
    : { type: "spring", stiffness: 340, damping: 28, mass: 0.82 };
  const handleKey = useCallback(
    (e) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prev;
    };
  }, [handleKey]);

  return createPortal(
    <motion.div
      className="float-modal-root"
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.button
        type="button"
        className="float-modal-backdrop"
        aria-label="Close dialog"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
      />
      <div className="float-modal-center">
        <motion.div
          className="float-modal-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="float-modal-title"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 28 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={
            reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.96, y: 16, filter: "blur(4px)" }
          }
          transition={panelSpring}
        >
          <button
            type="button"
            className="float-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} strokeWidth={2} />
          </button>
          <h2 id="float-modal-title" className="float-modal-title">
            {title}
          </h2>
          <p className="float-modal-message">{message}</p>
          <Button type="button" variant="primary" size="lg" className="float-modal-cta" onClick={onClose}>
            Got it
          </Button>
        </motion.div>
      </div>
    </motion.div>,
    document.body
  );
}
