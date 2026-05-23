"""Boost Growth Portal — v4 Backend Tests (Feb 2026 session)
Covers: 25 clients multi-service, 25 intake (12 pre + 13 post) with new fields,
5 resources with visibility, directory seed (5 contacts) + edit, resources CRUD,
therapist role visibility, intake admin-only.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@boost-growthsa.com"
ADMIN_PASSWORD = "BoostAdmin@2026"
THERAPIST_PIN = "0000"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def therapist_token():
    tl = requests.get(f"{API}/auth/therapists-list")
    assert tl.status_code == 200
    therapists = tl.json()
    # Prefer Ms. Maha
    t = next((x for x in therapists if x["name"] == "Ms. Maha"), therapists[0])
    r = requests.post(f"{API}/auth/therapist-login",
                      json={"therapist_id": t["id"], "pin": THERAPIST_PIN})
    assert r.status_code == 200, f"Therapist login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def therapist_headers(therapist_token):
    return {"Authorization": f"Bearer {therapist_token}"}


# ---------- Auth ----------
class TestAuth:
    def test_admin_login(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        body = r.json()
        assert body["role"] == "admin"
        assert "token" in body and len(body["token"]) > 20

    def test_admin_login_bad(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_therapists_list_public(self):
        r = requests.get(f"{API}/auth/therapists-list")
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 17, f"Expected 17 therapists, got {len(items)}"
        names = [t["name"] for t in items]
        assert "Ms. Asma" in names
        assert "Ms. Jenan" in names

    def test_therapist_login(self, therapist_token):
        assert therapist_token and len(therapist_token) > 20


# ---------- Clients (25 multi-service) ----------
class TestClients:
    def test_clients_count_25(self, admin_headers):
        r = requests.get(f"{API}/clients", headers=admin_headers)
        assert r.status_code == 200
        clients = r.json()
        assert len(clients) == 25, f"Expected 25 clients, got {len(clients)}"

    def test_clients_have_locations(self, admin_headers):
        r = requests.get(f"{API}/clients", headers=admin_headers)
        clients = r.json()
        for c in clients:
            assert "locations" in c
            assert isinstance(c["locations"], list)
            assert len(c["locations"]) >= 1, f"{c['name']} has no locations"

    def test_saleh_009_three_locations(self, admin_headers):
        r = requests.get(f"{API}/clients", headers=admin_headers)
        clients = r.json()
        saleh = next((c for c in clients if c.get("file_no") == "009"), None)
        assert saleh is not None, "File 009 (Saleh) missing"
        assert saleh["name"] == "Saleh Ahusainy"
        assert len(saleh["locations"]) == 3
        services = sorted([l["service"] for l in saleh["locations"]])
        assert services == ["HS", "HS", "SS"]

    def test_salman_038_two_locations_ss_hs(self, admin_headers):
        r = requests.get(f"{API}/clients", headers=admin_headers)
        clients = r.json()
        salman = next((c for c in clients if c.get("file_no") == "038"), None)
        assert salman is not None
        assert salman["name"] == "Salman Alrasheed"
        services = sorted([l["service"] for l in salman["locations"]])
        assert services == ["HS", "SS"]


# ---------- Intake (25 = 12 pre + 13 post) ----------
class TestIntake:
    def test_intake_admin_returns_25(self, admin_headers):
        r = requests.get(f"{API}/intake", headers=admin_headers)
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 25, f"Expected 25 intake, got {len(items)}"
        pre = [i for i in items if i.get("intake_type") == "pre"]
        post = [i for i in items if i.get("intake_type") == "post"]
        assert len(pre) == 12, f"Expected 12 pre, got {len(pre)}"
        assert len(post) == 13, f"Expected 13 post, got {len(post)}"

    def test_intake_new_fields_present(self, admin_headers):
        r = requests.get(f"{API}/intake", headers=admin_headers)
        items = r.json()
        # Collect all unique keys across all items
        all_keys = set()
        for it in items:
            all_keys.update(it.keys())
        for field in ("service", "district", "time_pref", "diagnosis",
                      "language", "priority"):
            assert field in all_keys, f"Field {field} not present in any item"
        # At least some should have real service values
        with_service = [i for i in items if i.get("service")]
        assert len(with_service) >= 20
        # Reema Idrees should have service=HS, district=Iraqi
        reema = next((i for i in items if i.get("child_name") == "Reema Idrees"), None)
        assert reema is not None
        assert reema["service"] == "HS"
        assert reema["district"] == "Iraqi"

    def test_intake_therapist_403(self, therapist_headers):
        r = requests.get(f"{API}/intake", headers=therapist_headers)
        assert r.status_code == 403

    def test_intake_create_with_priority(self, admin_headers):
        payload = {
            "child_name": "TEST_Priority Child",
            "intake_type": "pre",
            "service": "HS",
            "district": "TestDistrict",
            "time_pref": "Morning",
            "diagnosis": "ASD",
            "priority": True,
        }
        r = requests.post(f"{API}/intake", json=payload, headers=admin_headers)
        assert r.status_code == 200
        created = r.json()
        assert created["priority"] is True
        assert created["child_name"] == "TEST_Priority Child"
        iid = created["id"]
        # Verify in GET
        r2 = requests.get(f"{API}/intake", headers=admin_headers)
        found = next((x for x in r2.json() if x["id"] == iid), None)
        assert found is not None
        assert found["priority"] is True
        # Cleanup
        requests.delete(f"{API}/intake/{iid}", headers=admin_headers)


# ---------- Resources ----------
class TestResources:
    def test_resources_admin_sees_5(self, admin_headers):
        r = requests.get(f"{API}/resources", headers=admin_headers)
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 5, f"Expected 5 resources, got {len(items)}"
        titles = [x["title"] for x in items]
        for expected in ["Therapist Drive", "Therapist Training Hub",
                         "Client Files", "HR Files", "Company Policies"]:
            assert expected in titles

    def test_resources_therapist_sees_3(self, therapist_headers):
        r = requests.get(f"{API}/resources", headers=therapist_headers)
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 3, f"Therapist should see 3, got {len(items)}"
        # Must not contain admin-only resources
        titles = [x["title"] for x in items]
        assert "Client Files" not in titles
        assert "HR Files" not in titles
        # Must contain therapist + all ones
        assert "Therapist Drive" in titles
        assert "Company Policies" in titles

    def test_resources_crud(self, admin_headers):
        # Create
        payload = {"title": "TEST_Resource", "url": "https://test.example.com",
                   "visibility": "all", "description": "test"}
        r = requests.post(f"{API}/resources", json=payload, headers=admin_headers)
        assert r.status_code == 200
        rid = r.json()["id"]
        # Update
        payload2 = {"title": "TEST_Resource_Updated",
                    "url": "https://test2.example.com",
                    "visibility": "admin"}
        r2 = requests.put(f"{API}/resources/{rid}", json=payload2, headers=admin_headers)
        assert r2.status_code == 200
        assert r2.json()["title"] == "TEST_Resource_Updated"
        assert r2.json()["visibility"] == "admin"
        # Delete
        r3 = requests.delete(f"{API}/resources/{rid}", headers=admin_headers)
        assert r3.status_code == 200
        # Verify gone
        r4 = requests.get(f"{API}/resources", headers=admin_headers)
        assert all(x["id"] != rid for x in r4.json())


# ---------- Directory ----------
class TestDirectory:
    def test_directory_5_seeded(self, admin_headers):
        r = requests.get(f"{API}/directory", headers=admin_headers)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 5
        names = [x["name"] for x in items]
        for expected in ["Genan Almuhaisen", "Ms. Walaa",
                         "Ms. Maha", "Ms. Fahdah"]:
            assert expected in names, f"Missing {expected} in directory"
        # Check Genan is Direct Manager
        genan = next(x for x in items if x["name"] == "Genan Almuhaisen")
        assert genan["role"] == "Direct Manager"

    def test_directory_edit(self, admin_headers):
        r = requests.get(f"{API}/directory", headers=admin_headers)
        items = r.json()
        # Pick Ms. Walaa
        walaa = next(x for x in items if x["name"] == "Ms. Walaa")
        cid = walaa["id"]
        original_role = walaa.get("role")
        # Update
        r2 = requests.put(f"{API}/directory/{cid}",
                          json={"phone": "+966500000000"},
                          headers=admin_headers)
        assert r2.status_code == 200
        assert r2.json()["phone"] == "+966500000000"
        # Verify persisted
        r3 = requests.get(f"{API}/directory", headers=admin_headers)
        walaa2 = next(x for x in r3.json() if x["id"] == cid)
        assert walaa2["phone"] == "+966500000000"
        assert walaa2["role"] == original_role  # unchanged


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
