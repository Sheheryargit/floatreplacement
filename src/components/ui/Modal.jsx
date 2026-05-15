import { useId } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { isStaticUi } from "../../config/uiMode.js";
import { Button } from "./Button.jsx";
import "./Modal.css";

export function Modal({ title, message, onClose }) {
  const reduceMotion = useReducedMotion();
  /** `static-ui.css` clamps transition duration on all nodes; opacity fades can stall at initial (backdrop visible, panel invisible). */
  const skipEntranceFade = reduceMotion || isStaticUi();
  const titleId = useId();
  const descId = useId();
  const panelSpring = reduceMotion
    ? { duration: 0.18, ease: [0.16, 1, 0.3, 1] }
    : { type: "spring", stiffness: 340, damping: 28, mass: 0.82 };

  return (
    <Dialog.Root open modal onOpenChange={(openState) => !openState && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            className="float-modal-backdrop"
            initial={skipEntranceFade ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={skipEntranceFade ? { duration: 0 } : { duration: 0.18 }}
          />
        </Dialog.Overlay>
        <div className="float-modal-center float-modal-center--radix">
          <Dialog.Content asChild>
            <motion.div
              className="float-modal-panel"
              initial={
                skipEntranceFade ? false : { opacity: 0, scale: 0.9, y: 28 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={skipEntranceFade ? { duration: 0 } : panelSpring}
            >
              <Dialog.Close asChild>
                <button type="button" className="float-modal-close" aria-label="Close">
                  <X size={18} strokeWidth={2} />
                </button>
              </Dialog.Close>
              <Dialog.Title asChild>
                <h2 id={titleId} className="float-modal-title">
                  {title}
                </h2>
              </Dialog.Title>
              <Dialog.Description asChild>
                <p id={descId} className="float-modal-message">
                  {message}
                </p>
              </Dialog.Description>
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="float-modal-cta"
                onClick={onClose}
              >
                Got it
              </Button>
            </motion.div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
