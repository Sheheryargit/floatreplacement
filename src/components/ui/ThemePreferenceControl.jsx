import { Eclipse, SunMedium, MoonStar } from "lucide-react";
import { motion, LayoutGroup, useReducedMotion } from "framer-motion";
import "./ThemePreferenceControl.css";

const OPTIONS = [
  { id: "system", label: "System", Icon: Eclipse, hue: "system" },
  { id: "light", label: "Light", Icon: SunMedium, hue: "light" },
  { id: "dark", label: "Dark", Icon: MoonStar, hue: "dark" },
];

function ThemeSegIcon({ option, active, reduceMotion, Icon }) {
  const hoverTilt =
    option.id === "light" ? 10 : option.id === "dark" ? -10 : option.id === "system" ? 6 : 0;
  return (
    <motion.span
      className={"float-theme-seg-ic-wrap float-theme-seg-ic-wrap--" + option.hue}
      aria-hidden
      initial={false}
      animate={
        reduceMotion
          ? {}
          : !active
            ? { scale: 1, rotate: 0 }
            : option.id === "system"
              ? { rotate: [0, 360] }
              : { scale: [1, 1.06, 1], rotate: 0 }
      }
      transition={
        active && option.id === "system" && !reduceMotion
          ? { rotate: { duration: 14, repeat: Infinity, ease: "linear" } }
          : active && !reduceMotion
            ? { scale: { duration: 2.2, repeat: Infinity, ease: "easeInOut" } }
            : { duration: 0.22 }
      }
      whileHover={
        reduceMotion
          ? {}
          : {
              rotate: hoverTilt,
              scale: 1.08,
              transition: { type: "spring", stiffness: 420, damping: 22 },
            }
      }
      whileTap={reduceMotion ? {} : { scale: 0.88 }}
    >
      <Icon size={17} strokeWidth={active ? 2.15 : 1.95} className="float-theme-seg-ic" />
    </motion.span>
  );
}

export function ThemePreferenceControl({ value, onChange }) {
  const reduceMotion = useReducedMotion();

  return (
    <LayoutGroup>
      <div className="float-theme-seg" role="radiogroup" aria-label="Color theme">
        {OPTIONS.map((opt) => {
          const active = value === opt.id;
          const Icon = opt.Icon;
          return (
            <motion.button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={
                "float-theme-seg-btn float-theme-seg-btn--" +
                opt.hue +
                (active ? " float-theme-seg-btn--active" : "")
              }
              onClick={() => onChange(opt.id)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 520, damping: 32 }}
            >
              {active ? (
                <motion.span
                  layoutId="theme-seg-pill"
                  className="float-theme-seg-glow"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <ThemeSegIcon
                option={opt}
                active={active}
                reduceMotion={reduceMotion}
                Icon={Icon}
              />
              <span className="float-theme-seg-lbl">{opt.label}</span>
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
