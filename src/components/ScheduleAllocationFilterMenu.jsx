import { useState, useMemo, useCallback, useEffect } from "react";
import {
  ChevronLeft,
  ChevronDown,
  CornerDownRight,
  Search,
  X,
  Star,
  Filter,
  LayoutGrid,
  Briefcase,
  Users,
  Tag,
  User,
  FolderOpen,
  Building2,
  CircleDot,
  Palmtree,
} from "lucide-react";
import {
  SCHEDULE_FILTER_FIELD_GROUPS,
  FILTER_NONE,
  PROJECT_STAGE_FILTER_OPTIONS,
  PERSON_TYPE_OPTIONS,
  ALLOCATION_KIND_OPTIONS,
  normalizeFilterRules,
  upsertFilterRule,
  removeFilterRuleForField,
  countActiveFilterRules,
} from "../utils/scheduleAllocationFilter.js";
import { useAppTheme } from "../context/ThemeContext.jsx";
import "../pages/ScheduleAllocationFilterMenu.css";

const FIELD_ICONS = {
  LayoutGrid,
  Briefcase,
  Users,
  Tag,
  User,
  FolderOpen,
  Building2,
  CircleDot,
  Palmtree,
};

function fieldMeta(field) {
  for (const g of Object.values(SCHEDULE_FILTER_FIELD_GROUPS)) {
    const f = g.fields.find((x) => x.field === field);
    if (f) return { ...f, groupLabel: g.label };
  }
  return { field, label: field, icon: "Tag", groupLabel: "" };
}

function formatOptionLabel(field, value) {
  if (value === FILTER_NONE) {
    if (field === "department") return "No department";
    if (field === "client") return "No client";
    return "—";
  }
  if (field === "project_stage") {
    const o = PROJECT_STAGE_FILTER_OPTIONS.find((x) => x.value === value);
    return o ? o.label : value;
  }
  if (field === "allocation_kind") {
    const o = ALLOCATION_KIND_OPTIONS.find((x) => x.value === value);
    return o ? o.label : value;
  }
  if (field === "role" && value === "—") return "No role";
  return value;
}

