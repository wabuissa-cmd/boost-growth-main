// Themed schedule palettes (Boost Growth: beige/olive + calm variations).
// These are intentionally low-saturation to reduce visual noise.
export const SHIFT_CHILD_PALETTES = {
  // Shift 1: beige/olive (morning)
  1: ["#E9E2D6", "#E3DACB", "#DCD1BE", "#D3C8B2", "#C9BEA6", "#C2B89E"],
  // Shift 2: sage/stone (midday)
  2: ["#E6EFE7", "#DDE8DE", "#D2DFD4", "#C7D6CA", "#BDD0C1", "#B1C6B6"],
  // Shift 3: sand/clay (late)
  3: ["#F1E7DA", "#EADDCB", "#E3D2BA", "#DBC7A9", "#D2BC9B", "#CBB290"],
};

function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return h >>> 0;
}

function normalizeNameKey(name) {
  return (name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function getChildColor(name, shift = 1) {
  const key = normalizeNameKey(name);
  if (!key) return null;
  const sh = shift === 2 ? 2 : shift === 3 ? 3 : 1;
  const palette = SHIFT_CHILD_PALETTES[sh] || SHIFT_CHILD_PALETTES[1];
  const idx = hashString(key) % palette.length;
  return palette[idx];
}

// Hex -> readable text color
export function readable(hex) {
  if (!hex) return "#2C3625";
  const c = hex.replace("#", "");
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.65 ? "#2C3625" : "#FFFFFF";
}
