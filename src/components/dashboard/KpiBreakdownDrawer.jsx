import { useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { isStaticUi } from "../../config/uiMode.js";
import "./KpiBreakdownDrawer.css";

function fmtHours(n) {
  const x = Number(n) || 0;
  return `${x.toLocaleString("en-AU", { maximumFractionDigits: 1, minimumFractionDigits: 0 })}h`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function toneFromPct(pct, key) {
  if (key === "free") return pct >= 60 ? "low" : pct >= 35 ? "ok" : "near";
  // scheduled/util/billable: higher is “hotter”
  if (pct >= 105) return "over";
  if (pct >= 85) return "near";
  if (pct >= 55) return "ok";
  return "low";
}

export function KpiBreakdownDrawer({ open, onOpenChange, kpiKey, peopleRows, rangeLabel }) {
  const reduceMotion = useReducedMotion();
  const skip = reduceMotion || isStaticUi();

  const title = useMemo(() => {
    if (kpiKey === "scheduled") return "Scheduled work (ranked)";
    if (kpiKey === "free") return "Free capacity (ranked)";
    if (kpiKey === "leave") return "Leave / holidays (ranked)";
    if (kpiKey === "util") return "Utilization % (ranked)";
    if (kpiKey === "billable") return "Billable hours (ranked)";
    if (kpiKey === "nonBillable") return "Non-billable hours (ranked)";
    return "Breakdown";
  }, [kpiKey]);

  const rows = useMemo(() => {
    const list = [...(peopleRows || [])];
    const valueOf = (r) => {
      if (kpiKey === "scheduled") return Number(r.scheduledWorkHours) || 0;
      if (kpiKey === "free") return Number(r.freeHours) || 0;
      if (kpiKey === "leave") return Number(r.leaveHours) || 0;
      if (kpiKey === "billable") return Number(r.billableHours) || 0;
      if (kpiKey === "nonBillable") return Number(r.nonBillableHours) || 0;
      if (kpiKey === "util") {
        const cap = Number(r.capacityHours) || 0;
        const sched = Number(r.scheduledWorkHours) || 0;
        return cap > 0 ? (sched / cap) * 100 : 0;
      }
      return 0;
    };
    list.sort((a, b) => valueOf(b) - valueOf(a));
    const max = list.length ? valueOf(list[0]) : 0;
    return list.map((r) => ({ r, v: valueOf(r), max }));
  }, [peopleRows, kpiKey]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            className="dd-kpi-backdrop"
            initial={skip ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={skip ? { duration: 0 } : { duration: 0.18 }}
          />
        </Dialog.Overlay>

        <Dialog.Content asChild>
          <motion.aside
            className="dd-kpi-drawer"
            initial={skip ? false : { x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            transition={skip ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 32, mass: 0.9 }}
          >
            <div className="dd-kpi-drawer-head">
              <div className="dd-kpi-drawer-titleblock">
                <h2 className="dd-kpi-drawer-title">{title}</h2>
                <p className="dd-kpi-drawer-sub">{rangeLabel}</p>
              </div>
              <Dialog.Close asChild>
                <button className="dd-kpi-drawer-close" type="button" aria-label="Close">
                  <X size={18} strokeWidth={2} />
                </button>
              </Dialog.Close>
            </div>

            <div className="dd-kpi-drawer-body">
              {rows.map(({ r, v, max }) => {
                const name = r.person?.name || "Person";
                const cap = Number(r.capacityHours) || 0;
                const pct = kpiKey === "util" ? v : cap > 0 && (kpiKey === "scheduled" || kpiKey === "free") ? (v / cap) * 100 : max > 0 ? (v / max) * 100 : 0;
                const tone = toneFromPct(pct, kpiKey);
                const width = clamp(max > 0 ? (v / max) * 100 : 0, 0, 100);
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`dd-kpi-row dd-kpi-row--${tone}`}
                    title={`${name} · ${kpiKey === "util" ? `${Math.round(v)}%` : fmtHours(v)}`}
                    onClick={() => {
                      // Reuse existing person drawer by delegating: parent can listen via CustomEvent if desired.
                      window.dispatchEvent(new CustomEvent("alloc8:kpi-breakdown:pick-person", { detail: { personRow: r } }));
                    }}
                  >
                    <span className="dd-kpi-row-name">{name}</span>
                    <span className="dd-kpi-row-bar" aria-hidden>
                      <span className="dd-kpi-row-fill" style={{ width: `${width}%` }} />
                    </span>
                    <span className="dd-kpi-row-val">
                      {kpiKey === "util" ? `${Math.round(v)}%` : fmtHours(v)}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.aside>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

