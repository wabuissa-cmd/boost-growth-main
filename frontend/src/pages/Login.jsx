import { useState } from "react";
import { useAuth } from "../auth";
import { formatErr } from "../api";
import { ArrowRight, ShieldCheck, UserCircle } from "@phosphor-icons/react";

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

  const mobileShell = "w-full max-w-md mx-auto space-y-3";
  const mobileCard = "bg-white rounded-2xl p-5 shadow-md w-full";
  const desktopCard = "card p-7 page-enter";

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row login-page">
      {/* Desktop green panel — hidden on mobile */}
      <div
        className="hidden md:flex md:w-1/2 md:min-h-[100dvh] flex-col justify-center text-white py-14 px-6 relative overflow-hidden shrink-0"
        style={{ background: "linear-gradient(135deg, #7A8A6A 0%, #606E52 60%, #48543E 100%)" }}
      >
        <img src="/bg-logo.png" alt="" className="absolute opacity-10 pointer-events-none" style={{ bottom: "-50px", left: "-30px", width: 280, animation: "leaf-float 8s ease-in-out infinite" }} />
        <div className="max-w-lg mx-auto lg:mx-0 lg:ml-[max(1.5rem,calc((100%-32rem)/2))] relative w-full">
          <div className="text-xs tracking-[0.3em] opacity-80 font-bold">STAFF PORTAL</div>
          <div className="text-2xl font-display font-semibold">Boost Growth</div>
          <div className="text-sm opacity-90">Applied Behavior Analysis Services</div>
          <div className="mt-10">
            <h1 className="font-display text-4xl lg:text-5xl xl:text-6xl font-semibold leading-[1.1]">
              Each growth begins<br />with <span className="text-[#F0D88A] italic">seeds.</span>
            </h1>
            <div className="text-base opacity-90 mt-3">Helping children achieve their full potential.</div>
          </div>
        </div>
      </div>

      {/* Login area — full-screen green on mobile, centered form on desktop */}
      <div
        className="flex-1 flex flex-col min-h-[100dvh] overflow-y-auto px-6 py-8 md:py-10 md:justify-center login-mobile-bg md:bg-organic"
      >
        {/* Mobile branding */}
        <div className="md:hidden text-center text-white pt-2 pb-6 shrink-0">
          <img src="/bg-logo.png" alt="Boost Growth" className="w-[60px] h-[60px] object-contain mx-auto mb-3" />
          <div className="font-display text-xl font-semibold">Boost Growth</div>
          <div className="text-xs tracking-[0.25em] opacity-90 mt-1 font-bold">Staff Portal</div>
        </div>

        <div className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto md:max-w-md">
          {/* Mobile: white cards directly. Desktop: card wrapper */}
          <div className="md:hidden">
            {mode === "choose" && (
              <div className={mobileShell}>
                <div className={`${mobileCard} text-center mb-1`}>
                  <div className="text-xs font-bold tracking-[0.2em]" style={{ color: "#8B9E7A" }}>WELCOME BACK 👋</div>
                  <h2 className="font-display text-xl mt-1" style={{ color: "#2C3625" }}>Sign in to continue</h2>
                </div>
                <button data-testid="login-as-admin-btn" onClick={() => setMode("admin")}
                  className={`${mobileCard} flex items-center gap-3 min-h-[44px] text-left active:scale-[0.99]`}>
                  <ShieldCheck size={26} weight="duotone" color="#7A8A6A" />
                  <div className="flex-1">
                    <div className="font-bold" style={{ color: "#2C3625" }}>Admin / Supervisor</div>
                    <div className="text-xs" style={{ color: "#5C6853" }}>Full access · All clients · Reports</div>
                  </div>
                  <ArrowRight size={18} color="#7A8A6A" />
                </button>
                <button data-testid="login-as-therapist-btn" onClick={() => setMode("therapist")}
                  className={`${mobileCard} flex items-center gap-3 min-h-[44px] text-left active:scale-[0.99]`}>
                  <UserCircle size={26} weight="duotone" color="#7A8A6A" />
                  <div className="flex-1">
                    <div className="font-bold" style={{ color: "#2C3625" }}>I'm a Therapist</div>
                    <div className="text-xs" style={{ color: "#5C6853" }}>My clients · Session tools</div>
                  </div>
                  <ArrowRight size={18} color="#7A8A6A" />
                </button>
                <div className="text-center text-xs text-white/80 pt-2">boost-growthsa.com · Staff Access Only</div>
              </div>
            )}
            {mode === "admin" && (
              <form onSubmit={submitAdmin} className={mobileCard}>
                <button type="button" onClick={() => setMode("choose")} className="text-sm mb-3 min-h-[44px]" style={{ color: "#5C6853" }}>← Back</button>
                <h2 className="font-display text-xl mb-1" style={{ color: "#2C3625" }}>Admin Login</h2>
                <div className="text-sm mb-4" style={{ color: "#5C6853" }}>Sign in to your admin dashboard</div>
                <label className="label">Email</label>
                <input data-testid="admin-email-input" className="input mb-3 min-h-[44px] text-base" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@..." />
                <label className="label">Password</label>
                <input data-testid="admin-password-input" className="input mb-4 min-h-[44px] text-base" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
                {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded-lg mb-3">{err}</div>}
                <button data-testid="admin-submit-btn" disabled={loading} className="btn btn-primary w-full min-h-[44px]">
                  {loading ? <span className="spinner" /> : "Sign In"}
                </button>
              </form>
            )}
            {mode === "therapist" && (
              <form onSubmit={submitTherapist} className={mobileCard}>
                <button type="button" onClick={() => setMode("choose")} className="text-sm mb-3 min-h-[44px]" style={{ color: "#5C6853" }}>← Back</button>
                <h2 className="font-display text-xl mb-1" style={{ color: "#2C3625" }}>Therapist Login</h2>
                <div className="text-sm mb-4" style={{ color: "#5C6853" }}>Sign in with your work email and password</div>
                <label className="label">Email</label>
                <input data-testid="therapist-email-input" className="input mb-3 min-h-[44px] text-base" type="email" required autoFocus
                  placeholder="yourname@boostgrowthsa.com" value={tEmail} onChange={e => setTEmail(e.target.value)} />
                <label className="label">Password</label>
                <input data-testid="therapist-password-input" className="input mb-4 min-h-[44px] text-base" type="password" required
                  value={tPassword} onChange={e => setTPassword(e.target.value)} />
                {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded-lg mb-3">{err}</div>}
                <button data-testid="therapist-submit-btn" disabled={loading} className="btn btn-primary w-full min-h-[44px]">
                  {loading ? <span className="spinner" /> : "Sign In"}
                </button>
                <div className="text-center text-xs mt-3" style={{ color: "#8B9E7A" }}>First time? Ask admin for a temporary password.</div>
              </form>
            )}
          </div>

          <div className="hidden md:block">
            <div className={desktopCard}>
              {mode === "choose" && (
                <div className="stagger">
                  <div className="text-xs font-bold tracking-[0.25em]" style={{ color: "#8B9E7A" }}>WELCOME BACK 👋</div>
                  <h2 className="font-display text-2xl mt-1 mb-5" style={{ color: "#2C3625" }}>Sign in to continue</h2>
                  <button data-testid="login-as-admin-btn" onClick={() => setMode("admin")}
                    className="w-full mb-3 p-4 rounded-2xl text-white flex items-center gap-3 transition-all active:scale-[0.99] shadow-md min-h-[44px]"
                    style={{ background: "#7A8A6A" }}>
                    <ShieldCheck size={28} weight="duotone" />
                    <div className="flex-1 text-left">
                      <div className="font-bold">Admin / Supervisor</div>
                      <div className="text-xs opacity-80">Full access · All clients · Reports</div>
                    </div>
                    <ArrowRight size={20} />
                  </button>
                  <button data-testid="login-as-therapist-btn" onClick={() => setMode("therapist")}
                    className="w-full p-4 rounded-2xl flex items-center gap-3 transition-all active:scale-[0.99] min-h-[44px]"
                    style={{ background: "#F0E9D8", color: "#2C3625" }}>
                    <UserCircle size={28} weight="duotone" color="#7A8A6A" />
                    <div className="flex-1 text-left">
                      <div className="font-bold">I'm a Therapist</div>
                      <div className="text-xs" style={{ color: "#5C6853" }}>My clients · Session tools</div>
                    </div>
                    <ArrowRight size={20} />
                  </button>
                  <div className="text-center text-xs mt-5" style={{ color: "#8B9E7A" }}>boost-growthsa.com · Staff Access Only</div>
                </div>
              )}
              {mode === "admin" && (
                <form onSubmit={submitAdmin} className="stagger">
                  <button type="button" onClick={() => setMode("choose")} className="text-sm hover:underline mb-3" style={{ color: "#5C6853" }}>← Back</button>
                  <h2 className="font-display text-2xl mb-1" style={{ color: "#2C3625" }}>Admin Login</h2>
                  <div className="text-sm mb-5" style={{ color: "#5C6853" }}>Sign in to your admin dashboard</div>
                  <label className="label">Email</label>
                  <input data-testid="admin-email-input" className="input mb-3" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@..." />
                  <label className="label">Password</label>
                  <input data-testid="admin-password-input" className="input mb-4" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
                  {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded-lg mb-3">{err}</div>}
                  <button data-testid="admin-submit-btn" disabled={loading} className="btn btn-primary w-full min-h-[44px]">
                    {loading ? <span className="spinner" /> : "Sign In"}
                  </button>
                </form>
              )}
              {mode === "therapist" && (
                <form onSubmit={submitTherapist} className="stagger">
                  <button type="button" onClick={() => setMode("choose")} className="text-sm hover:underline mb-3" style={{ color: "#5C6853" }}>← Back</button>
                  <h2 className="font-display text-2xl mb-1" style={{ color: "#2C3625" }}>Therapist Login</h2>
                  <div className="text-sm mb-5" style={{ color: "#5C6853" }}>Sign in with your work email and password</div>
                  <label className="label">Email</label>
                  <input data-testid="therapist-email-input" className="input mb-3" type="email" required autoFocus
                    placeholder="yourname@boostgrowthsa.com" value={tEmail} onChange={e => setTEmail(e.target.value)} />
                  <label className="label">Password</label>
                  <input data-testid="therapist-password-input" className="input mb-4" type="password" required
                    value={tPassword} onChange={e => setTPassword(e.target.value)} />
                  {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded-lg mb-3">{err}</div>}
                  <button data-testid="therapist-submit-btn" disabled={loading} className="btn btn-primary w-full min-h-[44px]">
                    {loading ? <span className="spinner" /> : "Sign In"}
                  </button>
                  <div className="text-center text-xs mt-3" style={{ color: "#8B9E7A" }}>First time? Ask admin for a temporary password.</div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
