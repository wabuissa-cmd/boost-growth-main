import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "./api";
import { clearDataCache } from "./dataCache";

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
    await refresh();
    return data;
  };
  const loginTherapist = async (therapist_id, pin) => {
    const { data } = await api.post("/auth/therapist-login", { therapist_id, pin });
    if (data.token) localStorage.setItem("bg_token", data.token);
    await refresh();
    return data;
  };
  const loginTherapistEmail = async (email, password) => {
    const { data } = await api.post("/auth/therapist-email-login", { email, password });
    if (data.token) localStorage.setItem("bg_token", data.token);
    await refresh();
    return data;
  };
  const changePassword = async (old_password, new_password) => {
    await api.post("/auth/change-password", { old_password, new_password });
    setUser(u => (u ? { ...u, must_change_password: false } : u));
  };
  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (_e) { /* ignore */ }
    localStorage.removeItem("bg_token");
    clearDataCache();
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
  "wabuissa@boostgrowthsa.com",
  "walaa@boostgrowthsa.com",
  "msalthunayan@boostgrowthsa.com",
  "falghadeeb@boostgrowthsa.com",
  "jsalmuhaisin@boostgrowthsa.com",
]);
const HR_OPS_EMAILS = new Set(["hr@boostgrowthsa.com"]);

function _matchesClientLead(user) {
  const email = (user.email || "").toLowerCase().trim();
  if (CLIENT_LEAD_EMAILS.has(email)) return true;
  const key = (user.key || "").toLowerCase();
  if (FULL_CLIENT_KEYS.has(key)) return true;
  const first = (user.name || "").replace(/^Ms\.?\s*/i, "").split(/\s+/)[0]?.toLowerCase();
  return FULL_CLIENT_NAMES.has(first);
}

/** Walaa, Maha, Jenan, Fahda — therapist UI, all clients visible */
export function isClientLead(user) {
  if (!user) return false;
  if (user.client_lead) return true;
  return _matchesClientLead(user);
}

/** HR operations account — billing, clients, import, staff requests (not technical admin) */
export function isHrOps(user) {
  if (!user) return false;
  if (user.hr_ops) return true;
  return HR_OPS_EMAILS.has((user.email || "").toLowerCase().trim());
}

/** Portal admin + HR + Walaa — billing edit, schedule edit, attendance ops UI */
export function hasOpsAccess(user) {
  return isPortalAdmin(user) || isHrOps(user) || isWalaaOps(user);
}

/** Client billing dashboard — ops team + Jenan (read-only invoice view) */
export function canViewBilling(user) {
  return hasOpsAccess(user) || isJenan(user);
}

/** All active clients in Client Info (portal admin + HR + client-lead team) */
export function hasFullClientAccess(user) {
  if (!user) return false;
  if (isPortalAdmin(user)) return true;
  if (isHrOps(user)) return true;
  return isClientLead(user);
}

/** Supervision caseload page — ops leads + admin + HR */
export function canViewSupervisionCaseload(user) {
  return hasFullClientAccess(user);
}

/** Email admin login — technical portal admin only (excludes HR ops) */
export function isPortalAdmin(user) {
  if (!user) return false;
  if (user.portal_admin) return true;
  return user?.role === "admin" && !isClientLead(user) && !isHrOps(user);
}

/** Admin nav + dashboard (portal admin + Walaa ops) */
export function showAdminNav(user) {
  return isPortalAdmin(user) || isWalaaOps(user);
}

/** @deprecated use isPortalAdmin for admin nav; hasOpsAccess for client tools */
export function isStaffAdmin(user) {
  return isPortalAdmin(user) || hasOpsAccess(user);
}

const JENAN_EMAILS = new Set([
  "jsalmuhaisin@boostgrowthsa.com",
  "jenan@boostgrowthsa.com",
  "genan@boostgrowthsa.com",
]);
const JENAN_KEYS = new Set(["msjenan"]);

/** Jenan — leave/absence/balance HR in addition to ops-lead tools */
export function isJenan(user) {
  if (!user) return false;
  if (user.jenan_hr) return true;
  const email = (user.email || "").toLowerCase().trim();
  if (JENAN_EMAILS.has(email)) return true;
  const key = (user.key || "").toLowerCase();
  if (JENAN_KEYS.has(key)) return true;
  const first = (user.name || "").replace(/^Ms\.?\s*/i, "").split(/\s+/)[0]?.toLowerCase();
  return first === "jenan";
}

/** Walaa, Maha, Fahda — ops leads without Jenan's leave powers */
export function isOpsLead(user) {
  return isClientLead(user) && !isJenan(user);
}

export function canManageLeaves(user) {
  if (!user) return false;
  if (user.can_manage_leaves) return true;
  return isJenan(user);
}

/** Manager Hub — Jenan queue; portal admin / Walaa ops for temporary review access */
export function canAccessManagerHub(user) {
  if (!user) return false;
  if (user.can_access_manager_hub) return true;
  return isJenan(user) || showSystemAdmin(user);
}

export function canManagePurchaseStatus(user) {
  return isJenan(user) || isClientLead(user) || isPortalAdmin(user) || isHrOps(user) || isWalaaOps(user);
}

