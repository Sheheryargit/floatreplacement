import { useMemo } from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import "./PeopleUtilizationStrip.css";

function clamp01(x) {
  return Math.max(0, Math.min(1, Number(x) || 0));
}

function fmtHours(n) {
  const x = Number(n) || 0;
  return `${x.toLocaleString("en-AU", { maximumFractionDigits: 1, minimumFractionDigits: 0 })}h`;
}

export function PeopleUtilizationStrip({ peopleRows, onPickPerson }) {
  const rows = useMemo(() => [...(peopleRows || [])].sort((a, b) => b.scheduledWorkHours - a.scheduledWorkHours), [peopleRows]);

  return (
    <div className="dd-strip">
      <div className="dd-strip-head">
        <Activity size={16} strokeWidth={2.1} aria-hidden />
        People load (scheduled vs capacity)
        <span className="dd-strip-count" aria-label={`${rows.length} people`}>
          {rows.length}
        </span>
      </div>
      <div className="dd-strip-body">
        {rows.map((r, idx) => {
          const cap = Number(r.capacityHours) || 0;
          const sched = Number(r.scheduledWorkHours) || 0;
          const pct = cap > 0 ? clamp01(sched / cap) : 0;
          const name = r.person?.name || "Person";
          const tone = pct >= 1.01 ? "over" : pct >= 0.85 ? "near" : pct >= 0.55 ? "ok" : "low";
          return (
            <motion.button
              key={r.id}
              type="button"
              className={`dd-strip-row dd-strip-row--${tone}`}
              onClick={() => onPickPerson?.(r)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1], delay: idx * 0.015 }}
              title={`${name} · ${fmtHours(sched)} scheduled / ${fmtHours(cap)} capacity`}
            >
              <span className="dd-strip-name">{name}</span>
              <span className="dd-strip-bar" aria-hidden>
                <span className="dd-strip-bar-fill" style={{ width: `${Math.min(1, pct) * 100}%` }} />
              </span>
              <span className="dd-strip-meta">{Math.round(pct * 100)}%</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

