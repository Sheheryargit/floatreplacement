import { motion } from "framer-motion";
import { Briefcase, Clock3, Gauge, Palmtree, Sparkles, Users } from "lucide-react";
import "./KpiCards.css";

function fmtHours(n) {
  const x = Number(n) || 0;
  return `${x.toLocaleString("en-AU", { maximumFractionDigits: 1, minimumFractionDigits: 0 })}h`;
}

function fmtPct(n) {
  const x = Number(n) || 0;
  return `${Math.max(0, Math.min(100, Math.round(x)))}%`;
}

export function KpiCards({ kpis, onPick }) {
  const items = [
    { key: "people", label: "People", value: String(kpis?.peopleCount ?? 0), Icon: Users, clickable: false },
    { key: "cap", label: "Capacity", value: fmtHours(kpis?.capacityHours), Icon: Sparkles, clickable: false },
    { key: "scheduled", label: "Scheduled", value: fmtHours(kpis?.scheduledWorkHours), Icon: Briefcase, clickable: true },
    { key: "free", label: "Free", value: fmtHours(kpis?.freeHours), Icon: Clock3, clickable: true },
    { key: "leave", label: "Leave", value: fmtHours(kpis?.leaveHours), Icon: Palmtree, clickable: true },
    { key: "util", label: "Utilization", value: fmtPct(kpis?.utilizationPercent), Icon: Gauge, clickable: true },
  ];

  return (
    <div className="dd-kpis" role="group" aria-label="Key metrics">
      {items.map(({ key, label, value, Icon, clickable }, idx) => (
        <motion.button
          key={key}
          type="button"
          className={"dd-kpi" + (clickable ? " dd-kpi--click" : "")}
          onClick={() => clickable && onPick?.(key)}
          title={clickable ? `Open ${label} breakdown` : undefined}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1], delay: idx * 0.03 }}
        >
          <div className="dd-kpi-ic" aria-hidden>
            <Icon size={16} strokeWidth={2.1} />
          </div>
          <div className="dd-kpi-body">
            <div className="dd-kpi-label">{label}</div>
            <div className="dd-kpi-value">{value}</div>
          </div>
        </motion.button>
      ))}
    </div>
  );
}

