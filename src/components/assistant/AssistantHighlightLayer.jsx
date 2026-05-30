import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAssistant } from "../../context/AssistantContext.jsx";
import "./AssistantHighlightLayer.css";

/**
 * Renders a pulsing ring + tooltip over a control the assistant wants to point at.
 * Targets are matched via `[data-alloc8-guide="<target>"]` attributes on real controls.
 */
export default function AssistantHighlightLayer() {
  const { highlight } = useAssistant();
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!highlight?.target) {
      setRect(null);
      return undefined;
    }

    let raf = 0;
    const measure = () => {
      const el = document.querySelector(`[data-alloc8-guide="${CSS.escape(highlight.target)}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    measure();
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [highlight]);

  if (!highlight || !rect) return null;

  const pad = 6;
  const tipBelow = rect.top < 80;

  return createPortal(
    <div className="a8a-hl-root" aria-hidden>
      <div
        className="a8a-hl-ring"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
        }}
      />
      {highlight.message && (
        <div
          className={`a8a-hl-tip ${tipBelow ? "a8a-hl-tip--below" : "a8a-hl-tip--above"}`}
          style={{
            top: tipBelow ? rect.top + rect.height + pad + 8 : rect.top - pad - 8,
            left: rect.left + rect.width / 2,
          }}
        >
          {highlight.message}
        </div>
      )}
    </div>,
    document.body
  );
}
