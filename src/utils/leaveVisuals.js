/**
 * Leave type visuals — timeline, modals, swatches (no imports from AllocationModals to avoid cycles).
 */

const ALLOWED = new Set([
  "annual",
  "sick",
  "personal",
  "parental",
  "bereavement",
  "unpaid",
  "public_holiday",
  "other",
]);

export function normalizeLeaveTypeId(id) {
  return id && ALLOWED.has(id) ? id : "other";
}

/** Weekly day-off blocks generated from availability (Mon–Fri unchecked). */
export function isAvailabilityDayOffAlloc(alloc) {
  if (!alloc?.isLeave) return false;
  const k = alloc.availabilitySlotKey;
  return typeof k === "string" && k.startsWith("avail_off:");
}

/** Icon key for Lucide mapping in consumers */
export function leaveTimelineIconKey(id) {
  if (id === "day_off") return "calendaroff";
  const t = normalizeLeaveTypeId(id);
  const map = {
    annual: "palmtree",
    sick: "heartpulse",
    personal: "user",
    parental: "baby",
    bereavement: "flower2",
    unpaid: "wallet",
    public_holiday: "landmark",
    other: "umbrella",
  };
  return map[t] || "umbrella";
}

/**
 * Theme accents for leave panels / buttons (hex + rgba strings).
 */
export function leaveAccentTheme(typeId) {
  const t = normalizeLeaveTypeId(typeId);
  const themes = {
    annual: { solid: "#14b8a6", soft: "rgba(20, 184, 166, 0.22)", glow: "rgba(20, 184, 166, 0.45)" },
    sick: { solid: "#0ea5e9", soft: "rgba(14, 165, 233, 0.2)", glow: "rgba(14, 165, 233, 0.4)" },
    personal: { solid: "#a78bfa", soft: "rgba(167, 139, 250, 0.22)", glow: "rgba(167, 139, 250, 0.42)" },
    parental: { solid: "#f472b6", soft: "rgba(244, 114, 182, 0.22)", glow: "rgba(244, 114, 182, 0.4)" },
    bereavement: { solid: "#818cf8", soft: "rgba(129, 140, 248, 0.22)", glow: "rgba(129, 140, 248, 0.4)" },
    unpaid: { solid: "#f59e0b", soft: "rgba(245, 158, 11, 0.22)", glow: "rgba(245, 158, 11, 0.42)" },
    public_holiday: { solid: "#eab308", soft: "rgba(234, 179, 8, 0.22)", glow: "rgba(234, 179, 8, 0.4)" },
    other: { solid: "#94a3b8", soft: "rgba(148, 163, 184, 0.22)", glow: "rgba(148, 163, 184, 0.35)" },
  };
  return themes[t] || themes.other;
}

export function leavePanelStyleVars(typeId) {
  const a = leaveAccentTheme(typeId);
  return {
    "--lpam-leave-solid": a.solid,
    "--lpam-leave-soft": a.soft,
    "--lpam-leave-glow": a.glow,
  };
}

export function isoDateLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function leaveSpansToday(alloc, todayIso = isoDateLocal()) {
  if (!alloc?.startDate || !alloc?.endDate) return false;
  return alloc.startDate <= todayIso && alloc.endDate >= todayIso;
}

export function buildLeaveHoverTitle(alloc, leaveLabelFn) {
  if (isAvailabilityDayOffAlloc(alloc)) {
    const range =
      alloc.startDate === alloc.endDate
        ? alloc.startDate
        : `${alloc.startDate} → ${alloc.endDate}`;
    return `Day Off · ${range}. Click for details.`;
  }
  const lbl = alloc.leaveType ? leaveLabelFn(alloc.leaveType) : "Leave";
  const range =
    alloc.startDate === alloc.endDate
      ? alloc.startDate
      : `${alloc.startDate} → ${alloc.endDate}`;
  const wd = alloc.workingDays;
  const wdPart = typeof wd === "number" && wd > 0 ? ` · ${wd} working day${wd === 1 ? "" : "s"}` : "";
  const notes = (alloc.notes || "").trim();
  const notePart = notes ? ` · ${notes.length > 80 ? `${notes.slice(0, 77)}…` : notes}` : "";
  return `${lbl} · ${range}${wdPart}${notePart}. Click for details.`;
}
