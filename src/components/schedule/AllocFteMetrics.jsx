import { allocationFteLabels } from "../../utils/fteDisplay.js";
import "./AllocFteMetrics.css";

/**
 * Stacked FTE/d + FTE/wk for allocation blocks (37.5 h/week).
 */
export function AllocFteMetrics({ alloc, lay, scheduleModel, compact = false, hero = false }) {
  const { dayLabel, weekLabel, compactLabel } = allocationFteLabels(alloc, lay, scheduleModel);

  if (compact) {
    return <span className="lp-alloc-fte lp-alloc-fte--compact">{compactLabel}</span>;
  }

  if (hero) {
    return (
      <span className="lp-alloc-fte lp-alloc-fte--hero">
        <span className="lp-alloc-fte__day">{dayLabel}</span>
        <span className="lp-alloc-fte__week">{weekLabel}</span>
      </span>
    );
  }

  return (
    <span className="lp-alloc-fte">
      <span className="lp-alloc-fte__day">{dayLabel}</span>
      <span className="lp-alloc-fte__week">{weekLabel}</span>
    </span>
  );
}
