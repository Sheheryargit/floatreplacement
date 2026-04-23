import {
  useState,
  useRef,
  useEffect,
  useId,
  useMemo,
  useCallback,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Search, Check, Plus, UserPlus } from "lucide-react";
import { avatarGradientFromName } from "../../utils/projectColors.js";
import "./FloatSelect.css";

function normalizeOptions(options) {
  if (!options?.length) return [];
  return options.map((o) => {
    if (typeof o === "string") return { label: o, value: o, raw: o };
    return {
      label: o.label ?? String(o.value ?? ""),
      value: o.value ?? o.label,
      raw: o,
    };
  });
}

/**
 * Creatable combobox aligned with Alloc8 / modal forms.
 * `value` is the stored option value; trigger shows matching label.
 */
export function FloatSelect({
  t,
  value,
  onChange,
  options = [],
  placeholder = "Select an option",
  renderOption,
  renderSelected,
  creatable = true,
  searchPlaceholder = "Search or type to add new…",
  placement = "below",
  disabled = false,
  "aria-label": ariaLabel,
  /** Force remount / reopen kick (optional) */
  menuKey = 0,
}) {
  const uid = useId();
  const listboxId = `float-select-${uid}`;
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const inputRef = useRef(null);
  const lastKick = useRef(0);

  const norm = useMemo(() => normalizeOptions(options), [options]);
  const labelsLower = useMemo(
    () => new Set(norm.map((n) => n.label.toLowerCase())),
    [norm]
  );

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return norm;
    return norm.filter((n) => n.label.toLowerCase().includes(qq));
  }, [norm, q]);

  const canCreate =
    creatable &&
    q.trim() &&
    !labelsLower.has(q.trim().toLowerCase());

  const rows = useMemo(() => {
    const r = [];
    if (canCreate) r.push({ type: "create", key: "__create__", label: q.trim() });
    filtered.forEach((n) =>
      r.push({ type: "opt", key: String(n.value), ...n })
    );
    return r;
  }, [canCreate, filtered, q]);

  const selectedLabel = useMemo(() => {
    const m = norm.find(
      (n) => n.value === value || String(n.value) === String(value)
    );
    if (m) return m.label;
    if (value !== undefined && value !== null && value !== "")
      return String(value);
    return null;
  }, [norm, value]);

  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (menuKey > lastKick.current) {
      lastKick.current = menuKey;
      setOpen(true);
    }
  }, [menuKey]);

  useEffect(() => {
    if (open) {
      setQ("");
      setHi(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (rows.length === 0) {
      setHi(0);
      return;
    }
    setHi((i) => Math.min(i, rows.length - 1));
  }, [rows.length, open, q, canCreate]);

  const pick = useCallback(
    (row) => {
      if (!row) return;
      if (row.type === "create") onChange(row.label);
      else onChange(row.value);
      setOpen(false);
      setQ("");
    },
    [onChange]
  );

  const onTriggerKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onSearchKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => Math.min(i + 1, Math.max(0, rows.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[hi];
      if (row) pick(row);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  };

  const panelVars = {
    "--float-select-border": t.border,
  };

  const isPlaceholder = !selectedLabel;
  const selectedOpt = useMemo(() => norm.find((n) => n.value === value || String(n.value) === String(value)), [norm, value]);

  return (
    <div className="float-select" ref={ref}>
      <button
        type="button"
        className="float-select-trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        data-placeholder={isPlaceholder ? "true" : "false"}
        style={{
          background: t.surfAlt,
          border: `1.5px solid ${open ? t.focus : t.borderIn}`,
          color: isPlaceholder ? t.textMuted : t.text,
          boxShadow: open ? `0 0 0 3px ${t.accentGlow}` : "none",
        }}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="float-select-trigger-label">
          {renderSelected && selectedOpt ? renderSelected(selectedOpt.raw, t) : (selectedLabel || placeholder)}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          style={{
            color: t.textMuted,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={listboxId}
            role="listbox"
            key="float-select-panel"
            className={
              "float-select-panel float-select-panel--" +
              (placement === "above" ? "above" : "below")
            }
            style={{
              background: t.surfRaised,
              ...panelVars,
            }}
            initial={
              reduceMotion
                ? false
                : { opacity: 0, y: placement === "above" ? 8 : -8, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? undefined
                : { opacity: 0, y: placement === "above" ? 6 : -6, scale: 0.98 }
            }
            transition={{ duration: 0.22, ease: [0.45, 0, 0.55, 1] }}
          >
          <div
            className="float-select-search"
            style={{
              background: t.surfAlt,
              borderColor: t.border,
            }}
          >
            <Search size={15} strokeWidth={2} style={{ color: t.textMuted }} />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={searchPlaceholder}
              aria-autocomplete="list"
              style={{ color: t.text }}
            />
          </div>
          <div className="float-select-list">
            {rows.length === 0 ? (
              <div className="float-select-empty" style={{ color: t.textMuted }}>
                No matching options
              </div>
            ) : (
              rows.map((row, i) => {
                const active =
                  row.type === "opt" &&
                  (row.value === value || String(row.value) === String(value));
                const hl = i === hi;
                return (
                  <button
                    key={row.key}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={
                      "float-select-option" +
                      (row.type === "create" ? " float-select-option--create" : "")
                    }
                    style={{
                      color: row.type === "create" ? t.accent : t.text,
                      background: hl
                        ? t.accentGlow
                        : active
                          ? t.accentGlow
                          : "transparent",
                      outline: hl ? `1px solid ${t.focus}` : "none",
                      outlineOffset: -1,
                    }}
                    onMouseEnter={() => setHi(i)}
                    onClick={() => pick(row)}
                  >
                    <span className="float-select-option-body">
                      {row.type === "create" ? (
                        <>
                          <Plus
                            size={14}
                            strokeWidth={2.25}
                            style={{
                              display: "inline",
                              verticalAlign: "middle",
                              marginRight: 6,
                            }}
                          />
                          Create &ldquo;{row.label}&rdquo;
                        </>
                      ) : renderOption ? (
                        renderOption(row.raw, t)
                      ) : (
                        row.label
                      )}
                    </span>
                    {active && row.type === "opt" ? (
                      <Check size={16} strokeWidth={2.25} style={{ color: t.accent, flexShrink: 0 }} />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const ini = (n) => {
  if (!n) return "";
  const p = n.trim().split(/\s+/);
  return p.length === 1
    ? (p[0][0] || "").toUpperCase()
    : (p[0][0] + p[p.length - 1][0]).toUpperCase();
};

/**
 * Single-select people picker (team members, etc.). Search on top, list below.
 */
export function FloatPersonPicker({
  t,
  people = [],
  excludeIds = [],
  onPick,
  placeholder = "Add team member",
  placement = "below",
  emptyAllMessage = "Everyone on this list is already on the team.",
  emptyFilterMessage = "No people match your search.",
}) {
  const uid = useId();
  const listboxId = `float-person-${uid}`;
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const available = useMemo(
    () =>
      people.filter(
        (p) => !p.archived && !excludeIds.some((id) => String(id) === String(p.id))
      ),
    [people, excludeIds]
  );

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return available.filter((p) => {
      if (!qq) return true;
      return (
        p.name.toLowerCase().includes(qq) ||
        String(p.role || "")
          .toLowerCase()
          .includes(qq) ||
        String(p.department || "")
          .toLowerCase()
          .includes(qq)
      );
    });
  }, [available, q]);

  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setHi(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setHi((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const pick = (p) => {
    onPick(p.id);
    setOpen(false);
    setQ("");
  };

  const onSearchKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const p = filtered[hi];
      if (p) pick(p);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="float-select" ref={ref}>
      <button
        type="button"
        className="float-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        style={{
          background: t.surfAlt,
          border: `1.5px solid ${open ? t.focus : t.borderIn}`,
          color: t.textMuted,
          boxShadow: open ? `0 0 0 3px ${t.accentGlow}` : "none",
        }}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <UserPlus size={16} strokeWidth={2} style={{ color: t.accent, flexShrink: 0 }} />
        <span className="float-select-trigger-label" style={{ textAlign: "left" }}>
          {placeholder}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          style={{
            color: t.textMuted,
            marginLeft: "auto",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s ease",
          }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={listboxId}
            role="listbox"
            key="float-person-panel"
            className={
              "float-select-panel float-select-panel--" +
              (placement === "above" ? "above" : "below")
            }
            style={{ background: t.surfRaised, "--float-select-border": t.border }}
            initial={
              reduceMotion
                ? false
                : { opacity: 0, y: placement === "above" ? 8 : -8, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? undefined
                : { opacity: 0, y: placement === "above" ? 6 : -6, scale: 0.98 }
            }
            transition={{ duration: 0.22, ease: [0.45, 0, 0.55, 1] }}
          >
          <div className="float-select-search" style={{ background: t.surfAlt }}>
            <Search size={15} strokeWidth={2} style={{ color: t.textMuted }} />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search by name, role, or department…"
              style={{ color: t.text }}
              aria-autocomplete="list"
            />
          </div>
          <div className="float-select-list">
            {available.length === 0 ? (
              <div className="float-select-empty" style={{ color: t.textMuted }}>
                {emptyAllMessage}
              </div>
            ) : filtered.length === 0 ? (
              <div className="float-select-empty" style={{ color: t.textMuted }}>
                {emptyFilterMessage}
              </div>
            ) : (
              filtered.map((p, i) => {
                const hl = i === hi;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    className="float-select-option"
                    style={{
                      color: t.text,
                      background: hl ? t.accentGlow : "transparent",
                      outline: hl ? `1px solid ${t.focus}` : "none",
                      outlineOffset: -1,
                    }}
                    onMouseEnter={() => setHi(i)}
                    onClick={() => pick(p)}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: avatarGradientFromName(p.name),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#fff",
                        flexShrink: 0,
                      }}
                    >
                      {ini(p.name)}
                    </div>
                    <div className="float-select-option-body" style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: t.textMuted,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          flexWrap: "wrap",
                        }}
                      >
                        {p.role && p.role !== "—" ? <span>{p.role}</span> : null}
                        {p.role && p.role !== "—" && p.department ? (
                          <span style={{ color: t.textDim }} aria-hidden>
                            ·
                          </span>
                        ) : null}
                        {p.department ? <span>{p.department}</span> : null}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: t.accent,
                        flexShrink: 0,
                      }}
                    >
                      Add
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
