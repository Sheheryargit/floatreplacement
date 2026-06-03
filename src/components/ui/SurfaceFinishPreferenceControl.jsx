import { Layers, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import "./SurfaceFinishPreferenceControl.css";

const OPTIONS = [
  { id: "standard", label: "Standard", Icon: Layers },
  { id: "satin", label: "Satin", Icon: Sparkles },
];

export function SurfaceFinishPreferenceControl({ value, onChange }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="float-surface-finish-seg" role="radiogroup" aria-label="Surface finish">
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
              "float-surface-finish-seg-btn" +
              (active ? " float-surface-finish-seg-btn--active" : "")
            }
            onClick={() => onChange(opt.id)}
            whileHover={reduceMotion ? undefined : { scale: 1.02 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
          >
            <Icon size={15} strokeWidth={active ? 2.2 : 1.9} aria-hidden />
            {opt.label}
          </motion.button>
        );
      })}
    </div>
  );
}
