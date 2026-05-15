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
    annual: { solid: "#0d9488", soft: "rgba(13, 148, 136, 0.28)", glow: "rgba(45, 212, 191, 0.5)" },
    sick: { solid: "#0284c7", soft: "rgba(2, 132, 199, 0.26)", glow: "rgba(56, 189, 248, 0.48)" },
    personal: { solid: "#7c3aed", soft: "rgba(124, 58, 237, 0.24)", glow: "rgba(167, 139, 250, 0.45)" },
    parental: { solid: "#db2777", soft: "rgba(219, 39, 119, 0.24)", glow: "rgba(244, 114, 182, 0.45)" },
    bereavement: { solid: "#4f46e5", soft: "rgba(79, 70, 229, 0.24)", glow: "rgba(129, 140, 248, 0.42)" },
    unpaid: { solid: "#d97706", soft: "rgba(217, 119, 6, 0.26)", glow: "rgba(251, 191, 36, 0.45)" },
    public_holiday: { solid: "#ca8a04", soft: "rgba(202, 138, 4, 0.28)", glow: "rgba(250, 204, 21, 0.5)" },
    other: { solid: "#64748b", soft: "rgba(100, 116, 139, 0.26)", glow: "rgba(148, 163, 184, 0.38)" },
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
    return `Off · ${range}. Click for details.`;
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
