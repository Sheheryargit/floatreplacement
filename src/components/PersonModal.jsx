import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, FolderOpen, BarChart3, CalendarDays, ClipboardList,
  Plus, Download, Trash2, X, ChevronRight,
  Sun, Moon, Check, AlertTriangle, UserPlus, Shield, Clock,
  Palmtree, Briefcase, Tag, Building2, DollarSign, Mail, Info, Calendar,
  Archive, ArchiveRestore, Save, MoreHorizontal, Pencil, CircleAlert,
} from "lucide-react";
import { Button } from "./ui/Button.jsx";
import { tagChromaProps } from "../utils/tagChroma.js";
import { projectToAllocationLabel, avatarGradientFromName } from "../utils/projectColors.js";
import { toast } from "sonner";
import { SEED_DEPTS } from "../constants/departments.js";
import { PEOPLE_SEED } from "../data/peopleSeed.js";
import { DepartmentSelector } from "./DepartmentSelector.jsx";
import { FloatSelect } from "./ui/FloatSelect.jsx";
import {
  AU_PUBLIC_HOLIDAY_REGION_OPTIONS,
  legacyHolidaysToRegion,
  regionToLegacyHolidays,
} from "../constants/auHolidayRegions.js";
import { leaveLabel } from "./AllocationModals.jsx";
import { leaveAccentTheme, isoDateLocal } from "../utils/leaveVisuals.js";
import { isSupabaseConfigured } from "../lib/supabase.js";
import {
  getPersonAvailability,
  putPersonAvailability,
} from "../lib/api/personAvailability.js";
import {
  previewAvailabilityHours,
  employmentToWorkType,
  workTypeToEmployment,
} from "../utils/availabilityPreview.js";

/* ═══════════════════ DATA ═══════════════════ */
const SEED_ROLES = [
  "Analyst",
  "Consultant",
  "Director",
  "Engineer",
  "Graduate",
  "Manager",
  "Principal",
  "Senior Consultant",
  "Senior Manager",
  "Senior Specialist Lead",
  "Specialist Director",
  "Specialist Lead",
];
const SEED_TAGS = ["Azure",".NET","Cloud Secure","Data&AI","SDM","Firenation","UI and UX Design","service management","AWS Platform","Azkaban","Secure"];
const TYPES = ["Employee","Contractor","Placeholder"];
const ACCESS_OPTS = [
  { value:"none", label:"No access rights", desc:"", icon:Shield },
  { value:"member", label:"Member", desc:"Can view Schedule and optionally manage their own tasks and/or time off", icon:Users },
  { value:"manager", label:"Manager", desc:"Can manage specific Departments, People, and/or Projects", icon:Briefcase },
];
const MODAL_TABS = [
  { key:"info", label:"Info", icon:Info },
  { key:"access", label:"Access", icon:Shield },
  { key:"availability", label:"Availability", icon:Clock },
  { key:"timeoff", label:"Time Off", icon:Palmtree },
  { key:"projects", label:"Projects", icon:FolderOpen },
];

let _nid = 100;

export function nextPersonId() {
  return _nid++;
}

/* ═══════════════════ HELPERS ═══════════════════ */
const ini = (n) => { if(!n) return ""; const p=n.trim().split(/\s+/); return p.length===1?(p[0][0]||"").toUpperCase():(p[0][0]+p[p.length-1][0]).toUpperCase(); };
const avGrad = avatarGradientFromName;
const AVAIL_DEFAULTS = {
  availMon: true,
  availTue: true,
  availWed: true,
  availThu: true,
  availFri: true,
  weeklyHours: "37.5",
};

const DAY_FIELDS = [
  { key: "availMon", short: "Mon" },
  { key: "availTue", short: "Tue" },
  { key: "availWed", short: "Wed" },
  { key: "availThu", short: "Thu" },
  { key: "availFri", short: "Fri" },
];

