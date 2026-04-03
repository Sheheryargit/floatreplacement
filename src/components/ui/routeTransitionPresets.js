/** Page enter/exit presets — each route mount picks one at random (stable for that instance’s exit). */

const spring = { type: "spring", stiffness: 380, damping: 34, mass: 0.85 };
const ease = [0.22, 1, 0.36, 1];

export const PAGE_VARIANT_SIMPLE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};

export const PAGE_VARIANTS = [
  {
    initial: { opacity: 0, y: 18, filter: "blur(8px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, y: -12, filter: "blur(6px)" },
    transition: { duration: 0.38, ease },
  },
  {
    initial: { opacity: 0, scale: 0.96, x: 28 },
    animate: { opacity: 1, scale: 1, x: 0 },
    exit: { opacity: 0, scale: 0.98, x: -20 },
    transition: spring,
  },
  {
    initial: { opacity: 0, rotateX: 8, y: 24, transformPerspective: 900 },
    animate: { opacity: 1, rotateX: 0, y: 0, transformPerspective: 900 },
    exit: { opacity: 0, rotateX: -6, y: -16, transformPerspective: 900 },
    transition: { duration: 0.42, ease },
  },
  {
    initial: { opacity: 0, clipPath: "inset(12% 8% 12% 8% round 12px)" },
    animate: { opacity: 1, clipPath: "inset(0% 0% 0% 0% round 0px)" },
    exit: { opacity: 0, clipPath: "inset(8% 6% 8% 6% round 10px)" },
    transition: { duration: 0.4, ease },
  },
  {
    initial: { opacity: 0, x: "-4%", skewX: 2 },
    animate: { opacity: 1, x: "0%", skewX: 0 },
    exit: { opacity: 0, x: "3%", skewX: -1 },
    transition: { duration: 0.36, ease },
  },
];
