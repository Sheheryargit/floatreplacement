import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Users, FolderOpen, BarChart3, CalendarDays, ClipboardList,
  Plus, Download, Trash2, Search, X, ChevronRight, ChevronDown,
  Sun, Moon, Check, AlertTriangle, UserPlus, Shield, Clock,
  Palmtree, Briefcase, Tag, Building2, DollarSign, Mail, Info,
  Archive, ArchiveRestore, Save, MoreHorizontal, Pencil, CircleAlert,
} from "lucide-react";
import { tagChromaProps } from "../utils/tagChroma.js";
import { projectToAllocationLabel, avatarGradientFromName } from "../utils/projectColors.js";
import { toast } from "sonner";

/* ═══════════════════ DATA ═══════════════════ */
const SEED_ROLES = ["Graduate","Consultant","Senior Consultant","Manager","Engineer","Senior Specialist Lead","Principal","Director"];
/** Canonical departments; extras may be added via + or “Create …” in the picker and sync to lookups. */
const SEED_DEPTS = [
  "BRI CBO C&E Cloud Transformation",
  "BRI CBO C&E Integration Engineering",
  "BRI CBO C&E Quality Engineering",
  "CAN CBO C&E Quality Engineering",
  "Deloitte India - Eaas",
  "Eaas",
  "Ninjas",
  "Transition",
];
const SEED_TAGS = ["Azure",".NET","Cloud Secure","Data&AI","SDM","Firenation","UI and UX Design","service management","AWS Platform","Azkaban","Secure"];
const TYPES = ["Employee","Contractor","Placeholder"];
const ACCESS_OPTS = [
  { value:"none", label:"No access rights", desc:"", icon:Shield },
  { value:"member", label:"Member", desc:"Can view Schedule and optionally manage their own tasks and/or time off", icon:Users },
  { value:"manager", label:"Manager", desc:"Can manage specific Departments, People, and/or Projects", icon:Briefcase },
];
const AU_HOLIDAYS = ["Australia — National","Australia — ACT","Australia — NSW","Australia — NT","Australia — QLD","Australia — SA","Australia — TAS","Australia — VIC","Australia — WA"];
const MODAL_TABS = [
  { key:"info", label:"Info", icon:Info },
  { key:"access", label:"Access", icon:Shield },
  { key:"availability", label:"Availability", icon:Clock },
  { key:"timeoff", label:"Time Off", icon:Palmtree },
  { key:"projects", label:"Projects", icon:FolderOpen },
];

const PEOPLE_SEED = [
  { id:1,name:"Aditi Bali",role:"—",department:"Fire Nation",access:"—",tags:["Firenation"],type:"Employee",costRate:"0",billRate:"0",startDate:"2026-01-01",endDate:"",workType:"Full-time",notes:"",holidays:"None",email:"aditi.bali@company.com",archived:false },
  { id:2,name:"Akhil Prasad",role:"Graduate",department:"Eaas",access:"—",tags:["Cloud Secure"],type:"Employee",costRate:"0",billRate:"0",startDate:"2026-01-01",endDate:"",workType:"Full-time",notes:"",holidays:"None",email:"akhil.prasad@company.com",archived:false },
  { id:3,name:"Ali Raza",role:"Senior Consultant",department:"Sky",access:"Manager",tags:[".NET","Azure"],type:"Employee",costRate:"120",billRate:"180",startDate:"2025-03-15",endDate:"",workType:"Full-time",notes:"",holidays:"Australia — NSW",email:"ali.raza@company.com",archived:false },
  { id:4,name:"Amisha Punj",role:"Consultant",department:"Transition",access:"—",tags:["UI and UX Design"],type:"Employee",costRate:"85",billRate:"140",startDate:"2025-06-01",endDate:"",workType:"Full-time",notes:"",holidays:"Australia — VIC",email:"amisha.punj@company.com",archived:false },
  { id:5,name:"Amy Schroter",role:"Senior Consultant",department:"Anger Management",access:"Manager",tags:["service management"],type:"Employee",costRate:"110",billRate:"170",startDate:"2024-11-01",endDate:"",workType:"Full-time",notes:"",holidays:"Australia — VIC",email:"amy.schroter@company.com",archived:false },
  { id:6,name:"Amy Yienni Liu",role:"Engineer",department:"Azkaban",access:"—",tags:["Azkaban","Secure"],type:"Employee",costRate:"95",billRate:"150",startDate:"2025-01-10",endDate:"",workType:"Full-time",notes:"",holidays:"None",email:"amy.liu@company.com",archived:false },
  { id:7,name:"Andrew Charles Millard Brown",role:"Manager",department:"Sliced Secure",access:"—",tags:["Azure"],type:"Employee",costRate:"130",billRate:"200",startDate:"2024-08-01",endDate:"",workType:"Full-time",notes:"",holidays:"Australia — NSW",email:"andrew.brown@company.com",archived:false },
  { id:8,name:"Ankit Patel",role:"Senior Consultant",department:"Sliced Secure",access:"—",tags:["Azure"],type:"Employee",costRate:"105",billRate:"165",startDate:"2025-02-15",endDate:"",workType:"Full-time",notes:"",holidays:"None",email:"ankit.patel@company.com",archived:false },
  { id:9,name:"Ashish Dubey",role:"Senior Specialist Lead",department:"Hornets",access:"—",tags:["Data&AI"],type:"Employee",costRate:"140",billRate:"210",startDate:"2024-06-01",endDate:"",workType:"Full-time",notes:"",holidays:"Australia — VIC",email:"ashish.dubey@company.com",archived:false },
  { id:10,name:"Asmita Sayanthan",role:"Graduate",department:"Eaas",access:"—",tags:["Cloud Secure"],type:"Employee",costRate:"0",billRate:"0",startDate:"2026-01-01",endDate:"",workType:"Full-time",notes:"",holidays:"None",email:"asmita.s@company.com",archived:false },
  { id:11,name:"Belinda Chan",role:"Senior Consultant",department:"Anger Management",access:"Manager",tags:["Cloud Secure"],type:"Employee",costRate:"115",billRate:"175",startDate:"2024-09-15",endDate:"",workType:"Full-time",notes:"",holidays:"Australia — VIC",email:"belinda.chan@company.com",archived:false },
  { id:12,name:"Belinda Wakefield",role:"Manager",department:"Anger Management",access:"Manager",tags:["SDM"],type:"Employee",costRate:"135",billRate:"205",startDate:"2024-07-01",endDate:"",workType:"Full-time",notes:"",holidays:"Australia — VIC",email:"belinda.w@company.com",archived:false },
];
let _nid = 100;

