/**
 * Schedule leave tile copy + layout tiers (no imports from AllocationModals).
 */

import { normalizeLeaveTypeId } from "./leaveVisuals.js";

/** Partial bar height (px) at which notes may show on the tile. */
export const LEAVE_TILE_PARTIAL_NOTES_MIN_PX = 36;

/** Full-day column span at which notes may show without extra height. */
export const LEAVE_TILE_WIDE_COL_SPAN = 2;

/** Visible label before note text on tiles and tooltips. */
export const LEAVE_NOTES_PREFIX = "Notes: ";

const SHORT_LABELS = {
  annual: "Annual",
  sick: "Sick",
  personal: "Personal",
  parental: "Parental",
  bereavement: "Bereavement",
  unpaid: "Unpaid",
  public_holiday: "Holiday",
  other: "Other",
};

/**
 * @param {string} [typeId]
 * @returns {string}
 */
export function leaveTypeShortLabel(typeId) {
  const t = normalizeLeaveTypeId(typeId);
  return SHORT_LABELS[t] || SHORT_LABELS.other;
}

/**
 * Truncated note body only (no "Notes:" prefix).
 * @param {string} [notes]
 * @param {number} [maxLen=28]
 * @returns {string}
 */
export function leaveNotesBodyPreview(notes, maxLen = 28) {
  const s = (notes || "").trim();
  if (!s) return "";
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
}

/**
 * @param {string} [notes]
 * @param {number} [maxLen=28]
 * @returns {string}
 */
export function leaveNotesPreview(notes, maxLen = 28) {
  const body = leaveNotesBodyPreview(notes, maxLen);
  if (!body) return "";
  return `${LEAVE_NOTES_PREFIX}${body}`;
}

/**
 * Full note line for hover / tooltips.
 * @param {string} [notes]
 * @returns {string}
 */
export function formatLeaveNotesFull(notes) {
  const s = (notes || "").trim();
  if (!s) return "";
  return `${LEAVE_NOTES_PREFIX}${s}`;
}

/**
 * @param {number | null | undefined} hours
 * @returns {string}
 */
export function formatPartialLeaveHours(hours) {
  const h = Math.max(0, parseFloat(hours) || 0);
  if (h <= 0) return "";
  const rounded = Math.round(h * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}h`;
}

/**
 * @typedef {'compact' | 'wide' | 'notes' | 'rich'} LeaveTileTier
 */

/**
 * @param {{
 *   colSpan?: number,
 *   blockHeightPx?: number | null,
 *   hasNotes?: boolean,
 *   isPartial?: boolean,
 * }} opts
 * @returns {LeaveTileTier}
 */
export function computeLeaveTileTier({
  colSpan = 1,
  blockHeightPx = null,
  hasNotes = false,
  isPartial = false,
}) {
  const span = Math.max(1, colSpan);
  const h = blockHeightPx != null ? blockHeightPx : null;
  const wide = span >= LEAVE_TILE_WIDE_COL_SPAN;
  const partialTall = isPartial && h != null && h >= LEAVE_TILE_PARTIAL_NOTES_MIN_PX;

  if (isPartial && hasNotes && partialTall) return "rich";
  if (hasNotes && (wide || partialTall)) return "notes";
  if (wide) return "wide";
  return "compact";
}

/** Whether the tier should render notes on the tile (not hover-only). */
export function leaveTileShowsNotesOnTile(tier) {
  return tier === "notes" || tier === "rich";
}
