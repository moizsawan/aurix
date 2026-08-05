import { useState, useEffect } from "react";
import Head from "next/head";
import { DENIAL_CODES } from "../lib/denialCodes";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const ls = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const sls = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const serif = { fontFamily: "'Lora', Georgia, serif" };
const uid = () => "id_" + Math.random().toString(36).slice(2, 10);
const fmt = d => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const INSURERS = ["UnitedHealthcare", "Aetna", "BlueCross BlueShield", "Cigna", "Humana", "Medicare Advantage", "Medicaid"];
const STATUSES = ["Draft", "Submitted", "Approved", "Denied", "Under Appeal"];
const SC = {
  Draft: { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400", border: "border-slate-200", left: "border-l-slate-300" },
  Submitted: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", border: "border-blue-200", left: "border-l-blue-400" },
  Approved: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-200", left: "border-l-emerald-400" },
  Denied: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", border: "border-red-200", left: "border-l-red-400" },
  "Under Appeal": { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", border: "border-amber-200", left: "border-l-amber-400" },
};

// ─── SAMPLE DATA ──────────────────────────────────────────────────────────────
const SAMPLE_PATIENTS = [
  { id: "p1", name: "Margaret Chen", dob: "1958-04-12", insurance: "UnitedHealthcare", diagnosis: "Type 2 Diabetes with Peripheral Neuropathy", icd10: "E11.40", currentMedications: "Metformin 1000mg BID, Gabapentin 300mg TID, Lisinopril 10mg daily", medicalHistory: "15-year T2DM history. HbA1c 10.1% despite max metformin. Hypertension, CKD Stage 2. MI in 2019. Recurrent hypoglycemic episodes on sulfonylureas.", email: "margaret.chen@email.com" },
  { id: "p2", name: "Robert Okafor", dob: "1972-09-28", insurance: "Aetna", diagnosis: "Rheumatoid Arthritis, Seropositive", icd10: "M05.79", currentMedications: "Methotrexate 15mg weekly, Folic Acid 1mg daily, Prednisone 5mg daily", medicalHistory: "Seropositive RA diagnosed 2018. Anti-CCP 240 U/mL. Active synovitis bilateral hands/wrists. DAS28-CRP 5.1. Failed methotrexate monotherapy at max tolerated dose for 6 months. X-rays show erosive changes.", email: "robert.okafor@email.com" },
  { id: "p3", name: "Sandra Reyes", dob: "1985-02-17", insurance: "BlueCross BlueShield", diagnosis: "Crohn's Disease, Moderate-Severe", icd10: "K50.10", currentMedications: "Mesalamine 4.8g daily, Budesonide 9mg daily, Azathioprine 150mg daily", medicalHistory: "Crohn's diagnosed 2015. Multiple flares requiring hospitalization. Colonoscopy 2024: significant ileal involvement, CDAI 320. Failed mesalamine, budesonide, and azathioprine over 2 years. Nutritional deficiencies, weight loss.", email: "sandra.reyes@email.com" },
];

const SAMPLE_REQUESTS = [
  { id: "r1", patientId: "p1", treatment: "Ozempic (semaglutide) 1mg weekly", justification: "Patient has uncontrolled T2DM with HbA1c 10.1% despite maximum dose metformin for 18 months. Sulfonylureas contraindicated due to recurrent hypoglycemia. CV benefit critical given prior MI.", stepTherapy: "Metformin 1000mg BID x 18 months - HbA1c remains 10.1%. Glipizide 10mg BID x 3 months - discontinued due to severe hypoglycemic episodes requiring ER visit.", status: "Submitted", date: new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0], letter: null, pipeline: null },
  { id: "r2", patientId: "p2", treatment: "Humira (adalimumab) 40mg every other week", justification: "Active RA with DAS28-CRP 5.1 despite 6 months of methotrexate at maximum tolerated dose. Erosive changes on imaging. ACR/EULAR guidelines recommend biologic DMARD.", stepTherapy: "Methotrexate 15mg weekly x 6 months - DAS28 improved from 5.8 to 5.1, still high disease activity. Unable to increase dose due to hepatotoxicity (ALT 2x ULN).", status: "Denied", date: new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0], letter: null, pipeline: null },
  { id: "r3", patientId: "p3", treatment: "Entyvio (vedolizumab) 300mg IV infusion", justification: "Moderate-severe Crohn's with CDAI 320 despite triple conventional therapy for 2+ years. Multiple hospitalizations for flares. Endoscopic evidence of active disease.", stepTherapy: "Mesalamine 4.8g daily x 24 months, Budesonide 9mg x 6 months, Azathioprine 150mg x 12 months - all inadequate. Prednisone required for flares 4x in past year.", status: "Under Appeal", date: new Date(Date.now() - 10 * 86400000).toISOString().split("T")[0], letter: null, pipeline: null },
];

const LOGINS = {
  "dr.smith@clinic.com": { password: "doctor123", role: "clinician", name: "Dr. Sarah Smith", title: "Internal Medicine" },
  "margaret.chen@email.com": { password: "patient123", role: "patient", name: "Margaret Chen", patientId: "p1" },
  "robert.okafor@email.com": { password: "patient123", role: "patient", name: "Robert Okafor", patientId: "p2" },
  "sandra.reyes@email.com": { password: "patient123", role: "patient", name: "Sandra Reyes", patientId: "p3" },
};

// ─── ICONS (inline SVG) ──────────────────────────────────────────────────────
function I({ n, c = "w-4 h-4" }) {
  const paths = {
    grid: "M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z",
    users: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z",
    doc: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    plus: "M12 4v16m8-8H4",
    x: "M6 18L18 6M6 6l12 12",
    check: "M5 13l4 4L19 7",
    shield: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    logout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
    arrow: "M9 5l7 7-7 7",
    edit: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    copy: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z",
    pipeline: "M13 10V3L4 14h7v7l9-11h-7z",
    chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    alert: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z",
    brain: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    db: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
    target: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 100 12 6 6 0 000-12zm0 4a2 2 0 100 4 2 2 0 000-4z",
    refresh: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  };
  return <svg className={c} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={paths[n] || paths.doc} /></svg>;
}

function Spin({ size = "w-5 h-5" }) {
  return <div className={`${size} border-2 border-white/30 border-t-white rounded-full`} style={{ animation: "spin 0.7s linear infinite" }} />;
}

