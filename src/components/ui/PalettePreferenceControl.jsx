import { motion, LayoutGroup } from "framer-motion";
import "./PalettePreferenceControl.css";

const OPTIONS = [
  { id: "alloc8", label: "Alloc8", sub: "Teal" },
  { id: "stellar", label: "Stellar", sub: "Graphite" },
];

export function PalettePreferenceControl({ value, onChange }) {
  return (
    <LayoutGroup>
      <div className="float-palette-seg" role="radiogroup" aria-label="Color palette">
        {OPTIONS.map((opt) => {
          const active = value === opt.id;
          return (
            <motion.button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={"float-palette-seg-btn" + (active ? " float-palette-seg-btn--active" : "")}
              onClick={() => onChange(opt.id)}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
            >
              {active ? (
                <motion.span
                  layoutId="palette-seg-pill"
                  className="float-palette-seg-glow"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <span
                className={
                  "float-palette-swatch float-palette-swatch--" + opt.id
                }
                aria-hidden
              />
              <span className="float-palette-seg-copy">
                <span className="float-palette-seg-lbl">{opt.label}</span>
                <span className="float-palette-seg-sub">{opt.sub}</span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
