/** Page transitions — consistent fade + translate, ease-in-out */

const easeInOut = [0.45, 0, 0.55, 1];

export const PAGE_VARIANT_SIMPLE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: easeInOut },
};

/** Default route transition (all screens) */
export const PAGE_VARIANT_FADE_SLIDE = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
  transition: { duration: 0.28, ease: easeInOut },
};

export const PAGE_VARIANTS = [PAGE_VARIANT_FADE_SLIDE];
