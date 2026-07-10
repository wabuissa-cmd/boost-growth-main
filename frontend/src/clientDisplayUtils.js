/** Bilingual client label: English · Arabic when name_ar is set. */
export function clientDisplayName(client) {
  if (!client) return "";
  const en = (client.name || "").trim();
  const ar = (client.name_ar || "").trim();
  if (ar && ar !== en) return `${en} · ${ar}`;
  return en || "—";
}
