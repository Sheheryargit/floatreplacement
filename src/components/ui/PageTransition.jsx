import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PAGE_VARIANTS, PAGE_VARIANT_SIMPLE } from "./routeTransitionPresets.js";

/**
 * Wraps a route screen. Random preset is fixed for this mount so exit animation stays consistent.
 */
export default function PageTransition({ children }) {
  const reduceMotion = useReducedMotion();
  const preset = useMemo(() => {
    if (reduceMotion) return PAGE_VARIANT_SIMPLE;
    return PAGE_VARIANTS[Math.floor(Math.random() * PAGE_VARIANTS.length)];
  }, [reduceMotion]);

  return (
    <motion.div
      className="float-page-transition"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={{
        initial: preset.initial,
        animate: preset.animate,
        exit: preset.exit,
      }}
      transition={preset.transition}
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
    >
      {children}
    </motion.div>
  );
}
