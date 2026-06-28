import { formatLocationLabel, getMapsHref } from "./mapsUtils";

export const WEEK_ROW_BG = ["#FFFFFF", "#FAF8F3", "#F5F0E6", "#EDE1C9"];

/** Sunday-start week index from anchor — consistent row banding in invoice sheets. */
export function sundayWeekIndex(sessionDateISO, anchorISO) {
  const key = normalizeSessionDateKey(sessionDateISO);
  const anchorKey = normalizeSessionDateKey(anchorISO) || key;
  if (!key || !anchorKey) return 0;
  const d = parseISO(key);
  const anchor = parseISO(anchorKey);
  const sessionSunday = new Date(d);
  sessionSunday.setDate(sessionSunday.getDate() - sessionSunday.getDay());
  const anchorSunday = new Date(anchor);
  anchorSunday.setDate(anchorSunday.getDate() - anchorSunday.getDay());
  const diffDays = Math.round((sessionSunday - anchorSunday) / 86400000);
  return Math.max(0, Math.floor(diffDays / 7));
}

export function rowBgForSession(session, anchorISO) {
  const idx = sundayWeekIndex(session?.session_date, anchorISO);
  return WEEK_ROW_BG[idx % WEEK_ROW_BG.length];
}

export function parseISO(iso) {
  if (!iso) return new Date();
  const key = normalizeSessionDateKey(iso);
  return new Date(`${key}T12:00:00`);
}

/** Canonical YYYY-MM-DD for sort/compare — handles ISO, DD/MM/YYYY, and loose strings. */
export function normalizeSessionDateKey(raw) {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s.slice(0, 10);
}

