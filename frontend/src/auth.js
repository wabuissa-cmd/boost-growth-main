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
