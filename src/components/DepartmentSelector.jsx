import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  motion,
  AnimatePresence,
  LayoutGroup,
} from "framer-motion";
import {
  Search,
  ChevronDown,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { DEFAULT_DEPARTMENTS } from "../constants/departments.js";
import "./DepartmentSelector.css";

const NO_DEPT = "No department";

function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

/** Merge default + stored list, unique by case-insensitive name, sorted. */
export function mergeDepartmentList(depts, ensureName) {
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
  for (const d of DEFAULT_DEPARTMENTS) add(d);
  for (const d of depts || []) add(d);
  if (ensureName && ensureName !== NO_DEPT) add(ensureName);
  return out.sort((a, b) => a.localeCompare(b));
}

function listsEqual(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].map(norm).sort();
  const sb = [...b].map(norm).sort();
  return sa.every((v, i) => v === sb[i]);
}

/**
 * Premium department picker: search, add, inline edit, remove, save with confirm.
 * Single selection for the person's department (`value` / `onChange`).
 */
export function DepartmentSelector({ t, value, onChange, depts, setDepts }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const searchRef = useRef(null);
  const wrapRef = useRef(null);
  const editInputRef = useRef(null);
  const blurTimer = useRef(null);

  const baseline = useMemo(() => mergeDepartmentList(depts, value), [depts, value]);
  const [items, setItems] = useState(() => mergeDepartmentList(depts, value));
  useEffect(() => {
    setItems(mergeDepartmentList(depts, value));
  }, [depts]);

  const dirty = !listsEqual(items, baseline);

  const [editingName, setEditingName] = useState(null);
  const [editBuffer, setEditBuffer] = useState("");

  const [saveModal, setSaveModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  useEffect(() => {
    if (editingName && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingName]);

  const filtered = useMemo(() => {
    const qq = norm(q);
    if (!qq) return items;
    return items.filter((name) => norm(name).includes(qq));
  }, [items, q]);

  const canAdd =
    q.trim() &&
    !items.some((name) => norm(name) === norm(q.trim()));

  const displayValue =
    value && value !== NO_DEPT ? value : NO_DEPT;

  const commitRename = useCallback(
    (oldName) => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
      const next = editBuffer.trim();
      if (!next) {
        setEditingName(null);
        setEditBuffer("");
        return;
      }
      if (items.some((n) => n !== oldName && norm(n) === norm(next))) {
        return;
      }
      setItems((prev) =>
        prev.map((n) => (n === oldName ? next : n)).sort((a, b) => a.localeCompare(b))
      );
      if (value === oldName) onChange(next);
      setEditingName(null);
      setEditBuffer("");
    },
    [editBuffer, items, onChange, value]
  );

  const cancelEdit = useCallback(() => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setEditingName(null);
    setEditBuffer("");
  }, []);

  const removeName = useCallback(
    (name) => {
      setItems((prev) => prev.filter((n) => n !== name));
      if (value === name) onChange(NO_DEPT);
    },
    [value, onChange]
  );

  const addName = useCallback(
    (raw) => {
      const name = String(raw).trim();
      if (!name) return;
      if (items.some((n) => norm(n) === norm(name))) return;
      setItems((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
      onChange(name);
      setQ("");
    },
    [items, onChange]
  );

  const onSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (canAdd) addName(q.trim());
      else if (filtered.length === 1) {
        onChange(filtered[0]);
        setOpen(false);
        setQ("");
      }
    }
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  };

  const confirmSave = () => {
    setDepts(items);
    setSaveModal(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 900);
  };

  const glassBg =
    t.bg === "#0b0e14"
      ? "rgba(22, 26, 38, 0.82)"
      : "rgba(255, 255, 255, 0.86)";

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
              style={{
                background: glassBg,
                border: `1px solid ${t.border}`,
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                "--dept-sel-border": t.border,
                "--dept-sel-focus": t.focus,
                "--dept-sel-input-bg": t.surfAlt,
              }}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="dept-sel-search" style={{ background: t.surfAlt }}>
                <Search size={15} style={{ color: t.textMuted, flexShrink: 0 }} />
                <input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                  placeholder="Search or add a department..."
                  style={{ color: t.text }}
                />
              </div>

              {canAdd && (
                <motion.button
                  type="button"
                  className="dept-sel-add-hint"
                  style={{ color: t.accent, background: "transparent", width: "100%", textAlign: "left", border: "none" }}
                  onClick={() => addName(q.trim())}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  whileHover={{ background: t.accentGlow }}
                >
                  Add &lsquo;{q.trim()}&rsquo;
                </motion.button>
              )}

              <div className="dept-sel-list">
                <button
                  type="button"
                  onClick={() => {
                    onChange(NO_DEPT);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    marginBottom: 6,
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                    background:
                      displayValue === NO_DEPT ? t.accentGlow : "transparent",
                    color: t.text,
                  }}
                >
                  {NO_DEPT}
                  {displayValue === NO_DEPT ? (
                    <Check
                      size={14}
                      style={{ float: "right", color: t.accent, marginTop: 2 }}
                    />
                  ) : null}
                </button>

                <LayoutGroup>
                  <AnimatePresence initial={false}>
                    {filtered.map((name) => (
                      <motion.div
                        key={name}
                        layout
                        className="dept-sel-row"
                        style={{
                          background:
                            value === name ? t.accentGlow : "transparent",
                          border:
                            value === name
                              ? `1px solid ${t.border}`
                              : "1px solid transparent",
                        }}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{
                          layout: { type: "spring", stiffness: 420, damping: 34 },
                          opacity: { duration: 0.2 },
                        }}
                        whileHover={{
                          scale: 1.02,
                          boxShadow: `0 0 20px ${t.accentGlow}`,
                        }}
                      >
                        {editingName === name ? (
                          <input
                            ref={editInputRef}
                            className="dept-sel-row-input"
                            style={{ color: t.text }}
                            value={editBuffer}
                            onChange={(e) => setEditBuffer(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitRename(name);
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                cancelEdit();
                              }
                            }}
                            onBlur={() => {
                              if (blurTimer.current) clearTimeout(blurTimer.current);
                              blurTimer.current = window.setTimeout(() => {
                                commitRename(name);
                              }, 160);
                            }}
                          />
                        ) : (
                          <span
                            className="dept-sel-row-name"
                            style={{ color: t.text }}
                            onClick={() => {
                              onChange(name);
                              setOpen(false);
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                onChange(name);
                                setOpen(false);
                              }
                            }}
                          >
                            {name}
                          </span>
                        )}
                        {editingName !== name ? (
                          <>
                            <motion.button
                              type="button"
                              className="dept-sel-icon-btn dept-sel-icon-btn--edit"
                              aria-label={`Edit ${name}`}
                              title="Edit"
                              whileHover={{ scale: 1.06 }}
                              whileTap={{ scale: 0.94 }}
                              onMouseDown={() => {
                                if (blurTimer.current) clearTimeout(blurTimer.current);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingName(name);
                                setEditBuffer(name);
                              }}
                            >
                              <Pencil size={15} strokeWidth={2} />
                            </motion.button>
                            <motion.button
                              type="button"
                              className="dept-sel-icon-btn dept-sel-icon-btn--remove"
                              aria-label={`Remove ${name}`}
                              title="Remove"
                              whileHover={{ scale: 1.06 }}
                              whileTap={{ scale: 0.94 }}
                              onMouseDown={() => {
                                if (blurTimer.current) clearTimeout(blurTimer.current);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeName(name);
                              }}
                            >
                              <X size={16} strokeWidth={2.2} />
                            </motion.button>
                          </>
                        ) : null}
                        {value === name && editingName !== name ? (
                          <Check size={15} style={{ color: t.accent, flexShrink: 0 }} />
                        ) : null}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </LayoutGroup>

                {filtered.length === 0 && !canAdd && (
                  <div className="dept-sel-empty" style={{ color: t.textMuted }}>
                    No matching departments
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        className="dept-sel-save"
        disabled={!dirty}
        style={{
          background: dirty ? t.accent : t.btnSec,
          color: dirty ? t.accentTxt : t.btnSecTxt,
          border: `1px solid ${dirty ? t.accentSoft : t.border}`,
          boxShadow: dirty ? t.infoGlow : "none",
        }}
        onClick={() => dirty && setSaveModal(true)}
        animate={
          saveSuccess
            ? { scale: [1, 0.92, 1.06, 1], rotate: [0, -2, 2, 0] }
            : { scale: 1 }
        }
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        whileHover={dirty ? { scale: 1.02 } : {}}
        whileTap={dirty ? { scale: 0.98 } : {}}
      >
        {saveSuccess ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <Check size={16} strokeWidth={2.5} /> Saved
          </span>
        ) : (
          "Save departments"
        )}
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {saveModal ? (
            <motion.div
              key="dept-save-modal"
              className="dept-sel-modal-overlay"
              style={{ background: t.overlay }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSaveModal(false)}
            >
              <motion.div
                className="dept-sel-modal"
                style={{ background: t.surfRaised, color: t.text }}
                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
                  Save Changes?
                </div>
                <p style={{ margin: 0, color: t.textMuted, fontSize: 14, lineHeight: 1.55 }}>
                  Your department updates will be applied.
                </p>
                <div className="dept-sel-modal-actions">
                  <button
                    type="button"
                    style={{
                      background: t.btnSec,
                      color: t.btnSecTxt,
                      border: `1px solid ${t.border}`,
                    }}
                    onClick={() => setSaveModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    style={{
                      background: t.accent,
                      color: t.accentTxt,
                      border: `1px solid ${t.accentSoft}`,
                      boxShadow: t.infoGlow,
                    }}
                    onClick={confirmSave}
                  >
                    Confirm Save
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
