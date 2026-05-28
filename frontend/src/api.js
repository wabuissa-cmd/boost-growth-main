import axios from "axios";

// Production (single Railway service): leave REACT_APP_BACKEND_URL unset → use /api on same host.
// Local dev: set REACT_APP_BACKEND_URL=http://localhost:8000 in frontend/.env
const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
export const API = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

const api = axios.create({ baseURL: API, withCredentials: true });

api.interceptors.response.use(
  (res) => {
    const d = res.data;
    if (typeof d === "string" && d.trimStart().startsWith("<!")) {
      return Promise.reject(new Error("Server returned HTML instead of JSON — API not reachable"));
    }
    return res;
  },
  (err) => Promise.reject(err)
);

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("bg_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

export function formatErr(detail) {
  if (!detail) return "Something went wrong, please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" • ");
  return String(detail);
}

export const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]; // 5 working days
export const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu"];

export const TIME_SLOTS = [
  "8:00 AM - 9:00 AM",
  "9:00 AM - 10:00 AM",
  "10:00 AM - 11:00 AM",
  "11:00 AM - 12:00 PM",
  "12:00 PM - 1:00 PM",
  "1:00 PM - 2:00 PM",
  "2:00 PM - 3:00 PM",
  "3:00 PM - 4:00 PM",
  "4:00 PM - 5:00 PM",
  "5:00 PM - 6:00 PM",
];

export const SERVICE_CODES = [
  { id: "SS", label: "School Support", short: "SS", cls: "evt-ss" },
  { id: "HS", label: "Home Session", short: "HS", cls: "evt-hs" },
  { id: "OS", label: "Outdoor Session", short: "OS", cls: "evt-os" },
  { id: "MEETING", label: "Meeting", short: "Meeting", cls: "evt-meeting" },
  { id: "SUPERVISION", label: "Supervision", short: "Supervision", cls: "evt-supervision" },
  { id: "OBSERVATION", label: "Observation", short: "Observation", cls: "evt-observation" },
  { id: "AVC", label: "AVC", short: "AVC", cls: "evt-avc" },
  { id: "LEAVE", label: "Leave", short: "Leave", cls: "evt-leave" },
  { id: "BREAK", label: "Break", short: "Break", cls: "evt-break" },
];

export function startOfWeek(d = new Date()) {
  const dt = new Date(d);
  const day = dt.getDay();
  dt.setDate(dt.getDate() - day);
  dt.setHours(0, 0, 0, 0);
  return dt;
}
export function addDays(d, n) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt;
}
export function toISODate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  // Use local date components (NOT toISOString which converts to UTC and shifts the day)
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function formatDateRange(weekStart) {
  const end = addDays(weekStart, 4);
  const opt = { day: "numeric", month: "short" };
  return `${weekStart.toLocaleDateString('en-US', opt)} – ${end.toLocaleDateString('en-US', opt)}`;
}
export function formatGregorian(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}
