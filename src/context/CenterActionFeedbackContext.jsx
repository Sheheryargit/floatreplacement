import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, X } from "lucide-react";
import { toast } from "sonner";
import { showAdminAllocationPulse } from "../lib/adminAllocationPulse.js";
import "../components/CenterActionFeedback.css";

/** @typedef {"success" | "error" | "warning"} CenterActionVariant */
/** @typedef {"add" | "update" | "remove"} CenterActionKind */

/**
 * @typedef {{
 *   variant?: CenterActionVariant;
 *   action?: CenterActionKind;
 *   title: string;
 *   subtitle?: string;
 *   duration?: number;
 * }} CenterActionFeedbackOpts
 */

/** @type {null | ((opts: CenterActionFeedbackOpts) => void)} */
let emitCenterFeedback = null;

/**
 * Allocation / schedule feedback pill (no motion — avoids layout shift in the schedule chrome).
 * Falls back to Sonner if the provider is not mounted.
 * @param {CenterActionFeedbackOpts} opts
 */
export function showCenterActionFeedback(opts) {
  const variant = opts.variant ?? "success";
  const action = opts.action;
  if (
    variant === "success" &&
    (action === "add" || action === "update" || action === "remove")
  ) {
    const shown = showAdminAllocationPulse({
      action,
      title: opts.title,
      subtitle: opts.subtitle,
      duration: opts.duration,
    });
    if (shown) return;
  }

  const fn = emitCenterFeedback;
  if (fn) {
    fn(opts);
    return;
  }
  const v = opts.variant ?? "success";
  const desc = opts.subtitle;
  if (v === "error") toast.error(opts.title, { description: desc });
  else if (v === "warning") toast.warning(opts.title, { description: desc });
  else toast.success(opts.title, { description: desc });
}

const CenterFeedbackContext = createContext(
  /** @type {(opts: CenterActionFeedbackOpts) => void} */ () => {}
);

export function useCenterActionFeedback() {
  return useContext(CenterFeedbackContext);
}

/** @type {import("react").Context<(node: HTMLElement | null) => void>} */
const DockContext = createContext(() => {});

/** @type {import("react").Context<HTMLElement | null>} */
const DockElementContext = createContext(null);

/**
 * Attach `ref={useAlloc8ActionFeedbackMount()}` to a host element (e.g. schedule toolbar controls)
 * so allocation feedback portals inside that region instead of the viewport edge.
 */
export function useAlloc8ActionFeedbackMount() {
  return useContext(DockContext);
}

/** Current dock element (for admin allocation pulse and other anchored overlays). */
export function useAlloc8ActionFeedbackDock() {
  return useContext(DockElementContext);
}

export function CenterActionFeedbackProvider({ children }) {
  const [dockEl, setDockEl] = useState(/** @type {null | HTMLElement} */ (null));
  const [feed, setFeed] = useState(
    /** @type {null | { id: number; variant: CenterActionVariant; action: CenterActionKind; title: string; subtitle: string }} */ (
      null
    )
  );
  const timerRef = useRef(null);
  const idRef = useRef(0);

  const portalTarget =
    typeof document !== "undefined" ? dockEl ?? document.body : null;

  const show = useCallback((/** @type {CenterActionFeedbackOpts} */ opts) => {
    const duration = Math.max(750, opts.duration ?? 2100);
    const variant = opts.variant ?? "success";
    /** @type {CenterActionKind} */
    const action =
      variant === "success"
        ? opts.action === "update" || opts.action === "remove"
          ? opts.action
          : "add"
        : "add";
    const title = opts.title;
    const subtitle = opts.subtitle ?? "";
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    idRef.current += 1;
    const id = idRef.current;
    setFeed({ id, variant, action, title, subtitle });
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setFeed((cur) => (cur && cur.id === id ? null : cur));
    }, duration);
  }, []);

  useEffect(() => {
    emitCenterFeedback = show;
    return () => {
      emitCenterFeedback = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [show]);

  const anchored = Boolean(dockEl);
  const rootClass = "caf-root" + (anchored ? " caf-root--anchored" : " caf-root--floating");

  const portal =
    typeof document !== "undefined" && portalTarget
      ? createPortal(
          <div className={rootClass}>
            {feed ? (
              <div
                key={feed.id}
                role="status"
                aria-live="polite"
                className={
                  "caf-pill caf-pill--" +
                  feed.variant +
                  (feed.variant === "success" ? ` caf-pill--action-${feed.action}` : "")
                }
              >
                {feed.variant === "error" ? (
                  <span className="caf-icon caf-icon--error" aria-hidden>
                    <X size={17} strokeWidth={2.2} />
                  </span>
                ) : feed.variant === "warning" ? (
                  <span className="caf-icon caf-icon--warn" aria-hidden>
                    <AlertTriangle size={17} strokeWidth={2.2} />
                  </span>
                ) : (
                  <span className={`caf-icon caf-icon--action-${feed.action}`} aria-hidden>
                    <Check size={17} strokeWidth={2.2} />
                  </span>
                )}
                <span className="caf-pill-text">
                  <span className="caf-pill-title">{feed.title}</span>
                  {feed.subtitle ? <span className="caf-pill-sub">{feed.subtitle}</span> : null}
                </span>
              </div>
            ) : null}
          </div>,
          portalTarget
        )
      : null;

  return (
    <DockContext.Provider value={setDockEl}>
      <DockElementContext.Provider value={dockEl}>
        <CenterFeedbackContext.Provider value={show}>
          {children}
          {portal}
        </CenterFeedbackContext.Provider>
      </DockElementContext.Provider>
    </DockContext.Provider>
  );
}
