import { useState } from "react";
import { useAuth } from "../auth";
import { formatErr } from "../api";
import { ArrowRight, ShieldCheck, UserCircle } from "@phosphor-icons/react";

const GREEN_GRADIENT = "linear-gradient(135deg, #6B8F71 0%, #5A7D60 55%, #2F4A35 100%)";

function LoginHero({ className = "" }) {
  return (
    <div className={`text-center text-white relative ${className}`}>
      <div
        className="w-[72px] h-[72px] rounded-2xl mx-auto mb-4 flex items-center justify-center p-2.5 shadow-lg"
        style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)" }}
      >
        <img src="/bg-logo.png" alt="Boost Growth" className="w-full h-full object-contain" />
      </div>
      <div className="text-[10px] tracking-[0.3em] opacity-85 font-bold">STAFF PORTAL</div>
      <div className="font-display text-2xl font-semibold mt-1">Boost Growth</div>
      <div className="text-xs opacity-90 mt-0.5">Applied Behavior Analysis Services</div>
      <h1 className="font-display text-xl font-bold leading-snug mt-5 px-2">
        Each growth begins<br />with <span className="text-[#F0D88A]">seeds.</span>
      </h1>
      <div className="text-xs opacity-85 mt-2 px-4">Helping children achieve their full potential.</div>
    </div>
  );
}

function ChooseButtons({ onAdmin, onTherapist }) {
  return (
    <div className="stagger">
      <div className="text-xs font-bold tracking-[0.25em] mb-1" style={{ color: "#8A8670" }}>WELCOME BACK 👋</div>
      <h2 className="font-display text-xl md:text-2xl mb-5" style={{ color: "#2F4A35" }}>Sign in to continue</h2>
      <button
        data-testid="login-as-admin-btn"
        onClick={onAdmin}
        className="w-full mb-3 p-4 rounded-2xl text-white flex items-center gap-3 transition-all active:scale-[0.99] shadow-md min-h-[52px]"
        style={{ background: "#6B8F71" }}
      >
        <ShieldCheck size={28} weight="duotone" />
        <div className="flex-1 text-left">
          <div className="font-bold">Admin / Supervisor</div>
          <div className="text-xs opacity-80">Full access · All clients · Reports</div>
        </div>
        <ArrowRight size={20} />
      </button>
      <button
        data-testid="login-as-therapist-btn"
        onClick={onTherapist}
        className="w-full p-4 rounded-2xl flex items-center gap-3 transition-all active:scale-[0.99] min-h-[52px]"
        style={{ background: "#EDE1C9", color: "#2F4A35" }}
      >
        <UserCircle size={28} weight="duotone" color="#6B8F71" />
        <div className="flex-1 text-left">
          <div className="font-bold">Therapist</div>
          <div className="text-xs" style={{ color: "#6B6650" }}>Client sessions · My tools</div>
        </div>
        <ArrowRight size={20} />
      </button>
      <div className="text-center text-xs mt-5" style={{ color: "#8A8670" }}>boost-growthsa.com · Staff Access Only</div>
    </div>
  );
}

function AdminForm({ email, setEmail, password, setPassword, err, loading, onBack, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="stagger">
      <button type="button" onClick={onBack} className="text-sm hover:underline mb-3 min-h-[44px]" style={{ color: "#5C6853" }}>← Back</button>
      <h2 className="font-display text-xl md:text-2xl mb-1" style={{ color: "#2C3625" }}>Admin Login</h2>
      <div className="text-sm mb-5" style={{ color: "#5C6853" }}>Sign in to your admin dashboard</div>
      <label className="label">Email</label>
      <input data-testid="admin-email-input" className="input mb-3 min-h-[44px] text-base md:text-sm" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@..." />
      <label className="label">Password</label>
      <input data-testid="admin-password-input" className="input mb-4 min-h-[44px] text-base md:text-sm" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded-lg mb-3">{err}</div>}
      <button data-testid="admin-submit-btn" disabled={loading} className="btn btn-primary w-full min-h-[44px]">
        {loading ? <span className="spinner" /> : "Sign In"}
      </button>
    </form>
  );
}

