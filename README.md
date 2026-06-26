# Boost Growth Portal

Staff portal for scheduling, attendance, requests, and HR workflows.

## Urgent email notifications

Outbound email uses **HTTPS providers** (recommended on Railway): **Mailgun**, **Brevo**, or **Resend**. SMTP (Gmail) is supported locally but is often blocked on Railway.

### Who gets emailed (urgent only)

| Event | Recipient |
|-------|-----------|
| Therapist submits a staff request | **Jenan** — `jsalmuhaisin@boostgrowthsa.com` |
| Manager forwards to HR (إرسال للـ HR) | **HR inbox** — `hr@boostgrowthsa.com` (+ any `is_hr_ops` admin users) |

Subjects are prefixed with `[عاجل] [Urgent]`. All sends are logged in Admin → Email queue.

### Railway / production env vars

Set at least one provider (plus optional portal link for email bodies):

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key (`re_…`) — free tier ~3k/mo; paid tier raises limits |
| `MAILGUN_API_KEY` + `MAILGUN_DOMAIN` | Mailgun HTTP API (works well on Railway) |
| `BREVO_API_KEY` | Brevo API key (`xkeysib-…`) |
| `EMAIL_FROM` | Sender, e.g. `Boost Growth <noreply@boostgrowthsa.com>` (domain must be verified with provider) |
| `EMAIL_PROVIDER` | Optional: `auto` (default), `resend`, `mailgun`, `brevo`, or `smtp` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | SMTP fallback (local dev) |
| `PORTAL_URL` or `FRONTEND_URL` | Link included in urgent emails (e.g. `https://boost-growth-main-production-7283.up.railway.app`) |

Settings saved in **Admin → Email Notifications** are merged with these env vars (DB values override; env is never cleared).

### Provider notes

- **Resend**: verify `boostgrowthsa.com` at [resend.com/domains](https://resend.com/domains); upgrade plan for higher monthly volume.
- **Mailgun / Brevo**: prefer for production on Railway; authorize server IP in Brevo if API calls are blocked.

Test delivery: Admin → **Send a test email**.
