import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ListOrdered, Sparkles, X } from "lucide-react";
import { useStandupWalkthrough } from "../../context/StandupWalkthroughContext.jsx";
import "./StandupWalkthroughLayer.css";

function measureGuideTarget(targetId) {
  if (!targetId || typeof document === "undefined") return null;
  const el = document.querySelector(`[data-alloc8-guide="${CSS.escape(targetId)}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 1 && r.height < 1) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function dialoguePosition(rect, placement = "auto") {
  if (!rect) {
    return {
      mode: "center",
      cardStyle: {},
      tailClass: "",
    };
  }

  const pad = 10;
  const cardW = 320;
  const cardH = 220;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const below = placement === "below" || (placement === "auto" && rect.top < vh * 0.45);
  const preferRight = rect.left + rect.width / 2 < vw * 0.5;

  let top = below ? rect.top + rect.height + pad + 12 : rect.top - pad - 12;
  let left = rect.left + rect.width / 2;
  let tailClass = below ? "standup-wt-card__tail--top" : "standup-wt-card__tail--bottom";

  if (preferRight && rect.right + cardW + pad * 2 < vw) {
    top = Math.min(Math.max(pad, rect.top + rect.height / 2 - cardH / 2), vh - cardH - pad);
    left = rect.right + pad + 12;
    tailClass = "standup-wt-card__tail--left";
    return {
      mode: "anchored",
      cardStyle: { top, left, transform: "none" },
      tailClass,
    };
  }

  top = Math.min(Math.max(pad, below ? top : top - cardH), vh - cardH - pad);
  left = Math.min(Math.max(cardW / 2 + pad, left), vw - cardW / 2 - pad);

  return {
    mode: "anchored",
    cardStyle: {
      top,
      left,
      transform: below ? "translate(-50%, 0)" : "translate(-50%, -100%)",
    },
    tailClass,
  };
}

export function StandupWalkthroughLayer() {
  const reduceMotion = useReducedMotion();
  const {
    currentStep,
    stepIndex,
    stepCount,
    nextStep,
    skipWalkthrough,
    finishWalkthrough,
  } = useStandupWalkthrough();

  const [targetRect, setTargetRect] = useState(null);

  const remeasure = useCallback(() => {
    if (currentStep?.type !== "spotlight") {
      setTargetRect(null);
      return;
    }
    setTargetRect(measureGuideTarget(currentStep.target));
  }, [currentStep]);

  useLayoutEffect(() => {
    remeasure();
  }, [remeasure, stepIndex]);

  useEffect(() => {
    if (currentStep?.type !== "spotlight") return undefined;
    let raf = 0;
    const onMove = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(remeasure);
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    const retry = window.setInterval(remeasure, 400);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(retry);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [currentStep, remeasure]);

  if (!currentStep) return null;

  const isCenter = currentStep.type === "center";
  const isLast = stepIndex >= stepCount - 1;
  const placement = dialoguePosition(targetRect);
  const pad = 8;
  const hole = targetRect
    ? {
        x: targetRect.left - pad,
        y: targetRect.top - pad,
        w: targetRect.width + pad * 2,
        h: targetRect.height + pad * 2,
        rx: currentStep.target?.includes("panel") ? 14 : 999,
      }
    : null;

  const primaryLabel = currentStep.cta || (isLast ? "Done" : "Next");
  const waitForAction = Boolean(currentStep.waitForUserAction);

  const onPrimary = () => {
    if (isLast) {
      finishWalkthrough();
      return;
    }
    nextStep();
  };

  return createPortal(
    <div
      className={
        "standup-wt-root" + (waitForAction ? " standup-wt-root--interactive" : "")
      }
      role="dialog"
      aria-modal="true"
      aria-labelledby="standup-wt-title"
    >
      {!isCenter && hole ? (
        <svg className="standup-wt-mask" aria-hidden>
          <defs>
            <mask id="standup-wt-spot-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={hole.x}
                y={hole.y}
                width={hole.w}
                height={hole.h}
                rx={hole.rx}
                ry={hole.rx}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(6, 9, 18, 0.62)"
            mask="url(#standup-wt-spot-mask)"
          />
        </svg>
      ) : (
        <div className="standup-wt-backdrop" aria-hidden />
      )}

      {!isCenter && targetRect ? (
        <div
          className="standup-wt-ring"
          style={{
            top: targetRect.top - pad,
            left: targetRect.left - pad,
            width: targetRect.width + pad * 2,
            height: targetRect.height + pad * 2,
            borderRadius: hole?.rx === 999 ? 999 : 14,
          }}
          aria-hidden
        />
      ) : null}

      <motion.div
        className={
          "standup-wt-card" +
          (isCenter ? " standup-wt-card--center" : " standup-wt-card--anchored")
        }
        style={isCenter ? undefined : placement.cardStyle}
        initial={reduceMotion ? false : { opacity: 0, y: isCenter ? 16 : 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 30 }}
      >
        {!isCenter ? <span className={`standup-wt-card__tail ${placement.tailClass}`} aria-hidden /> : null}

        <div className="standup-wt-card__chrome">
          <div className="standup-wt-card__brand">
            <span className="standup-wt-card__icon" aria-hidden>
              {stepIndex === 0 || isLast ? <Sparkles size={15} /> : <ListOrdered size={15} />}
            </span>
            <span className="standup-wt-card__kicker">Standup tour</span>
            <button
              type="button"
              className="standup-wt-card__close"
              aria-label="Skip tour"
              onClick={skipWalkthrough}
            >
              <X size={15} />
            </button>
          </div>

          <div className="standup-wt-card__progress" aria-hidden>
            {Array.from({ length: stepCount }, (_, i) => (
              <span
                key={i}
                className={
                  "standup-wt-card__dot" +
                  (i === stepIndex ? " standup-wt-card__dot--active" : "") +
                  (i < stepIndex ? " standup-wt-card__dot--done" : "")
                }
              />
            ))}
          </div>

          <h2 id="standup-wt-title" className="standup-wt-card__title">
            {currentStep.title}
          </h2>
          <p className="standup-wt-card__body">{currentStep.body}</p>
          {currentStep.hint ? (
            <p className="standup-wt-card__hint">{currentStep.hint}</p>
          ) : null}

          <div className="standup-wt-card__actions">
            <button type="button" className="standup-wt-btn standup-wt-btn--ghost" onClick={skipWalkthrough}>
              Skip tour
            </button>
            {!waitForAction ? (
              <button type="button" className="standup-wt-btn standup-wt-btn--primary" onClick={onPrimary}>
                {primaryLabel}
              </button>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
