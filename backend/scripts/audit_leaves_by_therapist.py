#!/usr/bin/env python3
"""List leave requests for therapists by name/email pattern.

Usage — production API (Walaa ops or portal admin login):
  python scripts/audit_leaves_by_therapist.py --api razan hajar

Usage — direct MongoDB:
  cd backend && MONGO_URL='mongodb+srv://...' python scripts/audit_leaves_by_therapist.py razan hajar
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

DEFAULT_API = "https://staff.boostgrowth.org/api"
OPEN_STATUSES = frozenset({
    "pending", "pending_manager", "pending_hr", "pending_attachment", "in_progress",
})


def _print_block(block: dict) -> None:
    t = block.get("therapist") or {}
    print(f"\n=== {t.get('name')} ({t.get('email')}) id={t.get('id')} ===")
    print(f"  leave_balance: {t.get('leave_balance')}  contract: {t.get('contract_period_start')} → {t.get('contract_period_end')}")
    print(f"  leaves_total: {block.get('leaves_total')}  open: {block.get('leaves_open')}")
    leaves = block.get("leaves") or []
    if not leaves:
        print("  (no leave rows in database)")
        return
    for l in leaves:
        flag = "OPEN" if (l.get("status") in OPEN_STATUSES) else l.get("status")
        in_contract = "in-contract" if l.get("in_current_contract") else "outside-contract"
        print(
            f"  - {l.get('start_date')} → {l.get('end_date')} | {l.get('days')}d {l.get('leave_type')} "
            f"| {flag} | {in_contract} | created {str(l.get('created_at') or '')[:19]}"
        )


def _run_api(args: argparse.Namespace, patterns: list[str]) -> int:
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

    for pat in patterns:
        out = subprocess.check_output(
            [
                "curl", "-s",
                f"{args.api_base.rstrip('/')}/admin/leaves-audit",
                "-G", "--data-urlencode", f"q={pat}",
                "-H", f"Authorization: Bearer {token}",
            ]
        )
        data = json.loads(out)
        if data.get("detail"):
            print(f"API error for {pat!r}: {data['detail']}")
            continue
        for block in data.get("therapists") or []:
            _print_block(block)
        if not data.get("therapists"):
            print(f"\n(no therapists matched {pat!r})")
    return 0


async def _run_mongo(patterns: list[str]) -> int:
    from server import db, _contract_period_bounds, _ensure_contract_balance, _normalize_leave_status
    from server import therapist_schedule_display_name

    for pat in patterns:
        regex = {"$regex": pat.strip() or ".", "$options": "i"}
        therapists = await db.therapists.find(
            {"$or": [{"name": regex}, {"email": regex}, {"key": regex}]},
            {"_id": 0, "pin_hash": 0, "password_hash": 0},
        ).sort("name", 1).to_list(50)
        if not therapists:
            print(f"\n(no therapists matched {pat!r})")
            continue
        for t in therapists:
            t = await _ensure_contract_balance(t)
            start, end = _contract_period_bounds(t)
            leaves = await db.leaves.find(
                {"therapist_id": t["id"]}, {"_id": 0, "document_file_data": 0},
            ).sort("start_date", -1).to_list(500)
            block = {
                "therapist": {
                    "id": t["id"],
                    "name": therapist_schedule_display_name(t),
                    "email": t.get("email"),
                    "leave_balance": t.get("leave_balance"),
                    "contract_period_start": start,
                    "contract_period_end": end,
                },
                "leaves_total": len(leaves),
                "leaves_open": sum(
                    1 for l in leaves if _normalize_leave_status(l.get("status")) in OPEN_STATUSES
                ),
                "leaves": [
                    {
                        "start_date": l.get("start_date"),
                        "end_date": l.get("end_date"),
                        "days": l.get("days"),
                        "leave_type": l.get("leave_type"),
                        "status": l.get("status"),
                        "created_at": l.get("created_at"),
                        "in_current_contract": start <= (l.get("start_date") or "") <= end,
                    }
                    for l in leaves
                ],
            }
            _print_block(block)
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Audit leave requests by therapist name pattern")
    p.add_argument("patterns", nargs="+", help="Name/email fragments, e.g. razan hajar")
    p.add_argument("--api", action="store_true", help="Use production API instead of MONGO_URL")
    p.add_argument("--api-base", default=os.environ.get("API_BASE", DEFAULT_API))
    p.add_argument("--email", default=os.environ.get("AUDIT_EMAIL", "wabuissa@boostgrowthsa.com"))
    p.add_argument("--password", default=os.environ.get("AUDIT_PASSWORD", "growth2026"))
    args = p.parse_args()

    if args.api or not os.environ.get("MONGO_URL"):
        if not os.environ.get("MONGO_URL"):
            print("Note: MONGO_URL not set — using API mode\n")
        return _run_api(args, args.patterns)
    return asyncio.run(_run_mongo(args.patterns))


if __name__ == "__main__":
    raise SystemExit(main())
