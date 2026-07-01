#!/usr/bin/env python3
"""Integration test: prep relink creates markers from sessions + recovery paths."""
import asyncio
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "boost_growth_prep_test")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

START, END = "2026-06-28", "2026-07-02"
WEEK = "2026-06-28"


async def main():
    from server import (  # noqa: E402
        db,
        _sync_schedule_preparations_for_week,
        _recover_misdated_week_prep,
        _prep_week_diagnostics,
        _session_date_range_query,
        _prep_week_marker_scope_query,
    )

    tid = f"test-therapist-{uuid.uuid4().hex[:8]}"
    cid = f"test-client-{uuid.uuid4().hex[:8]}"
    cell_id = str(uuid.uuid4())

    await db.schedule_cells.insert_one({
        "id": cell_id,
        "therapist_id": tid,
        "day": 0,
        "time_slot": "8:00 AM - 9:00 AM",
        "service_code": "HS",
        "child_name": "Prep Test Child",
        "week_start": WEEK,
        "state": "normal",
    })
    await db.clients.insert_one({
        "id": cid,
        "name": "Prep Test Child",
    })
    await db.sessions.insert_one({
        "id": str(uuid.uuid4()),
        "client_id": cid,
        "session_date": "2026-06-28",
        "status": "Completed",
        "therapist_ids": [tid],
        "hours": 2,
        "created_by": "test",
    })

    recovery = await _sync_schedule_preparations_for_week(START, END)
    rows = await db.schedule_preparations.find(
        _prep_week_marker_scope_query(START, END),
        {"_id": 0},
    ).to_list(100)
    unique = {
        (r.get("therapist_id"), r.get("client_id"), (r.get("session_date") or "")[:10])
        for r in rows
        if r.get("therapist_id") and r.get("client_id")
    }
    assert len(unique) >= 1, f"expected markers, got {rows!r}, recovery={recovery}"

    await db.schedule_preparations.delete_many({"therapist_id": tid})
    await db.prep_history.delete_many({"therapist_id": tid})
    await db.sessions.delete_many({"therapist_ids": tid})
    await db.schedule_cells.delete_many({"therapist_id": tid})
    await db.clients.delete_one({"id": cid})

    print("integration ok", {"linked": len(unique), "recovery": recovery})


if __name__ == "__main__":
    asyncio.run(main())
