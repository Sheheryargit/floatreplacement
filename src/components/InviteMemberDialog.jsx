import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/Button.jsx";
import "./InviteMemberDialog.css";
import "../styles/premium-overlays.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SHRINK_MS = 560;
const SHRINK = { duration: 0.5, ease: [0.4, 0, 0.2, 1] };

/**
 * Invite flow (placeholder): collects email; dialog shrinks + center “Sent”, then Sonner toast.
 * @param {{ open: boolean; onOpenChange: (open: boolean) => void; layout?: "default" | "full" }} props
 */
export function InviteMemberDialog({ open, onOpenChange, layout = "default" }) {
  const reduceMotion = useReducedMotion();
  const [email, setEmail] = useState("");
  const [sendPhase, setSendPhase] = useState("idle");
  const pendingRef = useRef(null);
  const shrinkTimerRef = useRef(null);

  useEffect(() => {
    if (!open) {
      if (shrinkTimerRef.current) {
        clearTimeout(shrinkTimerRef.current);
        shrinkTimerRef.current = null;
      }
      setEmail("");
      setSendPhase("idle");
      pendingRef.current = null;
    }
  }, [open]);

  const finishSend = () => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    setSendPhase("idle");
    toast.success(p.email, {
      description: "Delivery is still a placeholder.",
      className: "alloc8-toast float-schedule-view-toast",
    });
    onOpenChange(false);
  };

  const handleSend = () => {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      toast.error("Invalid email", { description: "Enter a valid email address." });
      return;
    }

    if (reduceMotion) {
      pendingRef.current = { email: trimmed };
      finishSend();
      return;
    }

    pendingRef.current = { email: trimmed };
    setSendPhase("shrinking");
    shrinkTimerRef.current = window.setTimeout(() => {
      shrinkTimerRef.current = null;
      finishSend();
    }, SHRINK_MS);
  };

  useEffect(() => {
    return () => {
      if (shrinkTimerRef.current) clearTimeout(shrinkTimerRef.current);
    };
  }, []);

  const shrinking = sendPhase === "shrinking";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (shrinking) return;
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className={"lp-invite-overlay" + (shrinking ? " lp-invite-overlay--shrink" : "")}
        />

        {shrinking ? (
          <div className="lp-invite-sent-toast-anchor">
            <motion.div
              className="lp-invite-sent-toast"
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, scale: 0.88, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 30, delay: 0.06 }}
            >
              <span className="lp-invite-sent-toast-icon" aria-hidden>
                <Check size={22} strokeWidth={2.5} />
              </span>
              <span className="lp-invite-sent-toast-label">Sent</span>
            </motion.div>
          </div>
        ) : null}

        <Dialog.Content asChild>
          <div className="lp-invite-anchor">
            <motion.div
              className={
                "lp-invite-content" + (layout === "full" ? " lp-invite-content--full" : "")
              }
              style={{ transformOrigin: "center center" }}
              initial={false}
              animate={
                shrinking
                  ? { scale: 0.05, opacity: 0, y: 32, filter: "blur(5px)" }
                  : { scale: 1, opacity: 1, y: 0, filter: "blur(0px)" }
              }
              transition={SHRINK}
            >
              <Dialog.Description className="lp-invite-sr-only">
                Enter an email address, then send an invitation.
              </Dialog.Description>

              <div className="lp-invite-hero">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="lp-invite-close"
                    aria-label="Close"
                    disabled={shrinking}
                  >
                    <X size={18} strokeWidth={2} />
                  </button>
                </Dialog.Close>
                <motion.div
                  className="lp-invite-icon-wrap"
                  initial={reduceMotion ? false : { scale: 0.88, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                >
                  <Send size={28} strokeWidth={2} className="lp-invite-hero-send" />
                </motion.div>
                <Dialog.Title asChild>
                  <h2 className="lp-invite-title">Invite</h2>
                </Dialog.Title>
                <p className="lp-invite-lede">Send a workspace invite link.</p>
              </div>

              <div className="lp-invite-body">
                <div className="lp-invite-field">
                  <label className="lp-invite-label" htmlFor="lp-invite-email">
                    Work email
                  </label>
                  <input
                    id="lp-invite-email"
                    type="email"
                    className="lp-invite-email"
                    placeholder="alex@company.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={shrinking}
                  />
                </div>
              </div>

              <div className="lp-invite-foot">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => onOpenChange(false)}
                  disabled={shrinking}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleSend}
                  disabled={shrinking}
                  className="lp-invite-send-btn"
                >
                  <span>Send</span>
                  <Send size={17} strokeWidth={2.25} className="lp-invite-send-btn-ico" aria-hidden />
                </Button>
              </div>
            </motion.div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
