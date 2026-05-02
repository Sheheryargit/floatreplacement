/** localStorage: show Underallocated / On target / Overallocated on schedule person rows. */
export const PEAK_LOAD_LABELS_LS_KEY = "float.showPeakLoadStatus.v1";

export const PEAK_LOAD_LABELS_CHANGED_EVENT = "float-peak-load-labels-change";

export function readPeakLoadLabelsVisible() {
  try {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem(PEAK_LOAD_LABELS_LS_KEY);
    if (v === null) return true;
    return v === "1" || v === "true";
  } catch {
    return true;
  }
}

export function writePeakLoadLabelsVisible(visible) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PEAK_LOAD_LABELS_LS_KEY, visible ? "1" : "0");
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(PEAK_LOAD_LABELS_CHANGED_EVENT));
  } catch {
    // ignore
  }
}
