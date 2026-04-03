import "./ToggleSwitch.css";

/**
 * Accessible binary toggle (e.g. future feature flags).
 * `checked` + `onChange` — smooth spring motion via CSS.
 */
export function ToggleSwitch({
  id,
  checked,
  onChange,
  disabled,
  label,
  "aria-label": ariaLabel,
}) {
  return (
    <label className={`float-toggle ${disabled ? "float-toggle--disabled" : ""}`} htmlFor={id}>
      <span className="float-toggle-track">
        <input
          id={id}
          type="checkbox"
          className="float-toggle-input"
          role="switch"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          disabled={disabled}
          aria-label={ariaLabel ?? label}
        />
        <span className="float-toggle-thumb" aria-hidden />
      </span>
      {label ? <span className="float-toggle-label">{label}</span> : null}
    </label>
  );
}
