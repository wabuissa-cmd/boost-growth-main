#!/usr/bin/env python3
"""Count staff purchases per month (Jan–Jul) for 2026.

Usage — direct MongoDB:
  cd backend && MONGO_URL='mongodb+srv://...' python scripts/audit_purchases_by_month.py

Usage — production API:
  python scripts/audit_purchases_by_month.py --api
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import subprocess
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DEFAULT_API = "https://staff.boostgrowth.org/api"
YEAR = 2026
MONTHS = [f"{YEAR}-{m:02d}" for m in range(1, 8)]


def _month_key(doc: dict) -> str:
    pm = (doc.get("purchase_month") or "").strip()
    if len(pm) >= 7:
        return pm[:7]
    for field in ("purchase_date", "reimbursement_date"):
        val = (doc.get(field) or "")[:7]
        if len(val) >= 7:
            return val
    return "unknown"


def _print_report(items: list) -> None:
    counts = Counter(_month_key(p) for p in items)
    print(f"Total purchases: {len(items)}")
    print(f"\nCounts Jan–Jul {YEAR}:")
    for month in MONTHS:
        rows = [p for p in items if _month_key(p) == month]
        print(f"  {month}: {len(rows)}")
        for p in rows:
            print(
                f"    - {p.get('item')} | {p.get('purchaser_name') or p.get('therapist_name')} "
                f"| pm={p.get('purchase_month')} | pd={p.get('purchase_date')} "
                f"| sync={p.get('sync_source')} imported={p.get('imported')}"
            )
    other = {k: v for k, v in counts.items() if k not in MONTHS and k != "unknown"}
    if other:
        print("\nOther months:", dict(sorted(other.items())))


def _run_api(args: argparse.Namespace) -> int:
    out = subprocess.check_output(
        [
            "curl", "-s", "-X", "POST", f"{args.api_base.rstrip('/')}/auth/login",
            "-H", "Content-Type: application/json",
            "-d", json.dumps({"email": args.email, "password": args.password}),
        ]
    )
    token = json.loads(out).get("token")
    if not token:
        print("Login failed:", out.decode())
        return 1
    out = subprocess.check_output(
        [
            "curl", "-s", f"{args.api_base.rstrip('/')}/purchases",
            "-H", f"Authorization: Bearer {token}",
        ]
    )
    items = json.loads(out)
    if not isinstance(items, list):
        print("Unexpected response:", items)
        return 1
    _print_report(items)
    return 0


async def _run_mongo() -> int:
    url = os.environ.get("MONGO_URL")
    if not url:
        print("ERROR: MONGO_URL not set — use backend/.env or --api mode")
        return 1
    from server import db, _purchase_month_key  # noqa: E402

    items = await db.staff_purchases.find({}, {"_id": 0}).sort("purchase_month", 1).to_list(5000)
    for it in items:
        pm = _purchase_month_key(it)
        if pm:
            it["purchase_month"] = pm
    _print_report(items)
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--api", action="store_true", help="Use production API instead of MONGO_URL")
    p.add_argument("--api-base", default=os.environ.get("API_BASE", DEFAULT_API))
    p.add_argument("--email", default=os.environ.get("ADMIN_EMAIL", "admin@boostgrowthsa.com"))
    p.add_argument("--password", default=os.environ.get("ADMIN_PASSWORD", "Admin123"))
    args = p.parse_args()
    if args.api or not os.environ.get("MONGO_URL"):
        if not os.environ.get("MONGO_URL"):
            print("Note: MONGO_URL not set — using API mode\n")
        return _run_api(args)
    return asyncio.run(_run_mongo())


if __name__ == "__main__":
    raise SystemExit(main())