export function nextPersonId() {
  return _nid++;
}

/* ═══════════════════ HELPERS ═══════════════════ */
const ini = (n) => { if(!n) return ""; const p=n.trim().split(/\s+/); return p.length===1?(p[0][0]||"").toUpperCase():(p[0][0]+p[p.length-1][0]).toUpperCase(); };
const avGrad = avatarGradientFromName;
const personToForm = (p) => ({
  name:p.name, email:p.email||"", role:p.role==="—"?"No role":p.role,
  costRate:p.costRate||"0", billRate:p.billRate||"0",
  department:p.department||"No department", tags:[...p.tags], type:p.type||"Employee",
  access: ACCESS_OPTS.find((a)=>a.label===p.access)?.value || "none",
  startDate:p.startDate||"2026-01-01", endDate:p.endDate||"", workType:p.workType||"Full-time",
  notes:p.notes||"", holidays:p.holidays||"None",
});
const formToPerson = (form, id, archived) => {
  const al = ACCESS_OPTS.find((a)=>a.value===form.access)?.label||"—";
  return {
    id, name:form.name, email:form.email, role:form.role==="No role"?"—":form.role,
    department:form.department==="No department"?"":form.department,
    access:form.access==="none"?"—":al, tags:[...form.tags], type:form.type,
    costRate:form.costRate, billRate:form.billRate, startDate:form.startDate,
    endDate:form.endDate, workType:form.workType, notes:form.notes,
    holidays:form.holidays, archived:!!archived,
  };
};

/* ═══════════════════ THEMES ═══════════════════ */
const T = {
  dark: {
    bg:"#0b0e14",surface:"#12161f",surfRaised:"#171c27",surfAlt:"#1a2030",
    border:"#1e2538",borderSub:"#252d3f",borderIn:"#2a3348",
    text:"#e8ecf4",textSoft:"#9ba4b8",textMuted:"#636d84",textDim:"#3d4660",
    accent:"#6c8cff",accentSoft:"#4a6aef",accentHov:"#8aa4ff",accentTxt:"#0b0e14",accentGlow:"rgba(108,140,255,0.12)",
    sidebar:"#090c12",sidebarAct:"#141828",rowHov:"#151a26",
    tagBg:"#1c2640",tagTxt:"#8aa4ff",
    btnSec:"#1e2538",btnSecHov:"#252d3f",btnSecTxt:"#b0b8cc",
    danger:"#fb7185",dangerHov:"#f43f5e",dangerSoft:"rgba(251,113,133,0.16)",dangerTxt:"#fff",
    dangerGlow:"0 4px 24px rgba(244,63,94,0.28)",
    success:"#4ade80",successHov:"#22c55e",successSoft:"rgba(74,222,128,0.14)",successGlow:"0 4px 20px rgba(34,197,94,0.22)",
    warn:"#fcd34d",warnHov:"#fbbf24",warnTxt:"#0f172a",warnSoft:"rgba(252,211,77,0.16)",warnGlow:"0 4px 20px rgba(251,191,36,0.2)",
    info:"#a5b4fc",infoSoft:"rgba(165,180,252,0.14)",infoGlow:"0 4px 22px rgba(129,140,248,0.22)",
    overlay:"rgba(0,0,0,0.65)",shadow:"0 32px 100px rgba(0,0,0,0.6)",
    chk:"#6c8cff",scroll:"#252d3f",selRow:"#141a2e",focus:"#6c8cff",
    toastBg:"#171c27",toastBdr:"#1e2538",
    tabActiveBg:"rgba(108,140,255,0.1)",tabHovBg:"rgba(108,140,255,0.06)",
  },
  light: {
    bg:"#f5f6f8",surface:"#ffffff",surfRaised:"#ffffff",surfAlt:"#f8f9fb",
    border:"#e4e7ed",borderSub:"#ebedf2",borderIn:"#d4d8e0",
    text:"#151922",textSoft:"#4a5168",textMuted:"#858da3",textDim:"#c0c4d0",
    accent:"#4f6ae6",accentSoft:"#3a54d4",accentHov:"#3a54d4",accentTxt:"#ffffff",accentGlow:"rgba(79,106,230,0.08)",
    sidebar:"#ffffff",sidebarAct:"#f0f1f5",rowHov:"#f8f9fb",
    tagBg:"#eef1f8",tagTxt:"#4a5da8",
    btnSec:"#eef0f4",btnSecHov:"#e2e5eb",btnSecTxt:"#3e4560",
    danger:"#e11d48",dangerHov:"#be123c",dangerSoft:"rgba(225,29,72,0.1)",dangerTxt:"#fff",
    dangerGlow:"0 4px 18px rgba(225,29,72,0.2)",
    success:"#059669",successHov:"#047857",successSoft:"rgba(5,150,105,0.1)",successGlow:"0 4px 16px rgba(5,150,105,0.18)",
    warn:"#d97706",warnHov:"#b45309",warnTxt:"#fff",warnSoft:"rgba(217,119,6,0.1)",warnGlow:"0 4px 16px rgba(217,119,6,0.16)",
    info:"#4f46e5",infoSoft:"rgba(79,70,229,0.1)",infoGlow:"0 4px 18px rgba(79,70,229,0.15)",
    overlay:"rgba(15,18,28,0.35)",shadow:"0 32px 100px rgba(0,0,0,0.12)",
    chk:"#4f6ae6",scroll:"#d4d8e0",selRow:"#eef1fa",focus:"#4f6ae6",
    toastBg:"#ffffff",toastBdr:"#e4e7ed",
    tabActiveBg:"rgba(79,106,230,0.08)",tabHovBg:"rgba(79,106,230,0.04)",
  },
};

