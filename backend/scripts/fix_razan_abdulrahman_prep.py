#!/usr/bin/env python3
"""Fix Razan prep logged for Lulu when cell shows Abdulrahman (note vs child_name drift)."""
from __future__ import annotations

import json
import subprocess
import sys

BASE = "https://staff.boostgrowth.org/api"
RAZAN_THERAPIST_ID = "2832a061-2e3b-4a91-af66-8b5ec6ff00d4"
ABDUL_FILE = "068"
LULU_FILE = "062"


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
    abdul = next((c for c in clients if c.get("file_no") == ABDUL_FILE), None)
    lulu = next((c for c in clients if c.get("file_no") == LULU_FILE), None)
    if not abdul or not lulu:
        print("Clients 068/062 not found", file=sys.stderr)
        return 1

    week_start = get("/schedule/current-week-start").get("week_start")
    if not week_start:
        print("Could not resolve current week", file=sys.stderr)
        return 1

    cells = get(f"/schedule?week_start={week_start}")
    razan_abdul_cells = [
        c for c in cells
        if c.get("therapist_id") == RAZAN_THERAPIST_ID
        and "abdul" in ((c.get("note") or "") + " " + (c.get("child_name") or "")).lower()
    ]
    if not razan_abdul_cells:
        print("No Razan+Abdulrahman cells this week — nothing to fix", file=sys.stderr)
        return 0

    cleared = []
    for cell in razan_abdul_cells:
        day = cell.get("day")
        ws = cell.get("week_start") or week_start
        from datetime import datetime, timedelta
        session_date = (datetime.strptime(ws[:10], "%Y-%m-%d") + timedelta(days=int(day or 0))).strftime("%Y-%m-%d")
        wrong = post("/schedule/preparations/clear", {
            "therapist_id": RAZAN_THERAPIST_ID,
            "client_id": lulu["id"],
            "session_date": session_date,
            "schedule_cell_id": cell.get("id"),
            "time_slot": cell.get("time_slot") or "",
            "suppress_badge": True,
            "delete_prep_history": True,
            "delete_sessions": False,
        })
        marker = post("/schedule/preparations", {
            "therapist_id": RAZAN_THERAPIST_ID,
            "client_id": abdul["id"],
            "session_date": session_date,
            "time_slot": cell.get("time_slot") or "",
            "schedule_cell_id": cell.get("id"),
            "week_start": ws,
            "day": day,
            "notes": "Production fix: Abdulrahman prep (was wrongly linked to Lulu)",
            "cell_child_name": (cell.get("note") or cell.get("child_name") or "").split("|")[-1].strip(),
        })
        cleared.append({"cell_id": cell.get("id"), "session_date": session_date, "wrong_clear": wrong, "marker": marker})

    relink = post(f"/schedule/relink-prep?week_start={week_start}")
    print(json.dumps({
        "ok": True,
        "week_start": week_start,
        "abdul_id": abdul["id"],
        "lulu_id": lulu["id"],
        "fixed_cells": cleared,
        "relink": relink,
    }, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
