/** Excel column order — 28 Jun 2026 sheet (Ms. Maha, Ms. Fahda, then rest). */
export const THERAPIST_SCHEDULE_ORDER = [
  "msmaha", "msfahda", "msrazan", "msmanal", "mshajer", "msrahaf",
  "msshatha", "msalhanouf", "mswaad", "msfatimah", "msshoroq",
  "msabeer", "msnajla", "msasma", "msbodoor", "msjenan", "mswalaa",
];

/** Canonical display labels — same spelling everywhere (schedule, clients, directory). */
export const THERAPIST_DISPLAY_NAMES = {
  msabeer: "Ms. Abeer",
  msalhanouf: "Ms. Alhanouf",
  msbodoor: "Ms. Bodour",
  msfahda: "Ms. Fahda",
  msfatimah: "Ms. Fatimah",
  mshajer: "Ms. Hajar",
  msjenan: "Ms. Jenan",
  msmaha: "Ms. Maha",
  msmanal: "Ms. Manal",
  msnajla: "Ms. Najla",
  msrahaf: "Ms. Rahaf",
  msrazan: "Ms. Razan",
  msasma: "Ms. Asma",
  msshatha: "Ms. Shatha",
  msshoroq: "Ms. Shroug",
  mswaad: "Ms. Waad",
  mswalaa: "Ms. Walaa",
};

/** Family names for full schedule display (First + Family). */
export const THERAPIST_FAMILY_NAMES = {
  msMaha: "Althunayan",
  msFahda: "Alghadeeb",
  msRazan: "Alshatery",
  msManal: "Aldosery",
  msAsma: "Ahmed",
  msHajer: "Alfulaij",
  msRahaf: "Aljuhani",
  msShatha: "Alhammami",
  msAlhanouf: "Alromman",
  msWaad: "Alhamed",
  msNajla: "Alhamad",
  msBodoor: "Alkhlifah",
  msFatimah: "Alkhater",
  msShrooq: "Alamri",
  msAbeer: "Alshareef",
  msJenan: "Almuhaisin",
  msWalaa: "Abu Eissa",
};

/** Supervisors who only see their own block in My schedule view. */
export const SCHEDULE_OWN_BLOCK_KEYS = new Set(["msmaha", "msfahda", "mswalaa", "msjenan"]);

export function therapistFamilyName(key) {
  if (!key) return null;
  const lower = String(key).toLowerCase();
  for (const [k, v] of Object.entries(THERAPIST_FAMILY_NAMES)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}

/** First-name spelling overrides (client info source of truth). */
const THERAPIST_FIRST_NAME_OVERRIDES = {
  shrooq: "Shroug",
  shroug: "Shroug",
  bodoor: "Bodour",
  hajer: "Hajar",
};

function familyByFirstName(first) {
  const fl = (first || "").toLowerCase();
  if (!fl) return null;
  for (const [k, v] of Object.entries(THERAPIST_FAMILY_NAMES)) {
    if (k.toLowerCase().replace(/^ms/, "") === fl) return v;
  }
  return null;
}

export function getTherapistScheduleName(t) {
  if (!t) return "";
  const keyLower = (t.key || "").toLowerCase();
  if (PORTAL_GREETING_OVERRIDES[keyLower]) return PORTAL_GREETING_OVERRIDES[keyLower];
  const raw = (t.name || "").replace(/^Ms\.?\s*/i, "").trim();
  let first = raw.split(/\s+/)[0] || raw;
  const firstLower = first.toLowerCase();
  if (THERAPIST_FIRST_NAME_OVERRIDES[firstLower]) {
    first = THERAPIST_FIRST_NAME_OVERRIDES[firstLower];
  }
  if (firstLower === "najla") return "Najla Alhamad";
  const family = therapistFamilyName(t.key) || familyByFirstName(first);
  if (family) {
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && parts[parts.length - 1].toLowerCase() === family.toLowerCase()) {
      return parts.map((p, i) => (i === 0 && THERAPIST_FIRST_NAME_OVERRIDES[p.toLowerCase()]) || p).join(" ");
    }
    return `${first} ${family}`;
  }
  return raw || t.name || "";
}