/* ═══════════════════ TOASTS ═══════════════════ */
let _tid = 0;
function useToasts() {
  const [ts, setTs] = useState([]);
  const add = useCallback((msg, type="info") => {
    const id=++_tid;
    setTs((p) => [...p, { id, msg, type, out:false }]);
    setTimeout(() => setTs((p) => p.map((x) => x.id===id?{...x,out:true}:x)), 2600);
    setTimeout(() => setTs((p) => p.filter((x) => x.id!==id)), 3000);
  }, []);
  return { ts, add };
}
function Toasts({ ts, t }) {
  const icons = { success:Check, danger:CircleAlert, info:Info, warn:Archive };
  const colors = { success:t.success, danger:t.danger, info:t.info ?? t.accent, warn:t.warn };
  return (
    <div style={{ position:"fixed",bottom:24,right:24,zIndex:999,display:"flex",flexDirection:"column-reverse",gap:8 }}>
      {ts.map((x) => { const I=icons[x.type]||Info; const glow=x.type==="success"?t.successGlow:x.type==="danger"?t.dangerGlow:x.type==="warn"?t.warnGlow:t.infoGlow; return (
        <div key={x.id} style={{
          background:t.toastBg, border:`1px solid ${t.toastBdr}`, borderRadius:12,
          padding:"12px 18px", display:"flex",alignItems:"center",gap:10,
          boxShadow:`0 8px 30px rgba(0,0,0,0.14), ${glow||"none"}`, minWidth:280, maxWidth:400,
          animation:x.out?"toastOut 0.35s ease-in forwards":"toastIn 0.35s ease-out",
          borderLeft:`3px solid ${colors[x.type]}`,
        }}>
          <I size={16} style={{ color:colors[x.type], flexShrink:0 }} />
          <span style={{ color:t.text,fontSize:13,fontWeight:500 }}>{x.msg}</span>
        </div>
      ); })}
    </div>
  );
}