const personToForm = (p) => ({
  name:p.name, email:p.email||"", role:p.role==="—"?"No role":p.role,
  costRate:p.costRate||"0", billRate:p.billRate||"0",
  department:p.department||"No department", tags:[...p.tags], type:p.type||"Employee",
  access: ACCESS_OPTS.find((a)=>a.label===p.access)?.value || "none",
  startDate:p.startDate||"2026-01-01", endDate:p.endDate||"", workType:p.workType||"Full-time",
  notes:p.notes||"",
  publicHolidayRegion: p.publicHolidayRegion ?? legacyHolidaysToRegion(p.holidays),
  ...AVAIL_DEFAULTS,
});
const formToPerson = (form, id, archived) => {
  const al = ACCESS_OPTS.find((a)=>a.value===form.access)?.label||"—";
  const region = form.publicHolidayRegion ?? legacyHolidaysToRegion(form.holidays);
  return {
    id, name:form.name, email:form.email, role:form.role==="No role"?"—":form.role,
    department:form.department==="No department"?"":form.department,
    access:form.access==="none"?"—":al, tags:[...form.tags], type:form.type,
    costRate:form.costRate, billRate:form.billRate, startDate:form.startDate,
    endDate:form.endDate, workType:form.workType, notes:form.notes,
    publicHolidayRegion: region,
    holidays: regionToLegacyHolidays(region),
    archived:!!archived,
  };
};

