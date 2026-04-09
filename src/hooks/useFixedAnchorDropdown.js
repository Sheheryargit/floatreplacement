import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Table-friendly dropdown: fixed position under trigger, right-aligned.
 * Use with createPortal(..., document.body) so menus sit above later rows and scroll containers.
 */
export function useFixedAnchorDropdown(open, onRequestClose) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const update = useCallback(() => {
    const el = triggerRef.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, update]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      onRequestClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onRequestClose]);

  return { triggerRef, menuRef, pos };
}
