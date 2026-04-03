import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Search,
  CalendarDays,
  Users,
  FolderOpen,
  Settings,
  UserPlus,
} from "lucide-react";
import { useAppData } from "../../context/AppDataContext.jsx";
import { useAppTheme } from "../../context/ThemeContext.jsx";
import "./CommandPalette.css";

const ACTIONS = [
  {
    id: "go-schedule",
    title: "Open schedule",
    meta: "/",
    path: "/",
    icon: CalendarDays,
  },
  {
    id: "go-people",
    title: "People directory",
    meta: "/people",
    path: "/people",
    icon: Users,
  },
  {
    id: "go-projects",
    title: "Projects",
    meta: "/projects",
    path: "/projects",
    icon: FolderOpen,
  },
  {
    id: "go-settings",
    title: "Settings",
    meta: "/settings",
    path: "/settings",
    icon: Settings,
  },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const navigate = useNavigate();
  const { people, projects } = useAppData();
  const { theme } = useAppTheme();
  const inputRef = useRef(null);

  const { rows, selectables } = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const rows = [];
    const selectables = [];

    const addSection = (label, id) => {
      rows.push({ type: "section", id, label });
    };

    const addRow = (row) => {
      rows.push(row);
      selectables.push(row);
    };

    const actions = ACTIONS.filter(
      (a) =>
        !qq ||
        a.title.toLowerCase().includes(qq) ||
        a.meta.includes(qq)
    );
    if (actions.length) {
      addSection("Actions", "sec-actions");
      actions.forEach((a) =>
        addRow({
          type: "action",
          id: a.id,
          title: a.title,
          meta: a.meta,
          icon: a.icon,
          run: () => navigate(a.path),
        })
      );
    }

    if (
      !qq ||
      qq.includes("add") ||
      qq.includes("person") ||
      qq.includes("people") ||
      qq.includes("new")
    ) {
      addSection("Quick", "sec-quick");
      addRow({
        type: "action",
        id: "add-person",
        title: "Add person",
        meta: "Opens directory",
        icon: UserPlus,
        run: () => navigate("/people"),
      });
    }

    const ppl = people
      .filter((p) => !p.archived && (!qq || p.name.toLowerCase().includes(qq)))
      .slice(0, 10);
    if (ppl.length) {
      addSection("People", "sec-people");
      ppl.forEach((p) =>
        addRow({
          type: "person",
          id: `p-${p.id}`,
          title: p.name,
          meta: "Person",
          icon: Users,
          run: () => navigate("/people"),
        })
      );
    }

    const prj = projects
      .filter((p) => !p.archived && (!qq || p.name.toLowerCase().includes(qq)))
      .slice(0, 10);
    if (prj.length) {
      addSection("Projects", "sec-projects");
      prj.forEach((p) =>
        addRow({
          type: "project",
          id: `pr-${p.id}`,
          title: p.name,
          meta: "Project",
          icon: FolderOpen,
          run: () => navigate("/projects"),
        })
      );
    }

    return { rows, selectables };
  }, [q, people, projects, navigate]);

  useEffect(() => {
    setHi(0);
  }, [q, open]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const run = useCallback(
    (item) => {
      if (!item || item.type === "section") return;
      item.run();
      setOpen(false);
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    const onNav = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHi((i) => Math.min(i + 1, Math.max(0, selectables.length - 1)));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHi((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = selectables[hi];
        if (item) run(item);
      }
    };
    window.addEventListener("keydown", onNav);
    return () => window.removeEventListener("keydown", onNav);
  }, [open, hi, selectables, run]);

  if (!open) return null;

  const activeId = selectables[hi]?.id;

  return createPortal(
    <div
      className="alloc8-cmd-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      data-theme={theme}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="alloc8-cmd">
        <div className="alloc8-cmd-search">
          <Search size={18} strokeWidth={2} aria-hidden />
          <input
            ref={inputRef}
            className="alloc8-cmd-input"
            placeholder="Search people, projects, or jump…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
          />
          <span className="alloc8-cmd-hint">⌘K</span>
        </div>
        <div className="alloc8-cmd-scroll">
          {rows.length === 0 ? (
            <p className="alloc8-cmd-empty">No matches.</p>
          ) : (
            rows.map((row) => {
              if (row.type === "section") {
                return (
                  <div key={row.id} className="alloc8-cmd-section">
                    {row.label}
                  </div>
                );
              }
              const Icon = row.icon || Users;
              const active = row.id === activeId;
              return (
                <button
                  key={row.id}
                  type="button"
                  className={
                    "alloc8-cmd-row" + (active ? " alloc8-cmd-row--active" : "")
                  }
                  onMouseEnter={() => {
                    const i = selectables.findIndex((s) => s.id === row.id);
                    if (i >= 0) setHi(i);
                  }}
                  onClick={() => run(row)}
                >
                  <Icon size={17} strokeWidth={2} aria-hidden />
                  <span>{row.title}</span>
                  <span className="alloc8-cmd-row-meta">{row.meta}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
