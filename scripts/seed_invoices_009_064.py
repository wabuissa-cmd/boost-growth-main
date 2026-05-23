"""
Seed pre-loaded invoices for client 009 (Saleh Ahusainy) and client 064 (Nawaf Alshweb).
Idempotent: only adds invoices whose invoice_number does not yet exist for that client.
Existing invoices are NEVER deleted (per user safety rules).
"""
import os
import sys
import uuid
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# (invoice_number, is_closed, close_date_iso_or_None)
SEED = {
    "009": [
        ("INV0465", False, None),
        ("INV0455", False, None),
        ("INV0427", True, "2026-05-03"),
        ("INV0410", True, "2026-04-19"),
        ("INV0385", True, "2026-02-24"),
        ("INV0338", False, None),
        ("INV0317", True, "2025-12-04"),
        ("INV0293", False, None),
        ("INV0279", False, None),
    ],
    "064": [
        ("INV0383", True, "2026-02-26"),
        ("Copy of INV0383", False, None),
    ],
}


def seed_for(file_no, items):
    client = db.clients.find_one({"file_no": file_no}, {"_id": 0, "id": 1, "name": 1, "package_hours": 1})
    if not client:
        print(f"[skip] client file_no={file_no} not found in DB")
        return
    print(f"[client] {file_no} - {client['name']} (id={client['id']})")
    existing = {i["invoice_number"] for i in db.invoices.find(
        {"client_id": client["id"]}, {"_id": 0, "invoice_number": 1}
    )}
    pkg = client.get("package_hours") or 24
    added = 0
    for number, closed, close_date in items:
        if number in existing:
            print(f"  · skip (exists): {number}")
            continue
        doc = {
            "id": str(uuid.uuid4()),
            "client_id": client["id"],
            "invoice_number": number,
            "notes": None,
            "amount": None,
            "period_from": None,
            "period_to": None,
            "package_size": pkg,
            "payment_status": "complete" if closed else "pending",
            "start_date": close_date or now_iso()[:10],
            "service_type": "Home Session",
            "is_closed": bool(closed),
            "close_date": close_date,
            "created_by": "seed",
            "created_at": now_iso(),
        }
        db.invoices.insert_one(doc)
        added += 1
        print(f"  + added: {number} ({'Closed ' + close_date if closed else 'Open'})")
    print(f"[done] {file_no}: +{added} invoice(s)\n")


if __name__ == "__main__":
    for file_no, items in SEED.items():
        seed_for(file_no, items)
    print("All done.")
