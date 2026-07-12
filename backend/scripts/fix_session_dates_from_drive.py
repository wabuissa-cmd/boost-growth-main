#!/usr/bin/env python3
"""Fix inverted session dates from Drive Excel workbooks — one child at a time."""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from drive_sync import (
    ACTIVE_CLIENTS_FOLDER_ID,
    fetch_workbook_from_url,
    list_active_client_folders,
    resolve_attendance_sheet_url,
)

BASE = "https://staff.boostgrowth.org/api"
_INV_RE = re.compile(r"inv[\s\-_]*(\d+)", re.I)
_SKIP_TABS = ("summary", "template", "archive", "old", "backup", "readme", "index")

_DAY_LABEL_TO_ABBR = {
    "mon": "Mon", "monday": "Mon",
    "tue": "Tue", "tues": "Tue", "tuesday": "Tue",
    "wed": "Wed", "wednesday": "Wed",
    "thu": "Thu", "thur": "Thu", "thurs": "Thu", "thursday": "Thu",
    "fri": "Fri", "friday": "Fri",
    "sat": "Sat", "saturday": "Sat",
    "sun": "Sun", "sunday": "Sun",
}


def inv_key(name: str) -> str:
    m = _INV_RE.search(name or "")
    return f"INV{m.group(1)}" if m else ""


def day_name(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso[:10]).strftime("%a")
    except Exception:
        return ""


def normalize_date(s: str) -> Optional[str]:
    s = (s or "").strip()
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


def swap_month_day(iso: str) -> Optional[str]:
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", (iso or "")[:10])
    if not m:
        return None
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if mo == d or mo > 12 or d > 12:
        return None
    try:
        return datetime(y, d, mo).strftime("%Y-%m-%d")
    except ValueError:
        return None


def day_label_to_abbr(label: str) -> Optional[str]:
    s = (label or "").strip().lower()
    if not s:
        return None
    if s[:3] in _DAY_LABEL_TO_ABBR:
        return _DAY_LABEL_TO_ABBR[s[:3]]
    return _DAY_LABEL_TO_ABBR.get(s)


def matches_day_label(iso: str, label: str) -> bool:
    abbr = day_label_to_abbr(label)
    return not abbr or day_name(iso) == abbr


def correct_by_day_label(iso: str, label: str) -> str:
    if not iso or not label or matches_day_label(iso, label):
        return iso
    swapped = swap_month_day(iso)
    if swapped and matches_day_label(swapped, label):
        return swapped
    return iso


def likely_swapped(iso: str, peers: list[str]) -> Optional[str]:
    swapped = swap_month_day(iso)
    if not swapped or swapped == iso:
        return None
    peer_list = [p[:10] for p in peers if p and p[:10] != iso[:10]]
    if len(peer_list) < 2:
        return None
    peer_months = Counter(p[:7] for p in peer_list)
    cur_m, swap_m = iso[:7], swapped[:7]
    if peer_months.get(swap_m, 0) < 2:
        return None
    if peer_months.get(cur_m, 0) > 1:
        return None
    if peer_months.get(swap_m, 0) <= peer_months.get(cur_m, 0):
        return None
    try:
        swap_dt = datetime.fromisoformat(swapped)
        peer_dts = sorted(datetime.fromisoformat(p) for p in peer_list)
        margin = timedelta(days=45)
        if swap_dt < peer_dts[0] - margin or swap_dt > peer_dts[-1] + margin:
            return None
    except Exception:
        return None
    return swapped


def normalize_excel_date(raw, text_dates: list, day_label: str = "", peers: Optional[list] = None) -> Optional[str]:
    iso = None
    if isinstance(raw, datetime):
        iso = raw.strftime("%Y-%m-%d")
        anchor = any(str(x).startswith(("2024-", "2025-", "2026-")) for x in text_dates)
        swapped = swap_month_day(iso)
        if anchor and swapped and swapped != iso:
            if day_label:
                if matches_day_label(swapped, day_label) and not matches_day_label(iso, day_label):
                    iso = swapped
            elif peers and len(peers) >= 2:
                fixed = likely_swapped(iso, peers)
                if fixed:
                    iso = fixed
    elif raw:
        iso = normalize_date(str(raw))
    if iso and day_label:
        iso = correct_by_day_label(iso, day_label)
    return iso


def parse_time_range(s: str) -> tuple[str, str, float]:
    s = (s or "").strip()
    m = re.search(r"(\d{1,2})(?::(\d{2}))?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?", s)
    if not m:
        return "", "", 0.0
    h1, m1, h2, m2 = m.group(1), m.group(2) or "00", m.group(3), m.group(4) or "00"
    start = f"{int(h1):02d}:{int(m1):02d}"
    end = f"{int(h2):02d}:{int(m2):02d}"
    diff = ((int(h2) * 60 + int(m2)) - (int(h1) * 60 + int(m1))) / 60.0
    if diff < 0:
        diff += 24
    return start, end, round(diff, 2)


