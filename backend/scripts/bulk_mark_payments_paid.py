#!/usr/bin/env python3
"""Bulk-mark invoices paid (Fahad Suliman #079 stays partial / half paid).

Usage — production API:
  python scripts/bulk_mark_payments_paid.py

Usage — direct MongoDB:
  cd backend && MONGO_URL='mongodb+srv://...' python scripts/bulk_mark_payments_paid.py --mongo
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DEFAULT_API = "https://boost-growth-main-production-7283.up.railway.app/api"


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--mongo", action="store_true", help="Use MONGO_URL instead of production API")
    p.add_argument("--api-base", default=os.environ.get("API_BASE", DEFAULT_API))
    p.add_argument("--email", default=os.environ.get("ADMIN_EMAIL", "admin@boostgrowthsa.com"))
    p.add_argument("--password", default=os.environ.get("ADMIN_PASSWORD", "Admin123"))
    return p.parse_args()


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
    cmd = [
        "curl", "-s", "-X", "POST",
        f"{args.api_base.rstrip('/')}/admin/mark-all-payments-complete",
        "-H", f"Authorization: Bearer {token}",
    ]
    data = json.loads(subprocess.check_output(cmd))
    print(json.dumps(data, indent=2, ensure_ascii=False))
    return 0 if not data.get("skipped") or data.get("invoices_updated") is not None else 1


async def _run_mongo() -> int:
    if not os.environ.get("MONGO_URL"):
        print("ERROR: MONGO_URL not set")
        return 1
    from server import _migrate_mark_all_payments_complete  # noqa: E402

    data = await _migrate_mark_all_payments_complete(force=True)
    print(json.dumps(data, indent=2, ensure_ascii=False, default=str))
    return 0


def main() -> int:
    args = _parse_args()
    if args.mongo or os.environ.get("MONGO_URL"):
        return asyncio.run(_run_mongo())
    print("Note: using production API (pass --mongo with MONGO_URL for local DB)")
    return _run_api(args)


if __name__ == "__main__":
    raise SystemExit(main())
