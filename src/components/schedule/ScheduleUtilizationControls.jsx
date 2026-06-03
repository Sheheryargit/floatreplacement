import { Check, Clock, Percent } from "lucide-react";
import { FTE_PERSON_RAIL_OPTIONS } from "../../config/scheduleUiPrefs.js";
import { FTE_HOURS_PER_WEEK } from "../../utils/fteDisplay.js";
import "./ScheduleUtilizationControls.css";

/**
 * Date range insights: hours / % / FTE + optional person-row display when FTE is active.
 */
export function ScheduleUtilizationControls({
  utilizationMode,
  setUtilizationMode,
  ftePersonRail,
  setFtePersonRail,
}) {
  return (
    <>
      <div className="lp-popover-divider" />
      <div className="lp-popover-title">Date range insights</div>
      <div className="lp-util-block">
        <span className="lp-util-label">Show utilization in</span>
        <div className="lp-segment" role="group" aria-label="Utilization unit">
          <button
            type="button"
            className={utilizationMode === "hours" ? "lp-seg-active" : ""}
            onClick={() => setUtilizationMode("hours")}
            title="Hours"
          >
            <Clock size={14} />
          </button>
          <button
            type="button"
            className={utilizationMode === "percent" ? "lp-seg-active" : ""}
            onClick={() => setUtilizationMode("percent")}
            title="Percent"
          >
            <Percent size={14} />
          </button>
          <button
            type="button"
            className={
              utilizationMode === "fte" ? "lp-seg-active lp-seg-fte" : "lp-seg-fte"
            }
            onClick={() => setUtilizationMode("fte")}
            title="Full-time equivalent"
          >
            FTE
          </button>
        </div>
        {utilizationMode === "fte" ? (
          <p className="lp-util-fte-caption">
            1 FTE = {FTE_HOURS_PER_WEEK} hours per week (7.5h per day)
          </p>
        ) : null}
      </div>

      {utilizationMode === "fte" ? (
        <div className="lp-util-block lp-util-block--fte-rail">
          <span className="lp-util-label">Person row &amp; blocks</span>
          <p className="lp-util-fte-rail-hint">
            Choose what appears under each name and on project blocks ({FTE_HOURS_PER_WEEK}h = 1
            FTE/week).
          </p>
          <div
            className="lp-fte-rail-choices"
            role="radiogroup"
            aria-label="FTE person row and block display"
          >
            {FTE_PERSON_RAIL_OPTIONS.map((opt) => {
              const active = ftePersonRail === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={
                    "lp-fte-rail-choice" + (active ? " lp-fte-rail-choice--active" : "")
                  }
                  onClick={() => setFtePersonRail(opt.id)}
                >
                  <span className="lp-fte-rail-choice__mark" aria-hidden>
                    {active ? <Check size={12} strokeWidth={3} /> : null}
                  </span>
                  <span className="lp-fte-rail-choice__text">
                    <span className="lp-fte-rail-choice__label">{opt.label}</span>
                    <span className="lp-fte-rail-choice__detail">{opt.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