/** Resolve schedule-format name from therapist row, id, or stored fallback. */
export function resolveTherapistDisplayName(therapistOrId, therapists, fallback = "—") {
  if (therapistOrId && typeof therapistOrId === "object") {
    return getTherapistScheduleName(therapistOrId) || fallback;
  }
  const id = therapistOrId;
  if (!id || !therapists?.length) return fallback;
  const row = therapists.find(x => x.id === id);
  return row ? getTherapistScheduleName(row) : fallback;
}

/** Full name for home banner greetings (first + family, with overrides). */
const PORTAL_GREETING_OVERRIDES = {
  mswalaa: "Walaa Abu Eissa",
  msmaha: "Maha Althunayan",
  msfahda: "Fahda Alghadeeb",
  msjenan: "Jenan Al-Muhaisin",
  msasma: "Asma Ahmed",
};

export function getPortalDisplayName(user, therapistRow = null) {
  if (!user) return "";
  const key = (user.key || therapistRow?.key || "").toLowerCase();
  if (PORTAL_GREETING_OVERRIDES[key]) return PORTAL_GREETING_OVERRIDES[key];
  const email = (user.email || therapistRow?.email || "").toLowerCase();
  if (email === "wabuissa@boostgrowthsa.com" || email === "walaa@boostgrowthsa.com") return PORTAL_GREETING_OVERRIDES.mswalaa;
  if (email === "msalthunayan@boostgrowthsa.com") return PORTAL_GREETING_OVERRIDES.msmaha;
  if (email === "falghadeeb@boostgrowthsa.com") return PORTAL_GREETING_OVERRIDES.msfahda;
  if (email === "jsalmuhaisin@boostgrowthsa.com") return PORTAL_GREETING_OVERRIDES.msjenan;
  return getTherapistScheduleName(therapistRow || { name: user.name, key: user.key })
    || (user.name || "").replace(/^Ms\.?\s*/i, "").trim()
    || "";
}

function therapistHasScheduleKey(t) {
  const k = (t.key || "").toLowerCase();
  return Boolean(k && !/^ms\d+$/.test(k));
}

function therapistFirstNameToken(t) {
  const label = getTherapistScheduleName(t).toLowerCase().trim();
  return label.split(/\s+/)[0] || "";
}

export function sortTherapistsForSchedule(list) {
  const orderMap = new Map(THERAPIST_SCHEDULE_ORDER.map((k, i) => [k, i]));
  const ranked = [...list].sort((a, b) => {
    const ak = therapistHasScheduleKey(a) ? 1 : 0;
    const bk = therapistHasScheduleKey(b) ? 1 : 0;
    if (ak !== bk) return bk - ak;
    const ae = (a.email || "").trim();
    const be = (b.email || "").trim();
    if (ae && !be) return -1;
    if (be && !ae) return 1;
    return 0;
  });
  const seenIds = new Set();
  const seenLabels = new Set();
  const seenEmails = new Set();
  const seenFirstNames = new Set();
  const unique = [];
  for (const t of ranked) {
    if (!t?.id || seenIds.has(t.id)) continue;
    const label = getTherapistScheduleName(t).toLowerCase().trim();
    const email = (t.email || "").trim().toLowerCase();
    const first = therapistFirstNameToken(t);
    if (label && seenLabels.has(label)) continue;
    if (email && seenEmails.has(email)) continue;
    if (first && seenFirstNames.has(first) && !therapistHasScheduleKey(t)) continue;
    seenIds.add(t.id);
    if (label) seenLabels.add(label);
    if (email) seenEmails.add(email);
    if (first) seenFirstNames.add(first);
    unique.push(t);
  }
  return unique.sort((a, b) => {
    const ka = (a.key || "").toLowerCase();
    const kb = (b.key || "").toLowerCase();
    const ia = orderMap.has(ka) ? orderMap.get(ka) : 999;
    const ib = orderMap.has(kb) ? orderMap.get(kb) : 999;
    if (ia !== ib) return ia - ib;
    return (a.name || "").localeCompare(b.name || "");
  });
}

