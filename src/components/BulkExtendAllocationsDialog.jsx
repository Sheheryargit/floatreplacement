import { CalendarRange, X } from "lucide-react";
import { avatarGradientFromName } from "../utils/projectColors.js";
import {
  listLatestEndBulkExtendCandidates,
  maxBulkExtendEndDate,
} from "../utils/allocationBulkExtend.js";
import { BulkExtendAllocationsPanel } from "./BulkExtendAllocationsPanel.jsx";
import "./AllocationModals.css";
import "./BulkExtendAllocationsPanel.css";

function personInitials(name) {
  if (!name) return "";
  const p = name.trim().split(/\s+/);
  return p.length === 1
    ? (p[0][0] || "").toUpperCase()
    : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function formatDisplayDate(iso) {
  const s = String(iso || "").slice(0, 10);
  if (s.length < 10) return s;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return s;
  return dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Schedule entry — same shell as Create allocation modal.
 */
export function BulkExtendAllocationsDialog({
  open,
  person,
  onClose,
  allocations,
  contextAllocations,
  publicHolidayAllocations,
  projects,
  setAllocations,
  syncAllocationUpdate,
  onRefreshWorkspace,
  t,
}) {
  if (!open || !person || !t) return null;

  const scopeRows = listLatestEndBulkExtendCandidates(person.id, allocations);
  const latestEnd = maxBulkExtendEndDate(scopeRows);

  return (
    <div className="bulk-extend-shell lpam-overlay-radix" role="presentation" onClick={onClose}>
      <div
        className="lpam-modal lpam-create float-premium-modal bulk-extend-modal"
        role="dialog"
        aria-labelledby="bulk-extend-dialog-title"
        aria-modal="true"
        style={{
          color: t.text,
          background: t.surface,
          borderColor: t.border,
          boxShadow: t.shadow,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="lpam-head bulk-extend-head">
          <div className="bulk-extend-head-block">
            <div
              className="bulk-extend-head-icon"
              style={{
                color: t.accent,
                background: t.tabActiveBg,
                borderColor: `color-mix(in srgb, ${t.accent} 28%, transparent)`,
              }}
              aria-hidden
            >
              <CalendarRange size={18} strokeWidth={2} />
            </div>
            <div className="bulk-extend-head-text">
              <p className="bulk-extend-eyebrow" style={{ color: t.accent }}>
                Bulk extend
              </p>
              <h2 id="bulk-extend-dialog-title" className="lpam-title bulk-extend-title">
                Extend end dates
              </h2>
              <p className="bulk-extend-subtitle" style={{ color: t.textMuted }}>
                <span
                  className="bulk-extend-avatar"
                  style={{ background: avatarGradientFromName(person.name) }}
                  aria-hidden
                >
                  {personInitials(person.name)}
                </span>
                {person.name}
                {scopeRows.length >= 2 && latestEnd
                  ? ` · ${scopeRows.length} rows ending ${formatDisplayDate(latestEnd)}`
                  : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="lpam-icon-close bulk-extend-close"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: t.btnSec,
              borderColor: t.borderSub,
            }}
          >
            <X size={18} color={t.textMuted} />
          </button>
        </header>

        <div className="lpam-modal-body bulk-extend-body">
          <BulkExtendAllocationsPanel
            variant="modal"
            person={person}
            allocations={allocations}
            contextAllocations={contextAllocations}
            publicHolidayAllocations={publicHolidayAllocations}
            projects={projects}
            setAllocations={setAllocations}
            syncAllocationUpdate={syncAllocationUpdate}
            onRefreshWorkspace={onRefreshWorkspace}
            t={t}
            onDone={onClose}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
