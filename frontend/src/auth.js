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

/** Walaa, Maha, Jenan, Fahda + admin — see all clients and full ops access */
export function hasOpsAccess(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.staff_admin || user.ops_access) return true;
  const key = (user.key || "").toLowerCase();
  if (FULL_CLIENT_KEYS.has(key)) return true;
  const first = (user.name || "").replace(/^Ms\.?\s*/i, "").split(/\s+/)[0]?.toLowerCase();
  return FULL_CLIENT_NAMES.has(first);
}

/** Admin or ops team — full schedule, attendance, clients, reports */
export function isStaffAdmin(user) {
  return user?.role === "admin" || hasOpsAccess(user);
}

/** @deprecated alias */
export function hasFullClientAccess(user) {
  return hasOpsAccess(user);
}
