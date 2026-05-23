"""Update therapist emails from the Excel list provided by Walaa.
Matches therapists by first-name (e.g. 'Ms. Abeer' -> 'Abeer Alshareef').
Adds Najla as a new therapist if not present.
"""
import asyncio, os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / "backend" / ".env")
from motor.motor_asyncio import AsyncIOMotorClient

# Map: first-name (in DB Ms. <first>) -> (full_name, email)
EMAIL_MAP = {
    "Abeer":    ("Abeer Alshareef",    "a.alshareef@boostgrowthsa.com"),
    "Alhanouf": ("Alhanouf Alromman",  "a.alromman@boostgrowthsa.com"),
    "Bodoor":   ("Bodour Alkhalifah",  "balkhalifah@boostgrowthsa.com"),
    "Fahda":    ("Fahda Alghadeeb",    "falghadeeb@boostgrowthsa.com"),
    "Fatimah":  ("Fatimah Alkhater",   "falkhater@boostgrowthsa.com"),
    "Hajer":    ("Hajar Alfulaij",     "halfulaij@boostgrowthsa.com"),
    "Jenan":    ("Jenan Almuhaisin",   "jsalmuhaisin@boostgrowthsa.com"),
    "Maha":     ("Maha Althunayan",    "msalthunayan@boostgrowthsa.com"),
    "Manal":    ("Manal Aldosery",     "maldosery@boostgrowthsa.com"),
    "Rahaf":    ("Rahaf Aljuhani",     "raljuhani@boostgrowthsa.com"),
    "Razan":    ("Razan Alshatery",    "ralshatery@boostgrowthsa.com"),
    "Shatha":   ("Shatha Alhammami",   "shalhammami@boostgrowthsa.com"),
    "Shrooq":   ("Shuroog Alamri",     "shalamri@boostgrowthsa.com"),
    "Waad":     ("Waad Alhamed",       "walhamed@boostgrowthsa.com"),
}

# Therapists to ADD if not already present
ADD_NEW = [
    {"name": "Ms. Najla", "email": "nalhamad@boostgrowthsa.com", "color": "#A4BCCB"},
]

async def main():
    c = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = c[os.environ["DB_NAME"]]
    therapists = await db.therapists.find({}, {"_id": 0}).to_list(100)
    updated = 0
    for t in therapists:
        first = t["name"].replace("Ms. ", "").strip()
        if first in EMAIL_MAP:
            full, email = EMAIL_MAP[first]
            r = await db.therapists.update_one(
                {"id": t["id"]},
                {"$set": {"email": email}}
            )
            if r.modified_count:
                updated += 1
                print(f"  ✓ {t['name']:18s} -> {email}")
            else:
                print(f"  - {t['name']:18s} already had {email}")
    # Add Najla if missing
    import uuid
    for new in ADD_NEW:
        existing = await db.therapists.find_one({"name": new["name"]})
        if not existing:
            from passlib.context import CryptContext
            pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
            from datetime import datetime, timezone
            doc = {
                "id": str(uuid.uuid4()),
                "name": new["name"],
                "email": new["email"],
                "color": new["color"],
                "phone": None,
                "pin_hash": pwd_ctx.hash("0000"),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.therapists.insert_one(doc)
            print(f"  + Added: {new['name']} -> {new['email']}")
    print(f"\nDone! Updated {updated} emails.")
    c.close()

if __name__ == "__main__":
    asyncio.run(main())
