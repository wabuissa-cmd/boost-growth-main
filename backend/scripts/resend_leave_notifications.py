#!/usr/bin/env python3
"""Re-send Jenan urgent emails for open manager-pending leaves.

Usage — production API (portal admin):
  python scripts/resend_leave_notifications.py --api --email ADMIN@... --password '...' \\
    --therapists hajar razan manal

Dry run (list only):
  python scripts/resend_leave_notifications.py --api --dry-run --therapists hajar razan manal

Flush failed email_queue rows:
  python scripts/resend_leave_notifications.py --api --flush-queue --limit 50
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

DEFAULT_API = "https://staff.boostgrowth.org/api"


def _login(api_base: str, email: str, password: str) -> str:
    out = subprocess.check_output(
        [
            "curl", "-s", "-X", "POST", f"{api_base.rstrip('/')}/auth/login",
            "-H", "Content-Type: application/json",
            "-d", json.dumps({"email": email, "password": password}),
        ]
    )
    token = json.loads(out).get("token")
    if not token:
        print("Login failed:", out.decode())
        sys.exit(1)
    return token


def _post(api_base: str, token: str, path: str, body: dict | None = None, query: str = "") -> dict:
    url = f"{api_base.rstrip('/')}{path}"
    if query:
        url = f"{url}?{query}"
    cmd = ["curl", "-s", "-X", "POST", url, "-H", f"Authorization: Bearer {token}"]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    out = subprocess.check_output(cmd)
    return json.loads(out)


def _get(api_base: str, token: str, path: str, query: str = "") -> dict:
    url = f"{api_base.rstrip('/')}{path}"
    if query:
        url = f"{url}?{query}"
    out = subprocess.check_output(["curl", "-s", url, "-H", f"Authorization: Bearer {token}"])
    return json.loads(out)


def main() -> int:
    p = argparse.ArgumentParser(description="Resend leave notification emails to Jenan")
    p.add_argument("--api", action="store_true", help="Use production/staging API")
    p.add_argument("--api-base", default=DEFAULT_API)
    p.add_argument("--email", default="")
    p.add_argument("--password", default="")
    p.add_argument("--therapists", nargs="*", default=["hajar", "razan", "manal"])
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--flush-queue", action="store_true", help="Retry failed/queued email_queue rows")
    p.add_argument("--limit", type=int, default=50)
    args = p.parse_args()

    if not args.api:
        print("Use --api with --email and --password (portal admin).")
        return 1
    if not args.email or not args.password:
        print("--email and --password required for API mode.")
        return 1

    token = _login(args.api_base, args.email.strip(), args.password)
    if args.flush_queue:
        data = _post(args.api_base, token, "/admin/email-queue/retry", query=f"limit={args.limit}")
        print(json.dumps(data, indent=2))
        return 0

    body = {
        "therapists": args.therapists,
        "dry_run": args.dry_run,
        "also_notify_in_app": not args.dry_run,
    }
    data = _post(args.api_base, token, "/admin/resend-leave-notifications", body)
    print(json.dumps(data, indent=2))
    if data.get("detail"):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
