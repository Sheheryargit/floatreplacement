import { Hexagon, Wand2 } from "lucide-react";
import { motion, LayoutGroup, useReducedMotion } from "framer-motion";
import "./PalettePreferenceControl.css";

const OPTIONS = [
  { id: "default", label: "Alloc8", Icon: Hexagon, hue: "classic" },
  { id: "studio", label: "Studio", Icon: Wand2, hue: "studio" },
];

function PaletteSegIcon({ option, active, reduceMotion, Icon }) {
  return (
    <motion.span
      className={"float-palette-seg-ic-wrap float-palette-seg-ic-wrap--" + option.hue}
      aria-hidden
      initial={false}
      animate={
        reduceMotion
          ? {}
          : !active
            ? { rotate: 0, y: 0, x: 0 }
            : option.id === "studio"
              ? { rotate: [-2, 4, -2], y: [0, -1, 0] }
              : { rotate: [0, 6, -6, 0] }
      }
      transition={
        active && !reduceMotion
          ? { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.2 }
      }
      whileHover={
        reduceMotion
          ? {}
          : option.id === "studio"
            ? {
                rotate: [0, -8, 8, 0],
                scale: 1.1,
                transition: { duration: 0.45, ease: "easeOut" },
              }
            : {
                rotate: [0, 12, 0],
                scale: 1.08,
                transition: { type: "spring", stiffness: 400, damping: 20 },
              }
      }
      whileTap={reduceMotion ? {} : { scale: 0.88 }}
    >
      <Icon size={17} strokeWidth={active ? 2.15 : 1.95} className="float-palette-seg-ic" />
    </motion.span>
  );
}

/**
 * @param {{ value: "default" | "studio"; onChange: (id: "default" | "studio") => void }} props
 */
export function PalettePreferenceControl({ value, onChange }) {
  const reduceMotion = useReducedMotion();

  return (
    <LayoutGroup>
      <div className="float-palette-seg" role="radiogroup" aria-label="Visual style">
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
                "float-palette-seg-btn float-palette-seg-btn--" +
                opt.hue +
                (active ? " float-palette-seg-btn--active" : "")
              }
              onClick={() => onChange(opt.id)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 520, damping: 32 }}
            >
              {active ? (
                <motion.span
                  layoutId="palette-seg-pill"
                  className="float-palette-seg-glow"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <PaletteSegIcon
                option={opt}
                active={active}
                reduceMotion={reduceMotion}
                Icon={Icon}
              />
              <span className="float-palette-seg-lbl">{opt.label}</span>
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
