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

export const DEFAULT_BILLING_PAGE = {
  page_title: "Billing & Payments",
  page_subtitle: "Payment alerts first · then browse clients & invoices",
  intro_caption: "Open Invoice Sheet for full billing details. Reminder emails go to admin and Walaa 1–2 days before the next payment date.",
  send_reminders_label: "Send reminders",
  ending_soon_title: "Package ending soon",
  ending_soon_empty: "No critical or low packages right now.",
  payment_followup_title: "Needs payment follow-up",
  payment_followup_empty: "All open invoices are on track.",
  directory_heading: "Client Directory",
  show_ending_soon: true,
  show_payment_followup: true,
  show_send_reminders: true,
  overview_tab_label: "Client Invoices",
  calendar_tab_label: "Invoice Calendar",
};

export function mergeBillingPageSettings(raw) {
  const base = { ...DEFAULT_BILLING_PAGE };
  if (!raw || typeof raw !== "object") return base;
  for (const key of Object.keys(DEFAULT_BILLING_PAGE)) {
    if (typeof DEFAULT_BILLING_PAGE[key] === "boolean") {
      if (key in raw) base[key] = Boolean(raw[key]);
    } else if (typeof raw[key] === "string" && raw[key].trim()) {
      base[key] = raw[key].trim();
    }
  }
  return base;
}

export const DEFAULT_SCHEDULE_PAGE = {
  page_title: "Weekly Schedule",
  sheet_tab_label: "Team schedule",
  blocks_tab_label: "My schedule",
  admin_subtitle: "Right-click any cell for actions · Click to edit · Green ✓ = session prepared",
  therapist_blocks_subtitle: "My schedule — click your sessions to log preparation",
  team_sheet_subtitle: "Team schedule — view all therapists",
  legend_hint: "Tap a session to log preparation · Long-press for menu · Times shown per hour slot",
  sheet_panel_title: "Team schedule",
  sheet_panel_desc: "All therapists in one table — swipe horizontally on smaller screens",
  blocks_panel_title: "My schedule",
  blocks_panel_desc: "Sessions grouped by therapist — tap any cell to log or edit",
  leave_banner_label: "LEAVE",
  absent_banner_label: "ABSENT",
  draft_badge_label: "Draft",
  published_badge_label: "Published",
  search_placeholder: "Search therapist…",
  sync_prep_label: "Sync prep",
  save_draft_label: "Save as Draft",
  publish_week_label: "Publish Week",
  show_sync_prep: true,
  show_parent_whatsapp: true,
  show_legend: true,
};

export function mergeSchedulePageSettings(raw) {
  const base = { ...DEFAULT_SCHEDULE_PAGE };
  if (!raw || typeof raw !== "object") return base;
  for (const key of Object.keys(DEFAULT_SCHEDULE_PAGE)) {
    if (typeof DEFAULT_SCHEDULE_PAGE[key] === "boolean") {
      if (key in raw) base[key] = Boolean(raw[key]);
    } else if (typeof raw[key] === "string" && raw[key].trim()) {
      base[key] = raw[key].trim();
    }
  }
  return base;
}

export const DEFAULT_SESSION_PREP_PAGE = {
  page_eyebrow: "SESSION PREP",
  page_title: "Session Preparation",
  page_subtitle: "Log sessions, track package progress, and open invoice sheets",
  roster_heading: "Client roster",
  roster_desc: "Select a client to log a session, view history, or open their invoice sheet",
  search_placeholder: "Search client...",
  log_session_label: "Log Session",
  add_client_label: "Add Client",
  select_client_title: "Select Client",
  select_client_subtitle: "Choose a client to log a session",
  stat_total_label: "Total",
  stat_urgent_label: "Urgent",
  stat_warning_label: "Warning",
  stat_safe_label: "Safe",
  stat_clients_label: "Clients",
  stat_on_track_label: "On track",
  filter_tabs: [
    { id: "all", label: "All clients", enabled: true },
    { id: "urgent", label: "Urgent", enabled: true },
    { id: "warning", label: "Warning", enabled: true },
    { id: "ok", label: "On track", enabled: true },
  ],
  show_add_client_button: true,
  show_admin_filter_tabs: true,
};

export function mergeSessionPrepPageSettings(raw) {
  const base = {
    ...DEFAULT_SESSION_PREP_PAGE,
    filter_tabs: DEFAULT_SESSION_PREP_PAGE.filter_tabs.map((t) => ({ ...t })),
  };
  if (!raw || typeof raw !== "object") return base;
  for (const key of Object.keys(DEFAULT_SESSION_PREP_PAGE)) {
    if (key === "filter_tabs") continue;
    if (typeof DEFAULT_SESSION_PREP_PAGE[key] === "boolean") {
      if (key in raw) base[key] = Boolean(raw[key]);
    } else if (typeof raw[key] === "string" && raw[key].trim()) {
      base[key] = raw[key].trim();
    }
  }
  if (Array.isArray(raw.filter_tabs) && raw.filter_tabs.length) {
    base.filter_tabs = raw.filter_tabs;
  }
  return base;
}

