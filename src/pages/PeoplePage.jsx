import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Users,
  User,
  Plus,
  Download,
  Trash2,
  Search,
  X,
  ChevronRight,
  ChevronDown,
  Check,
  ArrowDownUp,
  UserPlus,
  Shield,
  Archive,
  ArchiveRestore,
  Filter,
  Mail,
  Building2,
  Tag,
  Clock,
} from "lucide-react";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAppData } from "../context/AppDataContext.jsx";
import AppSideNav from "../components/navigation/AppSideNav.jsx";
import { Button } from "../components/ui/Button.jsx";
import PersonModal, {
  T,
  Confirm,
  RowActions,
  formToPerson,
  ini,
  avGrad,
} from "../components/PersonModal.jsx";
import { toast } from "sonner";
import { tagChromaProps } from "../utils/tagChroma.js";
import {
  SCHEDULE_SORT_OPTIONS,
  comparePeopleForScheduleSort,
  personApproxTotalAllocatedHours,
} from "../utils/peopleSort.js";
import { CreateAllocationModal, leaveLabel } from "../components/AllocationModals.jsx";
import { resolveColorForProjectLabel } from "../utils/projectColors.js";
import { leaveBlocksWorkAllocation } from "../utils/allocationLeaveConflict.js";
import { useEnhancedMode } from "../enhanced/useEnhancedMode.js";
import "./PeoplePage.css";

const UserInsightPanel = lazy(() => import("../components/UserInsightPanel.jsx"));

function allocationHasPerson(a, pid) {
  if (Array.isArray(a.personIds) && a.personIds.length > 0) return a.personIds.includes(pid);
  return a.personId === pid;
}

function shortenAllocLabel(s, maxLen) {
  if (!s) return "";
  return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s;
}

const DEPT_EMPTY = "__dept_empty__";
const PERSON_TYPES = ["Employee", "Contractor", "Placeholder"];
const WORK_TYPES = ["Full-time", "Part-time"];
const ACCESS_FILTER_OPTS = [
  { value: "—", label: "No access" },
  { value: "Member", label: "Member" },
  { value: "Manager", label: "Manager" },
];

function toggleArr(list, v) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/* ═══════════════════════════════════════════════════════════
   APP
   ═══════════════════════════════════════════════════════════ */