/* ═══════════════════ THEMES ═══════════════════ */
const T = {
  dark: {
    bg:"#0f1117",surface:"#181c26",surfRaised:"#1e2235",surfAlt:"#1a1e2e",
    border:"#2a2f45",borderSub:"#323852",borderIn:"#3a4060",
    text:"#f0f2f8",textSoft:"#9ba4b8",textMuted:"#7b82a0",textDim:"#4a5168",
    accent:"#00c2a8",accentSoft:"#009e8a",accentHov:"#00e5c8",accentTxt:"#061210",accentGlow:"rgba(0,194,168,0.15)",
    sidebar:"#0f1117",sidebarAct:"rgba(0,194,168,0.08)",rowHov:"#151a24",
    tagBg:"rgba(124,106,247,0.12)",tagTxt:"#a599fc",
    btnSec:"#1e2235",btnSecHov:"#252a3d",btnSecTxt:"#c4c9d8",
    danger:"#ef4444",dangerHov:"#dc2626",dangerSoft:"rgba(239,68,68,0.16)",dangerTxt:"#fff",
    dangerGlow:"0 4px 24px rgba(239,68,68,0.25)",
    success:"#22c55e",successHov:"#16a34a",successSoft:"rgba(34,197,94,0.14)",successGlow:"0 4px 20px rgba(34,197,94,0.22)",
    warn:"#f59e0b",warnHov:"#d97706",warnTxt:"#0f172a",warnSoft:"rgba(245,158,11,0.16)",warnGlow:"0 4px 20px rgba(245,158,11,0.2)",
    info:"#38bdf8",infoSoft:"rgba(56,189,248,0.14)",infoGlow:"0 4px 22px rgba(56,189,248,0.22)",
    overlay:"rgba(0,0,0,0.6)",shadow:"0 32px 100px rgba(0,0,0,0.55)",
    chk:"#00c2a8",scroll:"#2a2f45",selRow:"rgba(0,194,168,0.06)",focus:"#00c2a8",
    toastBg:"#181c26",toastBdr:"#2a2f45",
    tabActiveBg:"rgba(0,194,168,0.12)",tabHovBg:"rgba(0,194,168,0.06)",
  },
  light: {
    bg:"#f4f6fa",surface:"#ffffff",surfRaised:"#ffffff",surfAlt:"#e8ebf4",
    border:"#e0e4ef",borderSub:"#e4e8f0",borderIn:"#d4d8e4",
    text:"#12151f",textSoft:"#4a5168",textMuted:"#5c6478",textDim:"#9ca3b8",
    accent:"#00a896",accentSoft:"#008f7d",accentHov:"#00c2a8",accentTxt:"#ffffff",accentGlow:"rgba(0,194,168,0.12)",
    sidebar:"#ffffff",sidebarAct:"rgba(0,194,168,0.08)",rowHov:"#f4f6fa",
    tagBg:"rgba(124,106,247,0.1)",tagTxt:"#5b4fcf",
    btnSec:"#e8ebf4",btnSecHov:"#dde1ec",btnSecTxt:"#3e4560",
    danger:"#ef4444",dangerHov:"#dc2626",dangerSoft:"rgba(239,68,68,0.1)",dangerTxt:"#fff",
    dangerGlow:"0 4px 18px rgba(239,68,68,0.2)",
    success:"#16a34a",successHov:"#15803d",successSoft:"rgba(22,163,74,0.1)",successGlow:"0 4px 16px rgba(22,163,74,0.18)",
    warn:"#d97706",warnHov:"#b45309",warnTxt:"#fff",warnSoft:"rgba(217,119,6,0.1)",warnGlow:"0 4px 16px rgba(217,119,6,0.16)",
    info:"#0284c7",infoSoft:"rgba(2,132,199,0.1)",infoGlow:"0 4px 18px rgba(2,132,199,0.15)",
    overlay:"rgba(15,18,28,0.35)",shadow:"0 32px 100px rgba(0,0,0,0.12)",
    chk:"#00a896",scroll:"#d4d8e0",selRow:"rgba(0,194,168,0.08)",focus:"#00c2a8",
    toastBg:"#ffffff",toastBdr:"#e0e4ef",
    tabActiveBg:"rgba(0,194,168,0.1)",tabHovBg:"rgba(0,194,168,0.05)",
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
        <div style={{ display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap" }}>
          <Button type="button" variant="secondary" size="md" onClick={onNo}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={yesDanger ? "destructive" : "warning"}
            size="md"
            onClick={onYes}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            {YI ? <YI size={14} /> : null} {yesLabel}
          </Button>
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
      <button
        type="button"
        className="alloc8-icon-btn"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Row actions"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (<>
        <div onClick={(e)=>{ e.stopPropagation(); setOpen(false); }} style={{ position:"fixed",inset:0,zIndex:99 }}/>
        <div style={{
          position:"absolute",right:0,top:"100%",marginTop:4,zIndex:100,
          background:t.bg==="#0f1117"||t.bg==="#0b0e14"?"#111627":"#ffffff",border:`1.5px solid ${t.accent}30`,borderRadius:10,
          boxShadow:`0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.3)`,minWidth:190,overflow:"hidden",animation:"dropIn 0.15s ease-out",
        }}>
          {[
            { icon:Pencil, label:"Edit profile", action:()=>{ onEdit(); setOpen(false); }, color:t.text },
            { icon:person.archived?ArchiveRestore:Archive, label:person.archived?"Restore":"Archive", action:()=>{ onArchive(); setOpen(false); }, color:t.warn },
            { icon:Trash2, label:"Delete", action:()=>{ onDelete(); setOpen(false); }, color:t.danger },
          ].map((item,i) => (
            <div key={i} onClick={(e)=>{ e.stopPropagation(); item.action(); }}
              style={{ padding:"11px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,fontSize:13,fontWeight:500,color:item.color,transition:"background 0.12s",borderBottom:i<2?`1px solid ${t.bg==="#0f1117"||t.bg==="#0b0e14"?"#1a2030":"#e4e7ed"}`:"none" }}
              onMouseEnter={(e)=>e.currentTarget.style.background=t.bg==="#0f1117"||t.bg==="#0b0e14"?"#1a2236":"#f0f2f5"}
              onMouseLeave={(e)=>e.currentTarget.style.background="transparent"}>
              <item.icon size={14}/> {item.label}
            </div>
          ))}
        </div>
      </>)}
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
          placeholder={tags.length===0?"Type a tag, then press Space or Enter…":""} style={{ background:"transparent",border:"none",outline:"none",flex:1,minWidth:140,color:t.text,fontSize:13,padding:"4px 0" }}/>
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

function allocationHasPerson(a, pid) {
  if (Array.isArray(a.personIds) && a.personIds.length > 0) return a.personIds.includes(pid);
  return a.personId === pid;
}

function InfoTab({ form,setForm,roles,setRoles,depts,setDepts,tagOpts,setTagOpts,t,tagIsDark,pickerKey }) {
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:22 }}>
      <div style={{ background:t.surfAlt,borderRadius:10,padding:20,display:"flex",flexDirection:"column",gap:18,border:`1px solid ${t.borderSub}` }}>
        <div><label style={Lbl(t)}>Role</label>
          <FloatSelect
            t={t}
            value={form.role}
            placeholder="Select role"
            searchPlaceholder="Search roles or type to add new…"
            onChange={(v)=>{ if(v!=="No role"&&!roles.includes(v)) setRoles([...roles,v]); setForm({...form,role:v}); }}
            options={["No role",...roles]}
          /></div>
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
        <DepartmentSelector
          key={pickerKey}
          t={t}
          value={form.department}
          onChange={(v) => setForm({ ...form, department: v })}
          depts={depts}
          setDepts={setDepts}
        />
      </div>
      <div><label style={Lbl(t)}>Tags</label>
        <CTagInput t={t} tagIsDark={tagIsDark} tags={form.tags} setTags={(nt)=>{ const n=nt.filter((x)=>!tagOpts.includes(x)); if(n.length) setTagOpts([...tagOpts,...n]); setForm({...form,tags:nt}); }} options={tagOpts}/></div>
      <div><label style={Lbl(t)}>Type</label>
        <FloatSelect
          t={t}
          value={form.type}
          onChange={(v)=>setForm({...form,type:v})}
          options={TYPES}
          placeholder="Select type"
          creatable={false}
          searchPlaceholder="Search types…"
        /></div>
    </div>
  );
}

function AccessTab({ form,setForm,t }) {
  return (<div><label style={Lbl(t)}>Access level</label>
    <FloatSelect
      t={t}
      value={form.access}
      onChange={(v)=>setForm({...form,access:v})}
      options={ACCESS_OPTS}
      placeholder="Select access level"
      creatable={false}
      searchPlaceholder="Search access levels…"
      renderOption={(opt, th)=>(<div style={{ display:"flex",alignItems:"flex-start",gap:10 }}><div style={{ width:32,height:32,borderRadius:8,background:th.accentGlow,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2 }}><opt.icon size={16} style={{ color:th.accent }}/></div><div><div style={{ fontWeight:600,color:th.text,fontSize:14 }}>{opt.label}</div>{opt.desc?(<div style={{ fontSize:12,color:th.textMuted,marginTop:2,lineHeight:1.4 }}>{opt.desc}</div>):null}</div></div>)}
    />
  </div>);
}

function AvailabilityTab({ form, setForm, t, editPerson, onRefreshWorkspace, tagTheme }) {
  const [applying, setApplying] = useState(false);
  const weeklyNum = parseFloat(String(form.weeklyHours ?? "37.5")) || 0;
  const preview = previewAvailabilityHours({
    mon: !!form.availMon,
    tue: !!form.availTue,
    wed: !!form.availWed,
    thu: !!form.availThu,
    fri: !!form.availFri,
    weeklyHours: weeklyNum,
  });

  const toggleDay = (fieldKey) => {
    const nextVal = !form[fieldKey];
    const n = DAY_FIELDS.reduce(
      (acc, { key }) => acc + (key === fieldKey ? (nextVal ? 1 : 0) : (form[key] ? 1 : 0)),
      0
    );
    if (n <= 0) {
      toast.error("Select at least one weekday", {
        description: "The schedule needs at least one working day.",
      });
      return;
    }
    setForm({ ...form, [fieldKey]: nextVal });
  };

  const applyToSchedule = async () => {
    if (!editPerson?.id || !isSupabaseConfigured) {
      toast.error("Save this person first to sync availability to the schedule.");
      return;
    }
    if (!preview.valid) return;
    setApplying(true);
    try {
      await putPersonAvailability({
        personId: editPerson.id,
        employmentType: workTypeToEmployment(form.workType),
        weeklyHours: weeklyNum,
        mon: !!form.availMon,
        tue: !!form.availTue,
        wed: !!form.availWed,
        thu: !!form.availThu,
        fri: !!form.availFri,
      });
      if (onRefreshWorkspace) await onRefreshWorkspace();
      toast.success("Availability applied to schedule", {
        description: "Weekly hours and leave blocks were updated on the server.",
      });
    } catch (e) {
      toast.error("Could not apply availability", {
        description: e?.message || String(e),
      });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div style={{ background:t.surfAlt,borderRadius:10,padding:20,border:`1px solid ${t.borderSub}`,display:"flex",flexDirection:"column",gap:18 }}>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
        {[["Start date","startDate"],["End date","endDate"]].map(([lbl,key])=>(
          <div key={key}><label style={Lbl(t)}>{lbl}</label><input type="date" value={form[key]} onChange={(e)=>setForm({...form,[key]:e.target.value})} style={{ ...Inp(t),colorScheme:tagTheme==="dark"?"dark":"light" }}/></div>
        ))}
      </div>
      <div style={{ display:"flex",gap:0 }}>
        {["Full-time","Part-time"].map((opt,i)=>(<button key={opt} type="button" onClick={()=>{
          if (opt === "Full-time") {
            setForm({
              ...form,
              workType: opt,
              ...AVAIL_DEFAULTS,
            });
          } else {
            setForm({ ...form, workType: opt });
          }
        }} style={{
          padding:"9px 24px",fontSize:13,cursor:"pointer",fontWeight:600,border:`1.5px solid ${form.workType===opt?t.accent:t.borderIn}`,
          borderRadius:i===0?"8px 0 0 8px":"0 8px 8px 0",background:form.workType===opt?t.accentGlow:t.surfAlt,
          color:form.workType===opt?t.accent:t.textSoft,transition:"all 0.15s",marginLeft:i===1?-1.5:0,
        }}>{opt}</button>))}
      </div>

      <div>
        <label style={Lbl(t)}>Working days (Mon–Fri)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          {DAY_FIELDS.map(({ key, short }) => (
            <label
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 8,
                border: `1.5px solid ${form[key] ? t.accent : t.borderIn}`,
                background: form[key] ? t.accentGlow : t.surface,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={!!form[key]}
                onChange={() => toggleDay(key)}
                style={{ accentColor: t.accent, width: 16, height: 16, cursor: "pointer" }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: form[key] ? t.accent : t.textSoft }}>{short}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={Lbl(t)}>Total weekly hours</label>
          <input
            type="number"
            min={0}
            step={0.25}
            value={form.weeklyHours}
            onChange={(e) => setForm({ ...form, weeklyHours: e.target.value })}
            style={{ ...Inp(t) }}
          />
        </div>
        <div>
          <label style={Lbl(t)}>Hours per working day (preview)</label>
          <div
            style={{
              ...Inp(t),
              display: "flex",
              alignItems: "center",
              color: preview.valid ? t.text : t.warn,
              fontWeight: 600,
            }}
          >
            {preview.valid ? preview.hoursPerDay : "—"}
            {preview.valid ? (
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: t.textMuted }}>
                ({preview.workingDays} day{preview.workingDays === 1 ? "" : "s"})
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>
        Unchecked weekdays become weekly <strong style={{ color: t.textSoft }}>Other / Leave</strong> blocks on the schedule.
        The server recalculates hours and replaces those rows when you apply or save.
      </p>

      {isSupabaseConfigured && editPerson?.id ? (
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={!preview.valid || applying}
          onClick={applyToSchedule}
          style={{ alignSelf: "flex-start" }}
        >
          {applying ? "Applying…" : "Apply to schedule"}
        </Button>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: t.textDim }}>
          Save the person first, then use Apply to schedule to push this pattern to the server.
        </p>
      )}

      <div><label style={Lbl(t)}>Notes</label><textarea value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} rows={4} style={{ ...Inp(t),resize:"vertical",minHeight:80,fontFamily:"inherit" }}/></div>
    </div>
  );
}

function TimeOffTab({ form, setForm, t, editPerson, allocations = [], onOpenCreateLeave }) {
  const todayIso = useMemo(() => isoDateLocal(), []);

  const upcomingLeave = useMemo(() => {
    const pid = editPerson?.id;
    if (pid == null) return [];
    return allocations
      .filter(
        (a) =>
          a.isLeave &&
          allocationHasPerson(a, pid) &&
          typeof a.endDate === "string" &&
          a.endDate >= todayIso
      )
      .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""))
      .slice(0, 14);
  }, [allocations, editPerson?.id, todayIso]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {editPerson && onOpenCreateLeave ? (
        <motion.button
          type="button"
          onClick={() => onOpenCreateLeave(editPerson)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px 18px",
            borderRadius: 10,
            border: `1px solid color-mix(in srgb, ${t.accent} 40%, ${t.border})`,
            background: `linear-gradient(145deg, color-mix(in srgb, ${t.accent} 18%, transparent), color-mix(in srgb, ${t.accent} 8%, transparent))`,
            color: t.accent,
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: `0 0 24px color-mix(in srgb, ${t.accent} 15%, transparent)`,
          }}
        >
          <Palmtree size={18} strokeWidth={2.25} />
          Log leave on schedule
        </motion.button>
      ) : null}

      <div>
        <label style={Lbl(t)}>Upcoming leave</label>
        {!editPerson ? (
          <p style={{ margin: 0, fontSize: 13, color: t.textDim, lineHeight: 1.5 }}>
            Save this person first to see leave from the schedule here.
          </p>
        ) : upcomingLeave.length === 0 ? (
          <div
            style={{
              padding: "20px 16px",
              borderRadius: 10,
              border: `1px dashed ${t.borderSub}`,
              background: t.surfAlt,
              textAlign: "center",
            }}
          >
            <Calendar size={22} style={{ color: t.textDim, marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 13, color: t.textMuted, lineHeight: 1.45 }}>
              No upcoming leave blocks yet. Use{" "}
              <strong style={{ color: t.textSoft }}>Log leave on schedule</strong> or the Schedule view.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <AnimatePresence initial={false}>
              {upcomingLeave.map((a) => {
                const accent = leaveAccentTheme(a.leaveType);
                const title = a.leaveType ? leaveLabel(a.leaveType) : a.project || "Leave";
                const range =
                  a.startDate === a.endDate
                    ? a.startDate
                    : `${a.startDate} → ${a.endDate}`;
                return (
                  <motion.div
                    key={a.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.45, 0, 0.55, 1] } }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.18 } }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: `1px solid color-mix(in srgb, ${accent.solid} 35%, ${t.border})`,
                      background: `linear-gradient(135deg, color-mix(in srgb, ${accent.solid} 12%, ${t.surfAlt}), ${t.surfAlt})`,
                      boxShadow: `0 0 20px color-mix(in srgb, ${accent.solid} 10%, transparent)`,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 5,
                        flexShrink: 0,
                        background: `linear-gradient(145deg, ${accent.solid}, color-mix(in srgb, ${accent.solid} 65%, #0f172a))`,
                        boxShadow: `0 0 0 2px ${accent.soft}, inset 0 1px 2px rgba(0,0,0,0.15)`,
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>{title}</div>
                      <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{range}</div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div>
        <label style={Lbl(t)}>Public holidays region</label>
        <FloatSelect
          t={t}
          value={form.publicHolidayRegion}
          onChange={(v) => setForm({ ...form, publicHolidayRegion: v })}
          options={AU_PUBLIC_HOLIDAY_REGION_OPTIONS}
          placeholder="Select region"
          creatable={false}
          searchPlaceholder="Search regions…"
        />
      </div>
    </div>
  );
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
  onRefreshWorkspace,
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

  const removePersonFromProjectLabel = async (projectLabel) => {
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
        const prev = a;
        setAllocations((prevList) => prevList.filter((x) => x.id !== a.id));
        try {
          await syncAllocationDelete(a.id);
        } catch (e) {
          setAllocations((prevList) => [...prevList, prev]);
          toast.error("Update failed", { description: e?.message || String(e) });
          return;
        }
      } else {
        const merged = {
          ...a,
          personIds: nextIds,
          personId: nextIds[0],
          updatedBy: "You",
          updatedAt: new Date().toISOString(),
          version: Number(a.version) || 1,
        };
        setAllocations((prevList) => prevList.map((x) => (x.id === a.id ? merged : x)));
        try {
          const saved = await syncAllocationUpdate(merged);
          setAllocations((prevList) => prevList.map((x) => (x.id === a.id ? saved : x)));
        } catch (e) {
          if (e?.name === "OptimisticLockError") {
            toast.error("Someone else edited this allocation", {
              description: "Refreshing from the server.",
            });
            if (typeof onRefreshWorkspace === "function") {
              onRefreshWorkspace().catch(() => {});
            }
          } else {
            toast.error("Update failed", { description: e?.message || String(e) });
          }
          return;
        }
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
          <FloatSelect
            key={pickKey}
            t={t}
            value=""
            placeholder="Choose a project to allocate…"
            creatable={false}
            searchPlaceholder="Search projects…"
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
  onOpenCreateLeave,
  onRefreshWorkspace,
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
        startDate:"2026-01-01",endDate:"",workType:"Full-time",notes:"",publicHolidayRegion:"None",
        ...AVAIL_DEFAULTS,
      });
      setDirty(false);
    }
  }, [open, editPerson]);

  useEffect(() => {
    if (!open || !editPerson?.id || !isSupabaseConfigured) return undefined;
    let cancelled = false;
    getPersonAvailability(editPerson.id)
      .then((row) => {
        if (cancelled || row == null || typeof row !== "object") return;
        setForm((f) => ({
          ...f,
          workType: employmentToWorkType(row.employment_type),
          weeklyHours: String(row.weekly_hours ?? "37.5"),
          availMon: !!row.mon,
          availTue: !!row.tue,
          availWed: !!row.wed,
          availThu: !!row.thu,
          availFri: !!row.fri,
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, editPerson?.id]);

  if (!open || !form) return null;

  const updateForm = (patch) => { setForm({...form,...patch}); setDirty(true); };
  const setFormWrap = (f) => { setForm(f); setDirty(true); };

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <div className="float-modal-overlay-dim" onClick={(e) => { if(ref.current&&!ref.current.contains(e.target)) onClose(); }}
      style={{
        position:"fixed",inset:0,background:t.overlay,zIndex:200,
        display:"flex",alignItems:"center",justifyContent:"center",
        padding:"max(16px, env(safe-area-inset-top, 0px)) max(20px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(20px, env(safe-area-inset-left, 0px))",
        overflowY:"auto",
        WebkitOverflowScrolling:"touch",
        animation:"fadeIn 0.22s var(--ds-ease-out, ease-out)",
      }}>
      <div className="float-premium-modal float-modal-panel-enter" ref={ref} onClick={(e)=>e.stopPropagation()} style={{
        background:t.surfRaised,width:"min(620px, 100%)",maxWidth:"100%",
        maxHeight:"min(calc(100vh - 32px), calc(100dvh - 32px))",
        display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden",
        transition:"background 0.35s",
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
          <div style={{ display:"grid",gridTemplateColumns:`repeat(${MODAL_TABS.length}, 1fr)`,gap:4,marginTop:20,borderBottom:`2px solid ${t.border}`,paddingBottom:0,position:"relative" }}>
            {MODAL_TABS.map((mt, i) => {
              const Icon = mt.icon;
              const active = tab === i;
              return (
                <button key={mt.key} type="button" onClick={() => setTab(i)} style={{
                  position:"relative",
                  padding:"10px 4px",fontSize:12,fontWeight:active?700:500,cursor:"pointer",
                  background:active?t.tabActiveBg:"transparent",border:"none",
                  color:active?t.accent:t.textMuted,
                  marginBottom:-2,transition:"background 0.22s var(--ease-ui-in-out, ease-in-out), color 0.2s ease",display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                  borderRadius:"8px 8px 0 0",whiteSpace:"nowrap",overflow:"hidden",
                }}
                  onMouseEnter={(e) => { if(!active) e.currentTarget.style.background=t.tabHovBg; }}
                  onMouseLeave={(e) => { if(!active) e.currentTarget.style.background="transparent"; }}>
                  {active ? (
                    <motion.span
                      layoutId="person-modal-tab-line"
                      style={{
                        position: "absolute",
                        left: 6,
                        right: 6,
                        bottom: -2,
                        height: 2,
                        borderRadius: 2,
                        background: t.accent,
                        boxShadow: `0 0 14px color-mix(in srgb, ${t.accent} 55%, transparent)`,
                        pointerEvents: "none",
                      }}
                      transition={{ type: "spring", stiffness: 380, damping: 34 }}
                    />
                  ) : null}
                  <Icon size={14} style={{ flexShrink: 0, position: "relative", zIndex: 1 }} />{" "}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", position: "relative", zIndex: 1 }}>{mt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content — scrollable */}
        <div style={{ padding:"22px 32px 10px",overflowY:"auto",flex:1,minHeight:0 }}>
          {tab===0 && <InfoTab form={form} setForm={setFormWrap} roles={roles} setRoles={setRoles} depts={depts} setDepts={setDepts} tagOpts={tagOpts} setTagOpts={setTagOpts} t={t} tagIsDark={tagIsDark} pickerKey={editPerson?.id ?? "new"}/>}
          {tab===1 && <AccessTab form={form} setForm={setFormWrap} t={t}/>}
          {tab===2 && (
            <AvailabilityTab
              form={form}
              setForm={setFormWrap}
              t={t}
              editPerson={editPerson}
              onRefreshWorkspace={onRefreshWorkspace}
              tagTheme={tagTheme}
            />
          )}
          {tab===3 && (
            <TimeOffTab
              form={form}
              setForm={setFormWrap}
              t={t}
              editPerson={editPerson}
              allocations={allocations}
              onOpenCreateLeave={onOpenCreateLeave}
            />
          )}
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
              onRefreshWorkspace={onRefreshWorkspace}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:"16px 32px 24px",flexShrink:0,display:"flex",alignItems:"center",gap:10,borderTop:`1px solid ${t.border}`,flexWrap:"wrap" }}>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={!form.name.trim()}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            {isEdit ? <><Save size={15}/> Save changes</> : <><UserPlus size={15}/> Add person</>}
          </Button>
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          {isEdit && (
            <Button
              type="button"
              variant="warning"
              size="md"
              onClick={onArchive}
              style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}
            >
              {editPerson?.archived ? <><ArchiveRestore size={14}/> Restore</> : <><Archive size={14}/> Archive</>}
            </Button>
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
