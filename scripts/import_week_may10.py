"""Import schedule for week of May 10 - May 14 from Excel.
Long sessions automatically detected from time-range hints in notes (e.g. "8:30 - 10:30") and merged using `duration` field.
"""
import asyncio
import os
import sys
import uuid
import re
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / "backend" / ".env")

from motor.motor_asyncio import AsyncIOMotorClient

WEEK_START = "2026-05-10"

# (day, time_slot, service_code, child, custom_time_or_note, duration)
SCHEDULE = [
    {"therapist": "Ms. Fahda", "items": [
        (0, "9:00 AM - 10:00 AM", "SS", "Aljouharhah", "8:30 AM - 10:30 AM", 2),  # 2 hours, merged
        (0, "1:00 PM - 2:00 PM", "HS", "Salman", None, 1),
        (0, "3:00 PM - 4:00 PM", "SUPERVISION", None, "W/ Abdulaziz A", 1),
        (1, "2:00 PM - 3:00 PM", "HS", "Abdulaziz W", None, 1),
        (1, "3:00 PM - 4:00 PM", "SUPERVISION", None, "W/ Faisal", 1),
        (2, "10:00 AM - 11:00 AM", "SS", "Aljouharhah", "10:30 AM - 12:30 PM", 2),
        (3, "2:00 PM - 3:00 PM", "HS", "Abdulaziz W", None, 1),
        (3, "3:00 PM - 4:00 PM", "HS", "Salman", None, 1),
        (4, "9:00 AM - 10:00 AM", "SS", "Aljouharhah", "8:30 AM - 10:30 AM", 2),
        (4, "1:00 PM - 2:00 PM", "HS", "Salman", None, 1),
    ]},
    {"therapist": "Ms. Razan", "items": [
        (0, "8:00 AM - 9:00 AM", "SS", "Saif", "Summer Camp", 1),
        (1, "8:00 AM - 9:00 AM", "SS", "Saif", "Summer Camp", 1),
        (2, "8:00 AM - 9:00 AM", "SS", "Saif", "Summer Camp", 1),
        (3, "8:00 AM - 9:00 AM", "SS", "Saif", "Summer Camp", 1),
        (4, "8:00 AM - 9:00 AM", "SS", "Saif", "Summer Camp", 1),
    ]},
    {"therapist": "Ms. Manal", "items": [
        (0, "2:00 PM - 3:00 PM", "HS", "Salman", None, 1),
        (1, "11:00 AM - 12:00 PM", "HS", "Sultan", None, 1),
        (3, "11:00 AM - 12:00 PM", "HS", "Sultan", None, 1),
        (4, "11:00 AM - 12:00 PM", "HS", "Sultan", None, 1),
    ]},
    {"therapist": "Ms. Sharifah", "items": [
        (0, "8:00 AM - 9:00 AM", "SS", "Saleh", "Summer Camp", 1),
        (1, "8:00 AM - 9:00 AM", "SS", "Saleh", "Summer Camp", 1),
        (2, "8:00 AM - 9:00 AM", "SS", "Saleh", "Summer Camp", 1),
        (3, "8:00 AM - 9:00 AM", "SS", "Saleh", "Summer Camp", 1),
        (4, "8:00 AM - 9:00 AM", "SS", "Saleh", "Summer Camp", 1),
    ]},
    {"therapist": "Ms. Hajer", "items": [
        (0, "8:00 AM - 9:00 AM", "HS", "Abdulaziz W", None, 1),
        (0, "10:00 AM - 11:00 AM", "HS", "Alwaleed", "10:30 - 12:30", 2),  # merged 2 hours
        (0, "1:00 PM - 2:00 PM", "HS", "Ameirah", "1:30", 1),
        (1, "10:00 AM - 11:00 AM", "HS", "Alwaleed", "10:30 - 12:30", 2),
        (1, "2:00 PM - 3:00 PM", "HS", "Yahaya", None, 1),
        (2, "8:00 AM - 9:00 AM", "HS", "Abdulaziz W", None, 1),
        (2, "10:00 AM - 11:00 AM", "HS", "Alwaleed", "10:30 - 12:30", 2),
        (2, "1:00 PM - 2:00 PM", "HS", "Ameirah", "1:30", 1),
        (3, "10:00 AM - 11:00 AM", "HS", "Alwaleed", "10:30 - 12:30", 2),
        (3, "2:00 PM - 3:00 PM", "HS", "Yahaya", None, 1),
        (4, "8:00 AM - 9:00 AM", "HS", "Abdulaziz W", None, 1),
        (4, "10:00 AM - 11:00 AM", "HS", "Alwaleed", "10:30 - 12:30", 2),
        (4, "1:00 PM - 2:00 PM", "HS", "Ameirah", "1:30", 1),
    ]},
    {"therapist": "Ms. Rahaf", "items": [
        (0, "2:00 PM - 3:00 PM", "HS", "Abdulaziz A", None, 1),
        (1, "2:00 PM - 3:00 PM", "HS", "Abdulaziz A", None, 1),
        (2, "2:00 PM - 3:00 PM", "HS", "Abdulaziz A", None, 1),
        (3, "2:00 PM - 3:00 PM", "HS", "Abdulaziz A", None, 1),
        (4, "2:00 PM - 3:00 PM", "HS", "Abdulaziz A", None, 1),
    ]},
    {"therapist": "Ms. Shatha", "items": [
        (0, "9:00 AM - 10:00 AM", "HS", "Faisal", None, 1),
        (0, "11:00 AM - 12:00 PM", "HS", "Husam", None, 1),
        (1, "9:00 AM - 10:00 AM", "HS", "Faisal", None, 1),
        (1, "10:00 AM - 11:00 AM", "SS", "Husam", None, 1),
        (2, "10:00 AM - 11:00 AM", "SS", "Husam", None, 1),
        (3, "9:00 AM - 10:00 AM", "HS", "Faisal", None, 1),
        (4, "9:00 AM - 10:00 AM", "HS", "Faisal", None, 1),
        (4, "10:00 AM - 11:00 AM", "SS", "Husam", None, 1),
    ]},
]


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    therapists = {t["name"]: t["id"] async for t in db.therapists.find({}, {"_id": 0, "id": 1, "name": 1})}
    print(f"Found {len(therapists)} therapists in DB")

    deleted = await db.schedule_cells.delete_many({"week_start": WEEK_START})
    print(f"Cleared {deleted.deleted_count} existing cells for week {WEEK_START}")

    inserted = 0
    skipped = 0
    for entry in SCHEDULE:
        tname = entry["therapist"]
        tid = therapists.get(tname)
        if not tid:
            print(f"  ! skipping: therapist '{tname}' not in DB")
            skipped += len(entry["items"])
            continue
        for day, slot, sc, child, note_or_time, duration in entry["items"]:
            # If note_or_time matches a time pattern like "8:30 - 10:30", store as custom_time
            custom_time = None
            note = None
            if note_or_time:
                if re.match(r"^\d{1,2}:\d{2}", note_or_time):
                    custom_time = note_or_time
                else:
                    note = note_or_time
            doc = {
                "id": str(uuid.uuid4()),
                "therapist_id": tid,
                "day": day,
                "time_slot": slot,
                "week_start": WEEK_START,
                "service_code": sc,
                "child_name": child,
                "note": note,
                "custom_time": custom_time,
                "duration": duration,
                "state": "normal",
                "color": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.schedule_cells.insert_one(doc)
            inserted += 1
    print(f"\nDone! Inserted {inserted} cells. Skipped {skipped}.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
