#!/usr/bin/env python3
"""Sync child birth dates from Active Clients Drive case summaries and intake forms."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from drive_sync import resolve_client_birth_date

BASE = "https://boost-growth-main-production-7283.up.railway.app/api"
SOURCE_FILE = Path("/Users/walaa/Downloads/Clients' Info-4.xlsx")


class Api:
    def __init__(self):
        out = subprocess.check_output(
            [
                "curl", "-s", "-X", "POST", f"{BASE}/auth/login",
                "-H", "Content-Type: application/json",
                "-d", '{"email":"admin@boostgrowthsa.com","password":"Admin123"}',
            ]
        )
        self.token = json.loads(out)["token"]
        self.h = [
            "-H", f"Authorization: Bearer {self.token}",
            "-H", "Content-Type: application/json",
        ]

    def get(self, path: str):
        return json.loads(subprocess.check_output(["curl", "-s", f"{BASE}{path}"] + self.h))

    def send(self, method: str, path: str, body: dict | None = None):
        cmd = ["curl", "-s", "-X", method, f"{BASE}{path}"] + self.h
        if body is not None:
            cmd += ["-d", json.dumps(body)]
        return json.loads(subprocess.check_output(cmd))


def put_client(api: Api, client: dict, **patch):
    payload = {k: client.get(k) for k in (
        "name", "file_no", "birth_date", "age", "parent_name", "parent_phone", "package_hours",
        "billing_mode", "cycle_weeks", "cycle_start_date", "package_end_date",
        "payment_status", "package_reset_at", "notes", "main_therapist_id",
        "co_therapist_ids", "supervisor", "locations", "color", "drive_url",
        "schedule_color", "status", "service_type", "address", "intake_file_url",
        "attendance_sheet_url", "progress_reports_url", "case_summary_url",
        "drive_folder_id", "drive_links", "case_summary_sections",
    )}
    payload.update(patch)
    return api.send("PUT", f"/clients/{client['id']}", payload)


def sync_via_api(api: Api, *, dry_run: bool, overwrite: bool, file_nos: list[str] | None):
    body = {"dry_run": dry_run, "overwrite": overwrite}
    if file_nos:
        body["file_nos"] = file_nos
    return api.send("POST", "/admin/sync-birth-dates-from-drive", body)


def sync_local(api: Api, *, dry_run: bool, overwrite: bool):
    """Fallback: resolve birth dates client-by-client when admin endpoint is not deployed yet."""
    clients = api.get("/clients")
    updated = 0
    skipped = 0
    for client in clients:
        if (client.get("status") or "Active") == "Inactive":
            continue
        name = client.get("name") or ""
        file_no = client.get("file_no") or ""
        existing = (client.get("birth_date") or "").strip()
        if existing and not overwrite:
            skipped += 1
            continue
        birth_iso = resolve_client_birth_date(
            case_summary_url=client.get("case_summary_url"),
            intake_file_url=client.get("intake_file_url"),
            case_summary_sections=client.get("case_summary_sections"),
        )
        if not birth_iso or birth_iso == existing:
            skipped += 1
            print(f"  skip {file_no} {name}: {birth_iso or 'not found'}")
            continue
        if dry_run:
            print(f"  would update {file_no} {name}: {birth_iso}")
        else:
            put_client(api, client, birth_date=birth_iso)
            print(f"  updated {file_no} {name}: {birth_iso}")
        updated += 1
    return {"updated": updated, "skipped": skipped}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--overwrite", action="store_true", help="Replace existing birth_date values")
    parser.add_argument("--file-no", action="append", dest="file_nos", help="Limit to file number(s)")
    parser.add_argument("--local", action="store_true", help="Client-by-client PUT fallback")
    args = parser.parse_args()

    api = Api()
    print(f"Source workbook (active client list): {SOURCE_FILE}")

    if args.local:
        result = sync_local(api, dry_run=args.dry_run, overwrite=args.overwrite)
        print(f"Done: {result['updated']} updated, {result['skipped']} skipped")
        return

    try:
        result = sync_via_api(
            api, dry_run=args.dry_run, overwrite=args.overwrite, file_nos=args.file_nos,
        )
    except subprocess.CalledProcessError:
        print("Admin endpoint unavailable — falling back to local sync")
        result = sync_local(api, dry_run=args.dry_run, overwrite=args.overwrite)

    print(result.get("message") or result)
    for row in result.get("results") or []:
        if row.get("status") in ("updated", "would_update"):
            print(f"  {row.get('file_no')} {row.get('name')}: {row.get('birth_date')}")


if __name__ == "__main__":
    main()
