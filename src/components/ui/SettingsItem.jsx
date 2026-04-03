import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import clsx from "clsx";
import "./SettingsItem.css";

/**
 * Row for settings: label, optional subtext, optional trailing control, optional chevron.
 */
export function SettingsItem({
  icon: Icon,
  label,
  subtext,
  children,
  onClick,
  disabled,
  dim,
  showChevron,
  className,
}) {
  const interactive = Boolean(onClick) && !disabled;
  return (
    <motion.div
      className={clsx(
        "float-settings-item",
        interactive && "float-settings-item--interactive",
        disabled && "float-settings-item--disabled",
        dim && "float-settings-item--dim",
        className
      )}
      onClick={interactive ? onClick : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.(e);
              }
            }
          : undefined
      }
      whileHover={interactive ? { scale: 1.005 } : undefined}
      whileTap={interactive ? { scale: 0.995 } : undefined}
      transition={{ type: "spring", stiffness: 480, damping: 32 }}
    >
      {Icon ? (
        <span className="float-settings-item-icon" aria-hidden>
          <Icon size={20} strokeWidth={1.85} />
        </span>
      ) : null}
      <div className="float-settings-item-text">
        <div className="float-settings-item-label">{label}</div>
        {subtext ? <div className="float-settings-item-sub">{subtext}</div> : null}
      </div>
      <div className="float-settings-item-trail">{children}</div>
      {showChevron ? (
        <ChevronRight className="float-settings-item-chevron" size={18} strokeWidth={2} aria-hidden />
      ) : null}
    </motion.div>
  );
}