export default function PeoplePage() {
  const { theme: mode } = useAppTheme();
  const t = T[mode];
  const enhancedMode = useEnhancedMode();

  const {
    people,
    setPeople,
    roles,
    setRoles,
    depts,
    setDepts,
    peopleTagOpts,
    setPeopleTagOpts,
    getNextPersonId,
    syncPersonCreate,
    syncPersonUpdate,
    syncPeopleDelete,
    allocations,
    publicHolidayAllocations,
    setAllocations,
    projects,
    allocationProjectOptions,
    addAllocationProjectLabel,
    syncAllocationCreate,
    syncAllocationUpdate,
    syncAllocationDelete,
  } = useAppData();

  const scheduleAllocations = useMemo(
    () => [...allocations, ...publicHolidayAllocations],
    [allocations, publicHolidayAllocations]
  );

  const [selected,setSelected]=useState(new Set());
  const [search,setSearch]=useState("");
  const [viewTab,setViewTab]=useState("active"); // active | archived
  const [modalOpen,setModalOpen]=useState(false);
  const [editingPerson,setEditingPerson]=useState(null);
  const [confirmDel,setConfirmDel]=useState(false);
  const [mounted,setMounted]=useState(false);
  const [peopleSort,setPeopleSort]=useState("custom");
  const [sortOpen,setSortOpen]=useState(false);
  const sortWrapRef=useRef(null);

  const filterWrapRef = useRef(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [nestOpen, setNestOpen] = useState({
    people: false,
    login: true,
    org: true,
    profile: true,
  });
  const [filterPersonSearch, setFilterPersonSearch] = useState("");
  const [advPersonIds, setAdvPersonIds] = useState([]);
  const [advDepartments, setAdvDepartments] = useState([]);
  const [advRoles, setAdvRoles] = useState([]);
  const [advTags, setAdvTags] = useState([]);
  const [advTypes, setAdvTypes] = useState([]);
  const [advAccess, setAdvAccess] = useState([]);
  const [advWorkTypes, setAdvWorkTypes] = useState([]);
  const [advEmailMode, setAdvEmailMode] = useState("any");
  const [advEmailContains, setAdvEmailContains] = useState("");

  const [allocCreateOpen, setAllocCreateOpen] = useState(false);
  const [allocPreselectPerson, setAllocPreselectPerson] = useState(null);
  const [allocPreselectProject, setAllocPreselectProject] = useState(null);
  const [allocDefaultTab, setAllocDefaultTab] = useState("allocation");

  const [personInsight, setPersonInsight] = useState(null);
  const insightTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(insightTimerRef.current), []);

  const schedulePeople = useMemo(
    () => [...people].filter((p) => !p.archived).sort((a, b) => a.name.localeCompare(b.name)),
    [people]
  );

  const openCreateAllocationForPersonProject = useCallback((person, projectLabel) => {
    setAllocDefaultTab("allocation");
    setAllocPreselectPerson(person ?? null);
    setAllocPreselectProject(projectLabel != null ? String(projectLabel).trim() || null : null);
    setAllocCreateOpen(true);
  }, []);

  const openCreateLeaveForPerson = useCallback((person) => {
    setAllocDefaultTab("leave");
    setAllocPreselectPerson(person ?? null);
    setAllocPreselectProject(null);
    setAllocCreateOpen(true);
  }, []);

  const closeCreateAllocation = useCallback(() => {
    setAllocCreateOpen(false);
    setAllocPreselectPerson(null);
    setAllocPreselectProject(null);
    setAllocDefaultTab("allocation");
  }, []);

  const handleCreateAllocation = useCallback(
    (payload) => {
      if (!payload.isLeave) {
        const pStart = payload.startDate;
        const pEnd = payload.endDate;
        for (const pid of payload.personIds) {
          const leaveConflict = scheduleAllocations.find(
            (a) =>
              leaveBlocksWorkAllocation(a) &&
              allocationHasPerson(a, pid) &&
              a.startDate <= pEnd &&
              a.endDate >= pStart
          );
          if (leaveConflict) {
            const personName = people.find((p) => p.id === pid)?.name || "This person";
            const leaveTypeName = leaveConflict.leaveType
              ? leaveLabel(leaveConflict.leaveType)
              : "Leave";
            toast.error(
              `Cannot allocate ${personName} — they are on ${leaveTypeName} (${leaveConflict.startDate} to ${leaveConflict.endDate})`
            );
            return;
          }
        }
      }

      const projectColor = resolveColorForProjectLabel(payload.project, projects);
      setAllocations((prev) => {
        const nextId = prev.reduce((m, a) => Math.max(m, Number(a.id) || 0), 0) + 1;
        const created = {
          id: nextId,
          ...payload,
          updatedBy: "You",
          updatedAt: new Date().toISOString(),
          projectColor,
        };
        queueMicrotask(() => syncAllocationCreate(created));
        return [...prev, created];
      });
      toast.success(payload.isLeave ? "Leave saved" : "Allocation saved", {
        description: payload.isLeave
          ? `${payload.startDate} → ${payload.endDate}`
          : `${shortenAllocLabel(payload.project, 42)} · ${Number(payload.hoursPerDay) || 0}h/day`,
        duration: 2800,
      });
    },
    [setAllocations, projects, scheduleAllocations, people, syncAllocationCreate]
  );

  useEffect(()=>{ setMounted(true); },[]);

  useEffect(() => {
    setAdvPersonIds([]);
    setFilterPersonSearch("");
  }, [viewTab]);

  const peopleInTab = useMemo(() => {
    const isArch = viewTab === "archived";
    return people.filter((p) => p.archived === isArch);
  }, [people, viewTab]);

  const departmentOptions = useMemo(() => {
    const set = new Set();
    for (const p of peopleInTab) {
      const d = (p.department || "").trim();
      if (d) set.add(d);
    }
    for (const d of depts) if (d && String(d).trim()) set.add(String(d).trim());
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [peopleInTab, depts]);

  const hasNoDept = useMemo(
    () => peopleInTab.some((p) => !(p.department || "").trim()),
    [peopleInTab]
  );

  const roleOptions = useMemo(() => {
    const set = new Set();
    for (const p of peopleInTab) {
      if (p.role) set.add(p.role);
    }
    for (const r of roles) if (r) set.add(r);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [peopleInTab, roles]);

  const tagOptions = useMemo(() => {
    const set = new Set(peopleTagOpts);
    for (const p of peopleInTab) (p.tags || []).forEach((tg) => set.add(tg));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [peopleInTab, peopleTagOpts]);

  const advActiveCount = useMemo(() => {
    let n = 0;
    if (advPersonIds.length) n++;
    if (advEmailMode !== "any") n++;
    if (advEmailContains.trim()) n++;
    if (advDepartments.length) n++;
    if (advRoles.length) n++;
    if (advTags.length) n++;
    if (advTypes.length) n++;
    if (advAccess.length) n++;
    if (advWorkTypes.length) n++;
    return n;
  }, [
    advPersonIds,
    advEmailMode,
    advEmailContains,
    advDepartments,
    advRoles,
    advTags,
    advTypes,
    advAccess,
    advWorkTypes,
  ]);

  const peoplePickerList = useMemo(() => {
    const q = filterPersonSearch.trim().toLowerCase();
    const sorted = [...peopleInTab].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q)
    );
  }, [peopleInTab, filterPersonSearch]);

  const filtered = useMemo(() => {
    const isArch = viewTab === "archived";
    return people.filter((p) => {
      if (p.archived !== isArch) return false;

      if (search) {
        const s = search.toLowerCase();
        const role = (p.role || "").toLowerCase();
        const dept = (p.department || "").toLowerCase();
        const tags = p.tags || [];
        const email = (p.email || "").toLowerCase();
        const type = (p.type || "").toLowerCase();
        const wt = (p.workType || "").toLowerCase();
        const acc = (p.access || "").toLowerCase();
        const nm = p.name.toLowerCase();
        const matchText =
          nm.includes(s) ||
          role.includes(s) ||
          dept.includes(s) ||
          email.includes(s) ||
          type.includes(s) ||
          wt.includes(s) ||
          acc.includes(s) ||
          tags.some((tg) => String(tg).toLowerCase().includes(s));
        if (!matchText) return false;
      }

      if (advPersonIds.length && !advPersonIds.includes(p.id)) return false;

      const em = (p.email || "").trim();
      if (advEmailMode === "has" && !em) return false;
      if (advEmailMode === "missing" && em) return false;
      if (advEmailContains.trim()) {
        if (!em.toLowerCase().includes(advEmailContains.trim().toLowerCase())) return false;
      }

      if (advDepartments.length) {
        const d = (p.department || "").trim();
        const ok = advDepartments.some((key) => {
          if (key === DEPT_EMPTY) return !d;
          return d === key;
        });
        if (!ok) return false;
      }

      if (advRoles.length) {
        const r = p.role || "—";
        if (!advRoles.includes(r)) return false;
      }

      if (advTags.length) {
        const tags = p.tags || [];
        if (!advTags.some((tg) => tags.includes(tg))) return false;
      }

      if (advTypes.length) {
        const ty = p.type || "Employee";
        if (!advTypes.includes(ty)) return false;
      }

      if (advAccess.length) {
        const a = p.access || "—";
        if (!advAccess.includes(a)) return false;
      }

      if (advWorkTypes.length) {
        const w = p.workType || "Full-time";
        if (!advWorkTypes.includes(w)) return false;
      }

      return true;
    });
  }, [
    people,
    search,
    viewTab,
    advPersonIds,
    advEmailMode,
    advEmailContains,
    advDepartments,
    advRoles,
    advTags,
    advTypes,
    advAccess,
    advWorkTypes,
  ]);

  const peopleOrderMap = useMemo(() => {
    const m = new Map();
    let i = 0;
    const isArch = viewTab === "archived";
    for (const p of people) {
      if (p.archived === isArch) m.set(p.id, i++);
    }
    return m;
  }, [people, viewTab]);

  const filteredSorted = useMemo(() => {
    const hoursMap = new Map();
    for (const p of filtered) {
      hoursMap.set(p.id, personApproxTotalAllocatedHours(p.id, allocations));
    }
    return [...filtered].sort((a, b) =>
      comparePeopleForScheduleSort(a, b, peopleSort, peopleOrderMap, hoursMap)
    );
  }, [filtered, peopleSort, peopleOrderMap, allocations]);

  const insightPerson = useMemo(() => {
    if (!personInsight) return null;
    return (
      filteredSorted.find((x) => x.id === personInsight.personId) ||
      people.find((x) => x.id === personInsight.personId) ||
      null
    );
  }, [personInsight, filteredSorted, people]);

  useEffect(() => {
    if (!enhancedMode) return;
    const fn = (e) => {
      if (e.key !== "Escape") return;
      clearTimeout(insightTimerRef.current);
      setPersonInsight(null);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [enhancedMode]);

  useEffect(() => {
    const h = (e) => {
      if (sortWrapRef.current && !sortWrapRef.current.contains(e.target)) setSortOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!filterOpen) return;
    const h = (e) => {
      if (filterWrapRef.current && !filterWrapRef.current.contains(e.target)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [filterOpen]);

  const clearAdvFilters = useCallback(() => {
    setAdvPersonIds([]);
    setAdvDepartments([]);
    setAdvRoles([]);
    setAdvTags([]);
    setAdvTypes([]);
    setAdvAccess([]);
    setAdvWorkTypes([]);
    setAdvEmailMode("any");
    setAdvEmailContains("");
    setFilterPersonSearch("");
  }, []);

  const nestToggle = useCallback((key) => {
    setNestOpen((o) => ({ ...o, [key]: !o[key] }));
  }, []);

  const activeCount = people.filter((p)=>!p.archived).length;
  const archivedCount = people.filter((p)=>p.archived).length;

  const toggleSel=(id)=>setSelected((p)=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });
  const toggleAll=()=>setSelected(selected.size===filteredSorted.length?new Set():new Set(filteredSorted.map((p)=>p.id)));

  const doDelete=()=>{ const c=selected.size; const ids=[...selected]; setPeople(people.filter((p)=>!selected.has(p.id))); setSelected(new Set()); setConfirmDel(false); syncPeopleDelete(ids); toast.error(`${c} ${c===1?"person":"people"} removed`); };
  const archivePerson=(id)=>{ const p=people.find((x)=>x.id===id); const next={...p,archived:!p.archived}; setPeople(people.map((x)=>x.id===id?next:x)); setSelected(new Set()); toast.warning(`${p.name} ${p.archived?"restored":"archived"}`); syncPersonUpdate(next); };

  const openAdd=()=>{ setEditingPerson(null); setModalOpen(true); };
  const openEdit=(person)=>{ setEditingPerson(person); setModalOpen(true); };

  const handleModalSave=(form)=>{
    if(editingPerson) {
      const updated = formToPerson(form, editingPerson.id, editingPerson.archived);
      setPeople(people.map((p)=>p.id===editingPerson.id?updated:p).sort((a,b)=>a.name.localeCompare(b.name)));
      syncPersonUpdate(updated);
      toast.success(`${form.name} updated`);
    } else {
      const newP = formToPerson(form, getNextPersonId(), false);
      setPeople([...people,newP].sort((a,b)=>a.name.localeCompare(b.name)));
      syncPersonCreate(newP);
      toast.success(`${form.name} added to directory`);
    }
    setModalOpen(false); setEditingPerson(null);
  };
  const handleModalArchive=()=>{
    if(editingPerson) { archivePerson(editingPerson.id); setModalOpen(false); setEditingPerson(null); }
  };

  return (
    <div
      className="people-page-root"
      data-theme={mode === "light" ? "light" : "dark"}
      data-enhanced-mode={enhancedMode ? "1" : "0"}
      style={{
        background: t.bg,
        color: t.text,
        fontFamily: "var(--font-body, 'DM Sans', system-ui, sans-serif)",
        fontSize: 14,
        transition: "background 0.35s ease, color 0.35s ease",
      }}
    >
      <AppSideNav />

      <main className="people-page-main">
        {/* Header */}
        <header className="people-page-header" style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
          <h1 style={{ fontSize:26,fontWeight:700,margin:0,letterSpacing:-0.5 }}>People</h1>
          <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
            <div style={{ position:"relative" }}>
              <Search size={15} style={{ position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:t.textMuted }}/>
              <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search name, email, role, department, tags…"
                style={{ width:search?260:200,background:t.surface,border:`1.5px solid ${t.borderIn}`,borderRadius:8,padding:"8px 12px 8px 34px",color:t.text,fontSize:13,outline:"none",transition:"all 0.25s" }}
                onFocus={(e)=>{ e.target.style.width="280px"; e.target.style.borderColor=t.focus; e.target.style.boxShadow=`0 0 0 3px ${t.accentGlow}`; }}
                onBlur={(e)=>{ if(!search) e.target.style.width="200px"; e.target.style.borderColor=t.borderIn; e.target.style.boxShadow="none"; }}/>
              {search&&<X size={14} style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:t.textMuted,cursor:"pointer" }} onClick={()=>setSearch("")}/>}
            </div>

            <div ref={filterWrapRef} className="people-filter-wrap">
              <button
                type="button"
                onClick={() => setFilterOpen((o) => !o)}
                style={{
                  display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600,
                  background:advActiveCount ? t.accentGlow : t.btnSec,
                  border:`1px solid ${advActiveCount ? `${t.accent}55` : t.border}`,
                  color:advActiveCount ? t.accent : t.textSoft,
                  transition:"all 0.15s",
                }}
              >
                <Filter size={14} strokeWidth={2.25} />
                Filters
                {advActiveCount > 0 && (
                  <span style={{
                    minWidth:20,height:20,padding:"0 6px",borderRadius:999,background:t.accent,color:t.accentTxt,
                    fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center",
                  }}>{advActiveCount}</span>
                )}
                <ChevronDown size={14} style={{ color:t.textMuted,transform:filterOpen ? "rotate(180deg)" : "none",transition:"transform 0.2s" }} />
              </button>

              {filterOpen && (
                <div
                  className="people-filter-panel"
                  style={{
                    position:"absolute",top:"calc(100% + 8px)",right:0,zIndex:130,
                    width:"min(360px, calc(100vw - 48px))",
                    maxHeight:"min(72vh, 520px)",
                    background:t.surfRaised,border:`1px solid ${t.border}`,borderRadius:12,
                    boxShadow:"0 16px 48px rgba(0,0,0,0.28)",display:"flex",flexDirection:"column",overflow:"hidden",
                  }}
                >
                  <div style={{ padding:"12px 14px",borderBottom:`1px solid ${t.borderSub}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexShrink:0 }}>
                    <span style={{ fontWeight:700,fontSize:13,color:t.text }}>Filter people</span>
                    <button type="button" onClick={clearAdvFilters} disabled={advActiveCount === 0}
                      style={{
                        fontSize:12,fontWeight:600,cursor:advActiveCount ? "pointer" : "default",
                        background:"transparent",border:"none",color:advActiveCount ? t.accent : t.textDim,padding:"4px 8px",borderRadius:6,
                      }}>Clear all</button>
                  </div>

                  <div style={{ overflowY:"auto",flex:1,minHeight:0,paddingBottom:8,
                    ["--people-filter-border"]: t.border,
                    ["--people-filter-nested-bg"]: mode === "dark" ? "rgba(0,0,0,0.18)" : "#f0f2f8",
                    ["--people-filter-text"]: t.text,
                    ["--people-filter-row-hov"]: t.tabHovBg,
                  }}>

                    {/* People */}
                    <div style={{ borderBottom:`1px solid ${t.borderSub}` }}>
                      <button type="button" onClick={() => nestToggle("people")}
                        style={{ width:"100%",display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"transparent",border:"none",cursor:"pointer",color:t.text,fontWeight:600,fontSize:13,textAlign:"left" }}>
                        <ChevronDown size={14} style={{ color:t.textMuted,flexShrink:0,transform:nestOpen.people ? "rotate(0deg)" : "rotate(-90deg)",transition:"transform 0.2s" }} />
                        <User size={14} style={{ color:t.accent,flexShrink:0 }} />
                        By person
                      </button>
                      {nestOpen.people && (
                        <div className="people-filter-nest-body" style={{ padding:"0 14px 12px 36px" }}>
                          <div style={{ position:"relative" }}>
                            <Search size={13} style={{ position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:t.textMuted }} />
                            <input value={filterPersonSearch} onChange={(e) => setFilterPersonSearch(e.target.value)} placeholder="Find in this list…"
                              style={{ width:"100%",background:t.surfAlt,border:`1px solid ${t.borderIn}`,borderRadius:8,padding:"7px 10px 7px 30px",color:t.text,fontSize:12,outline:"none" }} />
                          </div>
                          <p style={{ margin:0,fontSize:11,color:t.textMuted,lineHeight:1.4 }}>Show only selected people. Leave none selected to include everyone.</p>
                          <div className="people-filter-people-scroll">
                            {peoplePickerList.map((p) => {
                              const on = advPersonIds.includes(p.id);
                              return (
                                <label key={p.id}>
                                  <input type="checkbox" checked={on} onChange={() => setAdvPersonIds((ids) => toggleArr(ids, p.id))} style={{ accentColor:t.chk,width:14,height:14,flexShrink:0 }} />
                                  <span style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1 }}>{p.name}</span>
                                  <span style={{ color:t.textDim,fontSize:11,flexShrink:0,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis" }}>{(p.email || "").split("@")[0]}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Login / email */}
                    <div style={{ borderBottom:`1px solid ${t.borderSub}` }}>
                      <button type="button" onClick={() => nestToggle("login")}
                        style={{ width:"100%",display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"transparent",border:"none",cursor:"pointer",color:t.text,fontWeight:600,fontSize:13,textAlign:"left" }}>
                        <ChevronDown size={14} style={{ color:t.textMuted,flexShrink:0,transform:nestOpen.login ? "rotate(0deg)" : "rotate(-90deg)",transition:"transform 0.2s" }} />
                        <Mail size={14} style={{ color:t.accent,flexShrink:0 }} />
                        Login and email
                      </button>
                      {nestOpen.login && (
                        <div className="people-filter-nest-body" style={{ padding:"0 14px 12px 36px" }}>
                          <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
                            {[
                              { id:"any", label:"Any" },
                              { id:"has", label:"Has email" },
                              { id:"missing", label:"No email" },
                            ].map((opt) => {
                              const active = advEmailMode === opt.id;
                              return (
                                <button key={opt.id} type="button" onClick={() => setAdvEmailMode(opt.id)}
                                  style={{
                                    padding:"6px 12px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",
                                    border:`1px solid ${active ? t.accent : t.border}`,
                                    background:active ? t.accentGlow : t.surfAlt,color:active ? t.accent : t.textSoft,
                                  }}>{opt.label}</button>
                              );
                            })}
                          </div>
                          <div>
                            <label style={{ fontSize:11,fontWeight:600,color:t.textMuted,display:"block",marginBottom:4 }}>Email contains</label>
                            <input value={advEmailContains} onChange={(e) => setAdvEmailContains(e.target.value)} placeholder="e.g. company.com"
                              style={{ width:"100%",background:t.surfAlt,border:`1px solid ${t.borderIn}`,borderRadius:8,padding:"8px 10px",color:t.text,fontSize:12,outline:"none" }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Organization */}
                    <div style={{ borderBottom:`1px solid ${t.borderSub}` }}>
                      <button type="button" onClick={() => nestToggle("org")}
                        style={{ width:"100%",display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"transparent",border:"none",cursor:"pointer",color:t.text,fontWeight:600,fontSize:13,textAlign:"left" }}>
                        <ChevronDown size={14} style={{ color:t.textMuted,flexShrink:0,transform:nestOpen.org ? "rotate(0deg)" : "rotate(-90deg)",transition:"transform 0.2s" }} />
                        <Building2 size={14} style={{ color:t.accent,flexShrink:0 }} />
                        Organization
                      </button>
                      {nestOpen.org && (
                        <div className="people-filter-nest-body" style={{ padding:"0 14px 12px 36px" }}>
                          <div>
                            <span style={{ fontSize:11,fontWeight:600,color:t.textMuted }}>Department</span>
                            <div className="people-filter-chip-row" style={{ marginTop:6 }}>
                              {hasNoDept && (
                                <button type="button" onClick={() => setAdvDepartments((x) => toggleArr(x, DEPT_EMPTY))}
                                  style={{
                                    padding:"5px 10px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",
                                    border:`1px solid ${advDepartments.includes(DEPT_EMPTY) ? t.accent : t.border}`,
                                    background:advDepartments.includes(DEPT_EMPTY) ? t.accentGlow : t.surfAlt,
                                    color:advDepartments.includes(DEPT_EMPTY) ? t.accent : t.textSoft,
                                  }}>No department</button>
                              )}
                              {departmentOptions.map((d) => {
                                const on = advDepartments.includes(d);
                                return (
                                  <button key={d} type="button" onClick={() => setAdvDepartments((x) => toggleArr(x, d))}
                                    style={{
                                      padding:"5px 10px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",maxWidth:"100%",
                                      border:`1px solid ${on ? t.accent : t.border}`,background:on ? t.accentGlow : t.surfAlt,color:on ? t.accent : t.textSoft,
                                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                                    }} title={d}>{d}</button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <span style={{ fontSize:11,fontWeight:600,color:t.textMuted }}>Role</span>
                            <div className="people-filter-chip-row" style={{ marginTop:6 }}>
                              {roleOptions.map((r) => {
                                const on = advRoles.includes(r);
                                return (
                                  <button key={r} type="button" onClick={() => setAdvRoles((x) => toggleArr(x, r))}
                                    style={{
                                      padding:"5px 10px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",maxWidth:"100%",
                                      border:`1px solid ${on ? t.accent : t.border}`,background:on ? t.accentGlow : t.surfAlt,color:on ? t.accent : t.textSoft,
                                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                                    }} title={r === "—" ? "No role" : r}>{r === "—" ? "No role" : r}</button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Profile */}
                    <div>
                      <button type="button" onClick={() => nestToggle("profile")}
                        style={{ width:"100%",display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"transparent",border:"none",cursor:"pointer",color:t.text,fontWeight:600,fontSize:13,textAlign:"left" }}>
                        <ChevronDown size={14} style={{ color:t.textMuted,flexShrink:0,transform:nestOpen.profile ? "rotate(0deg)" : "rotate(-90deg)",transition:"transform 0.2s" }} />
                        <Tag size={14} style={{ color:t.accent,flexShrink:0 }} />
                        Tags, type, and access
                      </button>
                      {nestOpen.profile && (
                        <div className="people-filter-nest-body" style={{ padding:"0 14px 12px 36px" }}>
                          <div>
                            <span style={{ fontSize:11,fontWeight:600,color:t.textMuted }}>Tags</span>
                            <div className="people-filter-chip-row" style={{ marginTop:6 }}>
                              {tagOptions.length === 0 && <span style={{ fontSize:12,color:t.textDim }}>No tags in this view</span>}
                              {tagOptions.map((tg) => {
                                const on = advTags.includes(tg);
                                return (
                                  <button key={tg} type="button" onClick={() => setAdvTags((x) => toggleArr(x, tg))}
                                    style={{
                                      padding:"5px 10px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",maxWidth:"100%",
                                      border:`1px solid ${on ? t.accent : t.border}`,background:on ? t.accentGlow : t.surfAlt,color:on ? t.accent : t.textSoft,
                                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                                    }} title={tg}>{tg}</button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <span style={{ fontSize:11,fontWeight:600,color:t.textMuted }}>Type</span>
                            <div className="people-filter-chip-row" style={{ marginTop:6 }}>
                              {PERSON_TYPES.map((ty) => {
                                const on = advTypes.includes(ty);
                                return (
                                  <button key={ty} type="button" onClick={() => setAdvTypes((x) => toggleArr(x, ty))}
                                    style={{
                                      padding:"5px 10px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",
                                      border:`1px solid ${on ? t.accent : t.border}`,background:on ? t.accentGlow : t.surfAlt,color:on ? t.accent : t.textSoft,
                                    }}>{ty}</button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <span style={{ fontSize:11,fontWeight:600,color:t.textMuted }}>Access</span>
                            <div className="people-filter-chip-row" style={{ marginTop:6 }}>
                              {ACCESS_FILTER_OPTS.map((a) => {
                                const on = advAccess.includes(a.value);
                                return (
                                  <button key={a.value} type="button" onClick={() => setAdvAccess((x) => toggleArr(x, a.value))}
                                    style={{
                                      padding:"5px 10px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",
                                      border:`1px solid ${on ? t.accent : t.border}`,background:on ? t.accentGlow : t.surfAlt,color:on ? t.accent : t.textSoft,
                                    }}>{a.label}</button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <span style={{ fontSize:11,fontWeight:600,color:t.textMuted,display:"flex",alignItems:"center",gap:4 }}>
                              <Clock size={12} style={{ opacity:0.85 }} /> Work arrangement
                            </span>
                            <div className="people-filter-chip-row" style={{ marginTop:6 }}>
                              {WORK_TYPES.map((w) => {
                                const on = advWorkTypes.includes(w);
                                return (
                                  <button key={w} type="button" onClick={() => setAdvWorkTypes((x) => toggleArr(x, w))}
                                    style={{
                                      padding:"5px 10px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",
                                      border:`1px solid ${on ? t.accent : t.border}`,background:on ? t.accentGlow : t.surfAlt,color:on ? t.accent : t.textSoft,
                                    }}>{w}</button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <Button type="button" variant="secondary" size="md" style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Download size={14} /> Import
            </Button>
            <Button type="button" variant="primary" size="md" onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <UserPlus size={14} /> Add person
            </Button>
          </div>
        </header>

        {/* Active / Archived Tabs + Bulk Delete */}
        <div className="people-page-toolbar" style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,marginTop:8,flexWrap:"wrap",gap:10 }}>
          <div style={{ display:"flex",gap:2,background:t.surfAlt,borderRadius:10,padding:3,border:`1px solid ${t.border}` }}>
            {[
              { key:"active", label:"Active", count:activeCount, icon:Users },
              { key:"archived", label:"Archived", count:archivedCount, icon:Archive },
            ].map((vt)=>{
              const Icon=vt.icon;
              const active=viewTab===vt.key;
              return (<button key={vt.key} onClick={()=>{ setViewTab(vt.key); setSelected(new Set()); }} style={{
                padding:"8px 18px",fontSize:13,fontWeight:active?700:500,cursor:"pointer",
                background:active?t.surface:"transparent",border:active?`1px solid ${t.border}`:"1px solid transparent",
                color:active?t.text:t.textMuted,borderRadius:8,display:"flex",alignItems:"center",gap:7,transition:"all 0.2s",
                boxShadow:active?"0 1px 3px rgba(0,0,0,0.06)":"none",
              }}
                onMouseEnter={(e)=>{ if(!active) e.currentTarget.style.color=t.textSoft; }}
                onMouseLeave={(e)=>{ if(!active) e.currentTarget.style.color=t.textMuted; }}>
                <Icon size={14}/> {vt.label}
                <span style={{ background:active?t.accentGlow:(t.surfAlt),color:active?t.accent:t.textDim,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,marginLeft:2 }}>{vt.count}</span>
              </button>);
            })}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginLeft:"auto" }}>
            <div ref={sortWrapRef} style={{ position:"relative" }}>
              <button
                type="button"
                onClick={()=>setSortOpen((o)=>!o)}
                style={{
                  display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:8,
                  background:peopleSort!=="custom"?t.accentGlow:t.btnSec,border:`1px solid ${peopleSort!=="custom"?t.accent+"40":t.border}`,
                  color:peopleSort!=="custom"?t.accent:t.textSoft,fontSize:13,fontWeight:600,cursor:"pointer",
                }}
              >
                <ArrowDownUp size={14}/> Sort <ChevronDown size={14}/>
              </button>
              {sortOpen && (
                <div style={{
                  position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:120,minWidth:220,
                  background:t.surfRaised,border:`1px solid ${t.border}`,borderRadius:10,
                  boxShadow:"0 12px 40px rgba(0,0,0,0.25)",padding:"6px 0",
                }}>
                  {SCHEDULE_SORT_OPTIONS.map((opt)=>(
                    <button
                      key={opt.id}
                      type="button"
                      onClick={()=>{ setPeopleSort(opt.id); setSortOpen(false); }}
                      style={{
                        width:"100%",textAlign:"left",padding:"10px 14px",border:"none",background:peopleSort===opt.id?t.accentGlow:"transparent",
                        color:t.text,fontSize:13,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",
                      }}
                    >
                      {opt.label}
                      {peopleSort===opt.id && <Check size={14} style={{ color:t.accent }}/>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          {selected.size>0 && (
            <Button
              type="button"
              variant="destructive"
              size="md"
              onClick={() => setConfirmDel(true)}
              className="alloc8-btn-enter"
              style={{ display: "flex", alignItems: "center", gap: 7 }}
            >
              <Trash2 size={14} /> Delete {selected.size} selected
            </Button>
          )}
          </div>
        </div>

        {/* Table — scrolls inside main (matches Schedule / Projects shell) */}
        <div
          className="people-page-table-wrap"
          style={{
            ["--people-border"]: t.border,
            ["--people-surface"]: t.surface,
            transition: "background 0.35s",
          }}
        >
          <table>
            <thead>
              <tr style={{ borderBottom:`2px solid ${t.border}` }}>
                <th style={{ width:48,padding:"14px 14px" }}><input type="checkbox" checked={selected.size===filteredSorted.length&&filteredSorted.length>0} onChange={toggleAll} style={{ accentColor:t.chk,cursor:"pointer",width:16,height:16 }}/></th>
                {["Name","Role","Department","Access","Tags","Type",""].map((h,i)=>(
                  <th key={i} style={{ textAlign:"left",padding:"14px 16px",fontSize:11,fontWeight:700,color:t.textMuted,textTransform:"uppercase",letterSpacing:0.8,width:i===6?52:undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSorted.map((p,idx)=>{
                const sel=selected.has(p.id);
                return (
                  <tr
                    key={p.id}
                    data-people-insight-row={p.id}
                    onClick={()=>openEdit(p)}
                    style={{
                      borderBottom:`1px solid ${t.border}`,background:sel?t.selRow:"transparent",
                      cursor:"pointer",transition:"background 0.12s",
                      animation:mounted?`rowIn 0.35s ease-out ${idx*0.025}s both`:"none",
                    }}
                    onMouseEnter={(e) => {
                      if (!sel) e.currentTarget.style.background = t.rowHov;
                      if (!enhancedMode) return;
                      clearTimeout(insightTimerRef.current);
                      insightTimerRef.current = window.setTimeout(() => {
                        const r = e.currentTarget.getBoundingClientRect();
                        const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
                        setPersonInsight({
                          personId: p.id,
                          top: r.top,
                          left: Math.min(r.right + 8, vw - 328),
                        });
                      }, 620);
                    }}
                    onMouseLeave={(e) => {
                      if (!sel) e.currentTarget.style.background = sel ? t.selRow : "transparent";
                      clearTimeout(insightTimerRef.current);
                      setPersonInsight(null);
                    }}
                  >
                    <td style={{ padding:"12px 14px" }} onClick={(e)=>e.stopPropagation()}>
                      <input type="checkbox" checked={sel} onChange={()=>toggleSel(p.id)} style={{ accentColor:t.chk,cursor:"pointer",width:16,height:16 }}/>
                    </td>
                    <td style={{ padding:"12px 16px" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                        <div style={{ width:34,height:34,borderRadius:10,background:avGrad(p.name),display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff",flexShrink:0,boxShadow:"0 2px 8px rgba(0,0,0,0.15)",opacity:p.archived?0.5:1 }}>{ini(p.name)}</div>
                        <span style={{ fontWeight:600,color:p.archived?t.textMuted:t.text,fontSize:14 }}>{p.name}</span>
                      </div>
                    </td>
                    <td style={{ padding:"12px 16px",color:p.role==="—"?t.textDim:t.textSoft,fontWeight:500 }}>{p.role}</td>
                    <td style={{ padding:"12px 16px",color:t.textSoft }}>
                      {p.department&&<span style={{ display:"inline-flex",alignItems:"center",gap:4 }}><ChevronRight size={12} style={{ color:t.textDim }}/>{p.department}</span>}
                    </td>
                    <td style={{ padding:"12px 16px" }}>
                      {p.access!=="—"?(<span style={{ background:t.accentGlow,color:t.accent,borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:600,display:"inline-flex",alignItems:"center",gap:4 }}><Shield size={11}/> {p.access}</span>):<span style={{ color:t.textDim }}>—</span>}
                    </td>
                    <td style={{ padding:"12px 16px" }}>
                      <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
                        {p.tags.slice(0,3).map((tag,j)=>{ const tp=tagChromaProps(tag,mode==="dark"); return <span key={j} className={tp.className} style={{ ...tp.style,fontSize:11 }}>{tag}</span>; })}
                        {p.tags.length>3&&<span style={{ color:t.textMuted,fontSize:11,fontWeight:650,padding:"3px 4px" }}>+{p.tags.length-3}</span>}
                      </div>
                    </td>
                    <td style={{ padding:"12px 16px",color:t.textSoft,fontWeight:500 }}>{p.type}</td>
                    <td style={{ padding:"12px 8px" }} onClick={(e)=>e.stopPropagation()}>
                      <RowActions person={p} t={t}
                        onEdit={()=>openEdit(p)}
                        onArchive={()=>archivePerson(p.id)}
                        onDelete={()=>{ setSelected(new Set([p.id])); setConfirmDel(true); }}/>
                    </td>
                  </tr>
                );
              })}
              {filteredSorted.length===0 && (
                <tr><td colSpan={8} style={{ textAlign:"center",padding:"56px 20px" }}>
                  {viewTab==="archived"
                    ? <><Archive size={32} style={{ color:t.textDim,marginBottom:12 }}/><div style={{ color:t.textMuted,fontSize:15,fontWeight:600 }}>No archived people</div><div style={{ color:t.textDim,fontSize:13,marginTop:4 }}>Archived team members will appear here</div></>
                    : <><Search size={32} style={{ color:t.textDim,marginBottom:12 }}/><div style={{ color:t.textMuted,fontSize:15,fontWeight:600 }}>{search||advActiveCount?"No people match filters":"No people yet"}</div><div style={{ color:t.textDim,fontSize:13,marginTop:4 }}>{search||advActiveCount?"Try adjusting search or open Filters to clear criteria":"Click \"Add person\" to get started"}</div></>
                  }
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {createPortal(
        <AnimatePresence>
          {enhancedMode && personInsight && insightPerson ? (
            <motion.div
              key={insightPerson.id}
              style={{
                position: "fixed",
                left: personInsight.left,
                top: Math.max(8, personInsight.top),
                zIndex: 4000,
                pointerEvents: "none",
                ["--surface"]: t.surface,
                ["--border"]: t.border,
                ["--text"]: t.text,
                ["--text-muted"]: t.textMuted,
                ["--text-soft"]: t.textSoft,
                ["--accent"]: t.accent,
              }}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <Suspense fallback={null}>
                <UserInsightPanel
                  person={insightPerson}
                  allocations={scheduleAllocations}
                  theme={mode === "light" ? "light" : "dark"}
                />
              </Suspense>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body
      )}

      <PersonModal
        open={modalOpen} onClose={()=>{ setModalOpen(false); setEditingPerson(null); }}
        onSave={handleModalSave} onArchive={handleModalArchive}
        editPerson={editingPerson}
        roles={roles} setRoles={setRoles} depts={depts} setDepts={setDepts} tagOpts={peopleTagOpts} setTagOpts={setPeopleTagOpts} t={t}
        projects={projects}
        allocations={allocations}
        setAllocations={setAllocations}
        syncAllocationDelete={syncAllocationDelete}
        syncAllocationUpdate={syncAllocationUpdate}
        onOpenCreateAllocation={({ person, projectLabel }) =>
          openCreateAllocationForPersonProject(person, projectLabel)
        }
        onOpenCreateLeave={(person) => openCreateLeaveForPerson(person)}
        tagTheme={mode}
      />

      <CreateAllocationModal
        open={allocCreateOpen}
        onClose={closeCreateAllocation}
        onCreate={handleCreateAllocation}
        onCreateLeave={handleCreateAllocation}
        people={schedulePeople}
        preselectPerson={allocPreselectPerson}
        preselectDate={null}
        preselectProject={allocPreselectProject}
        defaultTab={allocDefaultTab}
        projects={allocationProjectOptions}
        projectRegistry={projects}
        onAddProject={addAllocationProjectLabel}
        t={t}
      />

      <Confirm open={confirmDel} t={t} onYes={doDelete} onNo={()=>{ setConfirmDel(false); setSelected(new Set()); }}
        title="Confirm deletion" desc={<>You are about to permanently remove <strong style={{color:t.text}}>{selected.size} {selected.size===1?"person":"people"}</strong> from the directory.</>}
        yesLabel="Delete" yesIcon={Trash2} yesDanger/>



      <style>{`
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes modalScale{from{opacity:0;transform:translateY(16px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes scaleIn{from{opacity:0;transform:scale(0.93)}to{opacity:1;transform:scale(1)}}
        @keyframes dropIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeSlideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
        @keyframes chipIn{from{opacity:0;transform:scale(0.8)}to{opacity:1;transform:scale(1)}}
        @keyframes rowIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes toastIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
        @keyframes toastOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(30px)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:7px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${t.scroll};border-radius:4px}
        input[type="number"]::-webkit-inner-spin-button,input[type="number"]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
        input[type="number"]{-moz-appearance:textfield}
        ::selection{background:${t.accent}40}
      `}</style>
    </div>
  );
}
