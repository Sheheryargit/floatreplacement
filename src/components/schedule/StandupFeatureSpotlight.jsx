import { useReducedMotion } from "framer-motion";
import "./StandupFeatureSpotlight.css";

/**
 * One-time glow + "New" badge around Standup entry points.
 * @param {{ show: boolean, variant?: "pill" | "nav", onDismiss?: () => void, children: import('react').ReactNode }} props
 */
export function StandupFeatureSpotlight({ show, variant = "pill", onDismiss, children }) {
  const reduceMotion = useReducedMotion();

  if (!show) return children;

  return (
    <span
      className={
        "standup-spotlight" +
        ` standup-spotlight--${variant}` +
        (reduceMotion ? " standup-spotlight--static" : "")
      }
    >
      {!reduceMotion ? (
        <>
          <span className="standup-spotlight-orbit" aria-hidden />
          <span className="standup-spotlight-ring standup-spotlight-ring--a" aria-hidden />
          <span className="standup-spotlight-ring standup-spotlight-ring--b" aria-hidden />
        </>
      ) : null}
      <span className="standup-spotlight-badge" aria-hidden>
        New
      </span>
      <span
        className="standup-spotlight-hit"
        onClickCapture={() => onDismiss?.()}
        onKeyDownCapture={(e) => {
          if (e.key === "Enter" || e.key === " ") onDismiss?.();
        }}
      >
        {children}
      </span>
    </span>
  );
}
