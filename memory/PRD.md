# Boost Growth — Staff Portal (PRD)

## Original Problem
Multi-role internal portal for **Boost Growth** (Applied Behavior Analysis
center, Riyadh, KSA). Manages schedule, client attendance, invoices, leaves,
intake flow and operational documents. The previous portal lived on Firebase;
this rebuild is on **FastAPI + MongoDB + React**.

## User Personas
- **Admin / HR** — sees all therapists & clients, manages schedule, invoices,
  leave approvals, master data seeding.
- **Therapist** — sees only her own clients, schedule, leaves and progress
  reports.

## Stack
- Frontend: React 18 + Tailwind + Phosphor icons + react-router
- Backend: FastAPI + Motor + bcrypt + PyJWT + openpyxl
- DB: MongoDB (local) — UUID `id` fields, `_id` excluded from responses
- Hosting: Emergent preview

## Auth
- **Admin**: email + password (bcrypt + JWT)
- **Therapist (new flow)**: email + password (bcrypt + JWT). Admin can
  generate a temporary password via `POST /api/therapists/{id}/reset-password`
  → therapist forced into Change-Password modal on next login
  (`must_change_password` flag).
- **PIN flow**: kept as backwards-compatible fallback (`/api/auth/therapist-login`).
- See `/app/memory/test_credentials.md` for current accounts.

## Data Model (MongoDB collections)
- `users`            — admin accounts
- `therapists`       — `id, name, email, color, pin_hash, password_hash, must_change_password, key, role, leave_balance, join_date`
- `clients`          — `id, name, file_no, package_hours, billing_mode, main_therapist_id, co_therapist_ids[], supervisor, locations[], drive_url, status, service_type, address, intake_file_url, attendance_sheet_url, progress_reports_url, case_summary_url, payment_status, package_end_date`
- `sessions`         — attendance entries
- `invoices`         — `id, client_id, invoice_number, start_date, package_size, payment_status, service_type, is_closed, close_date, source`
- `progress_reports` — `id, client_id, title, url, status (uploaded|reviewed|resolved), notes, report_date, created_at, updated_at`
- `leaves`           — `id, therapist_id, start_date, end_date, days, leave_type, status, notes, admin_note`
- `schedule_cells`   — `id, therapist_id, day, time_slot, service_code, child_name, custom_time, state, color, duration, week_start`
- `attendance_sheets`, `requests`, `notifications`, `intake_pre`, `intake_post`, `email_queue`, `email_settings`

## What's Implemented (cumulative)
### Auth & Master Data
- Admin/Therapist JWT auth, role-based filtering server-side
- Therapist email+password with temporary password reset & forced change
- `POST /api/admin/seed-master-data` — idempotent seed of canonical therapist
  & client lists (15 therapists from spec + Walaa/Jenan/Asma kept; 26 clients)
- Admin Panel: Run Seed (with confirm), per-therapist Reset Password, edit
  therapist info

### Navigation
- `Home | Schedule | Attendance | Clients | Records ▾ | Requests ▾ | Import | Admin`
- **Records** dropdown: Intake (admin)
- **Requests** dropdown: Requests, Leaves, Therapist Leaves (admin), Reports
- Directory + Resources fully removed

