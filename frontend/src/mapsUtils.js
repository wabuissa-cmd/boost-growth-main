/** Open a plain address or Google Maps short/full link correctly (mobile-friendly). */
export function getMapsHref(address) {
  const raw = (address || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    if (/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(raw)) return raw;
    return raw;
  }
  if (/^(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.)/i.test(raw)) {
    return `https://${raw.replace(/^\/+/, "")}`;
  }
  return `https://maps.google.com/?q=${encodeURIComponent(raw)}`;
}

export function isMapsLink(value) {
  const raw = (value || "").trim();
  if (!raw) return false;
  return /^https?:\/\//i.test(raw) || /^(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.)/i.test(raw);
}

/** Any non-empty address can open in Maps. */
export function hasOpenableLocation(value) {
  return Boolean(getMapsHref(value));
}

/** Short label for UI — hide long Maps URLs next to client names. */
export function formatLocationLabel(address) {
  const raw = (address || "").trim();
  if (!raw) return "";
  if (!isMapsLink(raw)) return raw;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const place = u.pathname.match(/\/place\/([^/]+)/i);
    if (place) {
      return decodeURIComponent(place[1].replace(/\+/g, " ")).split(",")[0].trim();
    }
  } catch {
    /* ignore */
  }
  return "View on Maps";
}
