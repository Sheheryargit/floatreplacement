import { Pipette } from "lucide-react";
import { Button } from "./Button.jsx";
import "./CanvasTintPreferenceControl.css";

const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Pick a hex tint for the workspace canvas (mixed with the active light/dark base).
 * @param {{ value: string; onChange: (hex: string) => void; theme: "light" | "dark" }} props
 */
export function CanvasTintPreferenceControl({ value, onChange, theme }) {
  const trimmed = (value || "").trim();
  const valid = HEX.test(trimmed);
  const pickerValue = valid ? trimmed : theme === "light" ? "#94a3b8" : "#475569";

  return (
    <div className="float-canvas-tint">
      <label className="float-canvas-tint-swatch" title="Pick a tint color">
        <input
          type="color"
          className="float-canvas-tint-input"
          value={pickerValue}
          aria-label="Canvas tint color"
          onChange={(e) => onChange(e.target.value.toLowerCase())}
        />
        <span className="float-canvas-tint-preview" style={{ background: pickerValue }} aria-hidden />
        <Pipette size={16} strokeWidth={2} className="float-canvas-tint-ico" aria-hidden />
      </label>
      <input
        type="text"
        className="float-canvas-tint-hex"
        value={trimmed}
        placeholder="#6366f1"
        spellCheck={false}
        maxLength={7}
        aria-label="Hex color"
        onChange={(e) => onChange(e.target.value)}
      />
      <Button type="button" variant="ghost" size="sm" className="float-canvas-tint-reset" onClick={() => onChange("")}>
        Reset
      </Button>
    </div>
  );
}