export function ScheduleAllocationFilterMenu({
  open,
  onRequestClose,
  rules,
  setRules,
  people,
  projects,
  depts,
  roles,
  clients,
  peopleTagOpts,
  projectTagOpts,
  allocationProjectOptions,
  starredPeopleTags,
  toggleStarredPeopleTag,
}) {
  const { theme } = useAppTheme();
  const isLight = theme === "light";
  const applyBtnStyle = isLight
    ? {
        background: "#0077e6",
        color: "#ffffff",
        borderColor: "#0a5fb8",
        boxShadow:
          "inset 0 0 0 1px rgba(10,95,184,0.45), 0 2px 10px rgba(0,119,230,0.35)",
      }
    : undefined;
  const clearBtnStyle = isLight
    ? { color: "#1e2a3a" }
    : undefined;

  const [screen, setScreen] = useState("root");
  const [drillField, setDrillField] = useState(null);
  const [drillOp, setDrillOp] = useState("in");
  const [drillSelected, setDrillSelected] = useState(() => new Set());
  const [rootSearch, setRootSearch] = useState("");
  const [drillSearch, setDrillSearch] = useState("");

  const normRules = useMemo(() => normalizeFilterRules(rules), [rules]);
  const activeCount = countActiveFilterRules(rules);

  const resetDrill = useCallback(() => {
    setScreen("root");
    setDrillField(null);
    setDrillSearch("");
    setDrillOp("in");
    setDrillSelected(new Set());
  }, []);

  useEffect(() => {
    if (!open) {
      resetDrill();
      setRootSearch("");
    }
  }, [open, resetDrill]);

  const peopleActive = useMemo(
    () => people.filter((p) => !p.archived),
    [people]
  );

  const optionList = useMemo(() => {
    if (!drillField) return [];
    const set = new Set();

    if (drillField === "department") {
      for (const p of peopleActive) {
        const d = (p.department || "").trim();
        if (d) set.add(d);
      }
      for (const d of depts) if (d && String(d).trim()) set.add(String(d).trim());
      const hasEmpty = peopleActive.some((p) => !(p.department || "").trim());
      const arr = [...set].sort((a, b) => a.localeCompare(b));
      return hasEmpty ? [FILTER_NONE, ...arr] : arr;
    }

    if (drillField === "role") {
      for (const p of peopleActive) {
        if (p.role) set.add(p.role);
      }
      for (const r of roles) if (r) set.add(r);
      return [...set].sort((a, b) => a.localeCompare(b));
    }

    if (drillField === "person") {
      return [...peopleActive]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({ value: String(p.id), label: p.name }));
    }

    if (drillField === "person_tag") {
      for (const t of peopleTagOpts) set.add(t);
      for (const p of peopleActive) (p.tags || []).forEach((x) => set.add(x));
      return [...set].sort((a, b) => a.localeCompare(b));
    }

    if (drillField === "person_type") {
      return [...PERSON_TYPE_OPTIONS];
    }

    if (drillField === "project") {
      return [...allocationProjectOptions];
    }

    if (drillField === "client") {
      for (const c of clients) if (c) set.add(c);
      for (const pr of projects) {
        const c = (pr.client || "").trim();
        if (c) set.add(c);
      }
      const hasEmpty = projects.some((pr) => !(pr.client || "").trim());
      const arr = [...set].sort((a, b) => a.localeCompare(b));
      return hasEmpty ? [FILTER_NONE, ...arr] : arr;
    }

    if (drillField === "project_tag") {
      for (const t of projectTagOpts) set.add(t);
      for (const pr of projects) (pr.tags || []).forEach((x) => set.add(x));
      return [...set].sort((a, b) => a.localeCompare(b));
    }

    if (drillField === "project_stage") {
      return PROJECT_STAGE_FILTER_OPTIONS.map((o) => o.value);
    }

    if (drillField === "allocation_kind") {
      return ALLOCATION_KIND_OPTIONS.map((o) => o.value);
    }

    return [];
  }, [
    drillField,
    peopleActive,
    depts,
    roles,
    peopleTagOpts,
    allocationProjectOptions,
    clients,
    projects,
    projectTagOpts,
  ]);

  const filteredDrillOptions = useMemo(() => {
    const q = drillSearch.trim().toLowerCase();
    if (drillField === "person") {
      const rows = optionList;
      if (!q) return rows;
      return rows.filter(
        (row) =>
          row.label.toLowerCase().includes(q) ||
          String(row.value).toLowerCase().includes(q)
      );
    }
    if (!q) return optionList;
    return optionList.filter((v) =>
      formatOptionLabel(drillField, v).toLowerCase().includes(q)
    );
  }, [optionList, drillSearch, drillField]);

  const openDrill = (field) => {
    const existing = normRules.find((r) => r.field === field);
    setDrillField(field);
    setDrillOp(existing?.op || "in");
    setDrillSelected(new Set(existing?.values || []));
    setDrillSearch("");
    setScreen("drill");
  };

  const toggleDrillValue = (v) => {
    const key = String(v);
    setDrillSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyDrill = () => {
    if (!drillField) return;
    const vals = [...drillSelected];
    setRules((r) => upsertFilterRule(r, drillField, drillOp, vals));
    setScreen("root");
    setDrillField(null);
    setDrillSearch("");
  };

  const clearDrillField = () => {
    if (!drillField) return;
    setRules((r) => removeFilterRuleForField(r, drillField));
    setScreen("root");
    setDrillField(null);
    setDrillSearch("");
  };

  const clearAll = () => {
    setRules(() => []);
    resetDrill();
  };

  const applyStarred = () => {
    const sorted = [...starredPeopleTags].sort((a, b) => a.localeCompare(b));
    setRules((r) => upsertFilterRule(r, "person_tag", "in", sorted));
    onRequestClose();
  };

  const rootItems = useMemo(() => {
    const items = [];
    for (const g of Object.values(SCHEDULE_FILTER_FIELD_GROUPS)) {
      for (const f of g.fields) {
        items.push({ ...f, groupLabel: g.label });
      }
    }
    const q = rootSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        it.groupLabel.toLowerCase().includes(q)
    );
  }, [rootSearch]);

  const groupedRoot = useMemo(() => {
    const m = new Map();
    for (const it of rootItems) {
      if (!m.has(it.groupLabel)) m.set(it.groupLabel, []);
      m.get(it.groupLabel).push(it);
    }
    return [...m.entries()];
  }, [rootItems]);

  const drillCount = optionList.length;
  const meta = drillField ? fieldMeta(drillField) : null;
  const IconCmp = meta ? FIELD_ICONS[meta.icon] || Tag : Filter;

  if (!open) return null;

  return (
    <div className="lp-schedule-filter-popover" role="dialog" aria-label="Schedule filters">
      {screen === "root" && (
        <>
          <div className="lp-schedule-filter-head">
            <Filter size={16} strokeWidth={2.25} className="lp-schedule-filter-head-icon" />
            <span className="lp-schedule-filter-head-title">Filter schedule</span>
            {activeCount > 0 && (
              <span className="lp-schedule-filter-badge">{activeCount}</span>
            )}
          </div>
          <div className="lp-schedule-filter-search">
            <Search size={15} strokeWidth={2} />
            <input
              value={rootSearch}
              onChange={(e) => setRootSearch(e.target.value)}
              placeholder="Search filter types"
              aria-label="Search filter types"
            />
          </div>
          <div className="lp-schedule-filter-scroll">
            {groupedRoot.map(([groupLabel, fields]) => (
              <div key={groupLabel} className="lp-schedule-filter-group">
                <div className="lp-schedule-filter-group-label">{groupLabel}</div>
                {fields.map((f) => {
                  const has = normRules.some((r) => r.field === f.field);
                  const Fi = FIELD_ICONS[f.icon] || Tag;
                  return (
                    <button
                      key={f.field}
                      type="button"
                      className={"lp-schedule-filter-cat" + (has ? " lp-schedule-filter-cat-active" : "")}
                      onClick={() => openDrill(f.field)}
                    >
                      <Fi size={16} strokeWidth={2} className="lp-schedule-filter-cat-icon" />
                      <span className="lp-schedule-filter-cat-label">{f.label}</span>
                      <ChevronDown
                        size={14}
                        className="lp-schedule-filter-cat-chevron"
                        style={{ transform: "rotate(-90deg)" }}
                      />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="lp-schedule-filter-footer">
            <button type="button" className="lp-schedule-filter-link" onClick={clearAll} disabled={activeCount === 0}>
              <X size={14} /> Clear all
            </button>
            <button
              type="button"
              className="lp-schedule-filter-link lp-schedule-filter-link-accent"
              disabled={starredPeopleTags.length === 0}
              onClick={applyStarred}
            >
              <Star size={14} /> Use starred tags
            </button>
          </div>
        </>
      )}

      {screen === "drill" && meta && (
        <>
          <div className="lp-schedule-filter-drill-top">
            <button
              type="button"
              className="lp-schedule-filter-back"
              onClick={() => {
                setScreen("root");
                setDrillField(null);
                setDrillSearch("");
              }}
              aria-label="Back to filter list"
            >
              <ChevronLeft size={18} strokeWidth={2} />
            </button>
            <div className="lp-schedule-filter-drill-head-text">
              <div className="lp-schedule-filter-search lp-schedule-filter-search-drill">
                <Search size={15} strokeWidth={2} />
                <input
                  value={drillSearch}
                  onChange={(e) => setDrillSearch(e.target.value)}
                  placeholder={`Search ${drillCount} ${meta.label}${drillCount === 1 ? "" : "s"}`}
                  aria-label={`Search ${meta.label} values`}
                />
              </div>
              <div className="lp-schedule-filter-pill-row">
                <span className="lp-schedule-filter-field-pill">
                  <IconCmp size={14} strokeWidth={2} />
                  {meta.label}
                </span>
                <div className="lp-schedule-filter-is-toggle" role="group" aria-label="Match mode">
                  <button
                    type="button"
                    className={drillOp === "in" ? "active" : ""}
                    onClick={() => setDrillOp("in")}
                  >
                    is
                  </button>
                  <button
                    type="button"
                    className={drillOp === "nin" ? "active" : ""}
                    onClick={() => setDrillOp("nin")}
                  >
                    is not
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="lp-schedule-filter-drill-list">
            {drillField === "person_tag" && (
              <p className="lp-schedule-filter-hint">
                Star a tag from the list below for quick access under Starred tags.
              </p>
            )}
            {filteredDrillOptions.length === 0 ? (
              <p className="lp-schedule-filter-empty">No matching options</p>
            ) : drillField === "person" ? (
              filteredDrillOptions.map((row) => {
                const on = drillSelected.has(String(row.value));
                return (
                  <label key={row.value} className="lp-schedule-filter-row">
                    <CornerDownRight size={14} className="lp-schedule-filter-row-hook" aria-hidden />
                    <span className="lp-schedule-filter-row-label">{row.label}</span>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleDrillValue(row.value)}
                      className="lp-schedule-filter-check"
                    />
                  </label>
                );
              })
            ) : (
              filteredDrillOptions.map((v) => {
                const on = drillSelected.has(String(v));
                return (
                  <label key={String(v)} className="lp-schedule-filter-row">
                    <CornerDownRight size={14} className="lp-schedule-filter-row-hook" aria-hidden />
                    <span className="lp-schedule-filter-row-label">{formatOptionLabel(drillField, v)}</span>
                    {drillField === "person_tag" && (
                      <button
                        type="button"
                        className={
                          "lp-schedule-filter-row-star" +
                          (starredPeopleTags.includes(v) ? " on" : "")
                        }
                        aria-label={starredPeopleTags.includes(v) ? "Remove from starred" : "Star tag"}
                        onClick={(e) => {
                          e.preventDefault();
                          toggleStarredPeopleTag(v);
                        }}
                      >
                        <Star size={14} fill={starredPeopleTags.includes(v) ? "currentColor" : "none"} />
                      </button>
                    )}
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleDrillValue(v)}
                      className="lp-schedule-filter-check"
                    />
                  </label>
                );
              })
            )}
          </div>

          <div className="lp-schedule-filter-drill-actions">
            <button
              type="button"
              className="lp-schedule-filter-btn secondary"
              onClick={clearDrillField}
              style={clearBtnStyle}
            >
              Clear
            </button>
            <button
              type="button"
              className="lp-schedule-filter-btn primary"
              onClick={applyDrill}
              style={applyBtnStyle}
            >
              Apply
            </button>
          </div>
        </>
      )}
    </div>
  );
}