export function canSupervisorReviewPurchases(user) {
  return (isClientLead(user) && !isJenan(user)) || isPortalAdmin(user) || isHrOps(user) || isWalaaOps(user);
}

export function canManagerFinalizePurchases(user) {
  return isJenan(user) || isPortalAdmin(user);
}

/** Reports & analytics — portal admin, Walaa ops, HR ops, Jenan */
export function canViewReports(user) {
  if (!user) return false;
  if (user.can_view_reports) return true;
  return showSystemAdmin(user) || isHrOps(user) || isJenan(user);
}

/** Training assessment results — ops leads + anyone with reports access */
export function canViewCenterTests(user) {
  if (!user) return false;
  if (user.can_view_reports) return true;
  return showSystemAdmin(user) || isHrOps(user) || isJenan(user) || isWalaaOps(user) || isClientLead(user);
}

/** Training Tests sidebar link — admin/ops leads; hidden for Jenan (Reports page is enough) */
export function showTrainingTestsNav(user) {
  if (!user || isJenan(user)) return false;
  if (user.can_view_reports) return true;
  return showSystemAdmin(user) || isHrOps(user) || isWalaaOps(user) || isOpsLead(user);
}

/** My Learning — therapists, Walaa, and client-lead team */
export function showAcademicPortfolioNav(user) {
  if (!user || isHrOps(user)) return false;
  if (isPortalAdmin(user) && !isClientLead(user) && !isWalaaOps(user)) return false;
  return user.role === "therapist" || isWalaaOps(user) || isClientLead(user);
}

/** Purchases page — Jenan, Walaa, Maha, Fahda + HR + portal admin */
export function canAccessPurchases(user) {
  return hasOpsAccess(user) || isClientLead(user);
}

/** Finance nav — Staff Payments (Jenan) vs Purchases (ops/admin) */
export function purchasesNavLabel(user) {
  return isJenan(user) ? "Staff Payments" : "Purchases";
}

/** Clinical sidebar section — intake queues and/or supervision caseload */
export function canViewClinicalNav(user) {
  return canEditIntake(user) || canViewSupervisionCaseload(user);
}

export function canHrReviewLeaves(user) {
  if (!user) return false;
  if (user.can_hr_review_leaves) return true;
  return isHrOps(user);
}

export function canEditStaffRequests(user) {
  if (!user) return false;
  if (user.can_edit_staff_requests) return true;
  return isJenan(user) || isHrOps(user);
}

/** Delete individual leave / staff requests (Walaa ops, portal admin, Jenan) */
export function canDeleteStaffRequests(user) {
  if (!user) return false;
  return showSystemAdmin(user) || isJenan(user);
}

export function canEditIntake(user) {
  if (!user) return false;
  if (user.can_edit_intake) return true;
  return isPortalAdmin(user) || isClientLead(user) || isHrOps(user);
}

export function canEditOwnSchedule(user) {
  return isPortalAdmin(user) || isClientLead(user);
}

export function showSystemAdmin(user) {
  return isPortalAdmin(user) || isWalaaOps(user);
}

export function canImportData(user) {
  if (!user) return false;
  if (user.can_import) return true;
  return isPortalAdmin(user) || isWalaaOps(user);
}

/** UI label for Jenan as direct manager in leave/request workflows */
export function directManagerLabel() {
  return "Direct Manager";
}

/** Sidebar / header role subtitle after login */
export function profileRoleLabel(user) {
  if (!user) return "";
  if (isHrOps(user)) return "HR";
  if (isWalaaOps(user)) return "Coordination";
  if (isJenan(user)) return directManagerLabel();
  if (showAdminNav(user)) return "Admin";
  return "Therapist";
}

const WALAA_EMAILS = new Set(["wabuissa@boostgrowthsa.com", "walaa@boostgrowthsa.com"]);
const WALAA_KEYS = new Set(["mswalaa"]);

/** Walaa operations — parent cancellation WhatsApp workflow */
export function isWalaaOps(user) {
  if (!user) return false;
  if (user.walaa_ops) return true;
  const email = (user.email || "").toLowerCase().trim();
  if (WALAA_EMAILS.has(email)) return true;
  const key = (user.key || "").toLowerCase();
  if (WALAA_KEYS.has(key)) return true;
  const first = (user.name || "").replace(/^Ms\.?\s*/i, "").split(/\s+/)[0]?.toLowerCase();
  return first === "walaa";
}

export function canParentCancellationOps(user) {
  if (!user) return false;
  if (user.can_parent_cancellation_ops) return true;
  return isPortalAdmin(user) || isHrOps(user) || isWalaaOps(user);
}

/** My Request / My Report nav — all therapist logins including client-lead team & Walaa */
export function showMyPortalNav(user) {
  if (!user || isHrOps(user)) return false;
  if (isPortalAdmin(user) && !isClientLead(user) && !isWalaaOps(user)) return false;
  return user.role === "therapist" || isWalaaOps(user);
}

/** My Report nav — hidden for Jenan (no clinical cases; Reports page is enough) */
export function showMyReportsNav(user) {
  if (!user || isJenan(user)) return false;
  return showMyPortalNav(user);
}
