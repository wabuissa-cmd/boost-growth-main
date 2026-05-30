/** Attendance / invoice billing helpers — home (hours) vs school (4-week cycle). */

export const WEEK_ROW_BG = ["#FFFFFF", "#F6F9F3", "#EDF4E8", "#E4EDE0"];

export function parseISO(iso) {
  if (!iso) return new Date();
  return new Date(`${String(iso).slice(0, 10)}T12:00:00`);
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
  return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
}

export function dayShort(iso) {
  return parseISO(iso).toLocaleDateString("en-US", { weekday: "short" });
}

export function isSchoolService(serviceType) {
  if (!serviceType) return false;
  const s = String(serviceType).toLowerCase();
  if (s.includes("school")) return true;
  if (s === "ss") return true;
  if (s.includes("ss") && !s.includes("hs")) return true;
  return false;
}

export function isHomeService(serviceType) {
  if (!serviceType) return false;
  const s = String(serviceType).toLowerCase();
  if (s.includes("home")) return true;
  if (s === "hs") return true;
  if (s.includes("hs") && !s.includes("ss")) return true;
  return false;
}

export function resolveClientBillingMode(client, invoice) {
  if (invoice?.service_type) {
    if (isSchoolService(invoice.service_type)) return "weeks";
    if (isHomeService(invoice.service_type)) return "hours";
  }
  if (client?.billing_mode === "weeks") return "weeks";
  const st = client?.service_type || "";
  if (st === "SS") return "weeks";
  return client?.billing_mode || "hours";
}

export function serviceTypeLabel(serviceType, billingMode) {
  const school = billingMode === "weeks" || isSchoolService(serviceType);
  if (school) {
    return { en: "School Support (SS)", ar: "مدرسية", school: true };
  }
  return { en: "Home Session (HS)", ar: "منزلية", school: false };
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

/** Urgent when week 3 is done and entering week 4 (last week of cycle). */
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

export function enrichClientBilling(client, sessions) {
  const mode = resolveClientBillingMode(client, null);
  const cycleWeeks = client.cycle_weeks || 4;

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
      serviceLabel: serviceTypeLabel(client.service_type, "weeks"),
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
    serviceLabel: serviceTypeLabel(client.service_type, "hours"),
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