// ─── CARD ─────────────────────────────────────────────────────────────────────
function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm ${className}`}>{children}</div>;
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ message, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 2000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed bottom-6 right-6 z-50 anim-up">
      <div className="bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
        <I n="check" c="w-4 h-4 text-emerald-400" /> {message}
      </div>
    </div>
  );
}

// ─── COPY HELPER ──────────────────────────────────────────────────────────────
let _setToastGlobal = null;
function copyText(text) {
  navigator.clipboard.writeText(text);
  if (_setToastGlobal) _setToastGlobal("Copied to clipboard");
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
function Badge({ status }) {
  const s = SC[status] || SC.Draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

// ─── PIPELINE STAGE INDICATOR ─────────────────────────────────────────────────
function PipelineStage({ number, name, status, duration, isLast }) {
  const colors = {
    pending: "bg-slate-200 text-slate-400 border-slate-200",
    running: "bg-amber-100 text-amber-700 border-amber-300",
    complete: "bg-emerald-100 text-emerald-700 border-emerald-300",
    failed: "bg-red-100 text-red-700 border-red-300",
  };
  const lineColors = {
    pending: "bg-slate-200",
    running: "bg-amber-300",
    complete: "bg-emerald-400",
    failed: "bg-red-300",
  };
  return (
    <div className="flex items-center">
      <div className="flex flex-col items-center">
        <div className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center text-sm font-bold transition-all duration-500 ${colors[status]}`}>
          {status === "running" ? <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-600 rounded-full" style={{ animation: "spin 0.7s linear infinite" }} /> : status === "complete" ? <I n="check" c="w-4 h-4" /> : status === "failed" ? <I n="x" c="w-4 h-4" /> : number}
        </div>
        <span className={`text-[10px] font-medium mt-1.5 max-w-[80px] text-center leading-tight ${status === "complete" || status === "running" ? "text-slate-700" : "text-slate-400"}`}>{name}</span>
        {duration !== undefined && status === "complete" && <span className="text-[9px] text-slate-400 mt-0.5">{duration}ms</span>}
      </div>
      {!isLast && (
        <div className={`w-8 h-0.5 mx-1 mt-[-18px] rounded transition-all duration-500 ${lineColors[status]}`} />
      )}
    </div>
  );
}

