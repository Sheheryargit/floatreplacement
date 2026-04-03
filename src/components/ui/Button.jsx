import { forwardRef, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import "./Button.css";

/**
 * @typedef {"primary" | "secondary" | "destructive" | "warning" | "ghost"} ButtonVariant
 * @typedef {"sm" | "md" | "lg"} ButtonSize
 */

export const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "md",
    className,
    disabled,
    type = "button",
    children,
    onPointerDown,
    ...rest
  },
  ref
) {
  const reduceMotion = useReducedMotion();

  const setRippleOrigin = useCallback(
    (e) => {
      onPointerDown?.(e);
      if (reduceMotion || disabled || !e.currentTarget) return;
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      el.style.setProperty("--rx", `${x}%`);
      el.style.setProperty("--ry", `${y}%`);
    },
    [onPointerDown, reduceMotion, disabled]
  );

  const tap = reduceMotion || disabled ? undefined : { scale: 0.97 };
  const hover =
    reduceMotion || disabled
      ? undefined
      : variant === "primary" || variant === "destructive" || variant === "warning"
        ? { scale: 1.012 }
        : { scale: 1.01 };

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      className={clsx("alloc8-btn", `alloc8-btn--${variant}`, `alloc8-btn--${size}`, className)}
      whileTap={tap}
      whileHover={hover}
      transition={{ type: "spring", stiffness: 520, damping: 32 }}
      onPointerDown={setRippleOrigin}
      {...rest}
    >
      {children}
    </motion.button>
  );
});
