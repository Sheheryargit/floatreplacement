/** Row height morph timing — keep in sync with schedule-row-motion.css */

export const SCHEDULE_ROW_GROW_MS = 380;
export const SCHEDULE_ROW_SHRINK_MS = 300;
export const SCHEDULE_ROW_MORPH_BUFFER_MS = 48;

/**
 * @param {number | undefined} prevH
 * @param {number} nextH
 * @returns {'grow' | 'shrink' | 'enter' | null}
 */
export function rowMotionKind(prevH, nextH) {
  if (prevH == null || !Number.isFinite(prevH)) return "enter";
  const d = nextH - prevH;
  if (d > 1.5) return "grow";
  if (d < -1.5) return "shrink";
  return null;
}

/** @param {'grow' | 'shrink' | 'enter' | null} kind */
export function motionDurationMs(kind) {
  if (kind === "grow" || kind === "enter") return SCHEDULE_ROW_GROW_MS;
  if (kind === "shrink") return SCHEDULE_ROW_SHRINK_MS;
  return 0;
}

export function beginScheduleHeightMorph(viewportEl) {
  viewportEl?.classList.add("lp-schedule-viewport--height-morph");
}

export function endScheduleHeightMorph(viewportEl) {
  viewportEl?.classList.remove("lp-schedule-viewport--height-morph");
  clearRowMotionTags(viewportEl);
}

export function tagRowMotionBeforeResize(viewportEl, index, kind) {
  if (!viewportEl || !kind) return;
  const el = viewportEl.querySelector(`[data-index="${index}"]`);
  if (el) el.setAttribute("data-row-motion", kind);
}

export function clearRowMotionTags(viewportEl) {
  if (!viewportEl) return;
  viewportEl.querySelectorAll("[data-row-motion]").forEach((el) => {
    el.removeAttribute("data-row-motion");
  });
}

/** Double rAF so the browser commits morph class before inline height/top changes. */
export function waitForNextFrames(count = 2) {
  return new Promise((resolve) => {
    let left = Math.max(1, count);
    const step = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

export function waitScheduleRowMorph(ms) {
  const t = Math.max(0, ms);
  return new Promise((resolve) => setTimeout(resolve, t));
}
