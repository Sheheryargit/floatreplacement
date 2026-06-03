/** Endless timeline band loading — hysteresis + cooldown (pure helpers for tests). */

export const EDGE_LOAD_ENTER_PX = 120;
export const EDGE_LOAD_EXIT_PX = 400;
export const EDGE_LOAD_COOLDOWN_MS = 400;
export const EDGE_LOAD_CHUNK = 2;
export const MAX_TIMELINE_OFFSET = 36;

/**
 * @typedef {{ prevArmed: boolean, nextArmed: boolean }} EdgeArmFlags
 */

/**
 * Load at most once per approach to each edge; re-arm only after scrolling past exit threshold.
 *
 * @param {number} scrollLeft
 * @param {number} clientWidth
 * @param {number} scrollWidth
 * @param {EdgeArmFlags} arms
 * @returns {{ loadPrev: boolean, loadNext: boolean, arms: EdgeArmFlags }}
 */
export function evaluateTimelineEdgeLoad(scrollLeft, clientWidth, scrollWidth, arms) {
  const distFromRight = scrollWidth - (scrollLeft + clientWidth);
  let loadPrev = false;
  let loadNext = false;
  let prevArmed = arms.prevArmed;
  let nextArmed = arms.nextArmed;

  if (scrollLeft < EDGE_LOAD_ENTER_PX) {
    if (!prevArmed) loadPrev = true;
    prevArmed = true;
  } else if (scrollLeft >= EDGE_LOAD_EXIT_PX) {
    prevArmed = false;
  }

  if (distFromRight < EDGE_LOAD_ENTER_PX) {
    if (!nextArmed) loadNext = true;
    nextArmed = true;
  } else if (distFromRight >= EDGE_LOAD_EXIT_PX) {
    nextArmed = false;
  }

  return { loadPrev, loadNext, arms: { prevArmed, nextArmed } };
}

/**
 * @param {{ prev: number, next: number }} offsets
 * @param {{ loadPrev?: boolean, loadNext?: boolean }} loads
 * @param {number} [chunk]
 */
export function applyTimelineOffsetChunk(offsets, loads, chunk = EDGE_LOAD_CHUNK) {
  const c = Math.max(1, Math.floor(chunk));
  let prev = offsets.prev;
  let next = offsets.next;
  if (loads.loadPrev && prev < MAX_TIMELINE_OFFSET) {
    prev = Math.min(MAX_TIMELINE_OFFSET, prev + c);
  }
  if (loads.loadNext && next < MAX_TIMELINE_OFFSET) {
    next = Math.min(MAX_TIMELINE_OFFSET, next + c);
  }
  if (prev === offsets.prev && next === offsets.next) return offsets;
  return { prev, next };
}
