"""Urgent staff-request email notifications (Jenan + HR forward)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@boost-growthsa.com"
ADMIN_PASSWORD = "BoostAdmin@2026"
JENAN_EMAIL = "jsalmuhaisin@boostgrowthsa.com"
HR_EMAIL = "hr@boostgrowthsa.com"


@pytest.fixture(scope="session")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def therapist_headers():
    tl = requests.get(f"{API}/auth/therapists-list")
    assert tl.status_code == 200
    therapists = tl.json()
    assert therapists
    t = therapists[0]
    r = requests.post(f"{API}/auth/therapist-login", json={"therapist_id": t["id"], "pin": "0000"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


class TestUrgentRequestEmail:
    def test_new_request_queues_urgent_email_to_jenan(self, admin_headers, therapist_headers):
        title = f"TEST urgent email {uuid.uuid4().hex[:8]}"
        r = requests.post(
            f"{API}/requests",
            json={
                "title": title,
                "description": "Automated urgent-email test",
                "request_type": "general",
                "priority": "high",
            },
            headers=therapist_headers,
        )
        assert r.status_code == 200, r.text
        rq = requests.get(f"{API}/admin/email-queue", headers=admin_headers)
        assert rq.status_code == 200
        match = next(
            (
                i
                for i in rq.json()
                if (i.get("to") or "").lower() == JENAN_EMAIL
                and (title in (i.get("subject") or "") or title in (i.get("body") or ""))
            ),
            None,
        )
        assert match is not None, f"No Jenan urgent email in queue for {title}"
        assert "[عاجل]" in match["subject"] and "[Urgent]" in match["subject"]
        assert match.get("status") in ("queued_no_key", "sent", "queued", "failed")

    def test_new_request_queues_urgent_email_to_hr(self, admin_headers, therapist_headers):
        title = f"TEST HR submit {uuid.uuid4().hex[:8]}"
        r = requests.post(
            f"{API}/requests",
            json={
                "title": title,
                "description": "HR should get urgent email on therapist submit",
                "request_type": "general",
                "priority": "normal",
            },
            headers=therapist_headers,
        )
        assert r.status_code == 200, r.text
        rq = requests.get(f"{API}/admin/email-queue", headers=admin_headers)
        assert rq.status_code == 200
        hr_match = next(
            (
                i
                for i in rq.json()
                if (i.get("to") or "").lower() == HR_EMAIL
                and (title in (i.get("subject") or "") or title in (i.get("body") or ""))
            ),
            None,
        )
        assert hr_match is not None, f"No HR urgent email in queue on submit for {title}"
        assert "[عاجل]" in hr_match["subject"] and "[Urgent]" in hr_match["subject"]

    def test_forward_to_hr_queues_urgent_email(self, admin_headers, therapist_headers):
        title = f"TEST HR forward {uuid.uuid4().hex[:8]}"
        cr = requests.post(
            f"{API}/requests",
            json={
                "title": title,
                "description": "HR forward email test",
                "request_type": "general",
                "priority": "normal",
            },
            headers=therapist_headers,
        )
        assert cr.status_code == 200, cr.text
        rid = cr.json()["id"]
        ur = requests.put(
            f"{API}/requests/{rid}/status",
            json={"status": "pending_hr", "admin_note": "Forward to HR test"},
            headers=admin_headers,
        )
        assert ur.status_code == 200, ur.text
        rq = requests.get(f"{API}/admin/email-queue", headers=admin_headers)
        assert rq.status_code == 200
        hr_items = [
            i
            for i in rq.json()
            if "HR approval" in (i.get("subject") or "")
            and (i.get("to") or "").lower() == HR_EMAIL
            and title in (i.get("body") or "")
        ]
        assert hr_items, "No urgent HR email queued after forward"
        assert "[عاجل]" in hr_items[0]["subject"]
