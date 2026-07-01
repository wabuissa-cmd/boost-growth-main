#!/usr/bin/env python3
"""Restore stable prep badge for Saleh (#009) on Fahda's Wed 2026-07-01 schedule cell."""
from __future__ import annotations

import json
import subprocess
import sys

BASE = "https://staff.boostgrowth.org/api"
WEEK_START = "2026-06-28"
SESSION_DATE = "2026-07-01"
FILE_NO = "009"


def api(token: str):
    h = ["-H", f"Authorization: Bearer {token}", "-H", "Content-Type: application/json"]

    def get(path: str):
        return json.loads(subprocess.check_output(["curl", "-s", f"{BASE}{path}"] + h, text=True))

    def post(path: str, body: dict | None = None):
        cmd = ["curl", "-s", "-X", "POST", f"{BASE}{path}"] + h
        if body is not None:
            cmd += ["-d", json.dumps(body)]
        return json.loads(subprocess.check_output(cmd, text=True))

    return get, post


def main() -> int:
    login = json.loads(subprocess.check_output([
        "curl", "-s", "-X", "POST", f"{BASE}/auth/login",
        "-H", "Content-Type: application/json",
        "-d", '{"email":"admin@boostgrowthsa.com","password":"Admin123"}',
    ], text=True))
    token = login.get("token")
    if not token:
        print("Login failed:", login, file=sys.stderr)
        return 1

    get, post = api(token)
    clients = get("/clients")
    saleh = next((c for c in clients if c.get("file_no") == FILE_NO), None)
    if not saleh:
        print("Client 009 not found", file=sys.stderr)
        return 1

    therapists = get("/therapists")
    fahda = next(
        (t for t in therapists if "fahda" in (t.get("name") or "").lower()),
        None,
    )
    if not fahda:
        print("Fahda therapist not found", file=sys.stderr)
        return 1

    cells = get(f"/schedule?week_start={WEEK_START}")
    fahda_cell = next(
        (
            c for c in cells
            if c.get("therapist_id") == fahda["id"]
            and c.get("day") == 3
            and "saleh" in (c.get("child_name") or c.get("note") or "").lower()
        ),
        None,
    )
    if not fahda_cell:
        print("Fahda+Saleh Wed cell not found", file=sys.stderr)
        return 1

    prep = get(f"/schedule/preparations?week_start={WEEK_START}")
    sups = prep.get("suppressions") or []
    cleared = 0
    for s in sups:
        if (
            s.get("client_id") == saleh["id"]
            and (s.get("session_date") or "")[:10] == SESSION_DATE
            and s.get("therapist_id") == fahda["id"]
        ):
            # No DELETE endpoint — relink/reconcile clears stale suppressions after deploy.
            cleared += 1

    marker = post("/schedule/preparations", {
        "therapist_id": fahda["id"],
        "client_id": saleh["id"],
        "session_date": SESSION_DATE,
        "time_slot": fahda_cell.get("time_slot") or "",
        "schedule_cell_id": fahda_cell.get("id"),
        "week_start": WEEK_START,
        "day": fahda_cell.get("day"),
        "notes": "Production fix: restore Fahda+Saleh Wed prep badge",
    })
    relink = post(f"/schedule/relink-prep?week_start={WEEK_START}")

    prep2 = get(f"/schedule/preparations?week_start={WEEK_START}")
    items = [
        i for i in (prep2.get("items") or [])
        if i.get("client_id") == saleh["id"]
        and (i.get("session_date") or "")[:10] == SESSION_DATE
        and i.get("therapist_id") == fahda["id"]
    ]

    print(json.dumps({
        "ok": True,
        "saleh_id": saleh["id"],
        "fahda_id": fahda["id"],
        "cell_id": fahda_cell.get("id"),
        "stale_suppressions_noted": cleared,
        "marker": marker,
        "relink_linked": relink.get("linked_count"),
        "fahda_wed_markers_after": len(items),
        "items": items,
    }, indent=2, default=str))
    return 0 if items else 1


if __name__ == "__main__":
    raise SystemExit(main())
