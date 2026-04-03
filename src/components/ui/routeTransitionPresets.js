/** Page transitions — Alloc8: fadeSlideUp, max ~300ms */

const ease = [0.22, 1, 0.36, 1];

export const PAGE_VARIANT_SIMPLE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};

/** Default route transition */
export const PAGE_VARIANT_FADE_SLIDE = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6 },
  transition: { duration: 0.22, ease },
};

export const PAGE_VARIANTS = [
  PAGE_VARIANT_FADE_SLIDE,
  {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.24, ease },
  },
];
