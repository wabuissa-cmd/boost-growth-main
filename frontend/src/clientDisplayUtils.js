/** Bilingual client label: English · Arabic when name_ar is set. */
export function clientDisplayName(client) {
  if (!client) return "";
  const en = (client.name || "").trim();
  const ar = (client.name_ar || "").trim();
  if (ar && ar !== en) return `${en} · ${ar}`;
  return en || "—";
}

const SUPERVISOR_FULL_NAMES = {
  fahda: "Fahda Alghadeeb",
  maha: "Maha Althunayan",
  jenan: "Jenan Almuhaisin",
};

/** Supervisor field → first + family (no Ms. prefix). */
export function formatSupervisorDisplayName(supervisor) {
  const raw = (supervisor || "").trim();
  if (!raw) return "—";
  const first = raw.replace(/^Ms\.?\s*/i, "").split(/\s+/)[0]?.toLowerCase() || "";
  if (SUPERVISOR_FULL_NAMES[first]) return SUPERVISOR_FULL_NAMES[first];
  const stripped = raw.replace(/^Ms\.?\s*/i, "").trim();
  const parts = stripped.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return stripped;
  return stripped || "—";
}
