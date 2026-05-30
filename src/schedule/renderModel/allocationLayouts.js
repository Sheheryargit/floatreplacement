import { advanceRepeatWindow } from "../../utils/allocationRepeatWindow.js";

/** Minimum span in column units (integer columns). */
const MIN_WEEK_MONTH_SPAN_COLS = 1;

export function allocationDateKeyYmd(raw) {
  return String(raw ?? "").trim().slice(0, 10);
}

function dateKeyLocal(dt) {
  const x = new Date(dt);
  const y = x.getFullYear();
  const mo = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function startOfWeekMonday(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dateFromKey(key) {
  const parts = String(key).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return new Date();
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
}

function weekMondayKey(dt) {
  return dateKeyLocal(startOfWeekMonday(dt));
}

/**
 * Map allocation date range to visible column start + span.
 * `start` / `span` are in column index units.
 */
export function layoutAllocation(alloc, scheduleModel) {
  const indexed = scheduleModel?.columnIndex?.layoutRangeForAllocation?.(alloc);
  if (indexed) return indexed;

  const keys = scheduleModel.slots.map((s) => allocationDateKeyYmd(s.dateKey));
  const sk = allocationDateKeyYmd(alloc.startDate);
  const ek = allocationDateKeyYmd(alloc.endDate);
  if (!sk || !ek) return null;

  let i0 = keys.findIndex((k) => k >= sk);
  if (i0 < 0) return null;
  let i1 = -1;
  for (let i = keys.length - 1; i >= 0; i--) {
    if (keys[i] <= ek) {
      i1 = i;
      break;
    }
  }
  if (i1 < i0) return null;
  let span = i1 - i0 + 1;
  span = Math.max(span, MIN_WEEK_MONTH_SPAN_COLS);
  return { start: i0, span };
}

function splitLayoutByWorkWeek(lay, scheduleModel) {
  const keys =
    scheduleModel?.columnIndex?.keys ??
    scheduleModel.slots.map((s) => allocationDateKeyYmd(s.dateKey));
  const i0 = lay.start;
  const i1 = lay.start + lay.span - 1;
  if (i0 < 0 || i1 >= keys.length || i1 < i0) return [lay];
  const segments = [];
  let segStart = i0;
  let curMonday = weekMondayKey(dateFromKey(keys[i0]));
  for (let idx = i0 + 1; idx <= i1; idx++) {
    const km = weekMondayKey(dateFromKey(keys[idx]));
    if (km !== curMonday) {
      const segSpan = Math.max(MIN_WEEK_MONTH_SPAN_COLS, idx - segStart);
      segments.push({ start: segStart, span: segSpan });
      segStart = idx;
      curMonday = km;
    }
  }
  segments.push({
    start: segStart,
    span: Math.max(MIN_WEEK_MONTH_SPAN_COLS, i1 - segStart + 1),
  });
  return segments.length > 0 ? segments : [lay];
}

/** Visible timeline segments for an allocation (includes recurring occurrences). */
export function layoutsForAllocation(alloc, scheduleModel) {
  const out = [];
  let start = allocationDateKeyYmd(alloc.startDate);
  let end = allocationDateKeyYmd(alloc.endDate);
  const repeatId = alloc.repeatId ?? "none";

  if (repeatId !== "none" && scheduleModel?.slots?.length) {
    const firstKey = allocationDateKeyYmd(scheduleModel.slots[0].dateKey);
    let guard = 0;
    while (end < firstKey && guard++ < 2600) {
      const next = advanceRepeatWindow(start, end, repeatId);
      if (!next) break;
      start = next.start;
      end = next.end;
    }
  }

  const originMs = new Date(`${start}T12:00:00`).getTime();
  const maxMs = originMs + 800 * 864e5;
  let occ = 0;

  for (let i = 0; i < 80; i++) {
    const lay = layoutAllocation({ ...alloc, startDate: start, endDate: end }, scheduleModel);
    if (lay) {
      const splits = splitLayoutByWorkWeek(lay, scheduleModel);
      const weekSplitCount = splits.length;
      splits.forEach((sli, partIdx) => {
        out.push({ ...sli, occ, weekPart: partIdx, weekSplitCount, occStart: start, occEnd: end });
      });
    }
    occ += 1;
    if (repeatId === "none") break;
    const next = advanceRepeatWindow(start, end, repeatId);
    if (!next) break;
    ({ start, end } = next);
    if (new Date(`${start}T12:00:00`).getTime() > maxMs) break;
  }
  return out;
}
