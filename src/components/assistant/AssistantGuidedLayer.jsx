import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAssistantWorkflow } from "../../context/AssistantWorkflowContext.jsx";
import { getGuideRect } from "../../lib/assistant/uiTargets.js";
import "./AssistantGuidedLayer.css";

function StepBadge({ n }) {
  return <span className="a8a-guide-badge">{n}</span>;
}

export default function AssistantGuidedLayer() {
  const {
    takeoverActive,
    running,
    guideHighlight,
    successPulse,
    ghost,
    activePlan,
    currentStep,
    stepProgress,
    completedStepIds,
  } = useAssistantWorkflow();

  const [maskRect, setMaskRect] = useState(null);
  const [fillText, setFillText] = useState("");
  const [connector, setConnector] = useState(null);

  useEffect(() => {
    if (!guideHighlight?.rect) {
      setMaskRect(null);
      setFillText("");
      return undefined;
    }

    let raf = 0;
    const measure = () => {
      const box = guideHighlight.rect;
      setMaskRect(box);
      if (guideHighlight.fillPreview) {
        setFillText(String(guideHighlight.fillPreview));
      } else {
        setFillText("");
      }
    };

    measure();
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (guideHighlight?.step?.params?.guide) {
          const p = guideHighlight.step.params;
          const updated = getGuideRect(p.guide, p, { scroll: false });
          if (updated?.box) setMaskRect(updated.box);
        } else {
          measure();
        }
      });
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [guideHighlight]);

  useEffect(() => {
    if (!ghost || !maskRect) {
      setConnector(null);
      return;
    }
    setConnector({
      x1: ghost.x,
      y1: ghost.y,
      x2: maskRect.left + maskRect.width / 2,
      y2: maskRect.top + maskRect.height / 2,
    });
  }, [ghost, maskRect]);

  const show = takeoverActive || running || guideHighlight || successPulse;
  if (!show) return null;

  const pad = 10;
  const steps = activePlan?.steps || [];
  const visibleSteps = steps.filter((s) => s.type !== "create_allocation").slice(0, 10);

  return createPortal(
    <div className="a8a-guided-root" aria-hidden>
      {(takeoverActive || guideHighlight) && (
        <svg className="a8a-guided-mask" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <mask id="a8a-spot-mask">
              <rect width="100%" height="100%" fill="white" />
              {maskRect && (
                <rect
                  x={maskRect.left - pad}
                  y={maskRect.top - pad}
                  width={maskRect.width + pad * 2}
                  height={maskRect.height + pad * 2}
                  rx="12"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(4, 7, 16, 0.52)"
            mask="url(#a8a-spot-mask)"
          />
        </svg>
      )}

      {maskRect && guideHighlight && (
        <>
          <div
            className="a8a-guided-ring"
            style={{
              top: maskRect.top - pad,
              left: maskRect.left - pad,
              width: maskRect.width + pad * 2,
              height: maskRect.height + pad * 2,
            }}
          >
            <StepBadge n={guideHighlight.stepIndex} />
          </div>
          {fillText && (
            <div
              className="a8a-guided-fill"
              style={{
                top: maskRect.top + 4,
                left: maskRect.left + 4,
                width: Math.max(maskRect.width - 8, 80),
              }}
            >
              <span className="a8a-guided-fill-text">{fillText}</span>
            </div>
          )}
        </>
      )}

      {connector && (
        <svg className="a8a-guided-connector" aria-hidden>
          <line
            x1={connector.x1}
            y1={connector.y1}
            x2={connector.x2}
            y2={connector.y2}
            className="a8a-guided-connector-line"
          />
        </svg>
      )}

      {successPulse?.rect && (
        <div
          className="a8a-guided-success"
          style={{
            top: successPulse.rect.top - 6,
            left: successPulse.rect.left - 6,
            width: successPulse.rect.width + 12,
            height: successPulse.rect.height + 12,
          }}
        >
          <span className="a8a-guided-success-label">{successPulse.message}</span>
        </div>
      )}

      {takeoverActive && visibleSteps.length > 0 && (
        <div className="a8a-step-dock">
          <div className="a8a-step-dock-head">Guided run</div>
          <ol className="a8a-step-dock-list">
            {visibleSteps.map((s, i) => {
              const done = completedStepIds.includes(s.id);
              const active = currentStep?.id === s.id;
              return (
                <li
                  key={s.id}
                  className={[
                    done ? "a8a-step-dock-item--done" : "",
                    active ? "a8a-step-dock-item--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="a8a-step-dock-num">{done ? "✓" : i + 1}</span>
                  <span className="a8a-step-dock-label">{s.label}</span>
                </li>
              );
            })}
          </ol>
          {stepProgress.total > 0 && (
            <div className="a8a-step-dock-foot">
              Step {stepProgress.index} of {stepProgress.total}
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  );
}
