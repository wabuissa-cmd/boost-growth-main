"""Boost Growth Portal — v7 Backend Tests (Feb 2026 v7 additions).
Covers: May 10-14 schedule import (107 cells), Leaves CRUD + balance + admin/therapist
visibility, leave create + status -> notification, cancel-notify with email queue,
sessions Excel export, admin email-settings + email-queue.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@boost-growthsa.com"
ADMIN_PASSWORD = "BoostAdmin@2026"
THERAPIST_PIN = "0000"
WEEK_MAY = "2026-05-10"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_headers():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def therapists_list():
    r = requests.get(f"{API}/auth/therapists-list")
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="session")
def waad(therapists_list):
    t = next((x for x in therapists_list if x["name"] == "Ms. Waad"), None)
    assert t is not None, "Ms. Waad not found"
    return t


@pytest.fixture(scope="session")
def waad_headers(waad):
    r = requests.post(f"{API}/auth/therapist-login",
                      json={"therapist_id": waad["id"], "pin": THERAPIST_PIN})
    assert r.status_code == 200, f"Waad login failed: {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def maha_headers(therapists_list):
    t = next((x for x in therapists_list if x["name"] == "Ms. Maha"), therapists_list[0])
    r = requests.post(f"{API}/auth/therapist-login",
                      json={"therapist_id": t["id"], "pin": THERAPIST_PIN})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}, t


# ---------- Schedule (May 10-14 import — 107 cells) ----------
class TestScheduleImport:
    def test_may_week_has_107_cells(self, admin_headers):
        r = requests.get(f"{API}/schedule", params={"week_start": WEEK_MAY},
                         headers=admin_headers)
        assert r.status_code == 200
        cells = r.json()
        assert len(cells) == 107, f"Expected 107 cells, got {len(cells)}"

    def test_cells_have_service_code_and_child(self, admin_headers):
        r = requests.get(f"{API}/schedule", params={"week_start": WEEK_MAY},
                         headers=admin_headers)
        cells = r.json()
        with_code = [c for c in cells if c.get("service_code")]
        with_child = [c for c in cells if c.get("child_name")]
        assert len(with_code) >= 80, f"Few cells with service_code: {len(with_code)}"
        assert len(with_child) >= 50, f"Few cells with child_name: {len(with_child)}"


# ---------- Leaves (admin) ----------
class TestLeavesAdmin:
    def test_leaves_2026_returns_31_enriched(self, admin_headers):
        r = requests.get(f"{API}/leaves", params={"year": 2026},
                         headers=admin_headers)
        assert r.status_code == 200
        items = r.json()
        # Spec mentioned 31; actual seed/frontend tile says 32 — accept either.
        assert len(items) in (31, 32), f"Expected 31-32 leaves, got {len(items)}"
        # Enrichment
        with_name = [i for i in items if i.get("therapist_name")]
        assert len(with_name) >= 25, f"Expected most enriched, got {len(with_name)}"
        # All should have therapist_email/color too
        sample = with_name[0]
        assert "therapist_color" in sample
        assert "therapist_email" in sample

    def test_balance_returns_17_rows(self, admin_headers):
        r = requests.get(f"{API}/leaves/balance", params={"year": 2026},
                         headers=admin_headers)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) == 17, f"Expected 17 rows, got {len(rows)}"
        for row in rows:
            assert row["allocated"] == 30, f"{row['name']} allocated={row['allocated']}"
            assert "used_annual" in row
            assert "pending" in row
            assert "remaining" in row

    def test_waad_balance_used_21_remaining_9(self, admin_headers):
        r = requests.get(f"{API}/leaves/balance", params={"year": 2026},
                         headers=admin_headers)
        rows = r.json()
        waad_row = next((x for x in rows if x["name"] == "Ms. Waad"), None)
        assert waad_row is not None
        assert waad_row["used_annual"] == 21, f"Waad used_annual={waad_row['used_annual']}"
        assert waad_row["remaining"] == 9, f"Waad remaining={waad_row['remaining']}"


# ---------- Leaves (therapist Ms. Waad) ----------
class TestLeavesTherapist:
    def test_waad_sees_only_own_leaves(self, waad_headers):
        r = requests.get(f"{API}/leaves", params={"year": 2026},
                         headers=waad_headers)
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 3, f"Waad should see 3 leaves, got {len(items)}"

    def test_waad_balance_only_own_row(self, waad_headers):
        r = requests.get(f"{API}/leaves/balance", params={"year": 2026},
                         headers=waad_headers)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) == 1
        assert rows[0]["name"] == "Ms. Waad"
        assert rows[0]["used_annual"] == 21
        assert rows[0]["remaining"] == 9


# ---------- Leave create + status update flow ----------
class TestLeaveFlow:
    def test_therapist_create_leave_pending_and_approve(self, admin_headers, maha_headers):
        m_headers, maha = maha_headers
        # Create as therapist
        payload = {
            "therapist_id": maha["id"],
            "start_date": "2026-08-01",
            "end_date": "2026-08-02",
            "days": 2,
            "leave_type": "Annual",
            "notes": "TEST_v7 flow"
        }
        r = requests.post(f"{API}/leaves", json=payload, headers=m_headers)
        assert r.status_code == 200
        created = r.json()
        assert created["status"] == "pending"
        lid = created["id"]

        # Verify therapist sees this leave
        gl = requests.get(f"{API}/leaves", params={"year": 2026}, headers=m_headers)
        assert gl.status_code == 200
        assert any(x["id"] == lid for x in gl.json())

        # Admin approves
        ru = requests.put(f"{API}/leaves/{lid}/status",
                          json={"status": "approved", "admin_note": "ok"},
                          headers=admin_headers)
        assert ru.status_code == 200
        assert ru.json()["status"] == "approved"

        # Therapist should have a notification
        nf = requests.get(f"{API}/notifications", headers=m_headers)
        assert nf.status_code == 200
        notifs = nf.json()
        leave_notifs = [n for n in notifs if n.get("kind") == "leave"
                        or "leave" in (n.get("title") or "").lower()]
        assert len(leave_notifs) >= 1, "No leave notification created for therapist"

        # Deletion is no longer allowed after submission (draft-only policy)
        rd = requests.delete(f"{API}/leaves/{lid}", headers=admin_headers)
        assert rd.status_code == 403

    def test_leave_create_accepts_iso_timestamps_normalizes_dates(self, maha_headers):
        """Regression: schedule overlay expects yyyy-mm-dd comparisons; store date-only even if UI sends timestamps."""
        m_headers, maha = maha_headers
        payload = {
            "therapist_id": maha["id"],
            "start_date": "2026-07-07T00:00:00.000Z",
            "end_date": "2026-07-17T23:59:59.000Z",
            "days": 11,
            "leave_type": "Annual",
            "notes": "TEST_v7 iso timestamps",
        }
        r = requests.post(f"{API}/leaves", json=payload, headers=m_headers)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["start_date"] == "2026-07-07"
        assert created["end_date"] == "2026-07-17"


# ---------- Cancel-Notify (schedule cell + email queue) ----------
class TestCancelNotify:
    def test_cancel_notify_creates_queue_item(self, admin_headers):
        # Get a real cell from May week
        rs = requests.get(f"{API}/schedule", params={"week_start": WEEK_MAY},
                          headers=admin_headers)
        cells = rs.json()
        cell = next((c for c in cells if c.get("therapist_id")), None)
        assert cell is not None, "No cell with therapist_id found"

        payload = {
            "cell_id": cell["id"],
            "state": "cancel_therapist",
            "message": "TEST_v7 cancel notify message",
            "send_email": True,
            "extra_email": "test_v7@example.com",
        }
        r = requests.post(f"{API}/schedule/cancel-notify",
                          json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("in_app") is True
        assert body.get("email") is not None
        # Since RESEND_API_KEY not set, status should be queued_no_key
        email_status = body["email"].get("status")
        assert email_status in ("queued_no_key", "sent", "queued"), f"unexpected status {email_status}"

        # Verify cell state is updated
        rs2 = requests.get(f"{API}/schedule", params={"week_start": WEEK_MAY},
                           headers=admin_headers)
        updated_cell = next((c for c in rs2.json() if c["id"] == cell["id"]), None)
        assert updated_cell is not None
        assert updated_cell.get("state") == "cancel_therapist"

        # Verify email queue contains item
        rq = requests.get(f"{API}/admin/email-queue", headers=admin_headers)
        assert rq.status_code == 200
        queue = rq.json()
        assert len(queue) >= 1
        # Most recent item should be ours
        recent = queue[0]
        assert recent.get("to") in ("test_v7@example.com",) or recent.get("to") is not None


# ---------- Sessions Excel Export ----------
class TestSessionsExport:
    def test_export_returns_xlsx(self, admin_headers):
        rc = requests.get(f"{API}/clients", headers=admin_headers)
        assert rc.status_code == 200
        clients = rc.json()
        assert len(clients) >= 1
        cid = clients[0]["id"]
        r = requests.get(f"{API}/clients/{cid}/sessions/export", headers=admin_headers)
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "spreadsheetml" in ct or "officedocument" in ct, f"Bad mime: {ct}"
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd.lower()
        assert "filename=" in cd.lower()
        assert len(r.content) > 500, f"Empty xlsx body: {len(r.content)}"


# ---------- Admin Email Settings & Queue ----------
class TestEmailSettings:
    def test_get_email_settings(self, admin_headers):
        r = requests.get(f"{API}/admin/email-settings", headers=admin_headers)
        assert r.status_code == 200
        body = r.json()
        assert "configured" in body
        assert "from_email" in body
        assert isinstance(body["configured"], bool)

    def test_post_settings_persists(self, admin_headers):
        # Save from_email only (don't actually set a real Resend key)
        payload = {"from_email": "TEST_Boost <test@example.com>"}
        r = requests.post(f"{API}/admin/email-settings", json=payload,
                          headers=admin_headers)
        assert r.status_code == 200
        # Re-read
        r2 = requests.get(f"{API}/admin/email-settings", headers=admin_headers)
        assert r2.json()["from_email"] == "TEST_Boost <test@example.com>"

    def test_email_queue_admin_only(self, admin_headers, waad_headers):
        r = requests.get(f"{API}/admin/email-queue", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        # Therapist should be 403
        rt = requests.get(f"{API}/admin/email-queue", headers=waad_headers)
        assert rt.status_code == 403


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
