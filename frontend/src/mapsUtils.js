/** Open a plain address or Google Maps short/full link correctly. */
export function getMapsHref(address) {
  const raw = (address || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.)/i.test(raw)) {
    return `https://${raw.replace(/^\/+/, "")}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw)}`;
}

export function isMapsLink(value) {
  const raw = (value || "").trim();
  return /^https?:\/\//i.test(raw) || /^(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.)/i.test(raw);
}