export function sessionDateSortKey(session) {
  const iso = normalizeSessionDateKey(session?.session_date);
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "9999-99-99";
  const t = new Date(`${iso}T12:00:00`).getTime();
  return Number.isNaN(t) ? iso : t;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function toISO(d) {
  return d.toISOString().slice(0, 10);
}

export function fmtDate(iso) {
  const dt = parseISO(iso);
  const d = dt.getDate();
  const m = dt.getMonth() + 1;
  const y = dt.getFullYear();
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

export function dayShort(iso) {
  return parseISO(iso).toLocaleDateString("en-US", { weekday: "short" });
}

export function dayNameFromDate(iso) {
  return parseISO(iso).toLocaleDateString("en-US", { weekday: "short" });
}

export function isSchoolDay(date) {
  const d = typeof date === "string" ? parseISO(date) : date;
  const wd = d.getDay();
  return wd >= 0 && wd <= 4;
}

export function fmtWeekRange(startISO, endISO) {
  if (!startISO) return "(upcoming)";
  const s = parseISO(startISO);
  const e = endISO ? parseISO(endISO) : s;
  const fmt = (dt) => `${dt.getDate()} ${dt.toLocaleDateString("en-US", { month: "short" })} ${dt.getFullYear()}`;
  return `${fmt(s)} - ${fmt(e)}`;
}

/** Therapists may edit only same-day sessions; ops/admin always. */
export function sessionEditableByUser(session, user, isOpsAdmin) {
  if (!session || !user) return false;
  if (isOpsAdmin) return true;
  if (user.role !== "therapist") return false;
  const today = new Date().toISOString().slice(0, 10);
  const d = (session.session_date || "").slice(0, 10);
  return d === today;
}

/** Default therapist(s) for a logged session by service type (HS = main, SS = co). */
export function resolveSessionTherapistIds(client, serviceType, currentUser, resolvedTherapistId = null) {
  if (currentUser?.role === "therapist") {
    const tid = resolvedTherapistId || currentUser.id;
    return tid ? [tid] : [];
  }
  if (!client) return [];
  const st = normalizeServiceTypeCode(serviceType) || "HS";
  const main = client.main_therapist_id;
  const cos = (client.co_therapist_ids || []).filter(Boolean);
  if (st === "SS") {
    if (cos.length) return [cos[0]];
    return main ? [main] : [];
  }
  if (main) return [main];
  return cos.length ? [cos[0]] : [];
}

/** SS: 4 blocks of 5 school days (Sun–Thu) from invoice start_date. */
export function computeSchoolWeekWindows(anchorISO, totalWeeks = 4) {
  if (!anchorISO) {
    return Array.from({ length: totalWeeks }, (_, i) => ({
      weekNumber: i + 1,
      startISO: null,
      endISO: null,
      dates: [],
      label: "(upcoming)",
    }));
  }
  const schoolDays = [];
  let d = parseISO(anchorISO);
  let guard = 0;
  while (schoolDays.length < totalWeeks * 5 && guard < 400) {
    if (isSchoolDay(d)) schoolDays.push(toISO(d));
    d = addDays(d, 1);
    guard += 1;
  }
  const weeks = [];
  for (let w = 0; w < totalWeeks; w++) {
    const chunk = schoolDays.slice(w * 5, w * 5 + 5);
    weeks.push({
      weekNumber: w + 1,
      startISO: chunk[0] || null,
      endISO: chunk[chunk.length - 1] || null,
      dates: chunk,
      label: chunk.length ? fmtWeekRange(chunk[0], chunk[chunk.length - 1]) : "(upcoming)",
    });
  }
  return weeks;
}

export function groupSessionsBySchoolWeeks(sessions, anchorISO, totalWeeks = 4) {
  const windows = computeSchoolWeekWindows(anchorISO, totalWeeks);
  const sorted = sortSessionsByDateAsc(sessions);
  const assigned = new Set();
  return windows.map((w, wi) => {
    const nextStart = windows[wi + 1]?.startISO;
    const inWeek = sorted.filter((s) => {
      if (!s?.id || assigned.has(s.id)) return false;
      const d = normalizeSessionDateKey(s.session_date);
      if (!d) return false;
      if (w.dates.includes(d)) {
        assigned.add(s.id);
        return true;
      }
      if (w.startISO && d >= w.startISO && (!nextStart || d < nextStart)) {
        assigned.add(s.id);
        return true;
      }
      return false;
    });
    return { ...w, sessions: inWeek };
  });
}

/** HS totals for ONE invoice only — Completed + Cancelled count toward used hours. */
export function computeHsInvoiceTotals(sessions, packageSize) {
  const pkg = parseFloat(packageSize) || 24;
  const billable = (sessions || []).filter(s => s.status === "Completed" || s.status === "Cancelled");
  const hoursUsed = billable.reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
  const hoursDelivered = (sessions || [])
    .filter(s => s.status === "Completed")
    .reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
  const hoursRemaining = Math.max(0, Math.round((pkg - hoursUsed) * 100) / 100);
  const noServiceCount = (sessions || []).filter(s => s.status === "No Service").length;
  const completedCount = (sessions || []).filter(s => s.status === "Completed").length;
  const noShowCount = (sessions || []).filter(s => s.status === "No Show").length;
  return {
    hoursUsed,
    hoursRemaining,
    hoursDelivered,
    pkg,
    noServiceCount,
    completedCount,
    noShowCount,
    totalSessions: (sessions || []).length,
  };
}

/** Keep only sessions belonging to a specific invoice (by id, source_invoice, or date window for orphans). */
export function filterSessionsForInvoice(sessions, invoice, allInvoices = []) {
  if (!invoice) return [];
  const invId = invoice.id;
  const invNum = (invoice.invoice_number || "").trim();
  const cid = invoice.client_id;
  const sorted = [...(allInvoices || [])]
    .filter(i => i.client_id === cid)
    .sort((a, b) => String(a.start_date || a.created_at || "").localeCompare(String(b.start_date || b.created_at || "")));

  const out = [];
  const seen = new Set();
  for (const s of sessions || []) {
    if (s.invoice_id && s.invoice_id !== invId) continue;
    if (invNum && (s.source_invoice || "").trim() && (s.source_invoice || "").trim() !== invNum && s.invoice_id) continue;
    if (s.invoice_id === invId || (invNum && (s.source_invoice || "").trim() === invNum)) {
      if (!seen.has(s.id)) {
        out.push(s);
        seen.add(s.id);
      }
    }
  }
  if (sorted.length) {
    for (const s of sessions || []) {
      if (seen.has(s.id)) continue;
      if (orphanBelongsToInvoice(s, invoice, sorted)) {
        out.push(s);
        seen.add(s.id);
      }
    }
  }
  return sortSessionsByDateAsc(out);
}

/** Numeric key from invoice_number (e.g. INV0490 → 490). */
export function invoiceNumberSortKey(inv) {
  const m = String(inv?.invoice_number || "").match(/inv[\s\-_]*(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

/** Chronological invoice order — highest INV number first (latest at top). */
export function sortInvoicesByRecent(invoiceList) {
  return [...(invoiceList || [])].sort((a, b) => {
    const na = invoiceNumberSortKey(a);
    const nb = invoiceNumberSortKey(b);
    if (na !== nb) return nb - na;
    const da = a.start_date || a.created_at || "";
    const db = b.start_date || b.created_at || "";
    return String(db).localeCompare(String(da));
  });
}

/** Oldest first (chronological — latest at bottom). */
export function sortSessionsByDateAsc(sessions) {
  return [...(sessions || [])].sort((a, b) => {
    const ka = sessionDateSortKey(a);
    const kb = sessionDateSortKey(b);
    if (ka !== kb) return ka < kb ? -1 : 1;
    const ta = String(a.start_time || "");
    const tb = String(b.start_time || "");
    if (ta !== tb) return ta.localeCompare(tb);
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

export function isSchoolWeekPeriodEnded(endISO) {
  if (!endISO) return false;
  const today = toISO(new Date());
  return today > String(endISO).slice(0, 10);
}

/** SS week status — active weeks only; past empty weeks stay Not started (e.g. Eid). */
export function resolveSsWeekStatus(weekWindow, attended, schoolDays, sessionCount, manualOverride = null) {
  const manual = manualOverride === "excluded" ? "open" : manualOverride;
  if (manual === "open") {
    return { weekStatus: "Open", countsAsDone: false, manual: true, overrideKey: "open" };
  }
  if (manual === "completed") {
    return { weekStatus: "Completed", countsAsDone: true, manual: true, overrideKey: "completed" };
  }
  if (!sessionCount) {
    return { weekStatus: "Not started", countsAsDone: false, manual: false, overrideKey: null };
  }
  if (isSchoolWeekPeriodEnded(weekWindow?.endISO)) {
    return { weekStatus: "Completed", countsAsDone: true, manual: false, overrideKey: null };
  }
  if (attended >= Math.min(5, schoolDays)) {
    return { weekStatus: "Completed", countsAsDone: true, manual: false, overrideKey: null };
  }
  return { weekStatus: "In Progress", countsAsDone: false, manual: false, overrideKey: null };
}

export function computeSsWeekSummary(sessions, anchorISO, totalWeeks = 4, weekOverrides = {}) {
  const groups = groupSessionsBySchoolWeeks(sessions, anchorISO, totalWeeks);
  const overrides = weekOverrides || {};
  return groups.map(w => {
    const attended = w.sessions.filter(s => s.status === "Completed").length;
    const schoolDays = w.dates.length || 5;
    const manual = overrides[String(w.weekNumber)] || overrides[w.weekNumber] || null;
    const resolved = resolveSsWeekStatus(w, attended, schoolDays, w.sessions.length, manual);
    return { ...w, attended, schoolDays, ...resolved };
  });
}

export function countSsWeeksDone(weekSummary) {
  return (weekSummary || []).filter(w => w.countsAsDone).length;
}

/** Admin tap cycle: Auto → force Closed → force Open → Auto */
export function nextWeekOverride(current) {
  const key = current === "excluded" ? "open" : current;
  if (!key) return "completed";
  if (key === "completed") return "open";
  return null;
}

export function mapPkgStatusToCard(status) {
  if (status === "critical") return "urgent";
  if (status === "low") return "warning";
  return "ok";
}

export function isSchoolService(serviceType) {
  if (!serviceType) return false;
  const s = String(serviceType).trim().toLowerCase();
  if (s === "ss") return true;
  if (s === "school support") return true;
  if (s.includes("school support")) return true;
  if (/^ss[\s/+]|[\s/+]ss$|[\s/+]ss[\s/+]/.test(s)) return true;
  return false;
}

export function isHomeService(serviceType) {
  if (!serviceType) return false;
  const s = String(serviceType).trim().toLowerCase();
  if (s === "hs") return true;
  if (s === "home session") return true;
  if (s.includes("home session")) return true;
  if (/^hs[\s/+]|[\s/+]hs$|[\s/+]hs[\s/+]/.test(s)) return true;
  return false;
}

/** Display label: HS, SS, Home Session, School Support, or HS+SS — never Arabic. */
export function formatServiceTypeDisplay(serviceType) {
  if (!serviceType) return null;
  const raw = String(serviceType).trim();
  const s = raw.toLowerCase();
  if (s === "ss" || s === "school support") return s === "ss" ? "SS" : "School Support";
  if (s === "hs" || s === "home session") return s === "hs" ? "HS" : "Home Session";
  if (isSchoolService(raw) && !isHomeService(raw)) {
    return s.includes("school support") ? "School Support" : "SS";
  }
  if (isHomeService(raw) && !isSchoolService(raw)) {
    return s.includes("home session") ? "Home Session" : "HS";
  }
  if (isHomeService(raw) && isSchoolService(raw)) {
    return raw.replace(/\s*\/\s*/g, " + ").replace(/\+/g, " + ");
  }
  return raw;
}

/** Billing mode from invoice filter code or invoice record. */
export function resolveClientBillingMode(client, invoice, serviceTypeCode) {
  if (serviceTypeCode === "SS") return "weeks";
  if (serviceTypeCode === "HS") return "hours";
  if (invoice) {
    const invSt = invoice.service_type;
    if (invSt) {
      if (isSchoolService(invSt)) return "weeks";
      if (isHomeService(invSt)) return "hours";
    }
    return "hours";
  }
  if (client?.billing_mode === "weeks") return "weeks";
  const cst = client?.service_type || "";
  if (cst === "SS") return "weeks";
  return "hours";
}

export function resolveCycleAnchor(client, invoice, sessions) {
  const iso = invoice?.start_date || client?.cycle_start_date;
  if (iso) return String(iso).slice(0, 10);
  const dated = (sessions || [])
    .filter(s => s.session_date)
    .map(s => s.session_date)
    .sort();
  if (dated.length) return dated[0];
  return toISO(new Date());
}

export function computeWeekWindows(anchorISO, cycleWeeks = 4) {
  const anchor = parseISO(anchorISO);
  const windows = [];
  for (let k = 0; k < cycleWeeks; k++) {
    const start = addDays(anchor, 7 * k);
    const end = addDays(start, 7);
    windows.push({
      weekNumber: k + 1,
      startISO: toISO(start),
      endISO: toISO(end),
      label: `${dayShort(toISO(start))} ${fmtDate(toISO(start))} → ${dayShort(toISO(end))} ${fmtDate(toISO(end))}`,
    });
  }
  return windows;
}

export function computeWeeksProgress(sessions, anchorISO, cycleWeeks = 4) {
  const windows = computeWeekWindows(anchorISO, cycleWeeks);
  const completed = (sessions || []).filter(s => s.status === "Completed" && s.session_date);
  const weeks = windows.map(w => {
    const inWeek = completed.filter(s => s.session_date >= w.startISO && s.session_date < w.endISO);
    return { ...w, hasSession: inWeek.length > 0, sessionCount: inWeek.length };
  });
  const weeksDone = weeks.filter(w => w.hasSession).length;
  let currentWeek = 1;
  for (const w of weeks) {
    if (w.hasSession) currentWeek = w.weekNumber;
  }
  if (weeksDone === 0) currentWeek = 1;
  else if (weeksDone >= cycleWeeks) currentWeek = cycleWeeks;
  else currentWeek = Math.min(cycleWeeks, weeksDone + 1);

  return {
    weeks,
    weeksDone,
    cycleWeeks,
    weeksRem: Math.max(0, cycleWeeks - weeksDone),
    currentWeek,
    pct: cycleWeeks ? Math.round((weeksDone / cycleWeeks) * 100) : 0,
  };
}

export function getWeeksUrgentStatus(weeksDone, cycleWeeks) {
  if (weeksDone >= cycleWeeks) return "urgent";
  if (weeksDone >= cycleWeeks - 1) return "urgent";
  if (weeksDone >= cycleWeeks - 2) return "warning";
  return "ok";
}

export function getHoursUrgentStatus(used, pkg) {
  const rem = pkg - used;
  const pct = rem / pkg;
  if (rem <= 0 || pct <= 0.2 || rem <= 2) return "urgent";
  if (pct <= 0.35 || rem <= 4) return "warning";
  return "ok";
}

export function ssSessionDayValue(session) {
  if (session.status === "Completed" || session.status === "No Show") return 1;
  return 0;
}

export function computeSsTotals(sessions) {
  const completed = sessions.filter(s => s.status === "Completed").length;
  const noShows = sessions.filter(s => s.status === "No Show").length;
  const noService = sessions.filter(s => s.status === "No Service").length;
  const used = completed + noShows;
  return { completed, noShows, noService, used, counted: used };
}

export function normalizeServiceTypeCode(serviceType) {
  if (!serviceType) return null;
  if (isSchoolService(serviceType) && !isHomeService(serviceType)) return "SS";
  if (isHomeService(serviceType) && !isSchoolService(serviceType)) return "HS";
  const s = String(serviceType).trim().toUpperCase();
  if (s === "HS" || s === "SS") return s;
  return null;
}

export function invoiceMatchesServiceType(invoice, code) {
  return normalizeServiceTypeCode(invoice?.service_type) === code;
}

/** Include legacy invoices without service_type so they are not hidden from the dropdown. */
export function filterInvoicesForServiceTab(invoices, serviceFilter, client) {
  if (!serviceFilter) return [...(invoices || [])];
  const profile = normalizeClientServiceType(client?.service_type);
  return (invoices || []).filter(inv => {
    const code = normalizeServiceTypeCode(inv.service_type);
    if (code === serviceFilter) return true;
    if (!code && !inv.service_type) {
      if (profile === "HS+SS") return true;
      if (profile === "HS") return serviceFilter === "HS";
      if (profile === "SS") return serviceFilter === "SS";
      return true;
    }
    return false;
  });
}

function invoiceWindowBounds(invoice, sortedClientInvoices) {
  const start = (invoice.start_date || invoice.created_at || "0000-00-00").slice(0, 10);
  let end = null;
  const idx = sortedClientInvoices.findIndex(i => i.id === invoice.id);
  if (idx >= 0 && idx + 1 < sortedClientInvoices.length) {
    const nxt = (sortedClientInvoices[idx + 1].start_date || "").slice(0, 10);
    if (nxt) end = nxt;
  }
  return { start, end };
}

function sessionHasInvoiceLink(s) {
  return !!(s.invoice_id || (s.source_invoice || "").trim());
}

function sessionInInvoiceDateWindow(s, invoice, sortedClientInvoices) {
  const d = normalizeSessionDateKey(s.session_date);
  if (!d) return false;
  const { start, end } = invoiceWindowBounds(invoice, sortedClientInvoices);
  const startKey = normalizeSessionDateKey(start) || start;
  if (d < startKey) return false;
  if (end) {
    const endKey = normalizeSessionDateKey(end) || end;
    if (d >= endKey) return false;
  }
  return true;
}

/** Orphan session belongs to this invoice only if not inside another invoice's bounded window. */
function orphanBelongsToInvoice(s, invoice, sortedClientInvoices) {
  if (sessionHasInvoiceLink(s)) return false;
  if (!sessionInInvoiceDateWindow(s, invoice, sortedClientInvoices)) return false;
  const d = normalizeSessionDateKey(s.session_date);
  for (const other of sortedClientInvoices) {
    if (other.id === invoice.id) continue;
    const { start, end } = invoiceWindowBounds(other, sortedClientInvoices);
    if (!end) continue;
    const startKey = normalizeSessionDateKey(start) || start;
    const endKey = normalizeSessionDateKey(end) || end;
    if (d >= startKey && d < endKey) return false;
  }
  return true;
}

export function clientHasServiceInvoices(invoices, code) {
  return (invoices || []).some(i => invoiceMatchesServiceType(i, code));
}

export function normalizeClientServiceType(serviceType) {
  if (!serviceType) return null;
  const raw = String(serviceType).trim();
  const compact = raw.toUpperCase().replace(/\s+/g, "");
  if (compact === "HS+SS" || compact === "HS/SS" || compact === "HS&SS") return "HS+SS";
  if (compact === "HS" || compact === "SS" || compact === "AVC") return compact;
  if (isHomeService(raw) && isSchoolService(raw)) return "HS+SS";
  if (isSchoolService(raw) && !isHomeService(raw)) return "SS";
  if (isHomeService(raw) && !isSchoolService(raw)) return "HS";
  return null;
}

/** Which HS/SS tabs are allowed from client profile (AVC → no HS/SS toggle). */
export function getServicesFromType(serviceType) {
  const t = normalizeClientServiceType(serviceType);
  if (t === "AVC") return ["AVC"];
  if (t === "HS+SS") return ["HS", "SS"];
  if (t === "HS") return ["HS"];
  if (t === "SS") return ["SS"];
  return ["HS", "SS"];
}

export function countServiceInvoices(invoices, code) {
  return (invoices || []).filter(i => invoiceMatchesServiceType(i, code)).length;
}

/** Which HS/SS tabs are allowed from client profile + locations. */
export function getClientProfileServices(client) {
  const fromType = getServicesFromType(client?.service_type);
  if (fromType.length === 1) return fromType;
  if (fromType.includes("HS") && fromType.includes("SS")) return ["HS", "SS"];

  const locCodes = new Set();
  for (const loc of client?.locations || []) {
    const c = normalizeServiceTypeCode(loc?.service);
    if (c === "HS" || c === "SS") locCodes.add(c);
  }
  if (locCodes.size) {
    const out = [];
    if (locCodes.has("HS")) out.push("HS");
    if (locCodes.has("SS")) out.push("SS");
    return out;
  }
  if (fromType.length) return fromType;
  return ["HS"];
}

/** Tab enable/disable from client profile + locations (not invoice existence). */
export function resolveServiceTabState(client, allInvoices) {
  const profileServices = getClientProfileServices(client);
  const clientType = normalizeClientServiceType(client?.service_type);
  const hsCount = countServiceInvoices(allInvoices, "HS");
  const ssCount = countServiceInvoices(allInvoices, "SS");
  const profileHasHS = profileServices.includes("HS");
  const profileHasSS = profileServices.includes("SS");
  const showToggle = profileHasHS && profileHasSS;

  return {
    clientType,
    profileServices,
    showToggle,
    hsCount,
    ssCount,
    profileHasHS,
    profileHasSS,
    hsClickable: profileHasHS,
    ssClickable: profileHasSS,
    hsLegacy: false,
    ssLegacy: false,
    hsDisabled: !profileHasHS,
    ssDisabled: !profileHasSS,
  };
}

function pickDefaultByOpenAndRecency(allInvoices, fallback) {
  const openHS = (allInvoices || []).filter(
    i => !i.is_closed && normalizeServiceTypeCode(i.service_type) === "HS"
  );
  const openSS = (allInvoices || []).filter(
    i => !i.is_closed && normalizeServiceTypeCode(i.service_type) === "SS"
  );
  if (openHS.length && !openSS.length) return "HS";
  if (openSS.length && !openHS.length) return "SS";
  if (openHS.length && openSS.length) return "HS";

  const sorted = [...(allInvoices || [])].sort((a, b) => {
    const da = a.start_date || a.created_at || "";
    const db = b.start_date || b.created_at || "";
    return String(db).localeCompare(String(da));
  });
  for (const inv of sorted) {
    const c = normalizeServiceTypeCode(inv.service_type);
    if (c === "HS" || c === "SS") return c;
  }
  return fallback;
}

export function inferDefaultServiceType(allInvoices, client, user, sessions) {
  const tab = resolveServiceTabState(client, allInvoices);
  const { clientType, profileHasHS, profileHasSS } = tab;

  if (clientType === "AVC") return null;

  // Client profile is source of truth for default tab
  if (clientType === "SS") return "SS";
  if (clientType === "HS") return "HS";

  if (clientType === "HS+SS") {
    return pickDefaultByOpenAndRecency(allInvoices, "HS");
  }

  // null/empty profile — both tabs available
  if (tab.hsCount > 0 && tab.ssCount === 0) return "HS";
  if (tab.ssCount > 0 && tab.hsCount === 0) return "SS";
  if (tab.hsCount === 0 && tab.ssCount === 0) {
    return profileHasSS && !profileHasHS ? "SS" : "HS";
  }
  return pickDefaultByOpenAndRecency(allInvoices, profileHasHS ? "HS" : "SS");
}

export function pickLatestOpenInvoice(invoiceList) {
  const sorted = sortInvoicesByRecent(invoiceList);
  const open = sorted.filter(i => !i.is_closed);
  return open[0] || sorted[0] || null;
}

/** Group HS sessions by calendar month (YYYY-MM), oldest → newest. */
export function groupSessionsByMonth(sessions) {
  const buckets = new Map();
  for (const s of sortSessionsByDateAsc(sessions)) {
    const key = normalizeSessionDateKey(s.session_date);
    if (!key || key.length < 7) continue;
    const monthKey = key.slice(0, 7);
    if (!buckets.has(monthKey)) buckets.set(monthKey, []);
    buckets.get(monthKey).push(s);
  }
  return Array.from(buckets.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

export function formatMonthLabel(monthKey) {
  if (!monthKey) return "";
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function hasOpenInvoice(invoiceList) {
  return (invoiceList || []).some(i => !i.is_closed);
}

export function groupSessionsByWeeks(sessions, anchorISO, cycleWeeks = 4) {
  const windows = computeWeekWindows(anchorISO, cycleWeeks);
  const sorted = [...(sessions || [])].sort((a, b) =>
    String(a.session_date).localeCompare(String(b.session_date))
  );
  const groups = windows.map(w => ({
    ...w,
    sessions: sorted.filter(s => s.session_date >= w.startISO && s.session_date < w.endISO),
  }));
  const lastEnd = windows[windows.length - 1]?.endISO;
  const extra = lastEnd ? sorted.filter(s => s.session_date >= lastEnd) : [];
  if (extra.length) {
    groups.push({
      weekNumber: cycleWeeks + 1,
      startISO: lastEnd,
      extra: true,
      label: `After week ${cycleWeeks}`,
      sessions: extra,
    });
  }
  return groups;
}

export function enrichClientFromPackageStatus(client, packageRows) {
  const rows = (packageRows || []).filter(r => r.client_id === client.id);
  const clientType = normalizeClientServiceType(client.service_type);
  const serviceDisplay = formatServiceTypeDisplay(client.service_type) || "—";

  const hs = rows.find(r => r.service_type === "HS");
  const ss = rows.find(r => r.service_type === "SS");
  let primary = hs;
  if (clientType === "SS") primary = ss || hs;
  else if (clientType === "HS+SS") primary = hs || ss;
  else if (clientType === "HS") primary = hs || ss;

  if (!primary || primary.status === "none") {
    const isWeeks = clientType === "SS";
    const payStatus = primary?.payment_status ?? client.payment_status ?? "pending";
    const pkgEnd = primary?.package_end_date ?? client.package_end_date;
    return {
      ...client,
      payment_status: payStatus,
      package_end_date: pkgEnd,
      billing_mode: isWeeks ? "weeks" : "hours",
      serviceDisplay,
      status: "ok",
      used: 0,
      pkg: isWeeks ? 4 : (client.package_hours || 24),
      rem: isWeeks ? 4 : (client.package_hours || 24),
      pct: 0,
      weeksDone: 0,
      currentWeek: 1,
      cycleWeeks: 4,
      weeksRem: 4,
      pkgRows: rows,
    };
  }

  const status = mapPkgStatusToCard(primary.status);

  if (primary.service_type === "HS" || primary.unit === "hours") {
    const pkg = primary.package_size ?? 24;
    const used = primary.used ?? 0;
    const rem = Math.max(0, primary.remaining ?? 0);
    return {
      ...client,
      payment_status: primary.payment_status ?? client.payment_status ?? "pending",
      package_end_date: primary.package_end_date ?? client.package_end_date,
      billing_mode: "hours",
      serviceDisplay,
      used,
      pkg,
      rem,
      pct: pkg > 0 ? Math.min(100, Math.round((used / pkg) * 100)) : 0,
      status,
      weeksDone: 0,
      currentWeek: 0,
      cycleWeeks: 0,
      weeksRem: 0,
      pkgRows: rows,
    };
  }

  const cycleWeeks = primary.total_weeks ?? 4;
  const weeksDone = primary.used ?? 0;
  const weeksRem = primary.remaining ?? 0;
  return {
    ...client,
    payment_status: primary.payment_status ?? client.payment_status ?? "pending",
    package_end_date: primary.package_end_date ?? client.package_end_date,
    billing_mode: "weeks",
    serviceDisplay,
    weeksDone,
    currentWeek: primary.current_week ?? 1,
    cycleWeeks,
    weeksRem,
    pct: cycleWeeks > 0 ? Math.min(100, Math.round((weeksDone / cycleWeeks) * 100)) : 0,
    status,
    used: 0,
    pkg: 0,
    rem: 0,
    pkgRows: rows,
  };
}

const PKG_URGENCY_ORDER = { critical: 0, expired: 1, low: 2, good: 3, none: 4 };

export function clientInitials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export function worstPkgStatus(rows) {
  const statuses = (rows || []).map(r => r?.status).filter(s => s && s !== "none");
  if (!statuses.length) return "none";
  return statuses.sort((a, b) => (PKG_URGENCY_ORDER[a] ?? 9) - (PKG_URGENCY_ORDER[b] ?? 9))[0];
}

export function mapPkgStatusToCardStatus(pkgStatus) {
  if (pkgStatus === "critical" || pkgStatus === "expired") return "urgent";
  if (pkgStatus === "low") return "warning";
  return "ok";
}

export function cardStatusMeta(cardStatus) {
  if (cardStatus === "urgent") {
    return { label: "Invoice Now", bg: "#FCE0E8", color: "#8B3A55", border: "#E8A0B8", bar: "#C97B5C" };
  }
  if (cardStatus === "warning") {
    return { label: "Nearing End", bg: "#FAF0D1", color: "#6B5218", border: "#E5C387", bar: "#D4A64A" };
  }
  return { label: "Safe", bg: "#EDE1C9", color: "#2F4A35", border: "#C9C0A8", bar: "#6B8F71" };
}

/** Progress ring / bar for preparation cards (HS hours or SS weeks). */
export function prepTrackMeta(client) {
  if (client?.hasHs && client.hsProgress) {
    const used = Number(client.hsProgress?.used) || 0;
    const pkg = client.hsProgress?.pkg ?? 24;
    const remaining = Number(client.hsProgress?.remaining) || 0;
    return {
      pct: client.hsProgress?.pct ?? 0,
      label: `Home Session · ${used.toFixed(1)}h of ${pkg}h`,
      sub: `${remaining.toFixed(1)}h remaining`,
      service: "HS",
    };
  }
  if (client?.hasSs && client.ssWeeks?.length) {
    const done = client.ssWeeks.filter(w => w.weekStatus === "Completed").length;
    const total = client.ssWeeks.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const current = client.ssWeeks.find(w => w.weekStatus === "In Progress")
      || client.ssWeeks.find(w => w.weekStatus === "Not started");
    return {
      pct,
      label: `School Support · ${done}/${total} weeks done`,
      sub: current ? `Week ${current.weekNumber} · ${current.weekStatus}` : client.ssAlert || "",
      service: "SS",
    };
  }
  return { pct: 0, label: "No open package", sub: "", service: client?.locationService || "HS" };
}

export function ssWeekAlertText(ssRow) {
  if (!ssRow || !["critical", "low"].includes(ssRow.status)) return null;
  const wk = ssRow.current_week || ssRow.total_weeks || 4;
  if (ssRow.status === "critical") return `Week ${wk} → Issue invoice now`;
  return `${ssRow.remaining ?? 0} week(s) remaining`;
}

/** Card view: HS + SS progress, week boxes, combined urgency. */
export function enrichClientForCardView(client, packageRows) {
  const base = enrichClientFromPackageStatus(client, packageRows);
  const rows = (packageRows || []).filter(r => r.client_id === client.id);
  const hsRow = rows.find(r => r.service_type === "HS") || null;
  const ssRow = rows.find(r => r.service_type === "SS") || null;
  const worst = worstPkgStatus([hsRow, ssRow]);
  const cardStatus = mapPkgStatusToCardStatus(worst);

  const ssWeeks = ssRow?.week_summary || null;

  let hsProgress = null;
  if (hsRow?.status && hsRow.status !== "none") {
    const pkg = hsRow.package_size ?? 24;
    const used = hsRow.used ?? 0;
    hsProgress = {
      used,
      pkg,
      remaining: hsRow.remaining ?? 0,
      pct: pkg > 0 ? Math.min(100, Math.round((used / pkg) * 100)) : 0,
      status: hsRow.status,
    };
  }

  const locEntry = client.locations?.find(l => l.service === "HS") || client.locations?.[0];
  const profileServices = getClientProfileServices(client);
  const rawLocation = locEntry?.address || client.address || "";
  return {
    ...base,
    cardStatus,
    status: cardStatus,
    hsRow,
    ssRow,
    ssWeeks,
    hsProgress,
    hasSs: profileServices.includes("SS") && Boolean(ssRow?.status && ssRow.status !== "none"),
    hasHs: profileServices.includes("HS") && Boolean(hsRow?.status && hsRow.status !== "none"),
    location: formatLocationLabel(rawLocation) || rawLocation,
    locationHref: rawLocation ? getMapsHref(rawLocation) : null,
    locationService: locEntry?.service || "",
    initials: clientInitials(client.name),
    ssAlert: ssWeekAlertText(ssRow),
  };
}

/** @deprecated Use enrichClientFromPackageStatus — sums hours across all invoices. */
export function enrichClientBilling(client, sessions) {
  const mode = resolveClientBillingMode(client, null);
  const cycleWeeks = client.cycle_weeks || 4;
  const serviceDisplay = formatServiceTypeDisplay(client.service_type) || "—";

  if (mode === "weeks") {
    const resetAt = client.package_reset_at;
    const scoped = (sessions || []).filter(s => {
      if (s.client_id !== client.id) return false;
      if (!resetAt) return true;
      return s.session_date && s.session_date >= resetAt.slice(0, 10);
    });
    const anchor = resolveCycleAnchor(client, null, scoped);
    const prog = computeWeeksProgress(scoped, anchor, cycleWeeks);
    const status = getWeeksUrgentStatus(prog.weeksDone, cycleWeeks);
    return {
      ...client,
      billing_mode: "weeks",
      serviceDisplay,
      weeksDone: prog.weeksDone,
      currentWeek: prog.currentWeek,
      cycleWeeks,
      weeksRem: prog.weeksRem,
      pct: prog.pct,
      status,
      used: 0,
      pkg: 0,
      rem: 0,
    };
  }

  const used = (sessions || [])
    .filter(s => s.client_id === client.id && s.status === "Completed")
    .filter(s => !client.package_reset_at || (s.session_date && s.session_date >= client.package_reset_at.slice(0, 10)))
    .reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
  const pkg = client.package_hours || 24;
  const rem = Math.max(0, pkg - used);
  return {
    ...client,
    billing_mode: "hours",
    serviceDisplay,
    used,
    pkg,
    rem,
    pct: Math.min(100, Math.round((used / pkg) * 100)),
    status: getHoursUrgentStatus(used, pkg),
    weeksDone: 0,
    currentWeek: 0,
    cycleWeeks: 0,
    weeksRem: 0,
  };
}
