import { useCallback, useEffect, useRef } from "react";
import { Check, ChevronLeft, ChevronRight, Clock, Square } from "lucide-react";
import {
  departmentDisplayLabel,
  STANDUP_STATUS,
} from "../../utils/standupSession.js";
import "./StandupModeBar.css";

function shortDeptLabel(label, maxLen = 10) {
  const t = String(label || "").trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

function stepHue(deptKey) {
  const s = String(deptKey || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 360;
}

/** Active standup controls — lives in schedule toolbar (no schedule shrink). */
export function StandupModeBar({
  active,
  session,
  currentDept,
  summary,
  orderLength,
  allComplete,
  hasRemaining,
  onEnd,
  onDone,
  onLater,
  onPrev,
  onNext,
  onReviewRemaining,
  onJumpToIndex,
}) {
  const barRef = useRef(null);

  const handleKeyDown = useCallback(
    (e) => {
      if (!active) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onDone();
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        onLater();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onEnd();
      }
    },
    [active, onDone, onEnd, onLater, onNext, onPrev]
  );

  useEffect(() => {
    const el = barRef.current;
    if (!el || !active) return undefined;
    el.focus();
    return undefined;
  }, [active, currentDept]);

  if (!active) return null;

  const currentIndex = session?.currentIndex ?? 0;
  const progressPct =
    orderLength > 0 ? Math.round(((currentIndex + 1) / orderLength) * 100) : 0;

  return (
    <div
      ref={barRef}
      className="standup-bar standup-bar--toolbar"
      data-alloc8-guide="standup-mode-bar"
      tabIndex={-1}
      role="toolbar"
      aria-label="Standup controls"
      onKeyDown={handleKeyDown}
    >
      <div className="standup-bar-shell">
        <div className="standup-bar-leading">
          <span className="standup-bar-kicker">Standup</span>
          <span className="standup-bar-now">{departmentDisplayLabel(currentDept)}</span>
          <div className="standup-bar-meter" aria-hidden>
            <div className="standup-bar-meter-track">
              <div className="standup-bar-meter-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="standup-bar-meter-label">
              {currentIndex + 1}/{orderLength}
            </span>
          </div>
        </div>

        <div className="standup-rail" role="list" aria-label="Department progress">
          {session?.departmentOrder.map((dept, i) => {
            const status = session.statuses[dept] || STANDUP_STATUS.PENDING;
            const isCurrent = i === currentIndex;
            const label = departmentDisplayLabel(dept);
            const hue = stepHue(dept);
            return (
              <div key={dept} className="standup-rail-segment" role="listitem">
                {i > 0 ? (
                  <span
                    className={
                      "standup-rail-line" +
                      (session.statuses[session.departmentOrder[i - 1]] === STANDUP_STATUS.DONE
                        ? " standup-rail-line--done"
                        : "")
                    }
                    aria-hidden
                  />
                ) : null}
                <div className="standup-rail-node">
                  <button
                    type="button"
                    className={
                      "standup-rail-step" +
                      (isCurrent ? " standup-rail-step--current" : "") +
                      ` standup-rail-step--${status}`
                    }
                    style={
                      isCurrent && status === STANDUP_STATUS.PENDING
                        ? { "--standup-step-hue": String(hue) }
                        : undefined
                    }
                    title={label}
                    aria-label={`${label} — ${status}`}
                    aria-current={isCurrent ? "step" : undefined}
                    onClick={() => onJumpToIndex(i)}
                  >
                    {status === STANDUP_STATUS.DONE ? (
                      <Check size={11} strokeWidth={2.75} aria-hidden />
                    ) : status === STANDUP_STATUS.LATER ? (
                      <Clock size={10} strokeWidth={2.25} aria-hidden />
                    ) : (
                      <span className="standup-rail-dot" aria-hidden />
                    )}
                  </button>
                  <span
                    className={
                      "standup-rail-label" + (isCurrent ? " standup-rail-label--current" : "")
                    }
                  >
                    {shortDeptLabel(label)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="standup-bar-actions">
          <button type="button" className="standup-bar-btn standup-bar-btn--nav" onClick={onPrev} aria-label="Previous">
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="standup-bar-btn standup-bar-btn--done" onClick={onDone}>
            <Check size={13} strokeWidth={2.5} />
            Done
          </button>
          <button type="button" className="standup-bar-btn standup-bar-btn--later" onClick={onLater}>
            <Clock size={13} strokeWidth={2.25} />
            Later
          </button>
          <button type="button" className="standup-bar-btn standup-bar-btn--nav" onClick={onNext} aria-label="Next">
            <ChevronRight size={16} />
          </button>
          {allComplete ? (
            <span className="standup-bar-complete" role="status">
              Done
            </span>
          ) : hasRemaining && summary?.pending === 0 ? (
            <button type="button" className="standup-bar-btn standup-bar-btn--review" onClick={onReviewRemaining}>
              Review
            </button>
          ) : null}
          <button type="button" className="standup-bar-btn standup-bar-btn--end" onClick={onEnd}>
            <Square size={11} fill="currentColor" strokeWidth={0} />
            End
          </button>
        </div>
      </div>
    </div>
  );
}
