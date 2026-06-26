#!/usr/bin/env python3
"""Rebuild SS (school) invoices on production from Google Sheets attendance workbooks."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from drive_sync import fetch_workbook_from_url

BASE = "https://boost-growth-main-production-7283.up.railway.app/api"
REBUILD_FROM = "2026-04-01"


def inv_key(n: str) -> str:
    return re.sub(r"[\s\-_]+", "", (n or "").strip(), flags=re.I).upper()


def norm_date_raw(raw) -> str | None:
    if isinstance(raw, datetime):
        return raw.strftime("%Y-%m-%d")
    s = str(raw).strip().replace("\\", "/")
    if not s:
        return None
    try:
        return datetime.fromisoformat(s[:10]).strftime("%Y-%m-%d")
    except Exception:
        pass
    for sep in ("/", "-"):
        if sep in s:
            parts = s.split(sep)
            if len(parts) == 3:
                try:
                    d, mo, y = int(parts[0]), int(parts[1]), int(parts[2])
                    if y < 100:
                        y += 2000
                    return datetime(y, mo, d).strftime("%Y-%m-%d")
                except Exception:
                    continue
    return None


def swap_md(iso: str) -> str:
    y, mo, d = map(int, iso.split("-"))
    if mo <= 12 and d <= 12 and mo != d:
        try:
            return datetime(y, d, mo).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return iso


def parse_dm_text(s: str) -> str | None:
    s = str(s).strip().replace("\\", "/")
    for sep in ("/", "-"):
        if sep in s:
            parts = s.split(sep)
            if len(parts) == 3:
                try:
                    d, mo, y = int(parts[0]), int(parts[1]), int(parts[2])
                    if y < 100:
                        y += 2000
                    return datetime(y, mo, d).strftime("%Y-%m-%d")
                except Exception:
                    continue
    return None


def normalize_session_date(raw, text_dates: list[str]) -> str | None:
    if isinstance(raw, str):
        return parse_dm_text(raw)
    if isinstance(raw, datetime):
        iso = raw.strftime("%Y-%m-%d")
        has_spring = any(x.startswith(("2026-04", "2026-05", "2026-06")) for x in text_dates)
        if has_spring:
            y, mo, d = map(int, iso.split("-"))
            if mo <= 12 and d <= 12 and mo != d:
                try:
                    swapped = datetime(y, d, mo).strftime("%Y-%m-%d")
                    if swapped.startswith(("2026-04", "2026-05", "2026-06")):
                        return swapped
                except ValueError:
                    pass
        return iso
    return norm_date_raw(raw)


def fix_session_dates(dates: list[str]) -> list[str]:
    """Legacy batch fix when sheet has no d/m text anchors."""
    if not dates:
        return dates
    months = Counter(x[:7] for x in dates if x)
    dominant = months.most_common(1)[0][0] if months else None
    out = []
    for iso in dates:
        if not iso:
            continue
        mo = int(iso[5:7])
        if dominant and dominant.startswith("2026-0") and mo >= 7 and months.get(dominant, 0) >= 3:
            out.append(swap_md(iso))
        else:
            out.append(iso)
    return out


def norm_status(s: str) -> str | None:
    sl = (s or "").strip().lower()
    if sl in ("completed", "complete", "delivered"):
        return "Completed"
    if "no show" in sl:
        return "No Show"
    if "cancel" in sl:
        return "Cancelled"
    if "no service" in sl or sl == "ns":
        return "No Service"
    return None


def is_ss_tab(ws) -> bool:
    flat = " ".join(
        str(ws.cell(r, c).value or "")
        for r in range(1, 10)
        for c in range(1, 8)
    ).lower()
    if "school support" in flat or "school session" in flat:
        return True
    if re.search(r"4\s*week", flat):
        return True
    return False


def is_closed_tab(ws) -> bool:
    return str(ws.cell(1, 3).value or "").strip().lower().startswith("clos")


def parse_ss_tab(ws, tab: str) -> dict | None:
    if not is_ss_tab(ws):
        return None
    inv = inv_key(tab)
    hdr = None
    cols: dict = {}
    for r in range(1, 15):
        row = [str(ws.cell(r, c).value or "").strip() for c in range(1, 12)]
        low = [x.lower() for x in row]
        if "date" in low and "status" in low:
            hdr = r
            cols = {h: i for i, h in enumerate(low)}
            break
    if not hdr:
        return None
    text_dates: list[str] = []
    raw_rows = []
    for r in range(hdr + 1, hdr + 100):
        d = ws.cell(r, cols["date"] + 1).value
        st = str(ws.cell(r, cols["status"] + 1).value or "").strip()
        if not d and not st:
            continue
        joined = " ".join(str(ws.cell(r, c).value or "") for c in range(1, 10)).lower()
        if "total" in joined:
            break
        if isinstance(d, str):
            dm = parse_dm_text(d)
            if dm:
                text_dates.append(dm)
        raw_rows.append((d, st))
    raw_sess = []
    for d, st in raw_rows:
        ns = norm_status(st)
        di = normalize_session_date(d, text_dates)
        if di and ns:
            raw_sess.append({"session_date": di, "status": ns})
    if not raw_sess:
        return None
    raw_sess.sort(key=lambda x: x["session_date"])
    closed = is_closed_tab(ws)
    return {
        "invoice_number": inv,
        "tab": tab.strip(),
        "is_closed": closed,
        "start_date": raw_sess[0]["session_date"],
        "close_date": raw_sess[-1]["session_date"] if closed else None,
        "sessions": raw_sess,
    }


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


def put_invoice(api: Api, inv: dict, **fields):
    payload = {
        "invoice_number": inv["invoice_number"],
        "notes": inv.get("notes"),
        "amount": inv.get("amount"),
        "period_from": inv.get("period_from"),
        "period_to": inv.get("period_to"),
        "package_size": fields.get("package_size", 4),
        "payment_status": inv.get("payment_status") or "pending",
        "start_date": fields.get("start_date", inv.get("start_date")),
        "service_type": "SS",
        "is_closed": fields.get("is_closed", inv.get("is_closed")),
        "close_date": fields.get("close_date", inv.get("close_date")),
        "week_overrides": fields.get("week_overrides", inv.get("week_overrides") or {}),
    }
    return api.send("PUT", f"/invoices/{inv['id']}", payload)


def rebuild_ss_invoice(api: Api, client: dict, inv: dict, excel: dict) -> dict:
    cid = client["id"]
    iid = inv["id"]
    inv_num = inv["invoice_number"]
    main_tid = client.get("main_therapist_id")

    invs = api.get(f"/clients/{cid}/invoices")
    for other in invs:
        st = other.get("service_type")
        if other["id"] == iid:
            continue
        if st == "SS" or (other.get("package_size") == 4 and st in (None, "SS")):
            if not other.get("is_closed"):
                put_invoice(api, other, is_closed=True, close_date=other.get("close_date"))

    put_invoice(
        api, inv,
        is_closed=False,
        start_date=excel["start_date"],
        package_size=4,
        week_overrides={},
    )

    existing = api.get(f"/sessions?client_id={cid}&invoice_id={iid}")
    for s in existing:
        api.send("DELETE", f"/sessions/{s['id']}")

    posted = 0
    for sess in excel["sessions"]:
        body = {
            "client_id": cid,
            "session_date": sess["session_date"],
            "status": sess["status"],
            "hours": 0,
            "service_type": "SS",
            "therapist_ids": [main_tid] if main_tid else [],
        }
        api.send("POST", "/sessions", body)
        posted += 1

    wo = {}
    if excel["is_closed"]:
        wo = {"1": "completed", "2": "completed", "3": "completed", "4": "completed"}

    updated = put_invoice(
        api, inv,
        is_closed=excel["is_closed"],
        start_date=excel["start_date"],
        close_date=excel["close_date"],
        package_size=4,
        week_overrides=wo,
        payment_status="complete" if excel["is_closed"] else inv.get("payment_status"),
    )
    return {
        "invoice": inv_num,
        "posted": posted,
        "closed": excel["is_closed"],
        "start": excel["start_date"],
        "week_overrides": wo,
        "portal": updated.get("is_closed"),
    }


def rebuild_client_ss(api: Api, client: dict) -> tuple[list, list]:
    results = []
    errors = []
    fn = client.get("file_no")
    url = client.get("attendance_sheet_url")
    if not url:
        return results, errors
    try:
        wb = fetch_workbook_from_url(url)
    except Exception as e:
        errors.append((fn, "fetch", str(e)))
        return results, errors

    excel_tabs = []
    for tab in wb.sheetnames:
        pkg = parse_ss_tab(wb[tab], tab)
        if pkg and pkg["start_date"] >= REBUILD_FROM:
            excel_tabs.append(pkg)

    if not excel_tabs:
        return results, errors

    invs = api.get(f"/clients/{client['id']}/invoices")
    by_num = {inv_key(i["invoice_number"]): i for i in invs}

    for excel in excel_tabs:
        inv = by_num.get(excel["invoice_number"])
        if not inv:
            errors.append((fn, excel["invoice_number"], "missing on portal"))
            continue
        try:
            r = rebuild_ss_invoice(api, client, inv, excel)
            results.append((fn, r))
            print(f"OK {fn} {r['invoice']}: {r['posted']} sessions, closed={r['closed']}, wo={bool(r['week_overrides'])}")
        except Exception as e:
            errors.append((fn, excel["invoice_number"], str(e)))
            print(f"ERR {fn} {excel['invoice_number']}: {e}")
    return results, errors


def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--file-no", action="append")
    args = p.parse_args()
    api = Api()
    clients = api.get("/clients")
    if args.file_no:
        want = set(args.file_no)
        clients = [c for c in clients if c.get("file_no") in want]
    else:
        clients = sorted(clients, key=lambda c: c.get("file_no", ""))

    results = []
    errors = []
    for client in clients:
        r, e = rebuild_client_ss(api, client)
        results.extend(r)
        errors.extend(e)

    print(f"\nDone: {len(results)} rebuilt, {len(errors)} errors")
    for e in errors:
        print(" ", e)


if __name__ == "__main__":
    main()
