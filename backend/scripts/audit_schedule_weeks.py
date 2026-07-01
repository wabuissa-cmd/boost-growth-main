"""Read-only audit: count schedule_cells per week_start (trial week Jun 28 2026 variants)."""
import asyncio
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


async def main():
    url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "boost_growth")
    if not url:
        print("MONGO_URL not set — set backend/.env or export MONGO_URL")
        sys.exit(1)
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
    print("\nPrep markers for trial week (2026-06-28 Sun–Thu):")
    start, end = "2026-06-28", "2026-07-02"
    prep_n = await db.schedule_preparations.count_documents(
        {"session_date": {"$gte": start, "$lte": end}}
    )
    hist_n = await db.prep_history.count_documents(
        {"session_date": {"$gte": start, "$lte": end}}
    )
    sess_n = await db.sessions.count_documents(
        {"session_date": {"$gte": start, "$lte": end}, "status": "Completed"}
    )
    print(f"  schedule_preparations: {prep_n}")
    print(f"  prep_history: {hist_n}")
    print(f"  completed sessions: {sess_n}")
    if hist_n:
        sample = await db.prep_history.find(
            {"session_date": {"$gte": start, "$lte": end}},
            {"_id": 0, "therapist_id": 1, "client_id": 1, "session_date": 1, "client_name": 1},
        ).limit(3).to_list(3)
        print("  prep_history sample:", sample)
    cells_week = await db.schedule_cells.count_documents({"week_start": "2026-06-28"})
    print(f"  schedule_cells (2026-06-28): {cells_week}")
    pipeline = [
        {"$group": {"_id": "$week_start", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
        {"$limit": 15},
    ]
    async for row in db.schedule_cells.aggregate(pipeline):
        print(f"  {row['_id']}: {row['n']} cells")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
