import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAppData } from "../context/AppDataContext.jsx";
import { isSupabaseConfigured } from "../lib/supabase.js";
import AppSideNav from "../components/navigation/AppSideNav.jsx";
import { Button } from "../components/ui/Button.jsx";
import { FloatSelect, FloatPersonPicker } from "../components/ui/FloatSelect.jsx";
import { PROJECT_COLOR_PALETTE, avatarGradientFromName } from "../utils/projectColors.js";
import { tagChromaProps } from "../utils/tagChroma.js";
import { toast } from "sonner";
import {
  Users,
  FolderOpen,
  Plus,
  Download,
  Trash2,
  Search,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Pencil,
  Save,
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Tag,
  Mail,
  Circle,
  Calendar,
  Hash,
  FileText,
  User,
  Briefcase,
  Palette,
  StickyNote,
  Shield,
  UserCheck,
  UserMinus,
  Layers,
} from "lucide-react";

/* ═══════════════════ DATA ═══════════════════ */
const STAGES = [
  { value:"draft", label:"Draft", color:"#636d84", desc:"Plan privately before sharing." },
  { value:"tentative", label:"Tentative", color:"#f59e0b", desc:"Set expectations without notifications." },
  { value:"confirmed", label:"Confirmed", color:"#34d399", desc:"Full visibility and tracking." },
  { value:"completed", label:"Completed", color:"#4fc3f7", desc:"Allow final changes, no notifications." },
  { value:"cancelled", label:"Cancelled", color:"#ff4d6a", desc:"Mark as inactive, stop tracking." },
];
const PROJECT_COLORS = PROJECT_COLOR_PALETTE;
const SEED_OWNERS = [
  { id:"jf",name:"Jane Foster",initials:"JF" },{ id:"dc",name:"David Chen",initials:"DC" },
  { id:"tp",name:"Tina Park",initials:"TP" },{ id:"jc",name:"James Clark",initials:"JC" },
  { id:"bh",name:"Ben Harris",initials:"BH" },{ id:"ss",name:"Sarah Singh",initials:"SS" },
  { id:"lm",name:"Lisa Morales",initials:"LM" },{ id:"gw",name:"George Wang",initials:"GW" },
  { id:"sy",name:"Sheher Yar",initials:"SY" },
];

/* ═══════════════════ HELPERS ═══════════════════ */
const ini = (n) => { if(!n)return""; const p=n.trim().split(/\s+/); return p.length===1?(p[0][0]||"").toUpperCase():(p[0][0]+p[p.length-1][0]).toUpperCase(); };
const avGrad = avatarGradientFromName;
const fmtDate = (d) => { if(!d)return"—"; const dt=new Date(d); return dt.toLocaleDateString("en-AU",{day:"2-digit",month:"short",year:"numeric"}); };

/* ═══════════════════ THEMES ═══════════════════ */
const T = {
  dark: { bg:"#0f1117",surface:"#181c26",surfRaised:"#1e2235",surfAlt:"#1a1e2e",border:"#2a2f45",borderSub:"#323852",borderIn:"#3a4060",text:"#f0f2f8",textSoft:"#9ba4b8",textMuted:"#7b82a0",textDim:"#4a5168",accent:"#00c2a8",accentHov:"#00e5c8",accentTxt:"#061210",accentGlow:"rgba(0,194,168,0.15)",sidebar:"#0f1117",sidebarAct:"rgba(0,194,168,0.08)",rowHov:"#151a24",tagBg:"rgba(124,106,247,0.12)",tagTxt:"#a599fc",btnSec:"#1e2235",btnSecHov:"#252a3d",btnSecTxt:"#c4c9d8",danger:"#ef4444",dangerHov:"#dc2626",dangerSoft:"rgba(239,68,68,0.16)",dangerTxt:"#fff",dangerGlow:"0 4px 24px rgba(239,68,68,0.25)",success:"#22c55e",successHov:"#16a34a",successSoft:"rgba(34,197,94,0.14)",successGlow:"0 4px 20px rgba(34,197,94,0.22)",warn:"#f59e0b",warnHov:"#d97706",warnTxt:"#0f172a",warnSoft:"rgba(245,158,11,0.16)",warnGlow:"0 4px 20px rgba(245,158,11,0.2)",info:"#38bdf8",infoSoft:"rgba(56,189,248,0.14)",overlay:"rgba(0,0,0,0.6)",shadow:"0 32px 100px rgba(0,0,0,0.55)",chk:"#00c2a8",scroll:"#2a2f45",selRow:"rgba(0,194,168,0.06)",focus:"#00c2a8",toastBg:"#181c26",toastBdr:"#2a2f45",tabActiveBg:"rgba(0,194,168,0.12)",tabHovBg:"rgba(0,194,168,0.06)" },
  light: { bg:"#f4f6fa",surface:"#ffffff",surfRaised:"#ffffff",surfAlt:"#e8ebf4",border:"#e0e4ef",borderSub:"#e4e8f0",borderIn:"#d4d8e4",text:"#12151f",textSoft:"#4a5168",textMuted:"#5c6478",textDim:"#9ca3b8",accent:"#00a896",accentHov:"#00c2a8",accentTxt:"#ffffff",accentGlow:"rgba(0,194,168,0.12)",sidebar:"#ffffff",sidebarAct:"rgba(0,194,168,0.08)",rowHov:"#f4f6fa",tagBg:"rgba(124,106,247,0.1)",tagTxt:"#5b4fcf",btnSec:"#e8ebf4",btnSecHov:"#dde1ec",btnSecTxt:"#3e4560",danger:"#ef4444",dangerHov:"#dc2626",dangerSoft:"rgba(239,68,68,0.1)",dangerTxt:"#fff",dangerGlow:"0 4px 18px rgba(239,68,68,0.2)",success:"#16a34a",successHov:"#15803d",successSoft:"rgba(22,163,74,0.1)",successGlow:"0 4px 16px rgba(22,163,74,0.18)",warn:"#d97706",warnHov:"#b45309",warnTxt:"#fff",warnSoft:"rgba(217,119,6,0.1)",warnGlow:"0 4px 16px rgba(217,119,6,0.16)",info:"#0284c7",infoSoft:"rgba(2,132,199,0.1)",overlay:"rgba(15,18,28,0.35)",shadow:"0 32px 100px rgba(0,0,0,0.12)",chk:"#00a896",scroll:"#d4d8e0",selRow:"rgba(0,194,168,0.08)",focus:"#00c2a8",toastBg:"#ffffff",toastBdr:"#e0e4ef",tabActiveBg:"rgba(0,194,168,0.1)",tabHovBg:"rgba(0,194,168,0.05)" },
};