function TherapistForm({ tEmail, setTEmail, tPassword, setTPassword, err, loading, onBack, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="stagger">
      <button type="button" onClick={onBack} className="text-sm hover:underline mb-3 min-h-[44px]" style={{ color: "#5C6853" }}>← Back</button>
      <h2 className="font-display text-xl md:text-2xl mb-1" style={{ color: "#2C3625" }}>Therapist Login</h2>
      <div className="text-sm mb-5" style={{ color: "#5C6853" }}>Sign in with your work email and password</div>
      <label className="label">Email</label>
      <input data-testid="therapist-email-input" className="input mb-3 min-h-[44px] text-base md:text-sm" type="email" required autoFocus
        placeholder="yourname@boostgrowthsa.com" value={tEmail} onChange={e => setTEmail(e.target.value)} />
      <label className="label">Password</label>
      <input data-testid="therapist-password-input" className="input mb-4 min-h-[44px] text-base md:text-sm" type="password" required
        value={tPassword} onChange={e => setTPassword(e.target.value)} />
      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded-lg mb-3">{err}</div>}
      <button data-testid="therapist-submit-btn" disabled={loading} className="btn btn-primary w-full min-h-[44px]">
        {loading ? <span className="spinner" /> : "Sign In"}
      </button>
      <div className="text-center text-xs mt-3" style={{ color: "#8B9E7A" }}>First time? Ask admin for a temporary password.</div>
    </form>
  );
}

export default function Login() {
  const { loginAdmin, loginTherapistEmail } = useAuth();
  const [mode, setMode] = useState("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tEmail, setTEmail] = useState("");
  const [tPassword, setTPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submitAdmin = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try { await loginAdmin(email, password); }
    catch (ex) { setErr(formatErr(ex.response?.data?.detail) || ex.message); }
    finally { setLoading(false); }
  };
  const submitTherapist = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try { await loginTherapistEmail(tEmail.trim().toLowerCase(), tPassword); }
    catch (ex) { setErr(formatErr(ex.response?.data?.detail) || ex.message); }
    finally { setLoading(false); }
  };

  const formContent = mode === "choose" ? (
    <ChooseButtons onAdmin={() => setMode("admin")} onTherapist={() => setMode("therapist")} />
  ) : mode === "admin" ? (
    <AdminForm email={email} setEmail={setEmail} password={password} setPassword={setPassword}
      err={err} loading={loading} onBack={() => setMode("choose")} onSubmit={submitAdmin} />
  ) : (
    <TherapistForm tEmail={tEmail} setTEmail={setTEmail} tPassword={tPassword} setTPassword={setTPassword}
      err={err} loading={loading} onBack={() => setMode("choose")} onSubmit={submitTherapist} />
  );

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row login-page">
      {/* Desktop green panel */}
      <div
        className="hidden md:flex md:w-1/2 md:min-h-[100dvh] flex-col justify-center text-white py-14 px-6 relative overflow-hidden shrink-0"
        style={{ background: GREEN_GRADIENT }}
      >
        <img src="/bg-logo.png" alt="" className="login-watermark absolute opacity-10 pointer-events-none" />
        <div className="max-w-lg mx-auto lg:mx-0 lg:ml-[max(1.5rem,calc((100%-32rem)/2))] relative w-full">
          <div className="text-xs tracking-[0.3em] opacity-80 font-bold">STAFF PORTAL</div>
          <div className="text-2xl font-display font-semibold">Boost Growth</div>
          <div className="text-sm opacity-90">Applied Behavior Analysis Services</div>
          <div className="mt-10">
            <h1 className="font-display text-4xl lg:text-5xl xl:text-6xl font-bold leading-[1.1]">
              Each growth begins<br />with <span className="text-[#F0D88A]">seeds.</span>
            </h1>
            <div className="text-base opacity-90 mt-3">Helping children achieve their full potential.</div>
          </div>
        </div>
      </div>

      {/* Login area */}
      <div className="flex-1 flex flex-col min-h-[100dvh] overflow-y-auto login-mobile-bg md:bg-organic md:justify-center md:py-10">
        {/* Mobile: branded hero + form card */}
        <div className="md:hidden flex flex-col min-h-[100dvh] relative overflow-hidden">
          <img src="/bg-logo.png" alt="" className="login-watermark absolute opacity-[0.08] pointer-events-none" />
          <div className="relative pt-8 pb-4 px-6 shrink-0">
            <LoginHero />
          </div>
          <div className="relative flex-1 px-6 pb-8 flex flex-col justify-end">
            <div className="login-form-card bg-white rounded-2xl p-6 shadow-xl w-full max-w-md mx-auto">
              {formContent}
            </div>
          </div>
        </div>

        {/* Desktop: centered card */}
        <div className="hidden md:flex flex-1 flex-col justify-center px-6">
          <div className="card p-7 page-enter w-full max-w-md mx-auto">
            {formContent}
          </div>
        </div>
      </div>
    </div>
  );
}
