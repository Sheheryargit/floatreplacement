import { useState, useEffect, useMemo } from "react";
import { NavLink } from "react-router-dom";
import {
  Users, FolderOpen, BarChart3, CalendarDays, ClipboardList,
  Plus, Download, Trash2, Search, X, ChevronRight,
  Sun, Moon, UserPlus, Shield,
  Archive, ArchiveRestore,
} from "lucide-react";
import { useAppTheme } from "../context/ThemeContext.jsx";
import PersonModal, {
  T,
  useToasts,
  Toasts,
  Confirm,
  RowActions,
  PEOPLE_SEED,
  formToPerson,
  SEED_ROLES,
  SEED_DEPTS,
  SEED_TAGS,
  ini,
  avGrad,
  nextPersonId,
} from "../components/PersonModal.jsx";

/* ═══════════════════════════════════════════════════════════
   APP
   ═══════════════════════════════════════════════════════════ */
export default function PeoplePage() {
  const { theme: mode, toggleTheme } = useAppTheme();
  const t = T[mode];

  const [people,setPeople]=useState(() => PEOPLE_SEED.map((p) => ({ ...p })));
  const [selected,setSelected]=useState(new Set());
  const [search,setSearch]=useState("");
  const [viewTab,setViewTab]=useState("active"); // active | archived
  const [modalOpen,setModalOpen]=useState(false);
  const [editingPerson,setEditingPerson]=useState(null);
  const [confirmDel,setConfirmDel]=useState(false);
  const [mounted,setMounted]=useState(false);
  const [roles,setRoles]=useState([...SEED_ROLES]);
  const [depts,setDepts]=useState([...SEED_DEPTS]);
  const [tagOpts,setTagOpts]=useState([...SEED_TAGS]);
  const { ts, add:toast } = useToasts();

  useEffect(()=>{ setMounted(true); },[]);

  const filtered = useMemo(() => {
    const isArch = viewTab==="archived";
    return people.filter((p) => {
      if (p.archived !== isArch) return false;
      if (!search) return true;
      const s=search.toLowerCase();
      return p.name.toLowerCase().includes(s)||p.role.toLowerCase().includes(s)||p.department.toLowerCase().includes(s)||p.tags.some((tg)=>tg.toLowerCase().includes(s));
    });
  }, [people,search,viewTab]);

  const activeCount = people.filter((p)=>!p.archived).length;
  const archivedCount = people.filter((p)=>p.archived).length;

  const toggleSel=(id)=>setSelected((p)=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });
  const toggleAll=()=>setSelected(selected.size===filtered.length?new Set():new Set(filtered.map((p)=>p.id)));

  const doDelete=()=>{ const c=selected.size; setPeople(people.filter((p)=>!selected.has(p.id))); setSelected(new Set()); setConfirmDel(false); toast(`${c} ${c===1?"person":"people"} removed`,"danger"); };
  const archivePerson=(id)=>{ setPeople(people.map((p)=>p.id===id?{...p,archived:!p.archived}:p)); setSelected(new Set()); const p=people.find((x)=>x.id===id); toast(`${p.name} ${p.archived?"restored":"archived"}`,"warn"); };

  const openAdd=()=>{ setEditingPerson(null); setModalOpen(true); };
  const openEdit=(person)=>{ setEditingPerson(person); setModalOpen(true); };

  const handleModalSave=(form)=>{
    if(editingPerson) {
      const updated = formToPerson(form, editingPerson.id, editingPerson.archived);
      setPeople(people.map((p)=>p.id===editingPerson.id?updated:p).sort((a,b)=>a.name.localeCompare(b.name)));
      toast(`${form.name} updated`,"success");
    } else {
      const newP = formToPerson(form, nextPersonId(), false);
      setPeople([...people,newP].sort((a,b)=>a.name.localeCompare(b.name)));
      toast(`${form.name} added to directory`,"success");
    }
    setModalOpen(false); setEditingPerson(null);
  };
  const handleModalArchive=()=>{
    if(editingPerson) { archivePerson(editingPerson.id); setModalOpen(false); setEditingPerson(null); }
  };

  const sideNav = [
    { to:"/", end:true, icon:CalendarDays, label:"Schedule" },
    { to:null, icon:ClipboardList, label:"Project plan" },
    { to:"/people", icon:Users, label:"People" },
    { to:"/projects", icon:FolderOpen, label:"Projects" },
    { to:null, icon:BarChart3, label:"Report" },
  ];

  return (
    <div style={{ background:t.bg,minHeight:"100vh",color:t.text,fontFamily:"'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",fontSize:14,transition:"background 0.35s ease,color 0.35s ease" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap" rel="stylesheet"/>

      {/* ── Sidebar ── */}
      <nav style={{ position:"fixed",left:0,top:0,bottom:0,width:72,background:t.sidebar,display:"flex",flexDirection:"column",alignItems:"center",paddingTop:16,gap:4,zIndex:50,borderRight:`1px solid ${t.border}`,transition:"background 0.35s" }}>
        <NavLink to="/" style={{ marginBottom:12,width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${t.accent},#a78bfa)`,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <span style={{ color:"#fff",fontWeight:800,fontSize:14 }}>R1</span>
        </NavLink>
        {sideNav.map((item,i)=>{
          const Icon=item.icon;
          const base={ display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"10px 4px",borderRadius:10,width:58,textAlign:"center",transition:"all 0.2s",position:"relative",textDecoration:"none",color:t.textMuted };
          if(item.to) {
            return (
              <NavLink key={i} to={item.to} end={!!item.end} style={({ isActive })=>({ ...base, cursor:"pointer", background:isActive?t.sidebarAct:"transparent", color:isActive?t.accent:t.textMuted })}>
                {({ isActive })=>(<>
                  {isActive&&<div style={{ position:"absolute",left:0,top:12,bottom:12,width:3,borderRadius:"0 3px 3px 0",background:t.accent }}/>}
                  <Icon size={19} strokeWidth={isActive?2.2:1.8}/><span style={{ fontSize:10,fontWeight:isActive?600:500 }}>{item.label}</span>
                </>)}
              </NavLink>
            );
          }
          return (
            <div key={i} onMouseEnter={(e)=>{ e.currentTarget.style.background=t.sidebarAct; }} onMouseLeave={(e)=>{ e.currentTarget.style.background="transparent"; }}
              style={{ ...base, cursor:"default", opacity:0.65 }}>
              <Icon size={19} strokeWidth={1.8}/><span style={{ fontSize:10,fontWeight:500 }}>{item.label}</span>
            </div>
          );
        })}
        <div style={{ marginTop:"auto",marginBottom:16 }}>
          <button onClick={toggleTheme} title={mode==="dark"?"Light mode":"Dark mode"}
            style={{ width:40,height:40,borderRadius:10,border:`1px solid ${t.borderIn}`,background:t.surfAlt,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:t.textSoft,transition:"all 0.25s" }}
            onMouseEnter={(e)=>{ e.currentTarget.style.borderColor=t.accent; }} onMouseLeave={(e)=>{ e.currentTarget.style.borderColor=t.borderIn; }}>
            {mode==="dark"?<Sun size={16}/>:<Moon size={16}/>}
          </button>
        </div>
      </nav>

      {/* ── Main ── */}
      <main style={{ marginLeft:72,padding:"24px 36px" }}>
        {/* Header */}
        <header style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
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
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,marginTop:8 }}>
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

        {/* Table */}
        <div style={{ background:t.surface,borderRadius:12,border:`1px solid ${t.border}`,overflow:"hidden",transition:"background 0.35s",boxShadow:"0 1px 3px rgba(0,0,0,0.05)" }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:`2px solid ${t.border}` }}>
                <th style={{ width:48,padding:"14px 14px" }}><input type="checkbox" checked={selected.size===filtered.length&&filtered.length>0} onChange={toggleAll} style={{ accentColor:t.chk,cursor:"pointer",width:16,height:16 }}/></th>
                {["Name","Role","Department","Access","Tags","Type",""].map((h,i)=>(
                  <th key={i} style={{ textAlign:"left",padding:"14px 16px",fontSize:11,fontWeight:700,color:t.textMuted,textTransform:"uppercase",letterSpacing:0.8,width:i===6?52:undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p,idx)=>{
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
                        {p.tags.slice(0,3).map((tag,j)=>(<span key={j} style={{ background:t.tagBg,color:t.tagTxt,borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:600 }}>{tag}</span>))}
                        {p.tags.length>3&&<span style={{ color:t.textMuted,fontSize:11,fontWeight:600,padding:"3px 4px" }}>+{p.tags.length-3}</span>}
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
              {filtered.length===0 && (
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
        roles={roles} setRoles={setRoles} depts={depts} setDepts={setDepts} tagOpts={tagOpts} setTagOpts={setTagOpts} t={t}/>

      <Confirm open={confirmDel} t={t} onYes={doDelete} onNo={()=>{ setConfirmDel(false); setSelected(new Set()); }}
        title="Confirm deletion" desc={<>You are about to permanently remove <strong style={{color:t.text}}>{selected.size} {selected.size===1?"person":"people"}</strong> from the directory.</>}
        yesLabel="Delete" yesIcon={Trash2} yesDanger/>

      <Toasts ts={ts} t={t}/>

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
