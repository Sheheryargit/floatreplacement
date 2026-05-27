import { useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { isStaticUi } from "../../config/uiMode.js";
import "./PersonDetailDrawer.css";

function fmtHours(n) {
  const x = Number(n) || 0;
  return `${x.toLocaleString("en-AU", { maximumFractionDigits: 1, minimumFractionDigits: 0 })}h`;
}

function mapToTopList(map, n = 6) {
  if (!map) return [];
  return [...map.entries()]
    .map(([key, hours]) => ({ key, hours }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, n);
}

export function PersonDetailDrawer({ open, onOpenChange, personRow }) {
  const reduceMotion = useReducedMotion();
  const skip = reduceMotion || isStaticUi();

  const name = personRow?.person?.name || "Person";
  const dept = (personRow?.person?.department || "").trim() || "—";
  const role = (personRow?.person?.role || "").trim() || "—";

  const topClients = useMemo(() => mapToTopList(personRow?.byClient, 8), [personRow]);
  const topProjects = useMemo(() => mapToTopList(personRow?.byProject, 10), [personRow]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            className="dd-drawer-backdrop"
            initial={skip ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={skip ? { duration: 0 } : { duration: 0.18 }}
          />
        </Dialog.Overlay>

        <Dialog.Content asChild>
          <motion.aside
            className="dd-drawer"
            initial={skip ? false : { x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            transition={
              skip ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 32, mass: 0.9 }
            }
          >
            <div className="dd-drawer-head">
              <div className="dd-drawer-titleblock">
                <h2 className="dd-drawer-title">{name}</h2>
                <p className="dd-drawer-sub">{role} · {dept}</p>
              </div>
              <Dialog.Close asChild>
                <button className="dd-drawer-close" type="button" aria-label="Close">
                  <X size={18} strokeWidth={2} />
                </button>
              </Dialog.Close>
            </div>

            <div className="dd-drawer-kpis">
              <div className="dd-mini">
                <div className="dd-mini-label">Capacity</div>
                <div className="dd-mini-value">{fmtHours(personRow?.capacityHours)}</div>
              </div>
              <div className="dd-mini">
                <div className="dd-mini-label">Scheduled</div>
                <div className="dd-mini-value">{fmtHours(personRow?.scheduledWorkHours)}</div>
              </div>
              <div className="dd-mini">
                <div className="dd-mini-label">Free</div>
                <div className="dd-mini-value">{fmtHours(personRow?.freeHours)}</div>
              </div>
              <div className="dd-mini">
                <div className="dd-mini-label">Leave</div>
                <div className="dd-mini-value">{fmtHours(personRow?.leaveHours)}</div>
              </div>
            </div>

            <div className="dd-drawer-body">
              <section className="dd-drawer-section">
                <h3 className="dd-drawer-h3">Top clients</h3>
                <div className="dd-drawer-list">
                  {topClients.length ? topClients.map((c) => (
                    <div key={c.key} className="dd-drawer-row">
                      <span className="dd-drawer-row-key">{c.key}</span>
                      <span className="dd-drawer-row-val">{fmtHours(c.hours)}</span>
                    </div>
                  )) : (
                    <p className="dd-drawer-empty">No work allocations in range.</p>
                  )}
                </div>
              </section>

              <section className="dd-drawer-section">
                <h3 className="dd-drawer-h3">Top projects</h3>
                <div className="dd-drawer-list">
                  {topProjects.length ? topProjects.map((c) => (
                    <div key={c.key} className="dd-drawer-row">
                      <span className="dd-drawer-row-key">{c.key}</span>
                      <span className="dd-drawer-row-val">{fmtHours(c.hours)}</span>
                    </div>
                  )) : (
                    <p className="dd-drawer-empty">No work allocations in range.</p>
                  )}
                </div>
              </section>
            </div>
          </motion.aside>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

