import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PAGE_VARIANT_FADE_SLIDE, PAGE_VARIANT_SIMPLE } from "./routeTransitionPresets.js";

/** Wraps a route screen — same enter/exit curve every navigation (no random presets). */
export default function PageTransition({ children }) {
  const reduceMotion = useReducedMotion();
  const preset = useMemo(
    () => (reduceMotion ? PAGE_VARIANT_SIMPLE : PAGE_VARIANT_FADE_SLIDE),
    [reduceMotion]
  );

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
