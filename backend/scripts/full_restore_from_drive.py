#!/usr/bin/env python3
"""One-click full portal recovery from Google Drive + Master Sheet.

Imports Active Clients (Master Sheet), syncs all attendance/invoices from Drive,
imports schedule for trial week 2026-06-28, then relinks prep badges.

Usage — production API (recommended, no local MONGO_URL):
  python scripts/full_restore_from_drive.py

Usage — direct MongoDB:
  cd backend && MONGO_URL='mongodb+srv://...' python scripts/full_restore_from_drive.py --mongo

Dry-run (preview Drive folders only):
  python scripts/full_restore_from_drive.py --dry-run
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
TRIAL_WEEK = "2026-06-28"


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--mongo", action="store_true", help="Use MONGO_URL instead of production API")
    p.add_argument("--api-base", default=os.environ.get("API_BASE", DEFAULT_API))
    p.add_argument("--email", default=os.environ.get("ADMIN_EMAIL", "admin@boostgrowthsa.com"))
    p.add_argument("--password", default=os.environ.get("ADMIN_PASSWORD", "Admin123"))
    p.add_argument("--week-start", default=TRIAL_WEEK)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--skip-clients", action="store_true")
    p.add_argument("--skip-drive", action="store_true")
    p.add_argument("--skip-schedule", action="store_true")
    p.add_argument("--skip-recover", action="store_true")
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
    body = {
        "week_start": args.week_start,
        "dry_run": args.dry_run,
        "skip_clients": args.skip_clients,
        "skip_drive": args.skip_drive,
        "skip_schedule": args.skip_schedule,
        "skip_recover": args.skip_recover,
    }
    cmd = [
        "curl", "-s", "-X", "POST",
        f"{args.api_base.rstrip('/')}/admin/full-restore-from-drive",
        "-H", f"Authorization: Bearer {token}",
        "-H", "Content-Type: application/json",
        "-d", json.dumps(body),
    ]
    data = json.loads(subprocess.check_output(cmd))
    print(json.dumps(data, indent=2, default=str))
    print("\n===", data.get("summary_ar", "done"), "===")
    return 0 if data.get("ok") else 1


async def _run_mongo(args: argparse.Namespace) -> int:
    if not os.environ.get("MONGO_URL"):
        print("ERROR: MONGO_URL not set")
        return 1
    from server import _run_full_restore_from_drive  # noqa: E402

    data = await _run_full_restore_from_drive(
        week_start=args.week_start,
        dry_run=args.dry_run,
        skip_clients=args.skip_clients,
        skip_drive=args.skip_drive,
        skip_schedule=args.skip_schedule,
        skip_recover=args.skip_recover,
        user_id="cli-full-restore",
    )
    print(json.dumps(data, indent=2, default=str))
    print("\n===", data.get("summary_ar", "done"), "===")
    return 0 if data.get("ok") else 1


def main() -> int:
    args = _parse_args()
    if args.mongo or os.environ.get("MONGO_URL"):
        return asyncio.run(_run_mongo(args))
    print("Note: using production API (pass --mongo with MONGO_URL for local DB)")
    return _run_api(args)


if __name__ == "__main__":
    raise SystemExit(main())