### Schedule
- Per-Therapist (blocks) is default; Full Sheet toggleable
- Zoom +/− buttons (70%-130%, persisted in localStorage)
- Excel import (with sheet selector + sheet-name detection)
- Approved leaves + absences overlay rows in **yellow (#FEF9C3)** with
  diagonal stripes, "ON LEAVE" / "ABSENT" label

### Attendance / Invoices
- Manual invoice creation with `New Invoice` modal (Invoice #, Service Type
  HS/SS, package size — all manual)
- Invoice History dropdown shows `🔓/🔒 INV#### (Open|Closed date)`
- Pre-loaded invoices for client 009 (Saleh Ahusainy) — 9 invoices
- "Sync from Excel" button — uploads `.xlsx`, detects `INV*` sheet tabs
  (regex `^(Copy of )?INV[\s\-_]*\d+`), creates missing invoices
- Excel export — **one tab per invoice**, named `INV0451` etc., matching
  Drive format `Days | Date | Status | Time | # of Hrs | Therapist | Note`
- Package End Date / Payment Status (Complete/Pending) editable; Reset
  Package gated by Payment Complete
- Service Type label in Log Session modal (was "Location")
- Pending payment warning banner visible at all times

### Clients
- Detail modal split into **Info / Attachments** tabs
- Status (Active/Inactive) and Service Type (HS/SS/HS+SS/AVC) editable
- Attachments tab: Intake / Attendance / Case Summary URL fields (admin
  editable, single Save button)
- **Interactive Progress Reports list** inside Attachments:
  per-report status (uploaded ● Uploaded amber / reviewed ● Reviewed blue /
  resolved ● Resolved green), add/delete + inline status dropdown
- Multiple locations per service type with HS/SS/OS badges

### Leaves
- Types: Annual, Sick, Unpaid, **Permission / Early Leave**, Absence, Exam,
  Emergency
- On approve: alert "Leave approved. X days deducted from balance."
- `/api/leaves/balance` enriched with `leave_balance` fallback to
  `annual_balance`
- New **Therapist Leaves** admin page: table of balance / used / pending /
  remaining + inline edit via `PUT /therapists/{id}/leave-balance`

### Intake / Reports / Requests
- Intake Pre → Move to Post (admin)
- Cancel-session modal with email notification placeholder
- Reports tracker (admin)

### Home (Therapist)
- Stats: own sessions this week / clients / hours
- Daily quote from `/app/frontend/src/data/quotes.js`

## API Endpoints (key)
- `POST /api/auth/login` (admin), `POST /api/auth/therapist-email-login`,
  `POST /api/auth/therapist-login` (legacy PIN), `POST /api/auth/change-password`,
  `GET /api/auth/me`, `POST /api/auth/logout`
- `POST /api/therapists/{id}/reset-password`, `PUT /api/therapists/{id}/leave-balance`
- `POST /api/admin/seed-master-data`
- `GET/POST/PUT/DELETE /api/clients[/{cid}]`
- `GET/POST /api/clients/{cid}/invoices`, `PUT/DELETE /api/invoices/{iid}`,
  `POST /api/clients/{cid}/invoices/sync-from-excel`
- `GET/POST /api/clients/{cid}/progress-reports`,
  `PUT/DELETE /api/progress-reports/{rid}`, `PUT /api/progress-reports/{rid}/status`
- `GET /api/clients/{cid}/sessions/export` (multi-tab xlsx)
- `GET/POST/PUT/DELETE /api/leaves`, `PUT /api/leaves/{id}/status`,
  `GET /api/leaves/balance`
- `POST /api/import/schedule-excel`, `POST /api/import/list-sheets`

## Outstanding / Backlog
- 🟡 **Resend (email) API key**: still missing — Admin → Email Notifications
  card has the entry point. Not configured = no outbound emails.
- 🟡 Validate Google Drive iframe preview for non-folder PDF links
  (may need `/preview` URL rewrite for some links)
- 🔵 (P2) Refactor `server.py` (~2100 lines) into routers
- 🔵 (P2) Move legacy `/auth/therapist-login` PIN endpoint to deprecation
  warning once all therapists have email passwords set

## Recent Sessions
- 2026-05-22 — Changes 1-5 (nav restructure, schedule defaults+zoom+yellow,
  permission leave + balance + therapist-leaves page, client status/service
  /attachments tabs, multi-tab Excel export)
- 2026-05-22 — Progress Reports CRUD + interactive list with per-row status
- (prior) Email/password therapist auth + Seed Master Data
- (prior) Invoice flow rewrites + sync-from-excel + manual creation

## Notes & Conventions
- Never paste preview URL into chat — user uses the preview button.
- Communicate in Arabic.
- Therapist sees only assigned clients (server-side filter on `/api/clients`)
- Each `data-testid` is unique and kebab-case
