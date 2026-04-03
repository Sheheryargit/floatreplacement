import { Monitor, Sun, Moon } from "lucide-react";
import { motion, LayoutGroup } from "framer-motion";
import "./ThemePreferenceControl.css";

const OPTIONS = [
  { id: "system", label: "System", Icon: Monitor },
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
];

export function ThemePreferenceControl({ value, onChange }) {
  return (
    <LayoutGroup>
    <div className="float-theme-seg" role="radiogroup" aria-label="Appearance">
      {OPTIONS.map((opt) => {
        const active = value === opt.id;
        const Icon = opt.Icon;
        return (
          <motion.button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={"float-theme-seg-btn" + (active ? " float-theme-seg-btn--active" : "")}
            onClick={() => onChange(opt.id)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            {active ? (
              <motion.span
                layoutId="theme-seg-pill"
                className="float-theme-seg-glow"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : null}
            <Icon size={16} strokeWidth={2} aria-hidden className="float-theme-seg-ic" />
            <span className="float-theme-seg-lbl">{opt.label}</span>
          </motion.button>
        );
      })}
    </div>
    </LayoutGroup>
  );
}
