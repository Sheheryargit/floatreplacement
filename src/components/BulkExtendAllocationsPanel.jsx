import { useMemo, useState, useEffect } from "react";
import { ArrowLeftRight, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { showCenterActionFeedback } from "../context/CenterActionFeedbackContext.jsx";
import {
  applyBulkExtend,
  defaultBulkExtendTargetDate,
  listLatestEndBulkExtendCandidates,
  maxBulkExtendEndDate,
  minBulkExtendTargetDate,
} from "../utils/allocationBulkExtend.js";
import "./AllocationModals.css";
import "./BulkExtendAllocationsPanel.css";

function formatDisplayDate(iso) {
  const s = String(iso || "").slice(0, 10);
  if (s.length < 10) return s;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return s;
  return dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function primaryBtnStyle(t, active, busy) {
  if (!active) {
    return {
      borderColor: t.border,
      background: t.btnSec || t.surface,
      color: t.textMuted,
      boxShadow: "none",
      cursor: "not-allowed",
    };
  }
  return {
    borderColor: "transparent",
    color: t.accentTxt || "#fff",
    opacity: busy ? 0.8 : 1,
    boxShadow: `0 8px 28px ${t.accentGlow || "rgba(0,136,255,0.35)"}`,
  };
}

/**
 * Extend latest-ending project allocations for one person to a shared end date.
 */
export function BulkExtendAllocationsPanel({
  person,
  allocations = [],
  contextAllocations,
  publicHolidayAllocations = [],
  projects = [],
  setAllocations,
  syncAllocationUpdate,
  onRefreshWorkspace,
  t,
  onDone,
  onCancel,
  /** @type {"embedded" | "modal"} */
  variant = "embedded",
}) {
  const personId = person?.id;
  const compact = variant === "modal";
  const scopeRows = useMemo(
    () => listLatestEndBulkExtendCandidates(personId, allocations),
    [personId, allocations]
  );
  const latestEnd = useMemo(() => maxBulkExtendEndDate(scopeRows), [scopeRows]);

  const ctx = useMemo(
    () => ({
      allocations: contextAllocations ?? allocations,
      publicHolidayAllocations,
      projects,
    }),
    [contextAllocations, allocations, publicHolidayAllocations, projects]
  );

  const [targetDate, setTargetDate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!personId || scopeRows.length < 2) {
      setTargetDate("");
      return;
    }
    setTargetDate(defaultBulkExtendTargetDate(scopeRows));
  }, [personId, scopeRows]);

  const minTargetDate = useMemo(() => minBulkExtendTargetDate(scopeRows), [scopeRows]);

  const { toUpdate } = useMemo(
    () => applyBulkExtend(personId, targetDate, ctx),
    [personId, targetDate, ctx]
  );

  const previewRows = useMemo(() => {
    const ids = new Set(toUpdate.map((u) => u.id));
    return scopeRows.filter((c) => ids.has(c.id));
  }, [toUpdate, scopeRows]);

  const targetValid = targetDate && (!minTargetDate || targetDate >= minTargetDate);
  const extendValid = targetValid && toUpdate.length > 0;

  const canApply =
    !busy &&
    extendValid &&
    typeof syncAllocationUpdate === "function" &&
    typeof setAllocations === "function";

  if (!person || scopeRows.length < 2 || !t) return null;

  const handleApply = async () => {
    if (!canApply) return;
    setBusy(true);
    const prevById = new Map(toUpdate.map((a) => [a.id, allocations.find((x) => x.id === a.id)]));
    setAllocations((prev) =>
      prev.map((a) => {
        const next = toUpdate.find((u) => u.id === a.id);
        return next ?? a;
      })
    );
    let ok = 0;
    try {
      for (const merged of toUpdate) {
        try {
          const saved = await syncAllocationUpdate(merged);
          setAllocations((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
          ok += 1;
        } catch (e) {
          const prevRow = prevById.get(merged.id);
          if (prevRow) {
            setAllocations((prev) => prev.map((a) => (a.id === merged.id ? prevRow : a)));
          }
          if (e?.name === "OptimisticLockError") {
            toast.error("Someone else edited an allocation", {
              description: "Refreshing from the server.",
            });
            onRefreshWorkspace?.().catch(() => {});
          } else {
            toast.error("Extend failed", { description: e?.message || String(e) });
          }
          break;
        }
      }
      if (ok > 0) {
        showCenterActionFeedback({
          action: "update",
          title: "Extended",
          subtitle: `${ok} allocation${ok === 1 ? "" : "s"} → ${formatDisplayDate(targetDate)}`,
        });
        onDone?.();
      }
    } finally {
      setBusy(false);
    }
  };

  const applyLabel = busy
    ? "Applying…"
    : extendValid
      ? `Extend to ${formatDisplayDate(targetDate)}`
      : "Pick a later date";

  const cardStyle = {
    borderColor: `color-mix(in srgb, ${t.borderSub || t.border} 78%, transparent)`,
    boxShadow: `inset 0 1px 0 color-mix(in srgb, ${t.surface} 55%, transparent), 0 12px 36px ${t.accentGlow || "rgba(0,136,255,0.08)"}`,
    background: `linear-gradient(
      155deg,
      color-mix(in srgb, ${t.surface} 90%, ${t.accent} 10%) 0%,
      color-mix(in srgb, ${t.surfRaised || t.surface} 96%, ${t.border} 4%) 100%
    )`,
  };

  return (
    <>
      <div className={"lpam-extend-card-wrap" + (compact ? " lpam-extend-card-wrap--drawer" : "")}>
        <div className="lpam-extend-card bulk-extend-card" style={cardStyle}>
          {!compact ? (
            <div className="lpam-extend-title-row">
              <span className="lpam-extend-accent-dot" style={{ background: t.accent }} aria-hidden />
              <div>
                <div className="lpam-extend-title" style={{ color: t.text }}>
                  Extend end dates
                </div>
                <p className="lpam-extend-sub" style={{ color: t.textMuted }}>
                  {scopeRows.length} allocations ending{" "}
                  {latestEnd ? formatDisplayDate(latestEnd) : "on the latest date"}.
                </p>
              </div>
            </div>
          ) : null}

          <div className="lpam-dates">
            <div className="lpam-field lpam-grow" style={{ marginBottom: 0 }}>
              <label className="lpam-label" style={{ color: t.textMuted }}>
                Current end
              </label>
              <div
                className="lpam-total-pill bulk-extend-current-pill"
                style={{
                  background: t.bg,
                  borderColor: t.borderIn || t.border,
                  color: t.text,
                }}
              >
                {latestEnd ? formatDisplayDate(latestEnd) : "—"}
              </div>
            </div>
            <ArrowLeftRight size={16} className="lpam-date-arrow" style={{ color: t.accent }} aria-hidden />
            <div className="lpam-field lpam-grow" style={{ marginBottom: 0 }}>
              <label className="lpam-label" htmlFor="bulk-extend-target-date" style={{ color: t.textMuted }}>
                New end date
              </label>
              <input
                id="bulk-extend-target-date"
                type="date"
                className="lpam-input lpam-date bulk-extend-date-input"
                value={targetDate}
                min={minTargetDate || undefined}
                onChange={(e) => setTargetDate(e.target.value)}
                disabled={busy}
                style={{
                  borderColor: t.borderIn || t.border,
                  background: t.bg,
                  color: t.text,
                }}
              />
            </div>
          </div>

          {targetDate && toUpdate.length > 0 ? (
            <div
              className="lpam-extend-preview lpam-extend-preview--ok bulk-extend-preview"
              style={{
                borderColor: `color-mix(in srgb, ${t.accent} 38%, transparent)`,
                background: `color-mix(in srgb, ${t.accentGlow || "rgba(0,136,255,0.12)"} 32%, ${t.surface})`,
              }}
            >
              <div className="lpam-extend-preview-top" style={{ color: t.text }}>
                <ArrowRight size={17} strokeWidth={2.25} style={{ flexShrink: 0, color: t.accent }} aria-hidden />
                <span>
                  {formatDisplayDate(latestEnd)} → {formatDisplayDate(targetDate)}
                </span>
              </div>
              <div className="lpam-extend-preview-metrics" style={{ color: t.textSoft }}>
                <span className="bulk-extend-preview-badge" style={{ color: t.accent, background: t.tabActiveBg }}>
                  {toUpdate.length} updating
                </span>
              </div>
              <ul className="bulk-extend-project-list">
                {previewRows.map((a) => (
                  <li
                    key={a.id}
                    className="bulk-extend-project-item"
                    style={{ color: t.text, background: t.surfAlt, borderColor: t.borderSub }}
                  >
                    {(a.project || "Project").trim()}
                  </li>
                ))}
              </ul>
            </div>
          ) : targetDate && !extendValid ? (
            <div
              className="lpam-extend-preview lpam-extend-preview--warn"
              style={{
                borderColor: `color-mix(in srgb, ${t.warn ?? "#f59e0b"} 42%, transparent)`,
                background: String(t.warnSoft || "rgba(245,158,11,0.12)"),
              }}
            >
              <div className="lpam-extend-preview-top" style={{ color: t.warn ?? "#f59e0b" }}>
                Choose a date after {latestEnd ? formatDisplayDate(latestEnd) : "the current end"}.
              </div>
            </div>
          ) : null}

          {!compact ? (
            <button
              type="button"
              className="lpam-btn lpam-btn-primary lpam-extend-apply bulk-extend-apply-full"
              disabled={!canApply}
              style={primaryBtnStyle(t, extendValid, busy)}
              onClick={handleApply}
            >
              {busy ? <Loader2 size={16} className="bulk-extend-spin" aria-hidden /> : null}
              {applyLabel}
            </button>
          ) : null}
        </div>
      </div>

      {compact ? (
        <div className="lpam-footer bulk-extend-footer" style={{ borderTopColor: t.borderSub || t.border }}>
          <div className="lpam-create-actions">
            {typeof onCancel === "function" ? (
              <button
                type="button"
                className="lpam-btn lpam-btn-secondary"
                disabled={busy}
                style={{
                  borderColor: t.border,
                  background: t.btnSec || t.surface,
                  color: t.btnSecTxt || t.textSoft,
                }}
                onClick={onCancel}
              >
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              className="lpam-btn lpam-btn-primary bulk-extend-apply-primary"
              disabled={!canApply}
              style={primaryBtnStyle(t, extendValid, busy)}
              onClick={handleApply}
            >
              {busy ? <Loader2 size={16} className="bulk-extend-spin" aria-hidden /> : null}
              {applyLabel}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