def norm_status(s: str) -> str:
    sl = (s or "").strip().lower()
    if re.match(r"^(hs|ss)\s*\|", sl):
        s = re.sub(r"^(hs|ss)\s*\|\s*", "", s, flags=re.I).strip()
        sl = s.lower()
    if sl in ("completed", "complete", "delivered"):
        return "Completed"
    if "no service" in sl or sl == "ns":
        return "No Service"
    if "cancel" in sl:
        return "Cancelled"
    if "no show" in sl or "no-show" in sl:
        return "No Show"
    return s.title() if s else "Completed"


def find_header(ws) -> tuple[Optional[int], dict]:
    for r_idx, row in enumerate(ws.iter_rows(min_row=1, max_row=12, values_only=True), start=1):
        cells = [str(c).strip().lower() if c is not None else "" for c in row]
        joined = " ".join(cells)
        if "date" in cells and ("status" in cells or "# of hrs" in joined or "hrs" in joined):
            col_map: dict = {}
            for ci, h in enumerate(cells):
                if h in ("day", "days"):
                    col_map["day"] = ci
                elif h == "date":
                    col_map["date"] = ci
                elif h == "status":
                    col_map["status"] = ci
                elif h == "time":
                    col_map["time"] = ci
                elif h in ("# of hrs", "hrs", "hours"):
                    col_map["hours"] = ci
                elif h == "therapist":
                    col_map["therapist"] = ci
            return r_idx, col_map
    return None, {}


def parse_sheet_rows(ws) -> list[dict]:
    hdr, col_map = find_header(ws)
    if not hdr or "date" not in col_map:
        return []
    raw_rows = []
    text_dates = []
    for row_idx, row in enumerate(ws.iter_rows(min_row=hdr + 1, values_only=True), start=hdr + 1):
        if row is None or all(c is None or (isinstance(c, str) and not c.strip()) for c in row):
            continue
        joined = " ".join(str(c).lower() for c in row if c is not None)
        if "total" in joined and "session" in joined:
            break
        raw_date = row[col_map["date"]] if col_map["date"] < len(row) else None
        if not raw_date:
            continue
        day_label = ""
        if "day" in col_map and col_map["day"] < len(row) and row[col_map["day"]]:
            day_label = str(row[col_map["day"]]).strip()
        if isinstance(raw_date, str):
            td = normalize_date(raw_date)
            if td:
                text_dates.append(td)
        status = norm_status(
            str(row[col_map["status"]]).strip()
            if "status" in col_map and col_map["status"] < len(row) and row[col_map["status"]]
            else ""
        )
        time_str = (
            str(row[col_map["time"]]).strip()
            if "time" in col_map and col_map["time"] < len(row) and row[col_map["time"]]
            else ""
        )
        start_t, end_t, _ = parse_time_range(time_str)
        raw_rows.append({
            "row_idx": row_idx,
            "raw_date": raw_date,
            "day_label": day_label,
            "status": status,
            "start_time": start_t or None,
            "end_time": end_t or None,
        })
    peers: list[str] = []
    out = []
    for rd in raw_rows:
        iso = normalize_excel_date(rd["raw_date"], text_dates, rd.get("day_label", ""), peers)
        rd["date_iso"] = iso
        if iso:
            peers.append(iso)
            out.append(rd)
    return out


def discover_sheets(wb, file_no: str) -> list[str]:
    fn = (file_no or "").strip().zfill(3)
    out = []
    for name in wb.sheetnames:
        sn = name.strip()
        if any(h in sn.lower() for h in _SKIP_TABS):
            continue
        if inv_key(sn) or (fn and fn in re.sub(r"[\s\-_]+", "", sn)):
            if parse_sheet_rows(wb[name]):
                out.append(name)
    return out


class Api:
    def __init__(self):
        out = subprocess.check_output([
            "curl", "-s", "-X", "POST", f"{BASE}/auth/login",
            "-H", "Content-Type: application/json",
            "-d", '{"email":"admin@boostgrowthsa.com","password":"Admin123"}',
        ])
        self.token = json.loads(out)["token"]
        self.h = ["-H", f"Authorization: Bearer {self.token}", "-H", "Content-Type: application/json"]

    def get(self, path: str):
        return json.loads(subprocess.check_output(["curl", "-s", f"{BASE}{path}"] + self.h))

    def send(self, method: str, path: str, body: dict | None = None):
        cmd = ["curl", "-s", "-X", method, f"{BASE}{path}"] + self.h
        if body is not None:
            cmd += ["-d", json.dumps(body)]
        raw = subprocess.check_output(cmd)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"raw": raw.decode()}


