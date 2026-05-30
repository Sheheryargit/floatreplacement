import { allocationDateKeyYmd } from "./renderModel/allocationLayouts.js";

const MIN_WEEK_MONTH_SPAN_COLS = 1;

function lowerBound(arr, target) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBoundLe(arr, target) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

/**
 * Sorted slot date keys + O(log n) column lookup for allocation ranges.
 * Attach to scheduleModel as `columnIndex` when building the model for the canvas.
 */
export function buildScheduleColumnIndex(scheduleModel) {
  const keys = (scheduleModel?.slots ?? []).map((s) => allocationDateKeyYmd(s.dateKey));
  return {
    keys,
    columnCount: keys.length,
    layoutRangeForAllocation(alloc) {
      const sk = allocationDateKeyYmd(alloc?.startDate);
      const ek = allocationDateKeyYmd(alloc?.endDate);
      if (!sk || !ek || keys.length === 0) return null;

      const i0 = lowerBound(keys, sk);
      if (i0 >= keys.length) return null;
      const i1 = upperBoundLe(keys, ek);
      if (i1 < i0) return null;

      const span = Math.max(MIN_WEEK_MONTH_SPAN_COLS, i1 - i0 + 1);
      return { start: i0, span };
    },
  };
}

export function attachColumnIndex(scheduleModel) {
  if (!scheduleModel?.slots?.length) return scheduleModel;
  if (scheduleModel.columnIndex?.keys?.length === scheduleModel.slots.length) {
    return scheduleModel;
  }
  return { ...scheduleModel, columnIndex: buildScheduleColumnIndex(scheduleModel) };
}