// ─── SCORE BAR ────────────────────────────────────────────────────────────────
function ScoreBar({ score, max, label, passed }) {
  const pct = Math.round((score / max) * 100);
  const color = passed ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="text-xs text-slate-500 w-44 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%`, animation: "score-fill 0.6s ease-out" }} />
      </div>
      <span className={`text-xs font-bold w-12 text-right ${passed ? "text-emerald-600" : "text-slate-500"}`}>{score}/{max}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    const u = LOGINS[email];
    if (!u || u.password !== pass) { setErr("Invalid credentials"); return; }
    onLogin({ email, ...u });
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#0A1628" }}>
      <Head><title>Aurix - AI Prior Authorization</title></Head>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[55%] flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, #C8922A 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(200,146,42,0.15)", border: "1px solid rgba(200,146,42,0.3)" }}>
              <I n="shield" c="w-5 h-5 text-[#C8922A]" />
            </div>
            <span className="text-white text-xl font-bold" style={serif}>Aurix</span>
          </div>
          <h1 className="text-white text-4xl font-bold leading-tight mb-6" style={serif}>
            AI-Powered Prior<br />Authorization
          </h1>
          <p className="text-blue-200/60 text-lg max-w-md leading-relaxed">
            The first 7-stage intelligent pipeline for prior authorization. Readiness scoring, criteria matching, AI letter generation, quality scoring, self-correction, denial pattern analysis, and automated appeal generation.
          </p>
        </div>
        <div className="relative z-10 flex gap-6">
          {[["7-Stage", "Pipeline"], ["Pre-Submission", "Readiness Score"], ["Auto-Appeal", "Generator"]].map(([a, b]) => (
            <div key={a} className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-5 py-4">
              <p className="text-[#C8922A] text-lg font-bold">{a}</p>
              <p className="text-blue-200/40 text-xs mt-0.5">{b}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(200,146,42,0.15)", border: "1px solid rgba(200,146,42,0.3)" }}>
              <I n="shield" c="w-5 h-5 text-[#C8922A]" />
            </div>
            <span className="text-white text-xl font-bold" style={serif}>Aurix</span>
          </div>
          <h2 className="text-white text-2xl font-bold mb-1" style={serif}>Sign in</h2>
          <p className="text-blue-200/40 text-sm mb-8">Enter your credentials to continue</p>

          {err && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4 text-red-300 text-sm">{err}</div>}

          <div className="space-y-4 mb-6">
            <div>
              <label className="text-blue-200/50 text-xs font-medium mb-1.5 block">Email</label>
              <input value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#C8922A]/50 transition" placeholder="Enter email" onKeyDown={e => e.key === "Enter" && submit()} />
            </div>
            <div>
              <label className="text-blue-200/50 text-xs font-medium mb-1.5 block">Password</label>
              <input type="password" value={pass} onChange={e => { setPass(e.target.value); setErr(""); }} className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#C8922A]/50 transition" placeholder="Enter password" onKeyDown={e => e.key === "Enter" && submit()} />
            </div>
          </div>

          <button onClick={submit} className="w-full py-3.5 rounded-xl text-white text-sm font-semibold transition-all hover:brightness-110" style={{ background: "linear-gradient(135deg, #C8922A 0%, #A67520 100%)" }}>
            Sign In
          </button>

          <div className="mt-8 bg-white/[0.03] border border-white/[0.05] rounded-xl p-4">
            <p className="text-blue-200/30 text-[10px] uppercase tracking-wider font-bold mb-3">Demo Accounts</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-blue-200/40"><span>Clinician:</span><span className="text-blue-200/60">dr.smith@clinic.com / doctor123</span></div>
              <div className="flex justify-between text-blue-200/40"><span>Patient:</span><span className="text-blue-200/60">margaret.chen@email.com / patient123</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════════
function Sidebar({ user, page, onNav, onLogout, requestCount }) {
  const links = [
    { id: "dashboard", label: "Dashboard", icon: "grid" },
    { id: "patients", label: "Patients", icon: "users" },
    { id: "requests", label: "PA Requests", icon: "doc", badge: requestCount || null },
  ];
  return (
    <aside className="w-[220px] flex flex-col shrink-0" style={{ background: "#0F1F3D" }}>
      <div className="px-5 pt-6 pb-5 border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(200,146,42,0.2)", border: "1px solid rgba(200,146,42,0.3)" }}>
            <I n="shield" c="w-4 h-4 text-[#C8922A]" />
          </div>
          <span className="text-white text-base font-bold" style={serif}>Aurix</span>
        </div>
        <p className="text-[10px] text-blue-300/40 font-medium uppercase tracking-wider pl-0.5">7-Stage PA Pipeline</p>
      </div>
      <nav className="flex-1 p-2.5 space-y-0.5 pt-3">
        {links.map(l => (
          <button key={l.id} onClick={() => onNav(l.id)}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${page === l.id ? "bg-white/10 text-white" : "text-blue-200/50 hover:text-white hover:bg-white/[0.04]"}`}>
            <I n={l.icon} c="w-4 h-4" />
            {l.label}
            {l.badge && <span className="ml-auto bg-[#C8922A]/20 text-[#C8922A] text-[10px] font-bold px-2 py-0.5 rounded-full">{l.badge}</span>}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-white/[0.07]">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-xs font-bold">{user.name.split(" ").map(w => w[0]).join("")}</div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{user.name}</p>
            <p className="text-blue-200/40 text-[10px] truncate">{user.title || user.role}</p>
          </div>
          <button onClick={onLogout} className="text-blue-200/30 hover:text-white transition"><I n="logout" c="w-4 h-4" /></button>
        </div>
      </div>
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE RESULTS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function PipelineResults({ pipeline }) {
  if (!pipeline) return null;
  const [showLetter, setShowLetter] = useState(false);

  const stage1 = pipeline.stages.find(s => s.stage === 1);
  const stage5 = pipeline.stages.find(s => s.stage === 5);
  const scoringStages = pipeline.stages.filter(s => s.stage === 3);
  const lastScore = scoringStages[scoringStages.length - 1];

  return (
    <div className="space-y-4 anim-up">
      {pipeline.demoMode && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <span className="font-semibold">Sample output (demo mode).</span> Live AI generation is unavailable right now, so this draft was assembled deterministically from the insurer criteria engine. The full pipeline adds AI generation and iterative self-correction on top of these criteria.
        </div>
      )}
      {stage1?.result?.usingBaselineCriteria && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <span className="font-semibold">Baseline criteria applied.</span> Aurix does not yet have a payer-specific ruleset for this insurer, so it used the {stage1.result.baselineSource} baseline. Native criteria are implemented for UnitedHealthcare, Aetna, BlueCross BlueShield, Cigna, and Medicare Advantage.
        </div>
      )}
      {/* Pipeline summary */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C8922A]/10 flex items-center justify-center">
              <I n="pipeline" c="w-4 h-4 text-[#C8922A]" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Pipeline Complete</p>
              <p className="text-[11px] text-slate-400">{pipeline.iterations} iteration{pipeline.iterations > 1 ? "s" : ""} in {(pipeline.totalDuration / 1000).toFixed(1)}s</p>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${pipeline.finalScore.passed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {pipeline.finalScore.totalScore}/{pipeline.finalScore.maxScore} ({pipeline.finalScore.percentage}%)
          </div>
        </div>

        {/* Stage timeline */}
        <div className="flex items-start justify-between px-2 mb-4 overflow-x-auto">
          {[
            { num: 1, name: "Criteria Match" },
            { num: 2, name: "AI Generation" },
            { num: 3, name: "Rubric Score" },
            { num: 4, name: "Self-Correct" },
            { num: 5, name: "Denial Risk" },
          ].map((s, i) => {
            const stageData = pipeline.stages.find(st => st.stage === s.num);
            const status = stageData ? "complete" : (pipeline.iterations <= 1 && s.num === 4) ? "pending" : "complete";
            return <PipelineStage key={s.num} number={s.num} name={s.name} status={status} duration={stageData?.duration} isLast={i === 4} />;
          })}
        </div>
      </Card>

      {/* Stage 1 Results - Gap Analysis */}
      {stage1 && stage1.result.criteriaFound && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <I n="db" c="w-4 h-4 text-blue-600" />
            <p className="text-sm font-bold text-slate-800">Stage 1: Insurer Criteria Engine</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-slate-50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Drug Identified</p>
              <p className="text-sm font-semibold text-slate-700 capitalize">{stage1.result.drugIdentified?.replace(/_/g, " ")}</p>
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Class</p>
              <p className="text-sm font-semibold text-slate-700 capitalize">{stage1.result.drugClass?.replace(/_/g, " ")}</p>
            </div>
          </div>
          {stage1.result.enrichments && (
            <div className="space-y-2 text-xs">
              {stage1.result.enrichments.cptCodes?.length > 0 && (
                <div className="flex gap-2"><span className="text-slate-400 w-28 shrink-0">CPT/HCPCS:</span><span className="text-slate-700 font-medium">{stage1.result.enrichments.cptCodes.join(", ")}</span></div>
              )}
              {stage1.result.enrichments.authDuration && (
                <div className="flex gap-2"><span className="text-slate-400 w-28 shrink-0">Auth Duration:</span><span className="text-slate-700 font-medium">{stage1.result.enrichments.authDuration}</span></div>
              )}
              {stage1.result.enrichments.placeOfService && (
                <div className="flex gap-2"><span className="text-slate-400 w-28 shrink-0">Place of Service:</span><span className="text-slate-700 font-medium">{stage1.result.enrichments.placeOfService}</span></div>
              )}
            </div>
          )}
          {stage1.result.gaps.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Documentation Gaps</p>
              {stage1.result.gaps.map((g, i) => (
                <div key={i} className={`text-xs px-3 py-2 rounded-lg ${typeof g === "object" && g.severity === "HIGH" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                  {typeof g === "object" ? g.message : g}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Stage 3 Results - Rubric Scoring */}
      {lastScore && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <I n="chart" c="w-4 h-4 text-purple-600" />
            <p className="text-sm font-bold text-slate-800">Stage 3: Quality Gate Scoring</p>
            {pipeline.iterations > 1 && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{pipeline.iterations} iterations</span>}
          </div>
          {lastScore.result.criteria.map(c => (
            <ScoreBar key={c.name} score={c.score} max={c.maxScore} label={c.name} passed={c.passed} />
          ))}
        </Card>
      )}

      {/* Stage 5 Results - Denial Probability */}
      {stage5 && stage5.result && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <I n="alert" c="w-4 h-4 text-orange-600" />
            <p className="text-sm font-bold text-slate-800">Stage 5: Denial Risk Analysis</p>
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div className={`text-3xl font-bold ${stage5.result.probability > 0.5 ? "text-red-600" : stage5.result.probability > 0.3 ? "text-amber-600" : "text-emerald-600"}`}>
              {Math.round(stage5.result.probability * 100)}%
            </div>
            <div>
              <p className={`text-sm font-semibold ${stage5.result.probability > 0.5 ? "text-red-700" : stage5.result.probability > 0.3 ? "text-amber-700" : "text-emerald-700"}`}>Denial Probability</p>
              <p className="text-[11px] text-slate-400">Based on {stage5.result.sampleSize} historical outcomes (confidence: {stage5.result.confidence})</p>
            </div>
          </div>
          {stage5.result.factors && stage5.result.factors.length > 0 && (
            <div className="space-y-1.5">
              {stage5.result.factors.map((f, i) => (
                <div key={i} className={`text-xs px-3 py-2 rounded-lg flex justify-between items-center ${f.severity === "POSITIVE" ? "bg-emerald-50 text-emerald-700" : f.severity === "HIGH" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                  <span>{f.factor}</span>
                  <span className="font-medium ml-2 shrink-0">{f.impact}</span>
                </div>
              ))}
            </div>
          )}
          {stage5.result.recommendation && (
            <p className="text-xs text-slate-500 mt-3 italic">{stage5.result.recommendation}</p>
          )}
        </Card>
      )}

      {/* Pre-submission scaffolding: billing codes + denial anticipation */}
      {(pipeline.billing || (pipeline.denialAnticipation && pipeline.denialAnticipation.length > 0)) && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <I n="doc" c="w-4 h-4 text-[#C8922A]" />
            <p className="text-sm font-bold text-slate-800">Pre-Submission Scaffolding</p>
          </div>
          {pipeline.billing && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-600 mb-1.5">Billing &amp; coding</p>
              <div className="text-xs text-slate-600 space-y-1">
                <div className="flex justify-between gap-3">
                  <span>ICD-10 diagnosis</span>
                  <span className={`font-medium ${pipeline.billing.icd10.raw ? (pipeline.billing.icd10.valid ? "text-emerald-700" : "text-amber-700") : "text-red-600"}`}>
                    {pipeline.billing.icd10.raw || "not provided"}{pipeline.billing.icd10.raw && !pipeline.billing.icd10.valid ? " (verify format)" : ""}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Procedure / HCPCS codes</span>
                  <span className="font-medium text-slate-700 text-right">{pipeline.billing.procedureCodes.length > 0 ? pipeline.billing.procedureCodes.join(", ") : "none mapped"}</span>
                </div>
              </div>
            </div>
          )}
          {pipeline.denialAnticipation && pipeline.denialAnticipation.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1.5">Denial anticipation</p>
              <div className="space-y-1.5">
                {pipeline.denialAnticipation.map((d, i) => (
                  <div key={i} className={`text-xs px-3 py-2 rounded-lg flex justify-between items-center gap-3 ${d.addressed === false ? "bg-red-50 text-red-700" : d.addressed === true ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-600"}`}>
                    <span>{d.reason}</span>
                    <span className="font-medium shrink-0">{d.addressed === false ? "Not addressed" : d.addressed === true ? "Addressed" : "Review"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Generated Letter */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <I n="doc" c="w-4 h-4 text-slate-600" />
            <p className="text-sm font-bold text-slate-800">Generated PA Letter</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowLetter(!showLetter)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              {showLetter ? "Collapse" : "Expand"}
            </button>
            <button onClick={() => copyText(pipeline.letter)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
              <I n="copy" c="w-3.5 h-3.5" /> Copy
            </button>
          </div>
        </div>
        {showLetter ? (
          <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl p-4 max-h-[500px] overflow-y-auto leading-relaxed font-[inherit]">{pipeline.letter}</pre>
        ) : (
          <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-4">
            <p className="font-medium text-slate-700 mb-1">Letter generated ({pipeline.letter?.split(/\s+/).length} words)</p>
            <p className="text-slate-400">{pipeline.letter?.slice(0, 200)}...</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE RUNNING ANIMATION
// ═══════════════════════════════════════════════════════════════════════════════
function PipelineRunning({ currentStage, stagesComplete }) {
  const stages = [
    { num: 1, name: "Criteria Match", desc: "Cross-referencing insurer requirements..." },
    { num: 2, name: "AI Generation", desc: "Generating PA letter with enriched context..." },
    { num: 3, name: "Rubric Score", desc: "Scoring letter against 6-criteria rubric..." },
    { num: 4, name: "Self-Correct", desc: "Iterating if below quality threshold..." },
    { num: 5, name: "Denial Risk", desc: "Computing denial probability from patterns..." },
  ];

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#C8922A]/10 flex items-center justify-center relative">
          <I n="pipeline" c="w-5 h-5 text-[#C8922A]" />
          <div className="absolute inset-0 rounded-xl border-2 border-[#C8922A]/30" style={{ animation: "pulse-ring 1.5s ease-out infinite" }} />
        </div>
        <div>
          <p className="text-base font-bold text-slate-800" style={serif}>Pipeline Running</p>
          <p className="text-xs text-slate-400">Processing through 5-stage pipeline...</p>
        </div>
      </div>

      <div className="space-y-3">
        {stages.map(s => {
          const status = stagesComplete.includes(s.num) ? "complete" : currentStage === s.num ? "running" : "pending";
          return (
            <div key={s.num} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${status === "running" ? "bg-amber-50 border border-amber-200" : status === "complete" ? "bg-emerald-50/50 border border-emerald-100" : "bg-slate-50 border border-slate-100"}`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${status === "running" ? "bg-amber-200 text-amber-800" : status === "complete" ? "bg-emerald-200 text-emerald-800" : "bg-slate-200 text-slate-400"}`}>
                {status === "complete" ? <I n="check" c="w-3.5 h-3.5" /> : status === "running" ? <div className="w-3.5 h-3.5 border-2 border-amber-600/30 border-t-amber-700 rounded-full" style={{ animation: "spin 0.7s linear infinite" }} /> : s.num}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${status === "pending" ? "text-slate-400" : "text-slate-700"}`}>Stage {s.num}: {s.name}</p>
                {status === "running" && <p className="text-[11px] text-amber-600 mt-0.5">{s.desc}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPEAL SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function AppealSection({ request, patient, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState([]);
  const [customText, setCustomText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [appealResult, setAppealResult] = useState(request.appeal || null);
  const [showAppealLetter, setShowAppealLetter] = useState(false);
  const [error, setError] = useState(null);

  const toggleReason = code => {
    setSelectedReasons(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  const generateAppeal = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientData: {
            name: patient.name, dob: patient.dob, insurance: patient.insurance,
            diagnosis: patient.diagnosis, icd10: patient.icd10,
            currentMedications: patient.currentMedications,
            medicalHistory: patient.medicalHistory,
            requestedTreatment: request.treatment,
            clinicalJustification: request.justification,
            stepTherapy: request.stepTherapy,
          },
          denialReasons: selectedReasons,
          customDenialText: customText,
          originalLetter: request.letter,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Appeal generation failed");

      setAppealResult(data);
      setShowForm(false);
      // Save appeal to request
      const updated = { ...request, appeal: data, status: "Under Appeal" };
      onUpdate(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      {!appealResult && !showForm && (
        <Card className="p-5 border-2 border-dashed border-red-200 bg-red-50/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <I n="alert" c="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">PA Request Denied</p>
                <p className="text-xs text-slate-400">Generate an AI-powered appeal letter to challenge this denial</p>
              </div>
            </div>
            <button onClick={() => setShowForm(true)} className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition hover:brightness-110" style={{ background: "linear-gradient(135deg, #C8922A 0%, #A67520 100%)" }}>
              Generate Appeal
            </button>
          </div>
        </Card>
      )}

      {showForm && (
        <Card className="p-5 anim-up">
          <div className="flex items-center gap-2 mb-4">
            <I n="edit" c="w-4 h-4 text-red-600" />
            <p className="text-sm font-bold text-slate-800">Appeal Letter Generator</p>
          </div>

          <p className="text-xs text-slate-500 mb-3">Select the denial reason(s) from the insurer:</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {DENIAL_CODES.map(opt => (
              <button key={opt.code} onClick={() => toggleReason(opt.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${selectedReasons.includes(opt.code) ? "bg-red-50 border-red-300 text-red-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                {selectedReasons.includes(opt.code) && <span className="mr-1">\u2713</span>}{opt.label}
              </button>
            ))}
          </div>

          <div className="mb-4">
            <label className="text-xs text-slate-500 font-medium mb-1 block">Additional denial details (optional)</label>
            <textarea value={customText} onChange={e => setCustomText(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8922A]/50 resize-none" placeholder="Paste the insurer's specific denial language here..." />
          </div>

          {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{error}</div>}

          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 border border-slate-200">Cancel</button>
            <button onClick={generateAppeal} disabled={selectedReasons.length === 0 || generating}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #C8922A 0%, #A67520 100%)" }}>
              {generating ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" style={{ animation: "spin 0.7s linear infinite" }} /> Generating Appeal...</> : <><I n="pipeline" c="w-4 h-4" /> Generate Appeal Letter</>}
            </button>
          </div>
        </Card>
      )}

      {appealResult && (
        <div className="space-y-4 anim-up">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <I n="doc" c="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Appeal Letter Generated</p>
                  <p className="text-[11px] text-slate-400">{appealResult.wordCount} words, {appealResult.iterations} iteration{appealResult.iterations > 1 ? "s" : ""}, {(appealResult.duration / 1000).toFixed(1)}s</p>
                </div>
              </div>
              <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${appealResult.score.passed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                Quality: {appealResult.score.totalScore}/{appealResult.score.maxScore}
              </div>
            </div>

            {/* Denial reasons addressed */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {appealResult.denialReasons.map(dr => (
                <span key={dr.code} className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">{dr.label}</span>
              ))}
            </div>

            {/* Appeal letter content */}
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setShowAppealLetter(!showAppealLetter)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                {showAppealLetter ? "Collapse Letter" : "View Full Appeal Letter"}
              </button>
              <button onClick={() => copyText(appealResult.appealLetter)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
                <I n="copy" c="w-3.5 h-3.5" /> Copy
              </button>
            </div>

            {showAppealLetter && (
              <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl p-4 max-h-[500px] overflow-y-auto leading-relaxed font-[inherit]">{appealResult.appealLetter}</pre>
            )}
          </Card>

          {!showForm && (
            <button onClick={() => { setAppealResult(null); setShowForm(true); setSelectedReasons([]); setCustomText(""); }}
              className="text-xs text-slate-500 hover:text-slate-700 font-medium">
              Regenerate with different denial reasons
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLINICIAN APP
// ═══════════════════════════════════════════════════════════════════════════════
function ClinicianApp({ user, onLogout }) {
  const [page, setPage] = useState("dashboard");
  const [patients, setPatients] = useState(() => ls("ax_patients", SAMPLE_PATIENTS));
  const [requests, setRequests] = useState(() => ls("ax_requests", SAMPLE_REQUESTS));
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [filter, setFilter] = useState("All");

  useEffect(() => { sls("ax_patients", patients); }, [patients]);
  useEffect(() => { sls("ax_requests", requests); }, [requests]);

  const goTo = p => { setPage(p); setSelectedPatient(null); setSelectedRequest(null); setShowNewPatient(false); setShowNewRequest(false); };

  // ── Dashboard ──────────────────────────────────────────────────────────────
  function Dashboard() {
    const active = requests.filter(r => r.status !== "Approved");
    const approved = requests.filter(r => r.status === "Approved");
    const denied = requests.filter(r => r.status === "Denied");
    const pending = requests.filter(r => r.status === "Submitted");

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-800" style={serif}>Dashboard</h1>
            <p className="text-sm text-slate-400 mt-0.5">Welcome back, {user.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Active Requests", val: active.length, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Pending Review", val: pending.length, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Approved", val: approved.length, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Denied", val: denied.length, color: "text-red-600", bg: "bg-red-50" },
          ].map(s => (
            <Card key={s.label} className="p-4 anim-up">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            </Card>
          ))}
        </div>

        {/* Pipeline badge */}
        <Card className="p-5 mb-6 anim-up s2">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#C8922A]/10 flex items-center justify-center">
              <I n="pipeline" c="w-4 h-4 text-[#C8922A]" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">7-Stage Intelligent Pipeline</p>
              <p className="text-[11px] text-slate-400">Criteria matching, readiness scoring, quality gate, self-correction, denial risk, and appeal generation</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {["Readiness Scoring", "Criteria Engine", "AI Generation", "Quality Gate", "Self-Correction", "Denial Analysis", "Appeal Generator"].map((s, i) => (
              <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-[11px] font-medium text-slate-600 border border-slate-100">
                <span className="w-4 h-4 rounded bg-[#C8922A]/10 text-[#C8922A] text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                {s}
              </span>
            ))}
          </div>
        </Card>

        {/* Recent requests */}
        <Card className="anim-up s3">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-800">Recent PA Requests</p>
          </div>
          {requests.slice(0, 5).map(r => {
            const p = patients.find(pt => pt.id === r.patientId);
            return (
              <div key={r.id} className="px-5 py-3.5 flex items-center justify-between border-b border-slate-50 last:border-0 hover:bg-slate-50/50 cursor-pointer transition" onClick={() => { setSelectedRequest(r); setPage("requests"); }}>
                <div>
                  <p className="text-sm font-semibold text-slate-700">{p?.name || "Unknown"}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{r.treatment}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{fmt(r.date)}</span>
                  <Badge status={r.status} />
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    );
  }

  // ── Patients ───────────────────────────────────────────────────────────────
  function PatientsPage() {
    if (showNewPatient) return <NewPatientForm />;
    if (selectedPatient) return <PatientDetail />;

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-slate-800" style={serif}>Patients</h1>
          <button onClick={() => setShowNewPatient(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition hover:brightness-110" style={{ background: "linear-gradient(135deg, #C8922A 0%, #A67520 100%)" }}>
            <I n="plus" c="w-4 h-4" /> Add Patient
          </button>
        </div>
        <div className="space-y-2">
          {patients.map(p => (
            <Card key={p.id} className="px-5 py-4 flex items-center justify-between cursor-pointer hover:shadow-md transition anim-up" onClick={() => setSelectedPatient(p)}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">{p.name.split(" ").map(w => w[0]).join("")}</div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{p.insurance} &middot; {p.diagnosis}</p>
                </div>
              </div>
              <I n="arrow" c="w-4 h-4 text-slate-300" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ── New Patient Form ───────────────────────────────────────────────────────
  function NewPatientForm() {
    const [f, setF] = useState({ name: "", dob: "", insurance: INSURERS[0], diagnosis: "", icd10: "", currentMedications: "", medicalHistory: "", email: "" });
    const [errors, setErrors] = useState({});
    const set = (k, v) => { setF(prev => ({ ...prev, [k]: v })); setErrors(prev => ({ ...prev, [k]: null })); };
    const save = () => {
      const e = {};
      if (!f.name.trim()) e.name = "Patient name is required";
      if (!f.dob) e.dob = "Date of birth is required";
      if (!f.diagnosis.trim()) e.diagnosis = "Primary diagnosis is required";
      if (Object.keys(e).length > 0) { setErrors(e); return; }
      const p = { ...f, id: uid() };
      setPatients(prev => [...prev, p]);
      setShowNewPatient(false);
      setSelectedPatient(p);
    };
    return (
      <div>
        <button onClick={() => setShowNewPatient(false)} className="text-sm text-slate-500 hover:text-slate-700 mb-4 flex items-center gap-1">&larr; Back</button>
        <Card className="p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-5" style={serif}>New Patient</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ["name", "Full Name *", "text"], ["dob", "Date of Birth *", "date"], ["email", "Email", "email"],
              ["diagnosis", "Primary Diagnosis *", "text"], ["icd10", "ICD-10 Code", "text"],
            ].map(([k, l, t]) => (
              <div key={k}>
                <label className="text-xs text-slate-500 font-medium mb-1 block">{l}</label>
                <input type={t} value={f[k]} onChange={e => set(k, e.target.value)} className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8922A]/50 ${errors[k] ? "border-red-300 bg-red-50/30" : "border-slate-200"}`} />
                {errors[k] && <p className="text-[11px] text-red-500 mt-1">{errors[k]}</p>}
              </div>
            ))}
            <div>
              <label className="text-xs text-slate-500 font-medium mb-1 block">Insurance</label>
              <select value={f.insurance} onChange={e => set("insurance", e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8922A]/50 bg-white">
                {INSURERS.map(i => <option key={i}>{i}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500 font-medium mb-1 block">Current Medications</label>
              <textarea value={f.currentMedications} onChange={e => set("currentMedications", e.target.value)} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8922A]/50 resize-none" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500 font-medium mb-1 block">Medical History</label>
              <textarea value={f.medicalHistory} onChange={e => set("medicalHistory", e.target.value)} rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8922A]/50 resize-none" />
            </div>
          </div>
          <button onClick={save} className="mt-5 px-6 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: "linear-gradient(135deg, #C8922A 0%, #A67520 100%)" }}>Save Patient</button>
        </Card>
      </div>
    );
  }

  // ── Patient Detail ─────────────────────────────────────────────────────────
  function PatientDetail() {
    const p = selectedPatient;
    const patientRequests = requests.filter(r => r.patientId === p.id);
    const [editing, setEditing] = useState(false);
    const [ef, setEf] = useState(null);

    const startEdit = () => { setEf({ ...p }); setEditing(true); };
    const cancelEdit = () => { setEditing(false); setEf(null); };
    const saveEdit = () => {
      if (!ef.name.trim() || !ef.dob) return;
      setPatients(prev => prev.map(x => x.id === p.id ? ef : x));
      setSelectedPatient(ef);
      setEditing(false);
      setEf(null);
    };
    const eSet = (k, v) => setEf(prev => ({ ...prev, [k]: v }));

    return (
      <div>
        <button onClick={() => setSelectedPatient(null)} className="text-sm text-slate-500 hover:text-slate-700 mb-4 flex items-center gap-1">&larr; Back</button>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-base font-bold text-slate-500">{p.name.split(" ").map(w => w[0]).join("")}</div>
            <div>
              <h2 className="text-lg font-bold text-slate-800" style={serif}>{p.name}</h2>
              <p className="text-sm text-slate-400">{p.insurance} &middot; DOB: {fmt(p.dob)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing && (
              <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition">
                <I n="edit" c="w-3.5 h-3.5" /> Edit
              </button>
            )}
            <button onClick={() => { setSelectedPatient(p); setShowNewRequest(true); setPage("requests"); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition hover:brightness-110" style={{ background: "linear-gradient(135deg, #C8922A 0%, #A67520 100%)" }}>
              <I n="pipeline" c="w-4 h-4" /> New PA Request
            </button>
          </div>
        </div>

        {editing ? (
          <Card className="p-5 mb-5 anim-up">
            <p className="text-sm font-bold text-slate-800 mb-4" style={serif}>Edit Patient</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[["name","Name","text"],["dob","Date of Birth","date"],["email","Email","email"],["diagnosis","Diagnosis","text"],["icd10","ICD-10","text"]].map(([k,l,t])=>(
                <div key={k}>
                  <label className="text-xs text-slate-500 font-medium mb-1 block">{l}</label>
                  <input type={t} value={ef[k]} onChange={e=>eSet(k,e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C8922A]/50" />
                </div>
              ))}
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">Insurance</label>
                <select value={ef.insurance} onChange={e=>eSet("insurance",e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white">
                  {INSURERS.map(i=><option key={i}>{i}</option>)}
                </select>
              </div>
              <div className="col-span-full">
                <label className="text-xs text-slate-500 font-medium mb-1 block">Current Medications</label>
                <textarea value={ef.currentMedications} onChange={e=>eSet("currentMedications",e.target.value)} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C8922A]/50 resize-none" />
              </div>
              <div className="col-span-full">
                <label className="text-xs text-slate-500 font-medium mb-1 block">Medical History</label>
                <textarea value={ef.medicalHistory} onChange={e=>eSet("medicalHistory",e.target.value)} rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C8922A]/50 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={cancelEdit} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-500 border border-slate-200 hover:bg-slate-50">Cancel</button>
              <button onClick={saveEdit} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #C8922A 0%, #A67520 100%)" }}>Save Changes</button>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <Card className="p-4">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">Diagnosis</p>
                <p className="text-sm font-semibold text-slate-700">{p.diagnosis}</p>
                {p.icd10 && <p className="text-xs text-slate-400 mt-1">ICD-10: {p.icd10}</p>}
              </Card>
              <Card className="p-4">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">Medications</p>
                <p className="text-xs text-slate-600 leading-relaxed">{p.currentMedications || "None documented"}</p>
              </Card>
            </div>

            <Card className="p-4 mb-5">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">Medical History</p>
              <p className="text-xs text-slate-600 leading-relaxed">{p.medicalHistory || "None documented"}</p>
            </Card>
          </>
        )}

        {/* Requests list */}
        <h3 className="text-sm font-bold text-slate-700 mb-3">PA Requests</h3>
        {patientRequests.length === 0 ? (
          <Card className="p-8 text-center text-sm text-slate-400">No PA requests yet</Card>
        ) : (
          <div className="space-y-2">
            {patientRequests.map(r => (
              <Card key={r.id} className={`px-5 py-4 border-l-4 ${SC[r.status]?.left || ""} cursor-pointer hover:shadow-md transition`} onClick={() => { setSelectedRequest(r); setPage("requests"); }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{r.treatment}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{fmt(r.date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.pipeline && <span className="text-[10px] bg-[#C8922A]/10 text-[#C8922A] px-2 py-0.5 rounded-full font-medium">Pipeline {r.pipeline.finalScore?.percentage}%</span>}
                    <Badge status={r.status} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── New PA Request (Pipeline) ──────────────────────────────────────────────
  function NewRequestForm() {
    const p = selectedPatient;
    const [f, setF] = useState({ requestedTreatment: "", clinicalJustification: "", stepTherapy: "", currentTreatmentInadequacy: "" });
    const [running, setRunning] = useState(false);
    const [currentStage, setCurrentStage] = useState(0);
    const [stagesComplete, setStagesComplete] = useState([]);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [readiness, setReadiness] = useState(null);
    const [checkingReadiness, setCheckingReadiness] = useState(false);
    const set = (k, v) => { setF(prev => ({ ...prev, [k]: v })); setReadiness(null); };

    const checkReadiness = async () => {
      setCheckingReadiness(true);
      try {
        const res = await fetch("/api/readiness", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientData: {
              name: p.name, dob: p.dob, insurance: p.insurance,
              diagnosis: p.diagnosis, icd10: p.icd10,
              currentMedications: p.currentMedications,
              medicalHistory: p.medicalHistory, ...f,
            },
          }),
        });
        const data = await res.json();
        setReadiness(data);
      } catch (err) { setError(err.message); }
      finally { setCheckingReadiness(false); }
    };

    const runPipeline = async () => {
      setRunning(true);
      setError(null);
      setResult(null);
      setStagesComplete([]);
      setCurrentStage(1);

      // Stage 1 is deterministic and fast — animate it immediately
      await new Promise(r => setTimeout(r, 500));
      setStagesComplete([1]);
      setCurrentStage(2);

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientData: {
              name: p.name, dob: p.dob, insurance: p.insurance,
              diagnosis: p.diagnosis, icd10: p.icd10,
              currentMedications: p.currentMedications,
              medicalHistory: p.medicalHistory,
              ...f,
            },
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Pipeline failed");
        }

        // Now animate stages 2-5 completing based on what actually happened
        const completedStages = (data.stages || []).map(s => s.stage);
        for (const stageNum of [2, 3, 4, 5]) {
          if (completedStages.includes(stageNum) || stageNum <= 3) {
            setStagesComplete(prev => [...prev, stageNum]);
            setCurrentStage(stageNum + 1);
            await new Promise(r => setTimeout(r, 300));
          }
        }

        setResult(data);

        // Save the request
        const newReq = {
          id: uid(), patientId: p.id,
          treatment: f.requestedTreatment,
          justification: f.clinicalJustification,
          stepTherapy: f.stepTherapy,
          status: "Draft", date: new Date().toISOString().split("T")[0],
          letter: data.letter,
          pipeline: data,
        };
        setRequests(prev => [...prev, newReq]);
      } catch (err) {
        setError(err.message);
      } finally {
        setRunning(false);
        setCurrentStage(0);
      }
    };

    return (
      <div>
        <button onClick={() => setShowNewRequest(false)} className="text-sm text-slate-500 hover:text-slate-700 mb-4 flex items-center gap-1">&larr; Back to {p.name}</button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#C8922A]/10 flex items-center justify-center">
            <I n="pipeline" c="w-5 h-5 text-[#C8922A]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800" style={serif}>New PA Request</h2>
            <p className="text-xs text-slate-400">7-stage pipeline for {p.name}</p>
          </div>
        </div>

        {!result && !running && (
          <Card className="p-6 mb-4 anim-up">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">Requested Treatment / Medication *</label>
                <input value={f.requestedTreatment} onChange={e => set("requestedTreatment", e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8922A]/50" placeholder="e.g. Humira (adalimumab) 40mg every other week" />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">Clinical Justification *</label>
                <textarea value={f.clinicalJustification} onChange={e => set("clinicalJustification", e.target.value)} rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8922A]/50 resize-none" placeholder="Why is this treatment medically necessary?" />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">Prior Treatments Tried and Failed</label>
                <textarea value={f.stepTherapy} onChange={e => set("stepTherapy", e.target.value)} rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8922A]/50 resize-none" placeholder="List prior treatments with dosages, duration, and reason for failure" />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">Why Current Treatment Is Insufficient</label>
                <textarea value={f.currentTreatmentInadequacy} onChange={e => set("currentTreatmentInadequacy", e.target.value)} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#C8922A]/50 resize-none" />
              </div>
            </div>

            {error && <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{error}</div>}

            <div className="mt-5 flex gap-3">
              <button onClick={checkReadiness} disabled={!f.requestedTreatment || checkingReadiness} className="flex-1 py-3.5 rounded-xl text-sm font-bold transition-all border-2 border-[#C8922A] text-[#C8922A] hover:bg-[#C8922A]/5 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {checkingReadiness ? <><div className="w-4 h-4 border-2 border-[#C8922A]/30 border-t-[#C8922A] rounded-full" style={{ animation: "spin 0.7s linear infinite" }} /> Checking...</> : <><I n="target" c="w-4 h-4" /> Check Readiness</>}
              </button>
              <button onClick={runPipeline} disabled={!f.requestedTreatment || !f.clinicalJustification} className="flex-1 py-3.5 rounded-xl text-white text-sm font-bold transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #C8922A 0%, #A67520 100%)" }}>
                <I n="pipeline" c="w-4 h-4" /> Run 5-Stage Pipeline
              </button>
            </div>
          </Card>
        )}

        {/* Readiness Score Results */}
        {readiness && !running && !result && (
          <Card className="p-5 mb-4 anim-up">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${readiness.readinessScore >= 80 ? "bg-emerald-100 text-emerald-700" : readiness.readinessScore >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                  {readiness.grade}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Submission Readiness Score</p>
                  <p className="text-xs text-slate-400">{readiness.readinessScore}% ready for {p.insurance}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold ${readiness.projectedApproval >= 70 ? "text-emerald-600" : readiness.projectedApproval >= 50 ? "text-amber-600" : "text-red-600"}`}>{readiness.projectedApproval}%</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Projected Approval</p>
              </div>
            </div>

            {/* Category scores */}
            <div className="space-y-2 mb-4">
              {readiness.categories.map(cat => (
                <div key={cat.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-600 font-medium">{cat.name}</span>
                    <span className={`text-xs font-bold ${cat.status === "pass" ? "text-emerald-600" : cat.status === "warning" ? "text-amber-600" : "text-red-600"}`}>{cat.score}/{cat.maxScore}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${cat.status === "pass" ? "bg-emerald-500" : cat.status === "warning" ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${(cat.score / cat.maxScore) * 100}%`, animation: "score-fill 0.6s ease-out" }} />
                  </div>
                  {cat.checks && cat.checks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {cat.checks.map(ch => (
                        <span key={ch.label} className={`text-[10px] px-2 py-0.5 rounded-full ${ch.passed === true ? "bg-emerald-50 text-emerald-600" : ch.passed === false ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-400"}`}>
                          {ch.passed === true ? "\u2713" : ch.passed === false ? "\u2717" : "?"} {ch.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Action items */}
            {readiness.actionItems.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">Actions to Improve Approval Odds {readiness.improvementPotential > 0 && <span className="text-emerald-600">(up to +{readiness.improvementPotential}%)</span>}</p>
                <div className="space-y-1.5">
                  {readiness.actionItems.map((item, i) => (
                    <div key={i} className={`text-xs px-3 py-2.5 rounded-lg ${item.priority === "HIGH" ? "bg-red-50 border border-red-100" : "bg-amber-50 border border-amber-100"}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`font-bold ${item.priority === "HIGH" ? "text-red-700" : "text-amber-700"}`}>{item.category}</span>
                        <span className="text-emerald-600 font-medium">{item.impact}</span>
                      </div>
                      <p className={`${item.priority === "HIGH" ? "text-red-600" : "text-amber-600"}`}>{item.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {readiness.drugMatch && (
              <div className="mt-3 flex gap-2">
                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">Drug: {readiness.drugMatch.name}</span>
                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">Class: {readiness.drugMatch.class.replace(/_/g, " ")}</span>
                {readiness.criteriaFound && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">Criteria engine matched</span>}
              </div>
            )}
          </Card>
        )}

        {running && <PipelineRunning currentStage={currentStage} stagesComplete={stagesComplete} />}
        {result && <PipelineResults pipeline={result} />}
      </div>
    );
  }

  // ── PA Requests ────────────────────────────────────────────────────────────
  function RequestsPage() {
    if (showNewRequest && selectedPatient) return <NewRequestForm />;

    if (selectedRequest) {
      const r = selectedRequest;
      const p = patients.find(pt => pt.id === r.patientId);
      return (
        <div>
          <button onClick={() => setSelectedRequest(null)} className="text-sm text-slate-500 hover:text-slate-700 mb-4 flex items-center gap-1">&larr; Back</button>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800" style={serif}>{r.treatment}</h2>
              <p className="text-sm text-slate-400">{p?.name} &middot; {fmt(r.date)}</p>
            </div>
            <div className="flex items-center gap-2">
              <select value={r.status} onChange={e => { const newR = { ...r, status: e.target.value }; setRequests(prev => prev.map(x => x.id === r.id ? newR : x)); setSelectedRequest(newR); }} className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white">
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
              <Badge status={r.status} />
              <button onClick={() => { if (window.confirm("Delete this PA request? This cannot be undone.")) { setRequests(prev => prev.filter(x => x.id !== r.id)); setSelectedRequest(null); } }} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition" title="Delete request">
                <I n="x" c="w-4 h-4" />
              </button>
            </div>
          </div>

          <Card className="p-5 mb-4">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">Clinical Justification</p>
            <p className="text-sm text-slate-700">{r.justification}</p>
            {r.stepTherapy && (
              <>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2 mt-4">Step Therapy</p>
                <p className="text-sm text-slate-700">{r.stepTherapy}</p>
              </>
            )}
          </Card>

          {r.pipeline ? (
            <PipelineResults pipeline={r.pipeline} />
          ) : (
            <Card className="p-8 text-center">
              <I n="pipeline" c="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-3">No pipeline data for this request</p>
              <button onClick={() => { setSelectedPatient(p); setShowNewRequest(true); }} className="text-sm text-[#C8922A] font-semibold hover:underline">Generate with Pipeline</button>
            </Card>
          )}

          {/* Appeal Generation for Denied Requests */}
          {(r.status === "Denied" || r.status === "Under Appeal") && (
            <AppealSection request={r} patient={p} onUpdate={(updated) => { setRequests(prev => prev.map(x => x.id === r.id ? updated : x)); setSelectedRequest(updated); }} />
          )}
        </div>
      );
    }

    const filtered = filter === "All" ? requests : requests.filter(r => r.status === filter);

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-slate-800" style={serif}>PA Requests</h1>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {["All", ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${filter === s ? "bg-[#C8922A] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{s}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <Card className="p-10 text-center">
            <I n="doc" c="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-1">No {filter === "All" ? "" : filter.toLowerCase() + " "}requests found</p>
            <p className="text-xs text-slate-400">{filter !== "All" ? "Try selecting a different status filter" : "Create a PA request from a patient profile"}</p>
          </Card>
        ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const p = patients.find(pt => pt.id === r.patientId);
            const daysSince = Math.floor((Date.now() - new Date(r.date).getTime()) / 86400000);
            const stale = daysSince > 7 && r.status === "Submitted";
            return (
              <Card key={r.id} className={`px-5 py-4 border-l-4 ${SC[r.status]?.left || ""} cursor-pointer hover:shadow-md transition`} onClick={() => setSelectedRequest(r)}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-700">{p?.name || "Unknown"}</p>
                      {stale && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Stale ({daysSince}d)</span>}
                      {r.pipeline && <span className="text-[10px] bg-[#C8922A]/10 text-[#C8922A] px-2 py-0.5 rounded-full font-medium">Pipeline {r.pipeline.finalScore?.percentage}%</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{r.treatment}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{fmt(r.date)}</span>
                    <Badge status={r.status} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F8F7F4]">
      <Head><title>Aurix - Dashboard</title></Head>
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar user={user} page={page} onNav={goTo} onLogout={onLogout} requestCount={requests.filter(r => r.status === "Submitted").length} />
      </div>
      {/* Mobile top nav */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 border-b border-slate-200" style={{ background: "#0F1F3D" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(200,146,42,0.2)" }}>
            <I n="shield" c="w-3.5 h-3.5 text-[#C8922A]" />
          </div>
          <span className="text-white text-sm font-bold" style={serif}>Aurix</span>
        </div>
        <div className="flex items-center gap-1">
          {[{id:"dashboard",icon:"grid"},{id:"patients",icon:"users"},{id:"requests",icon:"doc"}].map(l=>(
            <button key={l.id} onClick={()=>goTo(l.id)} className={`p-2 rounded-lg ${page===l.id?"bg-white/10 text-white":"text-blue-200/50"}`}>
              <I n={l.icon} c="w-4 h-4" />
            </button>
          ))}
          <button onClick={onLogout} className="p-2 text-blue-200/30"><I n="logout" c="w-4 h-4" /></button>
        </div>
      </div>
      <main className="flex-1 p-4 md:p-8 overflow-y-auto pt-16 md:pt-8">
        {page === "dashboard" && <Dashboard />}
        {page === "patients" && <PatientsPage />}
        {page === "requests" && <RequestsPage />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATIENT PORTAL
// ═══════════════════════════════════════════════════════════════════════════════
function PatientPortal({ user, onLogout }) {
  const patients = ls("ax_patients", SAMPLE_PATIENTS);
  const requests = ls("ax_requests", SAMPLE_REQUESTS);
  const patient = patients.find(p => p.id === user.patientId);
  const myRequests = requests.filter(r => r.patientId === user.patientId);

  const statusMessages = {
    Draft: "Your doctor is preparing the authorization request. No action is needed from you right now.",
    Submitted: "Your authorization request has been sent to your insurance company. They are reviewing it now. This usually takes 3-5 business days.",
    Approved: "Your treatment has been approved by your insurance. Your doctor's office will contact you to schedule your treatment.",
    Denied: "Unfortunately, your insurance has denied this request. Your doctor may file an appeal or discuss alternatives with you.",
    "Under Appeal": "Your doctor has filed an appeal with your insurance company. They are asking them to reconsider. This process can take 1-2 weeks.",
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <Head><title>Aurix - Patient Portal</title></Head>
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(200,146,42,0.15)" }}>
            <I n="shield" c="w-4 h-4 text-[#C8922A]" />
          </div>
          <span className="text-base font-bold" style={serif}>Aurix</span>
          <span className="text-xs text-slate-400 ml-2">Patient Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">{user.name}</span>
          <button onClick={onLogout} className="text-slate-400 hover:text-slate-600"><I n="logout" c="w-4 h-4" /></button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-xl font-bold text-slate-800 mb-1" style={serif}>Your Prior Authorizations</h1>
        <p className="text-sm text-slate-400 mb-6">Here is the status of your treatment requests</p>

        {myRequests.length === 0 ? (
          <Card className="p-8 text-center text-sm text-slate-400">No authorization requests found</Card>
        ) : (
          <div className="space-y-4">
            {myRequests.map(r => (
              <Card key={r.id} className={`p-5 border-l-4 ${SC[r.status]?.left || ""}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-700">{r.treatment}</p>
                  <Badge status={r.status} />
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-2">{statusMessages[r.status]}</p>
                <p className="text-xs text-slate-400">Submitted: {fmt(r.date)}</p>
              </Card>
            ))}
          </div>
        )}

        {patient && (
          <Card className="p-5 mt-6">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-3">Your Information</p>
            {[["Insurance", patient.insurance], ["Condition", patient.diagnosis]].map(([k, v]) => v ? (
              <div key={k} className="flex gap-3 items-center mb-2">
                <span className="text-xs text-slate-400 w-24">{k}</span>
                <span className="text-sm text-slate-700 font-medium">{v}</span>
              </div>
            ) : null)}
          </Card>
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function Home() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState(null);
  useEffect(() => { const u = ls("ax_user", null); if (u) setUser(u); setReady(true); _setToastGlobal = setToast; }, []);
  const login = u => { sls("ax_user", u); setUser(u); };
  const logout = () => { sls("ax_user", null); setUser(null); };

  if (!ready) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A1628" }}><Spin size="w-8 h-8" /></div>;
  return (
    <>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      {!user ? <Login onLogin={login} /> : user.role === "patient" ? <PatientPortal user={user} onLogout={logout} /> : <ClinicianApp user={user} onLogout={logout} />}
    </>
  );
}