export const DEFAULT_STAFF_LEAVE_PAGE = {
  page_title: "Staff & Leave",
  page_subtitle: "Vacation · leave · materials & HR requests",
  tabs: [
    { id: "vacation", label: "Vacation", enabled: true },
    { id: "leave", label: "Leave", enabled: true },
    { id: "other", label: "Other requests", enabled: true },
  ],
  active_requests_label: "Active Requests",
  history_label: "History",
  search_placeholder: "Search therapist / notes / type…",
  mark_absence_label: "Mark Absence",
  new_request_label: "New Request",
  request_leave_label: "Request Leave",
  other_heading: "Staff Requests",
  other_desc: "Materials · requirements · government · general",
  overview_label: "Request overview",
  stat_total_label: "Total",
  stat_pending_label: "Pending",
  stat_in_progress_label: "In progress",
  stat_done_label: "Done",
  show_mark_absence: true,
  show_new_request_button: true,
};

export function mergeStaffLeavePageSettings(raw) {
  const base = {
    ...DEFAULT_STAFF_LEAVE_PAGE,
    tabs: DEFAULT_STAFF_LEAVE_PAGE.tabs.map((t) => ({ ...t })),
  };
  if (!raw || typeof raw !== "object") return base;
  for (const key of Object.keys(DEFAULT_STAFF_LEAVE_PAGE)) {
    if (key === "tabs") continue;
    if (typeof DEFAULT_STAFF_LEAVE_PAGE[key] === "boolean") {
      if (key in raw) base[key] = Boolean(raw[key]);
    } else if (typeof raw[key] === "string" && raw[key].trim()) {
      base[key] = raw[key].trim();
    }
  }
  if (Array.isArray(raw.tabs) && raw.tabs.length) base.tabs = raw.tabs;
  return base;
}

export const DEFAULT_PURCHASES_PAGE = {
  page_title: "Employees' Purchases",
  page_subtitle: "Payment requests from therapists & supervisors · review & reimburse",
  tabs: [
    { id: "purchases", label: "Purchases", enabled: true },
    { id: "reports", label: "Reports", enabled: true },
  ],
  log_purchase_label: "Log Purchase",
  sync_sheet_label: "Sync from Sheet",
  search_placeholder: "Search…",
  list_heading: "Purchases",
  pending_strip_label: "pending — click to review",
  empty_list_message: "No purchases found",
  show_log_purchase: true,
  show_sync_sheet: true,
};

export function mergePurchasesPageSettings(raw) {
  const base = {
    ...DEFAULT_PURCHASES_PAGE,
    tabs: DEFAULT_PURCHASES_PAGE.tabs.map((t) => ({ ...t })),
  };
  if (!raw || typeof raw !== "object") return base;
  for (const key of Object.keys(DEFAULT_PURCHASES_PAGE)) {
    if (key === "tabs") continue;
    if (typeof DEFAULT_PURCHASES_PAGE[key] === "boolean") {
      if (key in raw) base[key] = Boolean(raw[key]);
    } else if (typeof raw[key] === "string" && raw[key].trim()) {
      base[key] = raw[key].trim();
    }
  }
  if (Array.isArray(raw.tabs) && raw.tabs.length) base.tabs = raw.tabs;
  return base;
}

export const DEFAULT_WAITING_PAGE = {
  intake_title: "Intake Waiting",
  intake_subtitle: "Pre- and post-intake queues for home-based services",
  school_title: "School Waiting",
  school_subtitle: "School support placement queue — synced from the SS waiting sheet",
  mode_intake_label: "Intake Waiting",
  mode_school_label: "School Waiting",
  pre_tab_label: "Pre-Intake",
  post_tab_label: "Post-Intake",
  intake_queue_label: "Pre-Intake Queue",
  post_queue_label: "Post-Intake Queue",
  school_queue_label: "School Waiting Queue",
  school_list_label: "School placement waiting list",
  sync_label: "Sync from Sheet",
  add_pre_label: "Pre-Intake",
  add_post_label: "Post-Intake",
  add_school_label: "Add Case",
  show_sync_button: true,
  show_add_buttons: true,
};

export function mergeWaitingPageSettings(raw) {
  const base = { ...DEFAULT_WAITING_PAGE };
  if (!raw || typeof raw !== "object") return base;
  for (const key of Object.keys(DEFAULT_WAITING_PAGE)) {
    if (typeof DEFAULT_WAITING_PAGE[key] === "boolean") {
      if (key in raw) base[key] = Boolean(raw[key]);
    } else if (typeof raw[key] === "string" && raw[key].trim()) {
      base[key] = raw[key].trim();
    }
  }
  return base;
}
