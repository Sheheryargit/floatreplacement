import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Users,
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
} from "lucide-react";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAppData } from "../context/AppDataContext.jsx";
import AppSideNav from "../components/navigation/AppSideNav.jsx";
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
import { CreateAllocationModal } from "../components/AllocationModals.jsx";
import { resolveColorForProjectLabel } from "../utils/projectColors.js";
import "./PeoplePage.css";

function allocationHasPerson(a, pid) {
  if (Array.isArray(a.personIds) && a.personIds.length > 0) return a.personIds.includes(pid);
  return a.personId === pid;
}

function shortenAllocLabel(s, maxLen) {
  if (!s) return "";
  return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s;
}

/* ═══════════════════════════════════════════════════════════
   APP
   ═══════════════════════════════════════════════════════════ */
export default function PeoplePage() {
  const { theme: mode } = useAppTheme();
  const t = T[mode];

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
    setAllocations,
    projects,
    allocationProjectOptions,
    addAllocationProjectLabel,
    syncAllocationCreate,
    syncAllocationUpdate,
    syncAllocationDelete,
  } = useAppData();

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

  const [allocCreateOpen, setAllocCreateOpen] = useState(false);
  const [allocPreselectPerson, setAllocPreselectPerson] = useState(null);
  const [allocPreselectProject, setAllocPreselectProject] = useState(null);

  const schedulePeople = useMemo(
    () => [...people].filter((p) => !p.archived).sort((a, b) => a.name.localeCompare(b.name)),
    [people]
  );

  const openCreateAllocationForPersonProject = useCallback((person, projectLabel) => {
    setAllocPreselectPerson(person ?? null);
    setAllocPreselectProject(projectLabel != null ? String(projectLabel).trim() || null : null);
    setAllocCreateOpen(true);
  }, []);

  const closeCreateAllocation = useCallback(() => {
    setAllocCreateOpen(false);
    setAllocPreselectPerson(null);
    setAllocPreselectProject(null);
  }, []);

  const handleCreateAllocation = useCallback(
    (payload) => {
      if (!payload.isLeave) {
        const pStart = payload.startDate;
        const pEnd = payload.endDate;
        for (const pid of payload.personIds) {
          const leaveConflict = allocations.find(
            (a) =>
              a.isLeave &&
              allocationHasPerson(a, pid) &&
              a.startDate <= pEnd &&
              a.endDate >= pStart
          );
          if (leaveConflict) {
            const personName = people.find((p) => p.id === pid)?.name || "This person";
            const leaveTypeName = leaveConflict.leaveType
              ? (leaveConflict.project || "Leave")
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
    [setAllocations, projects, allocations, people, syncAllocationCreate]
  );

  useEffect(()=>{ setMounted(true); },[]);

  const filtered = useMemo(() => {
    const isArch = viewTab==="archived";
    return people.filter((p) => {
      if (p.archived !== isArch) return false;
      if (!search) return true;
      const s=search.toLowerCase();
      const role = (p.role || "").toLowerCase();
      const dept = (p.department || "").toLowerCase();
      const tags = p.tags || [];
      return p.name.toLowerCase().includes(s)||role.includes(s)||dept.includes(s)||tags.some((tg)=>String(tg).toLowerCase().includes(s));
    });
  }, [people,search,viewTab]);

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

  useEffect(() => {
    const h = (e) => {
      if (sortWrapRef.current && !sortWrapRef.current.contains(e.target)) setSortOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
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
      style={{
        background: t.bg,
        color: t.text,
        fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
        fontSize: 14,
        transition: "background 0.35s ease, color 0.35s ease",
      }}
    >
      <AppSideNav />

      <main className="people-page-main">
        {/* Header */}
        <header className="people-page-header" style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
          <h1 style={{ fontSize:26,fontWeight:700,margin:0,letterSpacing:-0.5 }}>People</h1>
          <div style={{ display:"flex",gap:8,alignItems:"center" }}>
            <div style={{ position:"relative" }}>
              <Search size={15} style={{ position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:t.textMuted }}/>
              <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search people…"
                style={{ width:search?240:180,background:t.surface,border:`1.5px solid ${t.borderIn}`,borderRadius:8,padding:"8px 12px 8px 34px",color:t.text,fontSize:13,outline:"none",transition:"all 0.25s" }}
                onFocus={(e)=>{ e.target.style.width="240px"; e.target.style.borderColor=t.focus; e.target.style.boxShadow=`0 0 0 3px ${t.accentGlow}`; }}
                onBlur={(e)=>{ if(!search) e.target.style.width="180px"; e.target.style.borderColor=t.borderIn; e.target.style.boxShadow="none"; }}/>
              {search&&<X size={14} style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:t.textMuted,cursor:"pointer" }} onClick={()=>setSearch("")}/>}
            </div>
            <button style={{ background:t.btnSec,border:`1px solid ${t.border}`,borderRadius:8,color:t.btnSecTxt,padding:"8px 16px",cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:7,transition:"all 0.15s" }}
              onMouseEnter={(e)=>e.currentTarget.style.background=t.btnSecHov} onMouseLeave={(e)=>e.currentTarget.style.background=t.btnSec}>
              <Download size={14}/> Import
            </button>
            <button onClick={openAdd} style={{ background:t.accent,border:"none",borderRadius:8,color:t.accentTxt,padding:"8px 18px",cursor:"pointer",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:7,transition:"all 0.15s",boxShadow:`0 2px 12px ${t.accent}30` }}
              onMouseEnter={(e)=>{ e.currentTarget.style.background=t.accentHov; e.currentTarget.style.transform="translateY(-1px)"; }}
              onMouseLeave={(e)=>{ e.currentTarget.style.background=t.accent; e.currentTarget.style.transform="none"; }}>
              <UserPlus size={14}/> Add person
            </button>
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
            <button onClick={()=>setConfirmDel(true)} style={{
              background:t.dangerSoft,border:`1.5px solid ${t.danger}40`,borderRadius:8,color:t.danger,
              padding:"8px 18px",cursor:"pointer",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:7,transition:"all 0.15s",animation:"fadeSlideIn 0.2s ease-out",
            }}
              onMouseEnter={(e)=>{ e.currentTarget.style.background=t.danger; e.currentTarget.style.color=t.dangerTxt; }}
              onMouseLeave={(e)=>{ e.currentTarget.style.background=t.dangerSoft; e.currentTarget.style.color=t.danger; }}>
              <Trash2 size={14}/> Delete {selected.size} selected
            </button>
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
                  <tr key={p.id} onClick={()=>openEdit(p)}
                    style={{
                      borderBottom:`1px solid ${t.border}`,background:sel?t.selRow:"transparent",
                      cursor:"pointer",transition:"background 0.12s",
                      animation:mounted?`rowIn 0.35s ease-out ${idx*0.025}s both`:"none",
                    }}
                    onMouseEnter={(e)=>{ if(!sel) e.currentTarget.style.background=t.rowHov; }}
                    onMouseLeave={(e)=>{ if(!sel) e.currentTarget.style.background=sel?t.selRow:"transparent"; }}>
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
                    : <><Search size={32} style={{ color:t.textDim,marginBottom:12 }}/><div style={{ color:t.textMuted,fontSize:15,fontWeight:600 }}>{search?"No people match your search":"No people yet"}</div><div style={{ color:t.textDim,fontSize:13,marginTop:4 }}>{search?"Try a different search term":"Click \"Add person\" to get started"}</div></>
                  }
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

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
