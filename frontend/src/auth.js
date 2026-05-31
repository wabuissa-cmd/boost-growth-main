import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=loading, false=guest
  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(false);
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const loginAdmin = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.token) localStorage.setItem("bg_token", data.token);
    setUser(data);
    return data;
  };
  const loginTherapist = async (therapist_id, pin) => {
    const { data } = await api.post("/auth/therapist-login", { therapist_id, pin });
    if (data.token) localStorage.setItem("bg_token", data.token);
    setUser(data);
    return data;
  };
  const loginTherapistEmail = async (email, password) => {
    const { data } = await api.post("/auth/therapist-email-login", { email, password });
    if (data.token) localStorage.setItem("bg_token", data.token);
    setUser(data);
    return data;
  };
  const changePassword = async (old_password, new_password) => {
    await api.post("/auth/change-password", { old_password, new_password });
    setUser(u => (u ? { ...u, must_change_password: false } : u));
  };
  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (_e) { /* ignore */ }
    localStorage.removeItem("bg_token");
    setUser(false);
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, loginAdmin, loginTherapist, loginTherapistEmail, changePassword, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

const FULL_CLIENT_KEYS = new Set(["mswalaa", "msmaha", "msjenan", "msfahda"]);
const FULL_CLIENT_NAMES = new Set(["walaa", "maha", "jenan", "fahda"]);
const CLIENT_LEAD_EMAILS = new Set([
  "walaa@boostgrowthsa.com",
  "msalthunayan@boostgrowthsa.com",
  "falghadeeb@boostgrowthsa.com",
  "jsalmuhaisin@boostgrowthsa.com",
]);

function _matchesClientLead(user) {
  const email = (user.email || "").toLowerCase().trim();
  if (CLIENT_LEAD_EMAILS.has(email)) return true;
  const key = (user.key || "").toLowerCase();
  if (FULL_CLIENT_KEYS.has(key)) return true;
  const first = (user.name || "").replace(/^Ms\.?\s*/i, "").split(/\s+/)[0]?.toLowerCase();
  return FULL_CLIENT_NAMES.has(first);
}

/** Walaa, Maha, Jenan, Fahda — therapist UI, all clients, schedule edit */
export function isClientLead(user) {
  if (!user) return false;
  if (user.ops_access) return true;
  return _matchesClientLead(user);
}

/** Walaa, Maha, Jenan, Fahda + admin — all clients, schedule edit, attendance */
export function hasOpsAccess(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return isClientLead(user);
}

/** Email admin login — intake, reports, import, staff requests, leave management */
export function isPortalAdmin(user) {
  return user?.role === "admin" && !isClientLead(user);
}

/** Admin nav + dashboard (excludes client-lead team even if role is admin) */
export function showAdminNav(user) {
  return isPortalAdmin(user);
}

/** @deprecated use isPortalAdmin for admin nav; hasOpsAccess for client tools */
export function isStaffAdmin(user) {
  return isPortalAdmin(user) || hasOpsAccess(user);
}

/** @deprecated alias */
export function hasFullClientAccess(user) {
  return hasOpsAccess(user);
}
