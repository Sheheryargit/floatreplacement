import { useMemo } from "react";
import { CalendarOff } from "lucide-react";
import {
  truncateForArc,
  publicHolidayArcPathId,
} from "../../utils/publicHolidayDisplay.js";
import "./PublicHolidayTimelineTile.css";

/**
 * Public-holiday cell: bold title + icon + region chip.
 * Curved label only when the segment spans 2+ days (enough width); otherwise a flat caption.
 */
export function PublicHolidayTimelineTile({
  holidayName,
  regionBadge = "",
  colSpan = 1,
  segKey = "ph",
}) {
  const arcId = useMemo(() => publicHolidayArcPathId(segKey), [segKey]);
  const name = (holidayName || "Public holiday").trim() || "Public holiday";
  const useArc = colSpan >= 2;
  const arcLabel = truncateForArc(name, colSpan >= 4 ? 28 : 22);
  const flatLabel = truncateForArc(name, colSpan >= 2 ? 20 : 16);

  const spanTier =
    colSpan >= 4 ? "lp-ph-tile--span-xl" : colSpan >= 2 ? "lp-ph-tile--span-wide" : "";

  return (
    <span
      className={
        `lp-ph-tile ${spanTier}${useArc ? " lp-ph-tile--arc" : " lp-ph-tile--flat"}`.trim()
      }
      aria-hidden
      data-col-span={colSpan}
    >
      <span className="lp-ph-cluster">
        {useArc ? (
          <svg
            className="lp-ph-arc"
            viewBox="0 0 100 26"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
          >
            <defs>
              {/* Arc across the top; text sits on the upper edge (room in viewBox above y=6) */}
              <path id={arcId} d="M 8 18 A 42 14 0 0 0 92 18" fill="none" />
            </defs>
            <text className="lp-ph-arc-text">
              <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
                {arcLabel}
              </textPath>
            </text>
          </svg>
        ) : (
          <span className="lp-ph-flat-title">{flatLabel}</span>
        )}

        <span className="lp-leave-block__icon-pill lp-ph-icon-pill">
          <CalendarOff className="lp-leave-block__icon lp-ph-icon" size={14} strokeWidth={2.35} />
        </span>

        {regionBadge ? (
          <span className="lp-ph-region">{regionBadge}</span>
        ) : (
          <span className="lp-ph-region lp-ph-region--dot" aria-hidden />
        )}
      </span>

      <span className="lp-ph-hover-name">{name}</span>
    </span>
  );
}
