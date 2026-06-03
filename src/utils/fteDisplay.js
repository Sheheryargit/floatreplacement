/**
 * Full-time equivalent display — 1 FTE = 37.5 h/week (7.5 h/day on a 5-day week).
 */

import { workAllocationCoversDateKey } from "./allocationOccurrence.js";
import { weekMondayKeyFromDateKey } from "../schedule/renderModel/stacking.js";

export const FTE_HOURS_PER_WEEK = 37.5;
export const FTE_HOURS_PER_DAY = FTE_HOURS_PER_WEEK / 5;

/**
 * @param {number} fte
 * @returns {string}
 */
export function formatFteValue(fte) {
  const v = Math.max(0, Number(fte) || 0);
  if (v > 0 && v < 0.01) return "<0.01";
  const rounded = Math.round(v * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  const s = rounded.toFixed(2);
  if (s.endsWith("0")) return s.slice(0, -1);
  return s;
}

/**
 * @param {number} hoursPerDay
 * @returns {number}
 */
export function ftePerDayFromHours(hoursPerDay) {
  const h = Math.max(0, parseFloat(hoursPerDay) || 0);
  if (h <= 0 || FTE_HOURS_PER_DAY <= 0) return 0;
  return h / FTE_HOURS_PER_DAY;
}

/**
 * Hours booked in the ISO week of the segment start column (segment may span fewer days).
 * @param {object} alloc
 * @param {{ start?: number, span?: number }} lay
 * @param {{ slots?: Array<{ dateKey: string }> }} scheduleModel
 */
export function segmentHoursInStartWeek(alloc, lay, scheduleModel) {
  const slots = scheduleModel?.slots || [];
  const startCol = Math.max(0, Math.floor(lay?.start ?? 0));
  const span = Math.max(0, Math.floor(lay?.span ?? 0));
  const startDk = slots[startCol]?.dateKey;
  const weekKey = startDk ? weekMondayKeyFromDateKey(startDk) : "";
  if (!weekKey || span <= 0) return 0;

  const hpd = Math.max(0, parseFloat(alloc?.hoursPerDay) || 0);
  let total = 0;
  for (let c = startCol; c < startCol + span && c < slots.length; c++) {
    const dk = slots[c]?.dateKey;
    if (!dk || weekMondayKeyFromDateKey(dk) !== weekKey) continue;
    if (!workAllocationCoversDateKey(alloc, dk)) continue;
    total += hpd;
  }
  return total;
}

/**
 * @param {object} alloc
 * @param {{ start?: number, span?: number }} lay
 * @param {{ slots?: Array<{ dateKey: string }> }} scheduleModel
 * @returns {{ fteDay: number, fteWeek: number, dayLabel: string, weekLabel: string, compactLabel: string }}
 */
export function allocationFteLabels(alloc, lay, scheduleModel) {
  const hpd = Math.max(0, parseFloat(alloc?.hoursPerDay) || 0);
  const fteDay = ftePerDayFromHours(hpd);
  const weekHours = segmentHoursInStartWeek(alloc, lay, scheduleModel);
  const fteWeek = weekHours / FTE_HOURS_PER_WEEK;
  const dayVal = formatFteValue(fteDay);
  const weekVal = formatFteValue(fteWeek);
  return {
    fteDay,
    fteWeek,
    dayLabel: `${dayVal} FTE/d`,
    weekLabel: `${weekVal} FTE/wk`,
    compactLabel: `${dayVal}/d · ${weekVal}/wk`,
  };
}

/**
 * @param {number} peakHoursPerDay
 * @returns {string}
 */
export function formatPersonRailFte(peakHoursPerDay) {
  const fte = ftePerDayFromHours(peakHoursPerDay);
  return `${formatFteValue(fte)} FTE/d`;
}

/**
 * Subheading under person name when FTE mode is on (peak day + in-view week).
 * @param {number} peakHoursPerDay
 * @param {number} totalHoursInView
 * @param {string[]} visibleDateKeys
 */
export function formatPersonFteSubheading(peakHoursPerDay, totalHoursInView, visibleDateKeys) {
  const day = formatFteValue(ftePerDayFromHours(peakHoursPerDay));
  const weeks = new Set();
  for (const dk of visibleDateKeys || []) {
    const wk = weekMondayKeyFromDateKey(dk);
    if (wk) weeks.add(wk);
  }
  const weekCount = Math.max(1, weeks.size);
  const weekFte = formatFteValue(
    Math.max(0, Number(totalHoursInView) || 0) / (weekCount * FTE_HOURS_PER_WEEK)
  );
  return `${day} FTE/d · ${weekFte} FTE/wk`;
}

/**
 * @param {number} totalHoursInView
 * @param {string[]} visibleDateKeys
 * @returns {string}
 */
export function formatTeamFteBadge(totalHoursInView, visibleDateKeys) {
  const weeks = new Set();
  for (const dk of visibleDateKeys || []) {
    const wk = weekMondayKeyFromDateKey(dk);
    if (wk) weeks.add(wk);
  }
  const weekCount = Math.max(1, weeks.size);
  const fte = totalHoursInView / (weekCount * FTE_HOURS_PER_WEEK);
  return `${formatFteValue(fte)} FTE`;
}

/**
 * @param {object} alloc
 * @param {string} projectName
 * @param {string} hoursLabel
 * @param {{ start?: number, span?: number }} [lay]
 * @param {{ slots?: Array<{ dateKey: string }> }} [scheduleModel]
 */
export function allocationFteTooltipExtra(alloc, projectName, hoursLabel, lay, scheduleModel) {
  if (!lay || !scheduleModel?.slots?.length) return "";
  const { dayLabel, weekLabel } = allocationFteLabels(alloc, lay, scheduleModel);
  const name = projectName || alloc?.project || "Work";
  return `${name} · ${hoursLabel}/day · ${dayLabel} · ${weekLabel}`;
}
