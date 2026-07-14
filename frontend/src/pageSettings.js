/** Defaults + helpers for Client Info page settings (self-serve control panel). */

export const DEFAULT_CLIENT_INFO_PAGE = {
  page_badge: "CLIENTS",
  page_title: "Client Portfolios",
  page_subtitle: "Profiles, packages, locations, and progress — select a child to view details",
  directory_heading: "Client Directory",
  active_list_heading: "Active clients",
  inactive_list_heading: "Inactive clients",
  status_tabs: [
    { id: "active", label: "Active", enabled: true },
    { id: "inactive", label: "Inactive", enabled: true },
  ],
  detail_tabs: [
    { id: "overview", label: "Overview", enabled: true },
    { id: "billing", label: "Billing & History", enabled: true },
    { id: "summary", label: "Case Summary", enabled: true },
    { id: "records", label: "Records", enabled: true },
  ],
  service_types: [
    { value: "HS", label: "HS (Home Session)" },
    { value: "SS", label: "SS (School Support)" },
    { value: "HS+SS", label: "HS + SS" },
    { value: "AVC", label: "AVC" },
  ],
  location_services: ["HS", "SS", "OS"],
  supervisors: [
    "Fahda Alghadeeb",
    "Maha Althunayan",
    "Jenan Almuhaisin",
  ],
  default_package_hours: 24,
  default_new_client_color: "#A2C4C9",
  show_new_client_button: true,
};

export function mergeClientInfoPageSettings(raw) {
  const base = {
    ...DEFAULT_CLIENT_INFO_PAGE,
    status_tabs: DEFAULT_CLIENT_INFO_PAGE.status_tabs.map((t) => ({ ...t })),
    detail_tabs: DEFAULT_CLIENT_INFO_PAGE.detail_tabs.map((t) => ({ ...t })),
    service_types: DEFAULT_CLIENT_INFO_PAGE.service_types.map((t) => ({ ...t })),
    location_services: [...DEFAULT_CLIENT_INFO_PAGE.location_services],
    supervisors: [...DEFAULT_CLIENT_INFO_PAGE.supervisors],
  };
  if (!raw || typeof raw !== "object") return base;
  for (const key of [
    "page_badge", "page_title", "page_subtitle", "directory_heading",
    "active_list_heading", "inactive_list_heading", "default_new_client_color",
  ]) {
    if (typeof raw[key] === "string" && raw[key].trim()) base[key] = raw[key].trim();
  }
  if (typeof raw.default_package_hours === "number" && raw.default_package_hours > 0) {
    base.default_package_hours = raw.default_package_hours;
  }
  if ("show_new_client_button" in raw) base.show_new_client_button = Boolean(raw.show_new_client_button);
  if (Array.isArray(raw.status_tabs) && raw.status_tabs.length) base.status_tabs = raw.status_tabs;
  if (Array.isArray(raw.detail_tabs) && raw.detail_tabs.length) base.detail_tabs = raw.detail_tabs;
  if (Array.isArray(raw.service_types) && raw.service_types.length) base.service_types = raw.service_types;
  if (Array.isArray(raw.location_services) && raw.location_services.length) {
    base.location_services = raw.location_services;
  }
  if (Array.isArray(raw.supervisors)) base.supervisors = raw.supervisors;
  return base;
}

export function enabledTabs(tabs) {
  return (tabs || []).filter((t) => t && t.enabled !== false);
}