/* ═══════════════════ CONFIRM ═══════════════════ */
function Confirm({open,onYes,onNo,title,desc,yesLabel,yesIcon:YI,yesDanger,t}){
  if(!open)return null;
  return(<div className="float-modal-overlay-dim" style={{position:"fixed",inset:0,background:t.overlay,zIndex:350,display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn 0.2s var(--ds-ease-out, ease-out)"}} onClick={onNo}>
    <div onClick={e=>e.stopPropagation()} className="float-modal-panel-enter" style={{background:t.surfRaised,borderRadius:16,padding:"28px 32px",width:420,border:`1px solid ${t.border}`,boxShadow:`${t.shadow}, 0 0 0 1px rgba(255,255,255,0.04) inset`}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <div style={{width:40,height:40,borderRadius:12,background:yesDanger?t.dangerSoft:t.warnSoft,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:yesDanger?t.dangerGlow:t.warnGlow}}><AlertTriangle size={20} style={{color:yesDanger?t.danger:t.warn}}/></div>
        <div><div style={{fontWeight:700,color:t.text,fontSize:16}}>{title}</div><div style={{color:t.textMuted,fontSize:13,marginTop:2}}>This action cannot be undone.</div></div>
      </div>
      <p style={{color:t.textSoft,fontSize:14,lineHeight:1.6,margin:"0 0 24px"}}>{desc}</p>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap"}}>
        <Button type="button" variant="secondary" size="md" onClick={onNo}>Cancel</Button>
        <Button type="button" variant={yesDanger ? "destructive" : "warning"} size="md" onClick={onYes} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {YI ? <YI size={14} /> : null} {yesLabel}
        </Button>
      </div>
    </div>
  </div>);
}

const CLIENT_NONE = "__client_none__";

/* ═══════════════════ TAG INPUT ═══════════════════ */
function CTagInput({tags,setTags,options,t,tagIsDark}){
  const[open,setOpen]=useState(false);const[q,setQ]=useState("");
  const ref=useRef(null);const ir=useRef(null);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const avail=options.filter(o=>!tags.includes(o)&&o.toLowerCase().includes(q.toLowerCase()));
  const canC=q.trim()&&!options.some(o=>o.toLowerCase()===q.trim().toLowerCase())&&!tags.includes(q.trim());
  const add=v=>{const s=v.trim();if(s&&!tags.includes(s))setTags([...tags,s]);setQ("");};
  return(<div ref={ref} style={{position:"relative"}}>
    <div onClick={()=>{setOpen(true);setTimeout(()=>ir.current?.focus(),0);}} style={{background:t.surfAlt,border:`1.5px solid ${open?t.focus:t.borderIn}`,borderRadius:8,padding:"7px 10px",cursor:"text",minHeight:44,display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",transition:"border-color 0.2s,box-shadow 0.2s",boxShadow:open?`0 0 0 3px ${t.accentGlow}`:"none"}}>
      {tags.map(tag=>{const tp=tagChromaProps(tag,tagIsDark);return(<span key={tag} className={tp.className} style={{...tp.style,animation:"chipIn 0.2s ease-out"}}><Tag size={10} strokeWidth={2.25} aria-hidden/> {tag}<X size={12} className="float-tag-dismiss" aria-label={`Remove ${tag}`} onClick={e=>{e.stopPropagation();setTags(tags.filter(x=>x!==tag));}}/></span>);})}
      <input ref={ir} value={q} onChange={e=>setQ(e.target.value)} onFocus={()=>setOpen(true)} onKeyDown={e=>{if((e.key===" "||e.key==="Enter")&&q.trim()){e.preventDefault();add(q);}else if(e.key==="Backspace"&&!q&&tags.length)setTags(tags.slice(0,-1));}} placeholder={tags.length===0?"Type a tag, then press Space or Enter…":""} style={{background:"transparent",border:"none",outline:"none",flex:1,minWidth:120,color:t.text,fontSize:13,padding:"4px 0"}}/>
    </div>
    {open&&(avail.length>0||canC)&&(<div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:140,background:t.surfRaised,border:`1px solid ${t.border}`,borderRadius:10,maxHeight:180,overflowY:"auto",boxShadow:`0 12px 40px rgba(0,0,0,0.25)`,animation:"dropIn 0.18s ease-out"}}>
      {canC&&<div onClick={()=>add(q)} style={{padding:"9px 14px",cursor:"pointer",color:t.accent,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background=t.accentGlow} onMouseLeave={e=>e.currentTarget.style.background="transparent"}><Plus size={14}/> Create &lsquo;{q.trim()}&rsquo;</div>}
      {avail.map(o=>(<div key={o} onClick={()=>add(o)} style={{padding:"9px 14px",cursor:"pointer",color:t.text,fontSize:13,transition:"background 0.1s"}} onMouseEnter={e=>e.currentTarget.style.background=t.rowHov} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{o}</div>))}
    </div>)}
  </div>);
}

/* ═══════════════════ COLLAPSIBLE SECTION ═══════════════════ */
function Section({title,icon:Icon,count,defaultOpen,children,t}){
  const[open,setOpen]=useState(!!defaultOpen);
  return(<div style={{background:t.surfAlt,border:`1px solid ${t.borderSub}`,borderRadius:10,marginTop:12,overflow:"hidden",transition:"all 0.2s"}}>
    <div onClick={()=>setOpen(!open)} style={{padding:"14px 20px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",transition:"background 0.15s"}} onMouseEnter={e=>e.currentTarget.style.background=t.tabHovBg} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {Icon&&<Icon size={16} style={{color:t.accent}}/>}
        <span style={{fontWeight:700,fontSize:14,color:t.text}}>{title}</span>
        {count!==undefined&&<span style={{background:t.accentGlow,color:t.accent,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{count}</span>}
      </div>
      {open?<ChevronUp size={15} style={{color:t.textMuted}}/>:<ChevronDown size={15} style={{color:t.textMuted}}/>}
    </div>
    {open&&<div style={{padding:"0 20px 18px",borderTop:`1px solid ${t.borderSub}`}}>{children}</div>}
  </div>);
}

/* ═══════════════════ ROW ACTIONS ═══════════════════ */
function RowActions({project,onEdit,onArchive,onDelete,t}){
  const[open,setOpen]=useState(false);const ref=useRef(null);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  return(<div ref={ref} style={{position:"relative",zIndex:open?50:1}}>
    <button onClick={e=>{e.stopPropagation();setOpen(!open);}} style={{background:"transparent",border:"none",cursor:"pointer",color:t.textMuted,padding:6,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.background=t.accentGlow;e.currentTarget.style.color=t.accent;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=t.textMuted;}}><MoreHorizontal size={16}/></button>
    {open&&(<>
      <div onClick={e=>{e.stopPropagation();setOpen(false);}} style={{position:"fixed",inset:0,zIndex:99}}/>
      <div style={{position:"absolute",right:0,top:"100%",marginTop:4,zIndex:100,background:t.bg==="#0f1117"||t.bg==="#0b0e14"?"#111627":"#ffffff",border:`1.5px solid ${t.accent}30`,borderRadius:10,boxShadow:`0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.3)`,minWidth:190,overflow:"hidden",animation:"dropIn 0.15s ease-out"}}>
      {[
        {icon:Pencil,label:"Edit project",action:()=>{onEdit();setOpen(false);},color:t.text},
        {icon:project.archived?ArchiveRestore:Archive,label:project.archived?"Restore":"Archive",action:()=>{onArchive();setOpen(false);},color:t.warn},
        {icon:Trash2,label:"Delete",action:()=>{onDelete();setOpen(false);},color:t.danger},
      ].map((item,i)=>(<div key={i} onClick={e=>{e.stopPropagation();item.action();}} style={{padding:"11px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,fontSize:13,fontWeight:500,color:item.color,transition:"background 0.12s",borderBottom:i<2?`1px solid ${t.bg==="#0f1117"||t.bg==="#0b0e14"?"#1a2030":"#e4e7ed"}`:"none"}} onMouseEnter={e=>e.currentTarget.style.background=t.bg==="#0f1117"||t.bg==="#0b0e14"?"#1a2236":"#f0f2f5"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}><item.icon size={15}/> {item.label}</div>))}
      </div>
    </>)}
  </div>);
}

/* ═══════════════════ PROJECT MODAL ═══════════════════ */
const Lbl=t=>({fontSize:13,color:t.textMuted,fontWeight:600,whiteSpace:"nowrap"});

const defProject={name:"",code:"",owner:"sy",stage:"draft",billable:true,client:"",tags:[],startDate:"",endDate:"",notes:"",teamIds:[],managerEdit:false,color:"#6c8cff"};

export function ProjectModal({open,onClose,onSave,onArchive,editProject,people,clients,setClients,tagOpts,setTagOpts,t,tagIsDark=true}){
  const[form,setForm]=useState(null);const ref=useRef(null);const isEdit=!!editProject;
  useEffect(()=>{if(!open)return;if(editProject)setForm({...editProject,teamIds:[...(editProject.teamIds||[])]});else setForm({...defProject,color:PROJECT_COLORS[Math.floor(Math.random()*PROJECT_COLORS.length)]});},[open,editProject?.id]);
  if(!open||!form)return null;
  const upd=p=>setForm({...form,...p});
  const save=()=>{if(!form.name.trim())return;onSave(form);};

  return(
    <div className="float-modal-overlay-dim" onClick={e=>{if(ref.current&&!ref.current.contains(e.target))onClose();}} style={{
      position:"fixed",inset:0,background:t.overlay,zIndex:200,
      display:"flex",alignItems:"center",justifyContent:"center",
      padding:"max(16px, env(safe-area-inset-top, 0px)) max(20px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(20px, env(safe-area-inset-left, 0px))",
      overflowY:"auto",
      WebkitOverflowScrolling:"touch",
      animation:"fadeIn 0.22s var(--ds-ease-out, ease-out)",
    }}>
      <div className="float-premium-modal float-modal-panel-enter" ref={ref} onClick={e=>e.stopPropagation()} style={{
        background:t.surfRaised,width:"min(640px, 100%)",maxWidth:"100%",
        maxHeight:"min(calc(100vh - 32px), calc(100dvh - 32px))",
        display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden",
      }}>

        {/* Header */}
        <div style={{padding:"24px 32px 20px",flexShrink:0,borderBottom:`1px solid ${t.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{position:"relative"}}>
              <div style={{width:42,height:42,borderRadius:12,background:form.color,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 10px rgba(0,0,0,0.2)",transition:"transform 0.15s"}} onClick={()=>upd({_colorOpen:!form._colorOpen})} onMouseEnter={e=>e.currentTarget.style.transform="scale(1.08)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}><Palette size={16} style={{color:"#fff",opacity:0.8}}/></div>
              {form._colorOpen&&<div style={{position:"absolute",top:"100%",left:0,marginTop:8,zIndex:150,background:t.surfRaised,border:`1px solid ${t.border}`,borderRadius:10,padding:10,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,maxHeight:220,overflowY:"auto",boxShadow:`0 12px 40px rgba(0,0,0,0.3)`,animation:"dropIn 0.15s ease-out"}}>{PROJECT_COLORS.map(c=>(<div key={c} onClick={()=>upd({color:c,_colorOpen:false})} style={{width:28,height:28,borderRadius:8,background:c,cursor:"pointer",border:form.color===c?`2.5px solid ${t.text}`:"2.5px solid transparent",transition:"transform 0.1s"}} onMouseEnter={e=>e.currentTarget.style.transform="scale(1.15)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}/>))}</div>}
            </div>
            <input value={form.name} onChange={e=>upd({name:e.target.value})} placeholder="Project name" autoFocus={!isEdit} style={{background:"transparent",border:"none",outline:"none",fontSize:24,fontWeight:700,color:t.text,flex:1,padding:0,letterSpacing:-0.3}}/>
            <button onClick={onClose} style={{background:"transparent",border:"none",cursor:"pointer",color:t.textMuted,padding:6,borderRadius:8,transition:"all 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.background=t.btnSecHov;e.currentTarget.style.color=t.text;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=t.textMuted;}}><X size={18}/></button>
          </div>
        </div>

        {/* Content */}
        <div style={{overflowY:"auto",flex:1,minHeight:0,padding:"22px 32px"}}>
          <div style={{display:"grid",gridTemplateColumns:"120px 1fr",gap:"16px 24px",alignItems:"center"}}>
            <label style={Lbl(t)}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Hash size={14}/> Project code</span></label>
            <input value={form.code} onChange={e=>upd({code:e.target.value})} placeholder="Add project code" style={{background:t.surfAlt,border:`1.5px solid ${t.borderIn}`,borderRadius:8,padding:"10px 14px",color:t.text,fontSize:14,outline:"none",fontFamily:"'DM Mono', monospace"}}/>

            <label style={Lbl(t)}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><User size={14}/> Owner</span></label>
            <FloatSelect
              t={t}
              value={form.owner}
              onChange={(id)=>{const o=SEED_OWNERS.find(x=>x.id===id);if(o)upd({owner:o.id});}}
              options={SEED_OWNERS.map((o)=>({ label:o.name, value:o.id, raw:o }))}
              placeholder="Select owner"
              creatable={false}
              searchPlaceholder="Search owners…"
              renderOption={(o,th)=>o?(<div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:26,height:26,borderRadius:7,background:avGrad(o.name),display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff"}}>{o.initials}</div><span style={{fontWeight:500,color:th.text}}>{o.name}</span></div>):null}
            />

            <label style={Lbl(t)}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Circle size={14}/> Stage</span></label>
            <FloatSelect
              t={t}
              value={form.stage}
              onChange={(v)=>{const s=STAGES.find(x=>x.value===v);if(s)upd({stage:s.value});}}
              options={STAGES.map((s)=>({ label:s.label, value:s.value, raw:s }))}
              placeholder="Select stage"
              creatable={false}
              searchPlaceholder="Search stages…"
              renderOption={(s,th)=>s?(<div style={{display:"flex",alignItems:"flex-start",gap:10}}><Circle size={14} fill={s.color} stroke={s.color} style={{flexShrink:0,marginTop:3}}/><div><div style={{fontWeight:600,color:th.text}}>{s.label}</div><div style={{fontSize:12,color:th.textMuted,marginTop:1,lineHeight:1.3}}>{s.desc}</div></div></div>):null}
            />

            <label style={Lbl(t)}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><FileText size={14}/> Billable</span></label>
            <div style={{display:"flex",gap:0}}>
              {["Billable","Non-billable"].map((opt,i)=>{const bill=opt==="Billable";const active=(bill&&form.billable)||(!bill&&!form.billable);const ok=bill&&active;const warn=!bill&&active;const borderC=ok?t.success:warn?t.warn:t.borderIn;return(<button key={opt} type="button" onClick={()=>upd({billable:bill})} style={{padding:"9px 20px",fontSize:13,cursor:"pointer",fontWeight:active?700:550,border:`1.5px solid ${borderC}`,borderRadius:i===0?"10px 0 0 10px":"0 10px 10px 0",background:ok?t.successSoft:warn?t.warnSoft:active?t.accentGlow:t.surfAlt,color:ok?t.successHov:warn?t.warnHov:active?t.accent:t.textSoft,transition:"box-shadow 0.22s cubic-bezier(0.22,1,0.36,1), background 0.2s ease, border-color 0.2s ease",marginLeft:i===1?-1.5:0,boxShadow:ok&&active?t.successGlow:warn&&active?t.warnGlow:"none"}}>{opt}</button>);})}
            </div>

            <label style={Lbl(t)}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Briefcase size={14}/> Client</span></label>
            <FloatSelect
              t={t}
              value={form.client?form.client:CLIENT_NONE}
              onChange={(v)=>{if(v!==CLIENT_NONE&&!clients.includes(v))setClients([...clients,v]);upd({client:v===CLIENT_NONE?"":v});}}
              options={[{label:"No client",value:CLIENT_NONE},...clients.map((c)=>({label:c,value:c}))]}
              placeholder="Select client"
              searchPlaceholder="Search clients or type to add new…"
            />

            <label style={Lbl(t)}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Tag size={14}/> Tags</span></label>
            <CTagInput t={t} tagIsDark={tagIsDark} tags={form.tags} setTags={nt=>{const n=nt.filter(x=>!tagOpts.includes(x));if(n.length)setTagOpts([...tagOpts,...n]);upd({tags:nt});}} options={tagOpts}/>

            <label style={Lbl(t)}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Calendar size={14}/> Dates</span></label>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"center"}}>
              <input type="date" value={form.startDate} onChange={e=>upd({startDate:e.target.value})} style={{background:t.surfAlt,border:`1.5px solid ${t.borderIn}`,borderRadius:8,padding:"10px 12px",color:t.text,fontSize:14,outline:"none",colorScheme:t===T.dark?"dark":"light"}}/>
              <span style={{color:t.textDim,fontSize:12}}>to</span>
              <input type="date" value={form.endDate} onChange={e=>upd({endDate:e.target.value})} style={{background:t.surfAlt,border:`1.5px solid ${t.borderIn}`,borderRadius:8,padding:"10px 12px",color:t.text,fontSize:14,outline:"none",colorScheme:t===T.dark?"dark":"light"}}/>
            </div>

            <label style={{...Lbl(t),alignSelf:"flex-start",paddingTop:10}}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><StickyNote size={14}/> Notes</span></label>
            <textarea value={form.notes} onChange={e=>upd({notes:e.target.value})} rows={3} style={{background:t.surfAlt,border:`1.5px solid ${t.borderIn}`,borderRadius:8,padding:"10px 14px",color:t.text,fontSize:14,outline:"none",resize:"vertical",minHeight:60,fontFamily:"inherit"}}/>
          </div>

          <div style={{borderTop:`1px solid ${t.border}`,margin:"20px 0 4px",paddingTop:16}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",color:t.textSoft,fontSize:13}}>
              <input type="checkbox" checked={form.managerEdit} onChange={e=>upd({managerEdit:e.target.checked})} style={{accentColor:t.chk,width:16,height:16}}/>
              <Shield size={14} style={{color:t.textMuted}}/> Managers with 'manage projects' permission can edit this project
            </label>
          </div>

          {/* Team section */}
          <Section title="Team" icon={Users} count={form.teamIds.length} defaultOpen={form.teamIds.length>0} t={t}>
            <div style={{paddingTop:14,display:"flex",flexDirection:"column",gap:6}}>
              {form.teamIds.map((pid,i)=>{const p=people.find(x=>x.id===pid);if(!p)return null;return(
                <div key={pid} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",borderRadius:8,transition:"background 0.1s",background:"transparent"}} onMouseEnter={e=>e.currentTarget.style.background=t.tabHovBg} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:32,height:32,borderRadius:8,background:avGrad(p.name),display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0}}>{ini(p.name)}</div>
                    <div><div style={{fontWeight:600,fontSize:13,color:t.text}}>{p.name}</div><div style={{fontSize:11,color:t.textMuted,display:"flex",alignItems:"center",gap:4}}>{p.role!=="—"&&<span>{p.role}</span>}{p.role!=="—"&&p.department&&<span style={{color:t.textDim}}>·</span>}{p.department&&<span>{p.department}</span>}</div></div>
                  </div>
                  <button onClick={()=>upd({teamIds:form.teamIds.filter(id=>id!==pid)})} style={{background:"transparent",border:"none",cursor:"pointer",color:t.textMuted,padding:6,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.background=t.dangerSoft;e.currentTarget.style.color=t.danger;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=t.textMuted;}}><UserMinus size={15}/></button>
                </div>);})}
              <div style={{marginTop:form.teamIds.length>0?6:0}}>
                <FloatPersonPicker
                  t={t}
                  people={people}
                  excludeIds={form.teamIds}
                  onPick={(id)=>upd({teamIds:[...form.teamIds,id]})}
                  placement="above"
                  placeholder="Add team member"
                  emptyAllMessage="Everyone available is already on this team."
                  emptyFilterMessage="No people match your search."
                />
              </div>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div style={{padding:"16px 32px 24px",flexShrink:0,display:"flex",alignItems:"center",gap:10,borderTop:`1px solid ${t.border}`,flexWrap:"wrap"}}>
          <Button type="button" variant="primary" size="md" onClick={save} disabled={!form.name.trim()} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isEdit?<><Save size={15}/> Save changes</>:<><FolderOpen size={15}/> Create project</>}
          </Button>
          <Button type="button" variant="secondary" size="md" onClick={onClose}>Cancel</Button>
          {isEdit&&(
            <Button type="button" variant="warning" size="md" onClick={onArchive} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              {editProject?.archived?<><ArchiveRestore size={14}/> Restore</>:<><Archive size={14}/> Archive</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   APP
   ═══════════════════════════════════════════════════════════ */
export default function ProjectsPage(){
  const { theme: mode } = useAppTheme();
  const t=T[mode];
  const{
    people,
    projects,
    setProjects,
    clients,
    setClients,
    projectTagOpts,
    setProjectTagOpts,
    syncProjectCreate,
    syncProjectUpdate,
    syncProjectsDelete,
  }=useAppData();
  const[selected,setSelected]=useState(new Set());
  const[search,setSearch]=useState("");
  const[viewTab,setViewTab]=useState("active");
  const[modalOpen,setModalOpen]=useState(false);
  const[editingProject,setEditingProject]=useState(null);
  const[confirmDel,setConfirmDel]=useState(false);
  const[mounted,setMounted]=useState(false);

  useEffect(()=>{setMounted(true);},[]);

  const filtered=useMemo(()=>{const isArch=viewTab==="archived";return projects.filter(p=>{if(p.archived!==isArch)return false;if(!search)return true;const s=search.toLowerCase();return p.name.toLowerCase().includes(s)||p.client.toLowerCase().includes(s)||p.code.toLowerCase().includes(s)||p.tags.some(tg=>tg.toLowerCase().includes(s));});},[projects,search,viewTab]);
  const activeCount=projects.filter(p=>!p.archived).length;
  const archivedCount=projects.filter(p=>p.archived).length;
  const toggleSel=id=>setSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const toggleAll=()=>setSelected(selected.size===filtered.length?new Set():new Set(filtered.map(p=>p.id)));
  const doDelete=async()=>{const c=selected.size;const ids=[...selected];const prev=projects;setProjects(projects.filter(p=>!selected.has(p.id)));setSelected(new Set());setConfirmDel(false);try{if(isSupabaseConfigured) await syncProjectsDelete(ids);toast.error(`${c} project${c===1?"":"s"} removed`);}catch(e){setProjects(prev);toast.error("Delete failed",{description:e?.message||String(e)});} };
  const archiveProject=async(id)=>{const p=projects.find(x=>x.id===id);const next={...p,archived:!p.archived};const prev=projects;setProjects(projects.map(x=>x.id===id?next:x));setSelected(new Set());try{if(isSupabaseConfigured) await syncProjectUpdate(next);toast.warning(`${p.name} ${p.archived?"restored":"archived"}`);}catch(e){setProjects(prev);toast.error("Update failed",{description:e?.message||String(e)});} };
  const openAdd=()=>{setEditingProject(null);setModalOpen(true);};
  const openEdit=p=>{setEditingProject(p);setModalOpen(true);};
  const handleSave=async(form)=>{const clean={...form};delete clean._colorOpen;
    if(editingProject){
      const draft={...clean,id:editingProject.id,archived:editingProject.archived};
      try{
        const saved=isSupabaseConfigured? await syncProjectUpdate(draft):draft;
        setProjects(projects.map(p=>p.id===editingProject.id?saved:p).sort((a,b)=>a.name.localeCompare(b.name)));
        toast.success(`${form.name} updated`);
        setModalOpen(false);setEditingProject(null);
      }catch(e){toast.error("Update failed",{description:e?.message||String(e)});}
    } else {
      const tempId=typeof crypto!=="undefined"&&typeof crypto.randomUUID==="function"?crypto.randomUUID():`tmp_${Date.now()}`;
      const draft={...clean,id:tempId,archived:false};
      try{
        const saved=isSupabaseConfigured? await syncProjectCreate(draft):draft;
        setProjects([...projects,saved].sort((a,b)=>a.name.localeCompare(b.name)));
        toast.success(`${form.name} created`);
        setModalOpen(false);setEditingProject(null);
      }catch(e){toast.error("Save failed",{description:e?.message||String(e)});}
    }
  };
  const handleModalArchive=()=>{if(editingProject){archiveProject(editingProject.id);setModalOpen(false);setEditingProject(null);}};

  return(
    <div style={{display:"flex",minHeight:"100vh",background:t.bg,color:t.text,fontFamily:"var(--font-body, 'DM Sans', system-ui, sans-serif)",fontSize:14,transition:"background 0.35s ease,color 0.35s ease"}}>
      <AppSideNav />

      <main style={{flex:1,minWidth:0,padding:"24px 36px"}}>
        <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <h1 style={{fontSize:26,fontWeight:700,margin:0,letterSpacing:-0.5}}>Projects</h1>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{position:"relative"}}><Search size={15} style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:t.textMuted}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search projects…" style={{width:search?240:180,background:t.surface,border:`1.5px solid ${t.borderIn}`,borderRadius:8,padding:"8px 12px 8px 34px",color:t.text,fontSize:13,outline:"none",transition:"all 0.25s"}} onFocus={e=>{e.target.style.width="240px";e.target.style.borderColor=t.focus;e.target.style.boxShadow=`0 0 0 3px ${t.accentGlow}`;}} onBlur={e=>{if(!search)e.target.style.width="180px";e.target.style.borderColor=t.borderIn;e.target.style.boxShadow="none";}}/>{search&&<X size={14} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:t.textMuted,cursor:"pointer"}} onClick={()=>setSearch("")}/>}</div>
            <Button type="button" variant="secondary" size="md" style={{ display: "flex", alignItems: "center", gap: 7 }}><Download size={14}/> Import</Button>
            <Button type="button" variant="primary" size="md" onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 7 }}><Plus size={14}/> Add project</Button>
          </div>
        </header>

        {/* Tabs + Bulk */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,marginTop:8}}>
          <div style={{display:"flex",gap:2,background:t.surfAlt,borderRadius:10,padding:3,border:`1px solid ${t.border}`}}>
            {[{key:"active",label:"Active",count:activeCount,icon:FolderOpen},{key:"archived",label:"Archived",count:archivedCount,icon:Archive}].map(vt=>{const Icon=vt.icon;const active=viewTab===vt.key;return(<button key={vt.key} onClick={()=>{setViewTab(vt.key);setSelected(new Set());}} style={{padding:"8px 18px",fontSize:13,fontWeight:active?700:500,cursor:"pointer",background:active?t.surface:"transparent",border:active?`1px solid ${t.border}`:"1px solid transparent",color:active?t.text:t.textMuted,borderRadius:8,display:"flex",alignItems:"center",gap:7,transition:"all 0.2s",boxShadow:active?"0 1px 3px rgba(0,0,0,0.06)":"none"}} onMouseEnter={e=>{if(!active)e.currentTarget.style.color=t.textSoft;}} onMouseLeave={e=>{if(!active)e.currentTarget.style.color=t.textMuted;}}><Icon size={14}/> {vt.label}<span style={{background:active?t.accentGlow:t.surfAlt,color:active?t.accent:t.textDim,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,marginLeft:2}}>{vt.count}</span></button>);})}
          </div>
          {selected.size>0&&(
            <Button type="button" variant="destructive" size="md" onClick={()=>setConfirmDel(true)} className="alloc8-btn-enter" style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Trash2 size={14}/> Delete {selected.size} selected
            </Button>
          )}
        </div>

        {/* Table */}
        <div style={{background:t.surface,borderRadius:12,border:`1px solid ${t.border}`,overflow:"hidden",transition:"background 0.35s",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
          <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
            <thead><tr style={{borderBottom:`2px solid ${t.border}`}}>
              <th style={{width:48,padding:"14px 14px"}}><input type="checkbox" checked={selected.size===filtered.length&&filtered.length>0} onChange={toggleAll} style={{accentColor:t.chk,cursor:"pointer",width:16,height:16}}/></th>
              {["Project","Code","Client","Tags","Stage","Team","Start","End","Owner",""].map((h,i)=>(<th key={i} style={{textAlign:"left",padding:"14px 12px",fontSize:11,fontWeight:700,color:t.textMuted,textTransform:"uppercase",letterSpacing:0.8,whiteSpace:"nowrap",width:i===9?48:undefined}}>{h}</th>))}
            </tr></thead>
            <tbody>
              {filtered.map((p,idx)=>{const sel=selected.has(p.id);const stg=STAGES.find(s=>s.value===p.stage)||STAGES[0];const owner=SEED_OWNERS.find(o=>o.id===p.owner);const teamPeople=p.teamIds.map(id=>people.find(x=>x.id===id)).filter(Boolean);return(
                <tr key={p.id} onClick={()=>openEdit(p)} style={{borderBottom:`1px solid ${t.border}`,background:sel?t.selRow:"transparent",cursor:"pointer",transition:"background 0.12s",animation:mounted?`rowIn 0.35s ease-out ${idx*0.025}s both`:"none"}} onMouseEnter={e=>{if(!sel)e.currentTarget.style.background=t.rowHov;}} onMouseLeave={e=>{if(!sel)e.currentTarget.style.background=sel?t.selRow:"transparent";}}>
                  <td style={{padding:"12px 14px"}} onClick={e=>e.stopPropagation()}><input type="checkbox" checked={sel} onChange={()=>toggleSel(p.id)} style={{accentColor:t.chk,cursor:"pointer",width:16,height:16}}/></td>
                  <td style={{padding:"12px 12px"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:4,height:28,borderRadius:2,background:p.color,flexShrink:0}}/><span style={{fontWeight:600,color:p.archived?t.textMuted:t.text,fontSize:14}}>{p.name}</span></div></td>
                  <td style={{padding:"12px 12px",color:p.code?t.textSoft:t.textDim,fontFamily:"'DM Mono', monospace",fontSize:12}}>{p.code||"—"}</td>
                  <td style={{padding:"12px 12px",color:t.textSoft,fontSize:13}}>{p.client||"—"}</td>
                  <td style={{padding:"12px 12px"}}><div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>{p.tags.slice(0,2).map((tag,j)=>{const tp=tagChromaProps(tag,mode==="dark");return <span key={j} className={tp.className} style={{...tp.style,fontSize:11}}>{tag}</span>;})}{p.tags.length>2&&<span style={{color:t.textMuted,fontSize:11,fontWeight:650}}>+{p.tags.length-2}</span>}</div></td>
                  <td style={{padding:"12px 12px"}}><div style={{display:"inline-flex",alignItems:"center",gap:6,background:t.tabActiveBg,borderRadius:6,padding:"4px 10px"}}><Circle size={8} fill={stg.color} stroke={stg.color}/><span style={{color:t.textSoft,fontSize:12,fontWeight:600}}>{stg.label}</span></div></td>
                  <td style={{padding:"12px 12px"}}>{teamPeople.length>0?(<div style={{display:"flex",alignItems:"center"}}>{teamPeople.slice(0,3).map((tp,j)=>(<div key={tp.id} style={{width:26,height:26,borderRadius:7,background:avGrad(tp.name),display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#fff",marginLeft:j>0?-6:0,border:`2px solid ${t.surface}`,position:"relative",zIndex:3-j}} title={tp.name}>{ini(tp.name)}</div>))}{teamPeople.length>3&&<span style={{fontSize:11,color:t.textMuted,marginLeft:4,fontWeight:600}}>+{teamPeople.length-3}</span>}</div>):<span style={{color:t.textDim,fontSize:12}}>—</span>}</td>
                  <td style={{padding:"12px 12px",color:t.textSoft,fontSize:12,whiteSpace:"nowrap"}}>{fmtDate(p.startDate)}</td>
                  <td style={{padding:"12px 12px",color:t.textSoft,fontSize:12,whiteSpace:"nowrap"}}>{fmtDate(p.endDate)}</td>
                  <td style={{padding:"12px 12px"}}>{owner&&<div style={{width:28,height:28,borderRadius:8,background:avGrad(owner.name),display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff"}} title={owner.name}>{owner.initials}</div>}</td>
                  <td style={{padding:"12px 8px"}} onClick={e=>e.stopPropagation()}><RowActions project={p} t={t} onEdit={()=>openEdit(p)} onArchive={()=>archiveProject(p.id)} onDelete={()=>{setSelected(new Set([p.id]));setConfirmDel(true);}}/></td>
                </tr>);})}
              {filtered.length===0&&(<tr><td colSpan={11} style={{textAlign:"center",padding:"56px 20px"}}>{viewTab==="archived"?<><Archive size={32} style={{color:t.textDim,marginBottom:12}}/><div style={{color:t.textMuted,fontSize:15,fontWeight:600}}>No archived projects</div><div style={{color:t.textDim,fontSize:13,marginTop:4}}>Archived projects will appear here</div></>:<><Search size={32} style={{color:t.textDim,marginBottom:12}}/><div style={{color:t.textMuted,fontSize:15,fontWeight:600}}>{search?"No projects match your search":"No projects yet"}</div><div style={{color:t.textDim,fontSize:13,marginTop:4}}>{search?"Try a different search term":"Click \"Add project\" to get started"}</div></>}</td></tr>)}
            </tbody>
          </table>
          </div>
        </div>
      </main>

      <ProjectModal open={modalOpen} onClose={()=>{setModalOpen(false);setEditingProject(null);}} onSave={handleSave} onArchive={handleModalArchive} editProject={editingProject} people={people} clients={clients} setClients={setClients} tagOpts={projectTagOpts} setTagOpts={setProjectTagOpts} t={t} tagIsDark={mode==="dark"}/>
      <Confirm open={confirmDel} t={t} onYes={doDelete} onNo={()=>{setConfirmDel(false);setSelected(new Set());}} title="Confirm deletion" desc={<>You are about to permanently remove <strong style={{color:t.text}}>{selected.size} project{selected.size===1?"":"s"}</strong>.</>} yesLabel="Delete" yesIcon={Trash2} yesDanger/>


      <style>{`
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes modalScale{from{opacity:0;transform:translateY(16px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes scaleIn{from{opacity:0;transform:scale(0.93)}to{opacity:1;transform:scale(1)}}
        @keyframes dropIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes dropUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
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
