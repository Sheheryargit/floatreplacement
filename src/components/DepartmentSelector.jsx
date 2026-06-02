import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, Check } from "lucide-react";
import "./DepartmentSelector.css";

const NO_DEPT = "No department";

function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

/** Sorted lookup list + ensure current assignment is selectable. */
function departmentOptions(depts, currentValue) {
  const seen = new Set();
  const out = [];
  const add = (name) => {
    const n = String(name).trim();
    if (!n) return;
    const k = norm(n);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(n);
  };
  for (const d of depts || []) add(d);
  const cur = String(currentValue || "").trim();
  if (cur) add(cur);
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * Read-only department picker for person profile — manage departments on /departments.
 */
export function DepartmentSelector({ t, value, onChange, depts }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const searchRef = useRef(null);
  const wrapRef = useRef(null);

  const items = useMemo(() => departmentOptions(depts, value), [depts, value]);

  const filtered = useMemo(() => {
    const qq = norm(q);
    if (!qq) return items;
    return items.filter((name) => norm(name).includes(qq));
  }, [items, q]);

  const displayValue = value && String(value).trim() ? String(value).trim() : NO_DEPT;

  useEffect(() => {
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
    if (!open) setQ("");
  }, [open]);

  const pick = (name) => {
    onChange(name === NO_DEPT ? NO_DEPT : name);
    setOpen(false);
    setQ("");
  };

  const onSearchKeyDown = (e) => {
    if (e.key === "Enter" && filtered.length === 1) {
      e.preventDefault();
      pick(filtered[0]);
    }
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="dept-sel" ref={wrapRef}>
      <motion.button
        type="button"
        className="dept-sel-trigger"
        style={{
          background: t.surfAlt,
          border: `1.5px solid ${open ? t.focus : t.borderIn}`,
          color: displayValue === NO_DEPT ? t.textMuted : t.text,
          boxShadow: open ? `0 0 0 3px ${t.accentGlow}` : "none",
        }}
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.995 }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="dept-sel-trigger-label">{displayValue}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: "flex", color: t.textMuted }}
        >
          <ChevronDown size={16} strokeWidth={2} />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="dept-sel-backdrop"
              style={{ background: "transparent" }}
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="dept-sel-panel"
              role="listbox"
              style={{
                background: t.surfRaised,
                border: `1px solid ${t.border}`,
                boxShadow: t.shadow,
                "--dept-sel-panel-bg": t.surfRaised,
                "--dept-sel-search-bg": t.surfAlt,
                "--dept-sel-border": t.border,
                "--dept-sel-focus": t.focus,
                "--dept-sel-input-bg": t.surfAlt,
              }}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="dept-sel-search">
                <Search size={15} style={{ color: t.textMuted, flexShrink: 0 }} />
                <input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                  placeholder="Search departments…"
                  style={{ color: t.text }}
                  aria-label="Search departments"
                />
              </div>

              <div className="dept-sel-list">
                <button
                  type="button"
                  className="dept-sel-option"
                  onClick={() => pick(NO_DEPT)}
                  style={{
                    background: displayValue === NO_DEPT ? t.accentGlow : "transparent",
                    color: t.text,
                  }}
                >
                  {NO_DEPT}
                  {displayValue === NO_DEPT ? (
                    <Check size={14} style={{ color: t.accent, flexShrink: 0 }} />
                  ) : null}
                </button>

                {filtered.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="dept-sel-option"
                    onClick={() => pick(name)}
                    style={{
                      background: value === name ? t.accentGlow : "transparent",
                      color: t.text,
                    }}
                  >
                    <span className="dept-sel-option-label">{name}</span>
                    {value === name ? (
                      <Check size={14} style={{ color: t.accent, flexShrink: 0 }} />
                    ) : null}
                  </button>
                ))}

                {filtered.length === 0 && (
                  <div className="dept-sel-empty" style={{ color: t.textMuted }}>
                    No matching departments
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
