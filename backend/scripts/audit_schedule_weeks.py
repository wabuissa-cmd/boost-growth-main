"""Read-only audit + prep relink diagnostics for trial week Jun 28 2026."""
import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from motor.motor_asyncio import AsyncIOMotorClient

TARGETS = [
    "2026-06-28",
    "2025-06-28",
    "2026-06-21",
    "2026-07-05",
    "2026-05-10",
    "2026-05-03",
]

TRIAL_START = "2026-06-28"
TRIAL_END = "2026-07-02"


async def main():
    url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "boost_growth")
    if not url:
        print("MONGO_URL not set — set backend/.env or export MONGO_URL")
        sys.exit(1)

    from server import (  # noqa: E402
        _prep_week_diagnostics,
        _recover_misdated_week_prep,
        _session_date_range_query,
        _prep_week_marker_scope_query,
        _shift_calendar_year,
        _schedule_week_start_variants,
    )

    client = AsyncIOMotorClient(url)
    db = client[db_name]
    print(f"Database: {db_name}\n")
    print("week_start          | cells | week_status")
    print("-" * 48)
    for ws in TARGETS:
        n = await db.schedule_cells.count_documents({"week_start": ws})
        meta = await db.schedule_weeks.find_one({"week_start": ws}, {"_id": 0, "status": 1})
        status = (meta or {}).get("status") or "(none)"
        print(f"{ws}  | {n:5} | {status}")

    print(f"\n=== Prep diagnostics ({TRIAL_START} Sun–Thu) ===")
    diag = await _prep_week_diagnostics(TRIAL_START, TRIAL_END)
    print(json.dumps(diag, indent=2))

    alt_start = _shift_calendar_year(TRIAL_START, -1)
    alt_end = _shift_calendar_year(TRIAL_END, -1)
    print(f"\nYear-shift probe ({alt_start} – {alt_end}):")
    if alt_start and alt_end:
        print(f"  prep_history: {await db.prep_history.count_documents(_session_date_range_query(alt_start, alt_end))}")
        print(f"  completed sessions: {await db.sessions.count_documents({**_session_date_range_query(alt_start, alt_end), 'status': 'Completed'})}")

    week_variants = _schedule_week_start_variants(TRIAL_START)
    prep_by_ws = await db.schedule_preparations.count_documents({"week_start": {"$in": week_variants}})
    prep_scoped = await db.schedule_preparations.count_documents(_prep_week_marker_scope_query(TRIAL_START, TRIAL_END))
    print(f"\nschedule_preparations by week_start: {prep_by_ws}")
    print(f"schedule_preparations scoped (date OR week_start): {prep_scoped}")

    hist_sample = await db.prep_history.find(
        _session_date_range_query(TRIAL_START, TRIAL_END),
        {"_id": 0, "therapist_id": 1, "client_id": 1, "session_date": 1, "prepared_at": 1, "client_name": 1},
    ).limit(5).to_list(5)
    if hist_sample:
        print("\nprep_history sample (in-range):", hist_sample)
    else:
        by_pa = await db.prep_history.find(
            {"prepared_at": {"$gte": f"{TRIAL_START}T", "$lte": f"{TRIAL_END}T23:59:59.999Z"}},
            {"_id": 0, "therapist_id": 1, "client_id": 1, "session_date": 1, "prepared_at": 1},
        ).limit(5).to_list(5)
        if by_pa:
            print("\nprep_history sample (prepared_at in week, session_date may be wrong):", by_pa)

    sess_sample = await db.sessions.find(
        {**_session_date_range_query(TRIAL_START, TRIAL_END), "status": "Completed"},
        {"_id": 0, "client_id": 1, "session_date": 1, "therapist_ids": 1, "status": 1},
    ).limit(5).to_list(5)
    if sess_sample:
        print("\ncompleted sessions sample:", sess_sample)

    supp_n = await db.schedule_prep_suppressions.count_documents(_session_date_range_query(TRIAL_START, TRIAL_END))
    print(f"\nprep_suppressions in week: {supp_n}")

    if os.environ.get("DRY_RUN", "1") != "1":
        print("\n=== Running recovery (DRY_RUN=0) ===")
        recovery = await _recover_misdated_week_prep(TRIAL_START, TRIAL_END)
        print("recovery:", recovery)
        print("after:", json.dumps(await _prep_week_diagnostics(TRIAL_START, TRIAL_END), indent=2))
    else:
        print("\n(Set DRY_RUN=0 to run _recover_misdated_week_prep on production)")

    pipeline = [
        {"$group": {"_id": "$week_start", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
        {"$limit": 15},
    ]
    print("\nTop schedule_cells week_start values:")
    async for row in db.schedule_cells.aggregate(pipeline):
        print(f"  {row['_id']}: {row['n']} cells")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