/** Prefer Excel/week-specific therapist column order when available. */
export function sortTherapistsForScheduleWeek(list, orderIds = null) {
  const fallback = sortTherapistsForSchedule(list);
  if (!orderIds?.length) return fallback;
  const valid = new Set(list.map((t) => t.id));
  const filtered = orderIds.filter((id) => valid.has(id));
  if (!filtered.length) return fallback;
  const orderMap = new Map(filtered.map((id, i) => [id, i]));
  return [...list].sort((a, b) => {
    const ia = orderMap.has(a.id) ? orderMap.get(a.id) : 9999;
    const ib = orderMap.has(b.id) ? orderMap.get(b.id) : 9999;
    if (ia !== ib) return ia - ib;
    return sortTherapistsForSchedule([a, b])[0] === a ? -1 : 1;
  });
}

export function scheduleOwnBlockOnly(user) {
  if (!user) return false;
  const key = (user.key || "").toLowerCase();
  if (SCHEDULE_OWN_BLOCK_KEYS.has(key)) return true;
  const first = (user.name || "").replace(/^Ms\.?\s*/i, "").split(/\s+/)[0]?.toLowerCase();
  return ["maha", "fahda", "walaa", "jenan"].includes(first);
}

/** Unified schedule legend — cell states + service codes + cancellations. */
export const SCHEDULE_LEGEND_ITEMS = [
  { bg: "#FFFFFF", border: "#DDD8D0", label: "Available" },
  { bg: "#FFF4C4", border: "#E8C572", label: "Therapist Cancel" },
  { bg: "#FCE0E8", border: "#E8A4BD", label: "Client Cancel" },
  { bg: "#D6E8F0", border: "#8BB8CC", label: "Leave" },
  { bg: "#EEF2EA", border: "#B8C5AB", label: "Shift 1 · Sessions (8–12)" },
  { bg: "#DCE5D4", border: "#A8B89A", label: "Shift 2 · Sessions (12–4)" },
  { bg: "#C8D4BC", border: "#95A888", label: "Shift 3 · Sessions (4–8)" },
  { bg: "#F1ECF7", border: "#C9B8DE", label: "Meeting" },
  { bg: "#D8CFC0", border: "#A89880", label: "Supervision" },
  { bg: "#FFEAE0", border: "#F0B89F", label: "AVC" },
  { bg: "#FFF8D6", border: "#E6C96A", label: "Holiday" },
  { bg: "#5C8A47", border: "#FFFFFF", label: "Prepared ✓", dot: true },
];

/** Official closure / holiday row styling (light yellow + dark purple text). */
export const SCHEDULE_CLOSURE_STYLE = {
  background: "#FFF8D6",
  borderColor: "#E6C96A",
  color: "#5C3068",
};

/** Closure label for one therapist on a date (specific overrides all-staff). */
export function closureLabelForTherapist(closures, dateISO, therapistId) {
  if (!dateISO || !closures?.length) return null;
  const forDate = closures.filter(c => c.date === dateISO);
  if (!forDate.length) return null;
  const specific = forDate.find(
    c => Array.isArray(c.therapist_ids) && c.therapist_ids.length > 0 && c.therapist_ids.includes(therapistId)
  );
  if (specific) return specific.label;
  const all = forDate.find(c => !c.therapist_ids?.length);
  return all?.label ?? null;
}

/** Max horizontal slots when merging schedule cells (1 slot = 1 hour). */
export const MAX_SCHEDULE_MERGE_SLOTS = 5;

export const DURATION_OPTIONS = [
  { value: 0.5, label: "½ hr" },
  { value: 1, label: "1 hr" },
  { value: 1.5, label: "1½ hr" },
  { value: 2, label: "2 hr" },
  { value: 2.5, label: "2½ hr" },
  { value: 3, label: "3 hr" },
  { value: 3.5, label: "3½ hr" },
  { value: 4, label: "4 hr" },
  { value: 4.5, label: "4½ hr" },
  { value: 5, label: "5 hr" },
];
