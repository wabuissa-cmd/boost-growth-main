#!/usr/bin/env python3
"""Full portal data audit — counts, gaps, duplicate therapists, recovery steps.

Usage (production):
  cd backend && MONGO_URL='mongodb://...' DB_NAME=boost_growth python scripts/audit_full_portal_data.py

Optional:
  WEEK_START=2026-06-28  — focus schedule/prep diagnostics on one week
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from motor.motor_asyncio import AsyncIOMotorClient

OFFICIAL_CLIENT_COUNT = 25
FOCUS_WEEK = os.environ.get("WEEK_START", "2026-06-28")


def _bar(ok: bool) -> str:
    return "✓" if ok else "✗"


async def main():
    url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "boost_growth")
    if not url:
        print("ERROR: MONGO_URL not set — export MONGO_URL or add backend/.env")
        print("\nRecovery without DB access:")
        print("  1. Admin → Data & Backup → Export Backup (download JSON)")
        print("  2. Import → re-upload Active Clients + Schedule Excel for current week")
        print("  3. Admin → Seed Master Data (safe — updates missing fields only)")
        sys.exit(1)

    from server import (  # noqa: E402
        _active_client_filter,
        _billing_active_client_filter,
        _prep_week_diagnostics,
        _schedule_week_start_variants,
        _therapist_identity_token,
        therapist_schedule_display_name,
        OFFICIAL_CLIENT_FILE_NOS,
        INACTIVE_CLIENT_FILE_NOS,
    )

    client = AsyncIOMotorClient(url)
    db = client[db_name]
    print(f"=== Boost Growth Portal Audit ===")
    print(f"Database: {db_name}\n")

    # --- Core counts ---
    active_clients = await db.clients.count_documents(_active_client_filter())
    billing_active_clients = await db.clients.count_documents(_billing_active_client_filter())
    deleted_clients = await db.clients.count_documents({"deleted": True})
    total_clients = await db.clients.count_documents({})
    invoices = await db.invoices.count_documents({})
    sessions = await db.sessions.count_documents({})
    completed_sessions = await db.sessions.count_documents({"status": "Completed"})
    prep_history = await db.prep_history.count_documents({})
    therapists = await db.therapists.find({}, {"_id": 0}).to_list(500)
    schedule_cells = await db.schedule_cells.count_documents({})
    stored_backups = await db.backups.count_documents({})

    clients_with_invoices = len(await db.invoices.distinct("client_id"))
    clients_with_sessions = len(await db.sessions.distinct("client_id"))

    expected_billing = len(OFFICIAL_CLIENT_FILE_NOS - INACTIVE_CLIENT_FILE_NOS)
    print("--- Collection counts ---")
    rows = [
        ("clients (portal total)", active_clients, True),
        ("clients (billing-active)", billing_active_clients, billing_active_clients >= expected_billing),
        ("clients (inactive)", active_clients - billing_active_clients, True),
        ("clients (soft-deleted)", deleted_clients, True),
        ("clients (total)", total_clients, True),
        ("therapists", len(therapists), 12 <= len(therapists) <= 20),
        ("invoices", invoices, invoices > 0),
        ("sessions (all)", sessions, sessions > 0),
        ("sessions (completed)", completed_sessions, completed_sessions > 0),
        ("prep_history", prep_history, prep_history > 0),
        ("schedule_cells (all weeks)", schedule_cells, schedule_cells > 0),
        ("stored_backups", stored_backups, stored_backups > 0),
    ]
    for label, n, ok in rows:
        print(f"  [{_bar(ok)}] {label}: {n}")

    print(f"\n  Clients with invoices: {clients_with_invoices}")
    print(f"  Clients with sessions: {clients_with_sessions}")
    print(f"  Official seed file_nos: {len(OFFICIAL_CLIENT_FILE_NOS)}")
    print(f"  Known inactive file_nos: {', '.join(sorted(INACTIVE_CLIENT_FILE_NOS))}")

    # --- Missing official clients ---
    present_file_nos = {
        str(c.get("file_no") or "").zfill(3)
        async for c in db.clients.find(_active_client_filter(), {"_id": 0, "file_no": 1})
        if c.get("file_no")
    }
    missing_official = sorted(OFFICIAL_CLIENT_FILE_NOS - present_file_nos)
    if missing_official:
        print(f"\n--- Missing official clients ({len(missing_official)}) ---")
        for fn in missing_official:
            print(f"  file_no {fn}")

    # --- Duplicate therapists ---
    by_token: dict = {}
    by_display: dict = {}
    for t in therapists:
        tok = _therapist_identity_token(t) or t.get("id")
        by_token.setdefault(tok, []).append(t)
        disp = therapist_schedule_display_name(t).lower()
        by_display.setdefault(disp, []).append(t)

    dup_tokens = {k: v for k, v in by_token.items() if len(v) > 1}
    dup_names = {k: v for k, v in by_display.items() if len(v) > 1}
    print(f"\n--- Therapist duplicates ---")
    print(f"  By identity token: {len(dup_tokens)} groups")
    for tok, group in sorted(dup_tokens.items()):
        names = ", ".join(f"{x.get('name')} ({x['id'][:8]})" for x in group)
        print(f"    {tok}: {names}")
    print(f"  By display name: {len(dup_names)} groups")
    for name, group in sorted(dup_names.items()):
        if len(group) < 2:
            continue
        print(f"    {name}: {len(group)} rows")

    # --- Schedule weeks ---
    print("\n--- Top schedule weeks (cells) ---")
    pipeline = [
        {"$group": {"_id": "$week_start", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
        {"$limit": 12},
    ]
    async for row in db.schedule_cells.aggregate(pipeline):
        ws = row["_id"]
        meta = await db.schedule_weeks.find_one({"week_start": ws}, {"_id": 0, "status": 1})
        status = (meta or {}).get("status") or "(none)"
        print(f"  {ws}: {row['n']} cells · {status}")

    focus_variants = _schedule_week_start_variants(FOCUS_WEEK)
    focus_cells = await db.schedule_cells.count_documents({"week_start": {"$in": focus_variants}})
    print(f"\n--- Focus week {FOCUS_WEEK} ---")
    print(f"  schedule_cells: {focus_cells}")
    if focus_cells:
        try:
            from datetime import datetime, timedelta
            start = datetime.strptime(FOCUS_WEEK, "%Y-%m-%d").date()
            trial_end = (start + timedelta(days=4)).isoformat()
            diag = await _prep_week_diagnostics(FOCUS_WEEK, trial_end)
            print(f"  prep diagnostics: {json.dumps(diag, indent=2)}")
        except Exception as e:
            print(f"  prep diagnostics skipped: {e}")

    # --- Per-child data completeness (official list, billing-active only) ---
    print("\n--- Per-child data check (billing-active official file_nos) ---")
    missing_invoices: list[str] = []
    missing_sessions: list[str] = []
    missing_drive: list[str] = []
    child_rows: list[dict] = []
    async for c in db.clients.find(_billing_active_client_filter(), {"_id": 0}).sort("file_no", 1):
        fn = str(c.get("file_no") or "").zfill(3)
        if fn not in OFFICIAL_CLIENT_FILE_NOS:
            continue
        n_inv = await db.invoices.count_documents({"client_id": c["id"]})
        n_sess = await db.sessions.count_documents({"client_id": c["id"]})
        has_drive = bool((c.get("drive_url") or c.get("attendance_sheet_url") or "").strip())
        row = {
            "file_no": fn,
            "name": c.get("name"),
            "invoices": n_inv,
            "sessions": n_sess,
            "drive": has_drive,
        }
        child_rows.append(row)
        if n_inv == 0:
            missing_invoices.append(f"#{fn} {c.get('name')}")
        if n_sess == 0:
            missing_sessions.append(f"#{fn} {c.get('name')}")
        if not has_drive:
            missing_drive.append(f"#{fn} {c.get('name')}")

    for row in child_rows:
        flags = []
        if row["invoices"] == 0:
            flags.append("no invoices")
        if row["sessions"] == 0:
            flags.append("no sessions")
        if not row["drive"]:
            flags.append("no drive url")
        status = "OK" if not flags else ", ".join(flags)
        print(f"  #{row['file_no']} {row['name']}: inv={row['invoices']} sess={row['sessions']} · {status}")

    if missing_invoices:
        print(f"\n  Missing invoices ({len(missing_invoices)}): {', '.join(missing_invoices[:8])}")
        if len(missing_invoices) > 8:
            print(f"    ... +{len(missing_invoices) - 8} more")
    if missing_sessions:
        print(f"  Missing sessions ({len(missing_sessions)}): {', '.join(missing_sessions[:8])}")
        if len(missing_sessions) > 8:
            print(f"    ... +{len(missing_sessions) - 8} more")

    # --- Invoice / session gaps per client ---
    print("\n--- Clients missing billing data (billing-active, no invoices) ---")
    gap_count = 0
    async for c in db.clients.find(_billing_active_client_filter(), {"_id": 0, "id": 1, "name": 1, "file_no": 1}):
        n_inv = await db.invoices.count_documents({"client_id": c["id"]})
        n_sess = await db.sessions.count_documents({"client_id": c["id"]})
        if n_inv == 0 and n_sess == 0:
            gap_count += 1
            if gap_count <= 15:
                print(f"  #{c.get('file_no') or '?'} {c.get('name')}")
    if gap_count > 15:
        print(f"  ... and {gap_count - 15} more")
    if gap_count == 0:
        print("  (none — all active clients have sessions or invoices)")

    # --- Recovery guide ---
    data_ok = active_clients >= 20 and schedule_cells > 0
    billing_ok = invoices > 0 and sessions > 0
    prep_ok = prep_history > 0

    print("\n" + "=" * 60)
    print("RECOVERY STEPS (English)")
    print("=" * 60)
    if stored_backups > 0:
        print("A. RESTORE FROM STORED BACKUP (fastest if backup exists):")
        print("   Admin → Data & Backup → pick backup → Restore")
        print("   Or: POST /admin/restore-backup/{id} with dry_run=false")
    print("B. RE-IMPORT FROM EXCEL (schedule only wipes cells for that week):")
    print("   Import → Active Clients CSV (clients NOT deleted by schedule import)")
    print("   Import → Schedule Excel for current week (clear_existing only affects that week)")
    print("C. SEED MASTER DATA (safe — updates therapists/clients, never deletes):")
    print("   Admin → Run Seed")
    print("D. PER-CLIENT INVOICES: Clients page → upload Excel per child")
    print("E. SESSIONS / PREP: re-log via Attendance or Schedule prep relink")
    if missing_official:
        print("F. MISSING CHILDREN: Admin → restore-official-clients OR re-import clients file")

    print("\n" + "=" * 60)
    print("خطوات الاستعادة (عربي)")
    print("=" * 60)
    if data_ok:
        print("✓ بيانات الأطفال والجدول موجودة في قاعدة البيانات — لم يُمسح كل شيء.")
    else:
        print("✗ يبدو أن جزءاً كبيراً من البيانات مفقود — اتبع الخطوات أدناه.")
    if stored_backups > 0:
        print(f"١. استعادة من نسخة احتياطية ({stored_backups} نسخة محفوظة): لوحة Admin → استعادة")
    else:
        print("١. لا توجد نسخ احتياطية محفوظة بعد — فعّل النسخ اليومي أو صدّر Backup يدوياً")
    print("٢. إعادة استيراد ملف Active Clients من Import (لا يحذف الجدول)")
    print("٣. إعادة استيراد Excel الجدول للأسبوع الحالي من Import")
    print("٤. Seed Master Data من Admin (آمن — يحدّث البيانات الناقصة)")
    if not billing_ok:
        print("٥. الفواتير/الجلسات: ارفع Excel لكل طفل من صفحة Clients أو استعد من backup")
    if not prep_ok:
        print("٦. سجل التحضير: قد يحتاج إعادة ربط Schedule → Relink prep أو تسجيل جلسات جديدة")
    if dup_tokens or dup_names:
        print("٧. أسماء المعالجين المكررة: أعد تشغيل السيرفر (dedupe تلقائي) أو راجع therapists في Admin")

    summary = {
        "active_clients": active_clients,
        "billing_active_clients": billing_active_clients,
        "inactive_clients": active_clients - billing_active_clients,
        "deleted_clients": deleted_clients,
        "therapists": len(therapists),
        "duplicate_therapist_groups": len(dup_tokens),
        "invoices": invoices,
        "sessions": sessions,
        "prep_history": prep_history,
        "schedule_cells": schedule_cells,
        "stored_backups": stored_backups,
        "missing_official_file_nos": missing_official,
        "missing_invoices": missing_invoices,
        "missing_sessions": missing_sessions,
        "missing_drive_url": missing_drive,
        "child_rows": child_rows,
        "focus_week_cells": focus_cells,
        "clients_without_billing": gap_count,
    }
    print("\n--- JSON summary ---")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