def reconcile_child(api: Api, file_no: str, folder_id: str, apply: bool) -> dict:
    lookup = api.get(f"/admin/client-lookup/{file_no}")
    cid = lookup.get("client_id") or (lookup.get("client") or {}).get("id")
    if not cid:
        return {"file_no": file_no, "status": "skipped", "reason": "client not found"}
    name = lookup.get("name") or (lookup.get("client") or {}).get("name")
    sheet_url = resolve_attendance_sheet_url(folder_id)
    if not sheet_url:
        return {"file_no": file_no, "name": name, "status": "skipped", "reason": "no sheet"}
    wb = fetch_workbook_from_url(sheet_url)
    invoices = {inv_key(i.get("invoice_number") or ""): i for i in api.get(f"/clients/{cid}/invoices")}
    for inv in api.get(f"/clients/{cid}/invoices"):
        tab = (inv.get("source_sheet") or "").strip()
        k = inv_key(inv.get("invoice_number") or tab)
        if k:
            invoices[k] = inv

    fixes = []
    applied = 0
    for tab in discover_sheets(wb, file_no):
        inv_num = inv_key(tab) or tab.strip()
        inv_doc = invoices.get(inv_num)
        if not inv_doc:
            continue
        excel_rows = parse_sheet_rows(wb[tab])
        by_row = {r["row_idx"]: r for r in excel_rows}
        sessions = api.get(f"/sessions?client_id={cid}&invoice_id={inv_doc['id']}")
        for s in sessions:
            sk = s.get("sync_key") or ""
            parts = sk.split("|")
            row_idx = int(parts[2]) if len(parts) == 3 else None
            er = by_row.get(row_idx) if row_idx is not None else None
            if not er:
                st = (s.get("start_time") or "").strip()
                for cand in excel_rows:
                    if (cand.get("start_time") or "").strip() == st and cand.get("status") == s.get("status"):
                        er = cand
                        break
            if not er or not er.get("date_iso"):
                continue
            cur = (s.get("session_date") or "")[:10]
            target = er["date_iso"]
            if cur == target:
                continue
            start_t = s.get("start_time") or ""
            conflict = any(
                o.get("id") != s.get("id")
                and (o.get("session_date") or "")[:10] == target
                and (o.get("start_time") or "") == start_t
                for o in sessions
            )
            if conflict:
                continue
            fixes.append({
                "session_id": s["id"],
                "invoice": inv_num,
                "from": cur,
                "to": target,
                "day": er.get("day_label"),
                "status": s.get("status"),
            })
            if apply:
                body = {
                    "client_id": cid,
                    "session_date": target,
                    "start_time": s.get("start_time"),
                    "end_time": s.get("end_time"),
                    "hours": float(s.get("hours") or 0),
                    "status": s.get("status") or "Completed",
                    "therapist_ids": s.get("therapist_ids") or [],
                    "note": s.get("note"),
                    "service_type": s.get("service_type"),
                }
                api.send("PUT", f"/sessions/{s['id']}", body)
                applied += 1
    return {
        "file_no": file_no,
        "name": name,
        "status": "fixed" if apply and applied else ("preview" if fixes else "ok"),
        "fixes": fixes,
        "applied": applied,
    }


def main():
    p = argparse.ArgumentParser(description="Fix session dates from Drive Excel per child")
    p.add_argument("--apply", action="store_true", help="Apply fixes (default: preview only)")
    p.add_argument("--file-no", action="append", dest="file_nos", help="Limit to file number(s), e.g. 086")
    args = p.parse_args()

    api = Api()
    folders = list_active_client_folders(ACTIVE_CLIENTS_FOLDER_ID)
    if args.file_nos:
        wanted = {str(x).strip().zfill(3) for x in args.file_nos}
        folders = [f for f in folders if f["file_no"] in wanted]

    total_fixes = 0
    total_applied = 0
    for entry in sorted(folders, key=lambda x: x["file_no"]):
        result = reconcile_child(api, entry["file_no"], entry["folder_id"], apply=args.apply)
        fixes = result.get("fixes") or []
        if fixes:
            print(f"\n#{result['file_no']} {result.get('name', '')}: {len(fixes)} date(s)")
            for f in fixes[:8]:
                print(f"  {f['invoice']}: {f['from']} -> {f['to']} ({f.get('day') or '?'}) [{f['status']}]")
            if len(fixes) > 8:
                print(f"  ... +{len(fixes) - 8} more")
            total_fixes += len(fixes)
            total_applied += result.get("applied", 0)
        elif result.get("status") == "skipped":
            print(f"#{entry['file_no']}: skipped — {result.get('reason')}")

    mode = "applied" if args.apply else "would fix"
    print(f"\nDone: {total_fixes} date(s) {mode} across {len(folders)} child folder(s)")
    if not args.apply and total_fixes:
        print("Re-run with --apply to write corrections.")


if __name__ == "__main__":
    main()