/* ═══════════════════ CONFIRM DIALOG ═══════════════════ */
function Confirm({ open, onYes, onNo, title, desc, yesLabel, yesIcon:YI, yesDanger, t }) {
  if(!open) return null;
  return (
    <div className="float-modal-overlay-dim" style={{ position:"fixed",inset:0,background:t.overlay,zIndex:350,display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn 0.2s var(--ds-ease-out, ease-out)" }} onClick={onNo}>
      <div onClick={(e)=>e.stopPropagation()} className="float-modal-panel-enter" style={{ background:t.surfRaised,borderRadius:16,padding:"28px 32px",width:420,border:`1px solid ${t.border}`,boxShadow:`${t.shadow}, 0 0 0 1px rgba(255,255,255,0.04) inset` }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
          <div style={{ width:40,height:40,borderRadius:12,background:yesDanger?t.dangerSoft:t.warnSoft,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:yesDanger?t.dangerGlow:t.warnGlow }}>
            <AlertTriangle size={20} style={{ color:yesDanger?t.danger:t.warn }} />
          </div>
          <div>
            <div style={{ fontWeight:700,color:t.text,fontSize:16 }}>{title}</div>
            <div style={{ color:t.textMuted,fontSize:13,marginTop:2 }}>This action cannot be undone.</div>
          </div>
        </div>
        <p style={{ color:t.textSoft,fontSize:14,lineHeight:1.6,margin:"0 0 24px" }}>{desc}</p>
        <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
          <button onClick={onNo} style={{ background:t.btnSec,border:`1px solid ${t.border}`,borderRadius:8,color:t.btnSecTxt,padding:"9px 20px",cursor:"pointer",fontSize:13,fontWeight:600 }}>Cancel</button>
          <button onClick={onYes} style={{
            background:yesDanger?t.danger:t.warn,border:`1px solid ${yesDanger?t.dangerHov:t.warnHov}55`,borderRadius:10,color:yesDanger?t.dangerTxt:t.warnTxt,
            padding:"9px 20px",cursor:"pointer",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:6,
            transition:"box-shadow 0.22s cubic-bezier(0.22,1,0.36,1), transform 0.18s ease, filter 0.18s ease",
            boxShadow:yesDanger?t.dangerGlow:t.warnGlow,
          }}
            onMouseEnter={(e) => { e.currentTarget.style.filter="brightness(1.06)"; e.currentTarget.style.transform="translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter=""; e.currentTarget.style.transform=""; }}>
            {YI && <YI size={14}/>} {yesLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ ROW ACTIONS MENU ═══════════════════ */
function RowActions({ person, onEdit, onArchive, onDelete, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const h=(e)=>{ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h); },[]);
  return (
    <div ref={ref} style={{ position:"relative", zIndex: open ? 50 : 1 }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{ background:"transparent",border:"none",cursor:"pointer",color:t.textMuted,padding:4,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s" }}
        onMouseEnter={(e)=>{ e.currentTarget.style.background=t.accentGlow; e.currentTarget.style.color=t.accent; }}
        onMouseLeave={(e)=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.color=t.textMuted; }}>
        <MoreHorizontal size={16}/>
      </button>
      {open && (<>
        <div onClick={(e)=>{ e.stopPropagation(); setOpen(false); }} style={{ position:"fixed",inset:0,zIndex:99 }}/>
        <div style={{
          position:"absolute",right:0,top:"100%",marginTop:4,zIndex:100,
          background:t.bg==="#0b0e14"?"#111627":"#ffffff",border:`1.5px solid ${t.accent}30`,borderRadius:10,
          boxShadow:`0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.3)`,minWidth:190,overflow:"hidden",animation:"dropIn 0.15s ease-out",
        }}>
          {[
            { icon:Pencil, label:"Edit profile", action:()=>{ onEdit(); setOpen(false); }, color:t.text },
            { icon:person.archived?ArchiveRestore:Archive, label:person.archived?"Restore":"Archive", action:()=>{ onArchive(); setOpen(false); }, color:t.warn },
            { icon:Trash2, label:"Delete", action:()=>{ onDelete(); setOpen(false); }, color:t.danger },
          ].map((item,i) => (
            <div key={i} onClick={(e)=>{ e.stopPropagation(); item.action(); }}
              style={{ padding:"11px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,fontSize:13,fontWeight:500,color:item.color,transition:"background 0.12s",borderBottom:i<2?`1px solid ${t.bg==="#0b0e14"?"#1a2030":"#e4e7ed"}`:"none" }}
              onMouseEnter={(e)=>e.currentTarget.style.background=t.bg==="#0b0e14"?"#1a2236":"#f0f2f5"}
              onMouseLeave={(e)=>e.currentTarget.style.background="transparent"}>
              <item.icon size={14}/> {item.label}
            </div>
          ))}
        </div>
      </>)}
    </div>
  );
}

/* ═══════════════════ CREATABLE DROPDOWN ═══════════════════ */
function CDropdown({ value, onChange, options, placeholder, renderOption, t, menuOpenKey = 0 }) {
  const [open,setOpen]=useState(false);
  const [q,setQ]=useState("");
  const ref=useRef(null);
  const ir=useRef(null);
  const lastMenuKick = useRef(0);
  useEffect(()=>{ const h=(e)=>{ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h); },[]);
  useEffect(()=>{ if(open&&ir.current) ir.current.focus(); },[open]);
  useEffect(() => {
    if (menuOpenKey > lastMenuKick.current) {
      lastMenuKick.current = menuOpenKey;
      setOpen(true);
    }
  }, [menuOpenKey]);
  const lbls=options.map((o)=>typeof o==="string"?o:o.label);
  const filt=lbls.filter((l)=>l.toLowerCase().includes(q.toLowerCase()));
  const canC=q.trim()&&!lbls.some((l)=>l.toLowerCase()===q.trim().toLowerCase());
  const pick=(v)=>{ onChange(v); setOpen(false); setQ(""); };
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <div onClick={()=>setOpen(!open)} style={{
        background:t.surfAlt,border:`1.5px solid ${open?t.focus:t.borderIn}`,borderRadius:8,padding:"10px 14px",cursor:"pointer",
        display:"flex",justifyContent:"space-between",alignItems:"center",
        color:value&&value!==placeholder?t.text:t.textMuted,fontSize:14,transition:"border-color 0.2s,box-shadow 0.2s",
        boxShadow:open?`0 0 0 3px ${t.accentGlow}`:"none",
      }}>
        <span style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1 }}>{value||placeholder}</span>
        <ChevronDown size={14} style={{ color:t.textMuted,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",flexShrink:0 }}/>
      </div>
      {open && (
        <div style={{ position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:140,background:t.surfRaised,border:`1px solid ${t.border}`,borderRadius:10,boxShadow:`0 12px 40px rgba(0,0,0,0.25)`,overflow:"hidden",animation:"dropIn 0.18s ease-out" }}>
          <div style={{ padding:8,borderBottom:`1px solid ${t.border}` }}>
            <div style={{ position:"relative" }}>
              <Search size={14} style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:t.textMuted }}/>
              <input ref={ir} value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search or create…"
                style={{ width:"100%",background:t.surfAlt,border:`1px solid ${t.borderIn}`,borderRadius:6,padding:"8px 10px 8px 32px",color:t.text,fontSize:13,outline:"none" }}
                onKeyDown={(e)=>{ if(e.key==="Enter"&&canC) pick(q.trim()); }}/>
            </div>
          </div>
          <div style={{ maxHeight:210,overflowY:"auto" }}>
            {canC && (
              <div onClick={()=>pick(q.trim())} style={{ padding:"10px 14px",cursor:"pointer",color:t.accent,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:8,transition:"background 0.1s" }}
                onMouseEnter={(e)=>e.currentTarget.style.background=t.accentGlow} onMouseLeave={(e)=>e.currentTarget.style.background="transparent"}>
                <Plus size={14}/> Create "{q.trim()}"
              </div>
            )}
            {filt.map((lbl,i)=>{
              const raw=options.find((o)=>(typeof o==="string"?o:o.label)===lbl);
              const val=typeof raw==="string"?raw:(raw.value||raw.label);
              const act=value===lbl||value===val;
              return (
                <div key={i} onClick={()=>pick(val)} style={{ padding:renderOption?"10px 14px":"9px 14px",cursor:"pointer",color:t.text,fontSize:14,background:act?t.accentGlow:"transparent",display:"flex",alignItems:"center",justifyContent:"space-between",transition:"background 0.1s" }}
                  onMouseEnter={(e)=>{ if(!act) e.currentTarget.style.background=t.rowHov; }} onMouseLeave={(e)=>e.currentTarget.style.background=act?t.accentGlow:"transparent"}>
                  <div style={{ flex:1,minWidth:0 }}>{renderOption?renderOption(raw,t):lbl}</div>
                  {act && <Check size={14} style={{ color:t.accent,flexShrink:0,marginLeft:8 }}/>}
                </div>
              );
            })}
            {filt.length===0&&!canC && <div style={{ padding:14,color:t.textMuted,fontSize:13,textAlign:"center" }}>No results</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ CREATABLE TAG INPUT ═══════════════════ */
function CTagInput({ tags, setTags, options, t, tagIsDark }) {
  const [open,setOpen]=useState(false);
  const [q,setQ]=useState("");
  const ref=useRef(null);
  const ir=useRef(null);
  useEffect(()=>{ const h=(e)=>{ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h); },[]);
  const avail=options.filter((o)=>!tags.includes(o)&&o.toLowerCase().includes(q.toLowerCase()));
  const canC=q.trim()&&!options.some((o)=>o.toLowerCase()===q.trim().toLowerCase())&&!tags.includes(q.trim());
  const add=(v)=>{ const s=v.trim(); if(s&&!tags.includes(s)) setTags([...tags,s]); setQ(""); };
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <div onClick={()=>{ setOpen(true); setTimeout(()=>ir.current?.focus(),0); }}
        style={{ background:t.surfAlt,border:`1.5px solid ${open?t.focus:t.borderIn}`,borderRadius:8,padding:"7px 10px",cursor:"text",minHeight:44,display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",transition:"border-color 0.2s,box-shadow 0.2s",boxShadow:open?`0 0 0 3px ${t.accentGlow}`:"none" }}>
        {tags.map((tag) => {
          const tp = tagChromaProps(tag, tagIsDark);
          return (
          <span key={tag} className={tp.className} style={{ ...tp.style, animation:"chipIn 0.2s ease-out" }}>
            <Tag size={10} strokeWidth={2.25} aria-hidden /> {tag}
            <X size={12} className="float-tag-dismiss" aria-label={`Remove ${tag}`} onClick={(e)=>{ e.stopPropagation(); setTags(tags.filter((x)=>x!==tag)); }} />
          </span>
          );
        })}
        <input ref={ir} value={q} onChange={(e)=>setQ(e.target.value)} onFocus={()=>setOpen(true)}
          onKeyDown={(e)=>{ if((e.key===" "||e.key==="Enter")&&q.trim()){ e.preventDefault(); add(q); } else if(e.key==="Backspace"&&!q&&tags.length) setTags(tags.slice(0,-1)); }}
          placeholder={tags.length===0?"Type and press space to add…":""} style={{ background:"transparent",border:"none",outline:"none",flex:1,minWidth:140,color:t.text,fontSize:13,padding:"4px 0" }}/>
      </div>
      {open&&(avail.length>0||canC) && (
        <div style={{ position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:140,background:t.surfRaised,border:`1px solid ${t.border}`,borderRadius:10,maxHeight:180,overflowY:"auto",boxShadow:`0 12px 40px rgba(0,0,0,0.25)`,animation:"dropIn 0.18s ease-out" }}>
          {canC && <div onClick={()=>add(q)} style={{ padding:"9px 14px",cursor:"pointer",color:t.accent,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:8 }}
            onMouseEnter={(e)=>e.currentTarget.style.background=t.accentGlow} onMouseLeave={(e)=>e.currentTarget.style.background="transparent"}><Plus size={14}/> Create "{q.trim()}"</div>}
          {avail.map((o)=>(
            <div key={o} onClick={()=>add(o)} style={{ padding:"9px 14px",cursor:"pointer",color:t.text,fontSize:13,transition:"background 0.1s" }}
              onMouseEnter={(e)=>e.currentTarget.style.background=t.rowHov} onMouseLeave={(e)=>e.currentTarget.style.background="transparent"}>{o}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ TAB PANELS ═══════════════════ */
const Lbl = (t) => ({ display:"block",fontSize:11,color:t.textMuted,marginBottom:7,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8 });
const Inp = (t) => ({ background:t.surfAlt,border:`1.5px solid ${t.borderIn}`,borderRadius:8,padding:"10px 14px",color:t.text,fontSize:14,width:"100%",outline:"none" });

function mergeDepartmentOptions(depts, formDepartment) {
  const s = new Set(SEED_DEPTS);
  for (const d of depts) {
    if (d && String(d).trim()) s.add(String(d).trim());
  }
  if (formDepartment && formDepartment !== "No department") s.add(String(formDepartment).trim());
  const sorted = [...s].sort((a, b) => a.localeCompare(b));
  return ["No department", ...sorted];
}

function allocationHasPerson(a, pid) {
  if (Array.isArray(a.personIds) && a.personIds.length > 0) return a.personIds.includes(pid);
  return a.personId === pid;
}

function InfoTab({ form,setForm,roles,setRoles,depts,setDepts,tagOpts,setTagOpts,t,tagIsDark }) {
  const [deptMenuKick, setDeptMenuKick] = useState(0);
  const deptOptions = useMemo(
    () => mergeDepartmentOptions(depts, form.department),
    [depts, form.department]
  );
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:22 }}>
      <div style={{ background:t.surfAlt,borderRadius:10,padding:20,display:"flex",flexDirection:"column",gap:18,border:`1px solid ${t.borderSub}` }}>
        <div><label style={Lbl(t)}>Role</label>
          <CDropdown t={t} value={form.role} placeholder="No role" onChange={(v)=>{ if(v!=="No role"&&!roles.includes(v)) setRoles([...roles,v]); setForm({...form,role:v}); }} options={["No role",...roles]}/></div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
          {[["Cost rate","costRate"],["Bill rate","billRate"]].map(([lbl,key])=>(
            <div key={key}><label style={Lbl(t)}>{lbl}</label>
              <div style={{ display:"flex",alignItems:"center",background:t.surfAlt,border:`1.5px solid ${t.borderIn}`,borderRadius:8,padding:"0 14px" }}>
                <DollarSign size={14} style={{ color:t.textMuted }}/><input type="number" value={form[key]} onChange={(e)=>setForm({...form,[key]:e.target.value})} style={{ background:"transparent",border:"none",outline:"none",color:t.text,fontSize:14,padding:"10px 6px",flex:1,width:"100%" }}/><span style={{ color:t.textDim,fontSize:12,fontWeight:600 }}>/hr</span>
              </div></div>
          ))}
        </div>
      </div>
      <div>
        <label style={Lbl(t)}>Department</label>
        <div style={{ display:"flex",gap:8,alignItems:"stretch" }}>
          <div style={{ flex:1,minWidth:0 }}>
            <CDropdown
              t={t}
              menuOpenKey={deptMenuKick}
              value={form.department}
              placeholder="No department"
              onChange={(v) => {
                if (v !== "No department" && !depts.includes(v)) setDepts([...depts, v]);
                setForm({ ...form, department: v });
              }}
              options={deptOptions}
            />
          </div>
          <button
            type="button"
            aria-label="Add department"
            title="Add department"
            onClick={() => setDeptMenuKick((k) => k + 1)}
            style={{
              flexShrink:0,
              width:44,
              display:"flex",
              alignItems:"center",
              justifyContent:"center",
              background:t.surfAlt,
              border:`1.5px solid ${t.borderIn}`,
              borderRadius:8,
              cursor:"pointer",
              color:t.accent,
              transition:"border-color 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = t.focus;
              e.currentTarget.style.boxShadow = `0 0 0 3px ${t.accentGlow}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = t.borderIn;
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <Plus size={18} strokeWidth={2.25} />
          </button>
        </div>
      </div>
      <div><label style={Lbl(t)}>Tags</label>
        <CTagInput t={t} tagIsDark={tagIsDark} tags={form.tags} setTags={(nt)=>{ const n=nt.filter((x)=>!tagOpts.includes(x)); if(n.length) setTagOpts([...tagOpts,...n]); setForm({...form,tags:nt}); }} options={tagOpts}/></div>
      <div><label style={Lbl(t)}>Type</label>
        <CDropdown t={t} value={form.type} onChange={(v)=>setForm({...form,type:v})} options={TYPES} placeholder="Employee"/></div>
    </div>
  );
}

function AccessTab({ form,setForm,t }) {
  return (<div><label style={Lbl(t)}>Access level</label>
    <CDropdown t={t} value={ACCESS_OPTS.find((a)=>a.value===form.access)?.label||"No access rights"} onChange={(v)=>setForm({...form,access:v})} options={ACCESS_OPTS} placeholder="No access rights"
      renderOption={(opt,t)=>(<div style={{ display:"flex",alignItems:"flex-start",gap:10 }}><div style={{ width:32,height:32,borderRadius:8,background:t.accentGlow,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2 }}><opt.icon size={16} style={{ color:t.accent }}/></div><div><div style={{ fontWeight:600,color:t.text,fontSize:14 }}>{opt.label}</div>{opt.desc&&<div style={{ fontSize:12,color:t.textMuted,marginTop:2,lineHeight:1.4 }}>{opt.desc}</div>}</div></div>)}/>
  </div>);
}

function AvailabilityTab({ form,setForm,t }) {
  return (
    <div style={{ background:t.surfAlt,borderRadius:10,padding:20,border:`1px solid ${t.borderSub}`,display:"flex",flexDirection:"column",gap:18 }}>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
        {[["Start date","startDate"],["End date","endDate"]].map(([lbl,key])=>(
          <div key={key}><label style={Lbl(t)}>{lbl}</label><input type="date" value={form[key]} onChange={(e)=>setForm({...form,[key]:e.target.value})} style={{ ...Inp(t),colorScheme:t===T.dark?"dark":"light" }}/></div>
        ))}
      </div>
      <div style={{ display:"flex",gap:0 }}>
        {["Full-time","Part-time"].map((opt,i)=>(<button key={opt} onClick={()=>setForm({...form,workType:opt})} style={{
          padding:"9px 24px",fontSize:13,cursor:"pointer",fontWeight:600,border:`1.5px solid ${form.workType===opt?t.accent:t.borderIn}`,
          borderRadius:i===0?"8px 0 0 8px":"0 8px 8px 0",background:form.workType===opt?t.accentGlow:t.surfAlt,
          color:form.workType===opt?t.accent:t.textSoft,transition:"all 0.15s",marginLeft:i===1?-1.5:0,
        }}>{opt}</button>))}
      </div>
      <div><label style={Lbl(t)}>Notes</label><textarea value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} rows={4} style={{ ...Inp(t),resize:"vertical",minHeight:80,fontFamily:"inherit" }}/></div>
    </div>
  );
}

function TimeOffTab({ form,setForm,t }) {
  return (<div><label style={Lbl(t)}>Public holidays region</label><CDropdown t={t} value={form.holidays} onChange={(v)=>setForm({...form,holidays:v})} options={["None",...AU_HOLIDAYS]} placeholder="Select region"/></div>);
}

function ProjectsTab({
  t,
  editPerson,
  projects = [],
  allocations = [],
  setAllocations,
  syncAllocationDelete,
  syncAllocationUpdate,
  onOpenCreateAllocation,
}) {
  const [pickKey, setPickKey] = useState(0);
  const personId = editPerson?.id;

  const activeProjectLabels = useMemo(() => {
    const rows = projects.filter((p) => !p.archived);
    rows.sort((a, b) => projectToAllocationLabel(a).localeCompare(projectToAllocationLabel(b)));
    return rows.map((p) => projectToAllocationLabel(p));
  }, [projects]);

  const assignedRows = useMemo(() => {
    if (personId == null) return [];
    const map = new Map();
    for (const a of allocations) {
      if (a.isLeave) continue;
      if (!allocationHasPerson(a, personId)) continue;
      const lab = (a.project || "").trim();
      if (!lab) continue;
      if (map.has(lab)) continue;
      const proj = projects.find((pr) => projectToAllocationLabel(pr) === lab);
      const display = proj ? projectToAllocationLabel(proj) : lab;
      map.set(lab, display);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [allocations, personId, projects]);

  const canRemove =
    typeof setAllocations === "function" &&
    typeof syncAllocationDelete === "function" &&
    typeof syncAllocationUpdate === "function";

  const removePersonFromProjectLabel = (projectLabel) => {
    if (!canRemove || personId == null) return;
    const pl = (projectLabel || "").trim();
    const affected = allocations.filter(
      (a) => !a.isLeave && (a.project || "").trim() === pl && allocationHasPerson(a, personId)
    );
    if (affected.length === 0) return;
    for (const a of affected) {
      const ids =
        Array.isArray(a.personIds) && a.personIds.length > 0
          ? [...a.personIds]
          : a.personId != null
            ? [a.personId]
            : [];
      const nextIds = ids.filter((id) => id !== personId);
      if (nextIds.length === 0) {
        setAllocations((prev) => prev.filter((x) => x.id !== a.id));
        queueMicrotask(() => syncAllocationDelete(a.id));
      } else {
        const merged = {
          ...a,
          personIds: nextIds,
          personId: nextIds[0],
          updatedBy: "You",
          updatedAt: new Date().toISOString(),
        };
        setAllocations((prev) => prev.map((x) => (x.id === a.id ? merged : x)));
        queueMicrotask(() => syncAllocationUpdate(merged));
      }
    }
    toast.success("Schedule updated", { description: `Removed from ${pl}` });
  };

  if (!editPerson) {
    return (
      <div style={{ textAlign:"center",padding:"40px 20px",color:t.textMuted }}>
        <div style={{ width:52,height:52,borderRadius:14,background:t.accentGlow,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:14 }}>
          <FolderOpen size={22} style={{ color:t.accent }} />
        </div>
        <div style={{ fontSize:15,fontWeight:600,color:t.textSoft,marginBottom:6 }}>Save the person first</div>
        <div style={{ fontSize:13,color:t.textDim,lineHeight:1.55,maxWidth:360,margin:"0 auto" }}>
          Once they are in the directory, you can link them to projects here or from the Schedule.
        </div>
      </div>
    );
  }

  if (!onOpenCreateAllocation) {
    return (
      <div style={{ textAlign:"center",padding:"40px 20px",color:t.textMuted }}>
        <div style={{ fontSize:14,color:t.textSoft,lineHeight:1.55 }}>Project assignment from this screen is not available here. Open the Schedule to manage allocations.</div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:22 }}>
      <div>
        <label style={Lbl(t)}>Active projects</label>
        {activeProjectLabels.length === 0 ? (
          <div style={{ fontSize:13,color:t.textDim,padding:"10px 0" }}>No active (non-archived) projects in the registry.</div>
        ) : (
          <CDropdown
            key={pickKey}
            t={t}
            value=""
            placeholder="Choose a project to allocate…"
            onChange={(v) => {
              setPickKey((k) => k + 1);
              onOpenCreateAllocation({ person: editPerson, projectLabel: v });
            }}
            options={activeProjectLabels}
          />
        )}
      </div>
      <div>
        <label style={Lbl(t)}>On schedule for this person</label>
        {assignedRows.length === 0 ? (
          <div style={{ fontSize:13,color:t.textDim,padding:"10px 0" }}>No project allocations yet.</div>
        ) : (
          <ul style={{ listStyle:"none",margin:0,padding:0,display:"flex",flexDirection:"column",gap:8 }}>
            {assignedRows.map(([label, display]) => (
              <li
                key={label}
                style={{
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"space-between",
                  gap:12,
                  background:t.surfAlt,
                  border:`1px solid ${t.borderSub}`,
                  borderRadius:10,
                  padding:"10px 14px",
                }}
              >
                <span style={{ fontSize:14,color:t.text,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0 }}>
                  {display}
                </span>
                <button
                  type="button"
                  disabled={!canRemove}
                  aria-label={`Remove ${display} from this person`}
                  title={canRemove ? "Remove all schedule rows for this project" : ""}
                  onClick={() => removePersonFromProjectLabel(label)}
                  style={{
                    flexShrink:0,
                    background:canRemove ? t.btnSec : "transparent",
                    border:`1px solid ${canRemove ? t.border : "transparent"}`,
                    cursor:canRemove ? "pointer" : "not-allowed",
                    color:canRemove ? t.textMuted : t.textDim,
                    padding:6,
                    borderRadius:8,
                    display:"flex",
                    alignItems:"center",
                    justifyContent:"center",
                    opacity:canRemove ? 1 : 0.45,
                  }}
                  onMouseEnter={(e) => {
                    if (!canRemove) return;
                    e.currentTarget.style.background = t.rowHov;
                    e.currentTarget.style.color = t.danger;
                  }}
                  onMouseLeave={(e) => {
                    if (!canRemove) return;
                    e.currentTarget.style.background = t.btnSec;
                    e.currentTarget.style.color = t.textMuted;
                  }}
                >
                  <X size={16} strokeWidth={2.25} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════ PERSON MODAL (Add + Edit) ═══════════════════ */
export function PersonModal({
  open,
  onClose,
  onSave,
  onArchive,
  editPerson,
  roles,
  setRoles,
  depts,
  setDepts,
  tagOpts,
  setTagOpts,
  t,
  projects = [],
  allocations = [],
  setAllocations,
  syncAllocationDelete,
  syncAllocationUpdate,
  onOpenCreateAllocation,
  tagTheme = "dark",
}) {
  const tagIsDark = tagTheme === "dark";
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState(null);
  const [dirty, setDirty] = useState(false);
  const ref = useRef(null);
  const isEdit = !!editPerson;

  useEffect(() => {
    if (open) {
      setTab(0);
      setForm(editPerson ? personToForm(editPerson) : {
        name:"",email:"",role:"No role",costRate:"0",billRate:"0",
        department:"No department",tags:[],type:"Employee",access:"none",
        startDate:"2026-01-01",endDate:"",workType:"Full-time",notes:"",holidays:"None",
      });
      setDirty(false);
    }
  }, [open, editPerson]);

  if (!open || !form) return null;

  const updateForm = (patch) => { setForm({...form,...patch}); setDirty(true); };
  const setFormWrap = (f) => { setForm(f); setDirty(true); };

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <div className="float-modal-overlay-dim" onClick={(e) => { if(ref.current&&!ref.current.contains(e.target)) onClose(); }}
      style={{ position:"fixed",inset:0,background:t.overlay,zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:48,animation:"fadeIn 0.22s var(--ds-ease-out, ease-out)" }}>
      <div className="float-premium-modal float-modal-panel-enter" ref={ref} onClick={(e)=>e.stopPropagation()} style={{
        background:t.surfRaised,width:620,maxHeight:"calc(100vh - 96px)",
        display:"flex",flexDirection:"column",transition:"background 0.35s",
      }}>
        {/* Header */}
        <div style={{ padding:"28px 32px 0",flexShrink:0 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
            <div style={{ flex:1,minWidth:0 }}>
              <input value={form.name} onChange={(e)=>updateForm({name:e.target.value})} placeholder="Name" autoFocus={!isEdit}
                style={{ background:"transparent",border:"none",outline:"none",fontSize:26,fontWeight:700,color:t.text,width:"100%",padding:0,marginBottom:6,letterSpacing:-0.3 }}/>
              <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                <Mail size={14} style={{ color:t.textDim,flexShrink:0 }}/>
                <input value={form.email} onChange={(e)=>updateForm({email:e.target.value})} placeholder="Email address"
                  style={{ background:"transparent",border:"none",outline:"none",fontSize:14,color:t.textMuted,width:"100%",padding:0 }}/>
              </div>
            </div>
            <div style={{
              width:56,height:56,borderRadius:14,background:form.name?avGrad(form.name):t.borderIn,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:"#fff",flexShrink:0,
              boxShadow:"0 4px 16px rgba(0,0,0,0.2)",transition:"all 0.3s",
            }}>{ini(form.name)}</div>
          </div>

          {/* Tabs — fixed equal-width grid */}
          <div style={{ display:"grid",gridTemplateColumns:`repeat(${MODAL_TABS.length}, 1fr)`,gap:4,marginTop:20,borderBottom:`2px solid ${t.border}`,paddingBottom:0 }}>
            {MODAL_TABS.map((mt, i) => {
              const Icon = mt.icon;
              const active = tab === i;
              return (
                <button key={mt.key} onClick={() => setTab(i)} style={{
                  padding:"10px 4px",fontSize:12,fontWeight:active?700:500,cursor:"pointer",
                  background:active?t.tabActiveBg:"transparent",border:"none",
                  color:active?t.accent:t.textMuted,
                  borderBottom:active?`2px solid ${t.accent}`:"2px solid transparent",
                  marginBottom:-2,transition:"all 0.2s",display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                  borderRadius:"8px 8px 0 0",whiteSpace:"nowrap",overflow:"hidden",
                }}
                  onMouseEnter={(e) => { if(!active) e.currentTarget.style.background=t.tabHovBg; }}
                  onMouseLeave={(e) => { if(!active) e.currentTarget.style.background=active?t.tabActiveBg:"transparent"; }}>
                  <Icon size={14} style={{ flexShrink:0 }}/> <span style={{ overflow:"hidden",textOverflow:"ellipsis" }}>{mt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content — scrollable */}
        <div style={{ padding:"22px 32px 10px",overflowY:"auto",flex:1,minHeight:0 }}>
          {tab===0 && <InfoTab form={form} setForm={setFormWrap} roles={roles} setRoles={setRoles} depts={depts} setDepts={setDepts} tagOpts={tagOpts} setTagOpts={setTagOpts} t={t} tagIsDark={tagIsDark}/>}
          {tab===1 && <AccessTab form={form} setForm={setFormWrap} t={t}/>}
          {tab===2 && <AvailabilityTab form={form} setForm={setFormWrap} t={t}/>}
          {tab===3 && <TimeOffTab form={form} setForm={setFormWrap} t={t}/>}
          {tab===4 && (
            <ProjectsTab
              t={t}
              editPerson={editPerson}
              projects={projects}
              allocations={allocations}
              setAllocations={setAllocations}
              syncAllocationDelete={syncAllocationDelete}
              syncAllocationUpdate={syncAllocationUpdate}
              onOpenCreateAllocation={onOpenCreateAllocation}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:"16px 32px 24px",flexShrink:0,display:"flex",alignItems:"center",gap:10,borderTop:`1px solid ${t.border}` }}>
          <button onClick={handleSave} disabled={!form.name.trim()} style={{
            background:t.accent,border:"none",borderRadius:8,color:t.accentTxt,
            padding:"10px 26px",cursor:form.name.trim()?"pointer":"default",fontSize:14,fontWeight:700,
            opacity:form.name.trim()?1:0.35,transition:"all 0.2s",
            boxShadow:form.name.trim()?`0 2px 12px ${t.accent}30`:"none",display:"flex",alignItems:"center",gap:8,
          }}
            onMouseEnter={(e) => { if(form.name.trim()) { e.currentTarget.style.background=t.accentHov; e.currentTarget.style.transform="translateY(-1px)"; }}}
            onMouseLeave={(e) => { e.currentTarget.style.background=t.accent; e.currentTarget.style.transform="none"; }}>
            {isEdit ? <><Save size={15}/> Save changes</> : <><UserPlus size={15}/> Add person</>}
          </button>
          <button onClick={onClose} style={{ background:t.btnSec,border:`1px solid ${t.border}`,borderRadius:8,color:t.btnSecTxt,padding:"10px 24px",cursor:"pointer",fontSize:14,fontWeight:600,transition:"all 0.15s" }}
            onMouseEnter={(e) => e.currentTarget.style.background=t.btnSecHov}
            onMouseLeave={(e) => e.currentTarget.style.background=t.btnSec}>Cancel</button>
          {isEdit && (
            <button onClick={onArchive} style={{
              marginLeft:"auto",background:t.warnSoft,border:`1px solid ${t.warn}30`,borderRadius:8,color:t.warn,
              padding:"10px 18px",cursor:"pointer",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:6,transition:"all 0.15s",
            }}
              onMouseEnter={(e)=>{ e.currentTarget.style.background=t.warn; e.currentTarget.style.color="#fff"; }}
              onMouseLeave={(e)=>{ e.currentTarget.style.background=t.warnSoft; e.currentTarget.style.color=t.warn; }}>
              {editPerson?.archived ? <><ArchiveRestore size={14}/> Restore</> : <><Archive size={14}/> Archive</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PersonModal;
export {
  T,
  useToasts,
  Toasts,
  Confirm,
  RowActions,
  PEOPLE_SEED,
  formToPerson,
  personToForm,
  SEED_ROLES,
  SEED_DEPTS,
  SEED_TAGS,
  ini,
  avGrad,
};
