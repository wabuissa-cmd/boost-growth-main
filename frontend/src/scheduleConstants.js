/** Excel schedule row order (matches master therapist list). */
export const THERAPIST_SCHEDULE_ORDER = [
  "msmaha", "msfahda", "msrazan", "msmanal", "msasma", "mshajer", "msrahaf",
  "msshatha", "msalhanouf", "mswaad", "msnajla", "msbodoor", "msfatimah", "msshoroq",
  "msabeer", "msjenan",
];

/** Family names for full schedule display (First + Family). */
export const THERAPIST_FAMILY_NAMES = {
  msMaha: "Althunayan",
  msFahda: "Alghadeeb",
  msRazan: "Alshatery",
  msManal: "Aldosery",
  msAsma: "Asma",
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
};

/** Supervisors who only see their own block in Per Therapist view. */
export const SCHEDULE_OWN_BLOCK_KEYS = new Set(["msmaha", "msfahda", "mswalaa", "msjenan"]);

export function therapistFamilyName(key) {
  if (!key) return null;
  const lower = String(key).toLowerCase();
  for (const [k, v] of Object.entries(THERAPIST_FAMILY_NAMES)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}

export function getTherapistScheduleName(t) {
  if (!t) return "";
  const first = (t.name || "").replace(/^Ms\.?\s*/i, "").trim();
  const firstLower = first.toLowerCase();
  if (firstLower === "najla") return "Najla Alhamad";
  const family = therapistFamilyName(t.key);
  if (family) return `${first} ${family}`;
  return first || t.name || "";
}

export function sortTherapistsForSchedule(list) {
  const orderMap = new Map(THERAPIST_SCHEDULE_ORDER.map((k, i) => [k, i]));
  return [...list].sort((a, b) => {
    const ka = (a.key || "").toLowerCase();
    const kb = (b.key || "").toLowerCase();
    const ia = orderMap.has(ka) ? orderMap.get(ka) : 999;
    const ib = orderMap.has(kb) ? orderMap.get(kb) : 999;
    if (ia !== ib) return ia - ib;
    return (a.name || "").localeCompare(b.name || "");
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
  { bg: "#D9EAD3", border: "#B6D7A8", label: "Leave" },
  { bg: "#E5EBE1", border: "#B4C2A9", label: "SS" },
  { bg: "#D4E0E8", border: "#A4BCCB", label: "HS" },
  { bg: "#FAF0D1", border: "#E6C983", label: "OS" },
  { bg: "#F1ECF7", border: "#C9B8DE", label: "Meeting" },
  { bg: "#E8F0E8", border: "#A8C0A8", label: "Supervision" },
  { bg: "#FFEAE0", border: "#F0B89F", label: "AVC" },
  { bg: "#FFF8D6", border: "#E6C96A", label: "Holiday" },
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
