// Per-child color map (matches Base44 SC_COLORS — by first name)
export const CHILD_COLORS = {
  "Abdularahman":"#D9EAD3","Abdulrahman":"#D9EAD3","Abdulaziz W":"#D5A6BD","Abdulaziz A":"#FCE5CD",
  "Abdulaziz":"#D5A6BD","Abdulelah":"#D9D2E9","Aljoharah":"#B4A7D6","Aljouhrah":"#B4A7D6",
  "Alwaleed":"#EA9999","Amani":"#A2C4C9","Ameirah":"#F4CCCC","Ameerah":"#F4CCCC",
  "Fahad":"#A2C4C9","Ibrahim":"#D0E0E3","Khalid":"#FFF2CC","Lulu":"#D5A6BD",
  "Mohammed Alaqel":"#E6B8AF","Mohammed":"#F9CB9C","Omar":"#B4A7D6",
  "Saad":"#D9EAD3","Saleh":"#FFE599","Salman":"#B6D7A8","Sulaiman":"#FFE599",
  "Sultan D":"#6FA8DC","Sultan":"#6D9EEB",
};

export function getChildColor(name) {
  if (!name) return null;
  const trimmed = name.trim();
  if (CHILD_COLORS[trimmed]) return CHILD_COLORS[trimmed];
  // fallback: first word
  const first = trimmed.split(/\s+/)[0];
  return CHILD_COLORS[first] || null;
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
