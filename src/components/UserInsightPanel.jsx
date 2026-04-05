import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { allocationHasPersonSchedule, countWeekdaysBetweenKeys } from "../utils/peopleSort.js";
import { resolveColorForProjectLabel } from "../utils/projectColors.js";
import "./UserInsightPanel.css";

/**
 * Aggregate work allocations by project label for one person (excludes leave).
 */
function projectHoursForPerson(personId, allocations) {
  const map = new Map();
  let total = 0;
  for (const a of allocations) {
    if (a.isLeave || !allocationHasPersonSchedule(a, personId)) continue;
    const wd = countWeekdaysBetweenKeys(a.startDate, a.endDate);
    const h = wd * (parseFloat(a.hoursPerDay) || 0);
    const key = (a.project || "").trim() || "Unassigned";
    map.set(key, (map.get(key) || 0) + h);
    total += h;
  }
  return { map, total };
}

const UserInsightPanel = memo(function UserInsightPanel({ person, allocations, theme = "dark" }) {
  const { rows, utilizationPct, maxBar } = useMemo(() => {
    const { map, total } = projectHoursForPerson(person.id, allocations);
    const entries = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxBar = Math.max(...entries.map(([, h]) => h), 1e-6);
    /** Rough load vs ~160h month (design token: soft cap for display only) */
    const utilizationPct = Math.min(100, Math.round((total / 160) * 100));
    return { rows: entries, utilizationPct, maxBar };
  }, [person.id, allocations]);

  return (
    <div className="user-insight-panel" data-theme={theme === "light" ? "light" : "dark"} role="tooltip">
      <div className="user-insight-panel__head">
        <span className="user-insight-panel__name">{person.name}</span>
        <span className="user-insight-panel__util" aria-live="polite">
          <span className="user-insight-panel__util-val">{utilizationPct}</span>
          <span className="user-insight-panel__util-suffix">% load</span>
        </span>
      </div>
      <p className="user-insight-panel__hint">Approx. booked hours by project (all dates)</p>
      <div className="user-insight-panel__chart" role="img" aria-label="Project hours breakdown">
        {rows.length === 0 ? (
          <span className="user-insight-panel__empty">No work allocations yet</span>
        ) : (
          rows.map(([label, hours]) => {
            const pct = Math.round((hours / maxBar) * 100);
            const hex = resolveColorForProjectLabel(label, []);
            return (
              <div key={label} className="user-insight-panel__row">
                <span className="user-insight-panel__tag" style={{ borderColor: `${hex}66`, color: hex }}>
                  {label.length > 22 ? `${label.slice(0, 21)}…` : label}
                </span>
                <div className="user-insight-panel__bar-wrap" aria-hidden>
                  <motion.div
                    className="user-insight-panel__bar"
                    style={{ backgroundColor: hex }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <span className="user-insight-panel__hrs">{hours < 10 ? hours.toFixed(1) : Math.round(hours)}h</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

export default UserInsightPanel;
