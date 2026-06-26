#!/usr/bin/env python3
"""Rebuild HS (home session) invoices from Google Sheets — dates, hours, therapists."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from drive_sync import fetch_workbook_from_url

BASE = "https://boost-growth-main-production-7283.up.railway.app/api"


def inv_key(n: str) -> str:
    return re.sub(r"[\s\-_]+", "", (n or "").strip(), flags=re.I).upper()


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
        anchor = any(x.startswith(("2026-04", "2026-05", "2026-06")) for x in text_dates)
        if anchor:
            y, mo, d = map(int, iso.split("-"))
            if mo <= 12 and d <= 12 and mo != d:
                try:
                    sw = datetime(y, d, mo).strftime("%Y-%m-%d")
                    if sw.startswith(("2026-04", "2026-05", "2026-06", "2025-")):
                        return sw
                except ValueError:
                    pass
        return iso
    return None


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


def is_closed_tab(ws) -> bool:
    return str(ws.cell(1, 3).value or "").strip().lower().startswith("clos")


def is_hs_tab(ws) -> bool:
    flat = " ".join(
        str(ws.cell(r, c).value or "")
        for r in range(1, 10)
        for c in range(1, 8)
    ).lower()
    if re.search(r"4\s*week", flat):
        return False
    if "school support" in flat and "home" not in flat:
        return False
    if re.search(r"paid\s+sesh[^0-9]*\d+\s*h", flat):
        return True
    if "home session" in flat:
        return True
    if re.search(r"paid\s+sesh[^0-9]*(\d+)", flat):
        m = re.search(r"paid\s+sesh[^0-9]*(\d+)", flat)
        if m and int(m.group(1)) > 8:
            return True
    return False


def package_size_from_tab(ws, default: float = 24) -> float:
    flat = " ".join(
        str(ws.cell(r, c).value or "")
        for r in range(1, 10)
        for c in range(1, 8)
    ).lower()
    m = re.search(r"paid\s+sesh[^0-9]*([\d.]+)", flat)
    if m:
        try:
            return float(m.group(1))
        except Exception:
            pass
    return default


def parse_hs_tab(ws, tab: str) -> dict | None:
    if not is_hs_tab(ws):
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
    for r in range(hdr + 1, hdr + 120):
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
        time_val = ""
        if "time" in cols:
            time_val = str(ws.cell(r, cols["time"] + 1).value or "").strip()
        hrs_val = None
        if "hours" in cols or "# of hrs" in cols:
            key = "hours" if "hours" in cols else "# of hrs"
            hrs_val = ws.cell(r, cols[key] + 1).value
        ther_val = ""
        if "therapist" in cols:
            ther_val = str(ws.cell(r, cols["therapist"] + 1).value or "").strip()
        raw_rows.append((d, st, time_val, hrs_val, ther_val))
    sessions = []
    for d, st, time_val, hrs_val, ther_val in raw_rows:
        ns = norm_status(st)
        di = normalize_session_date(d, text_dates)
        if not di or not ns:
            continue
        start_t, end_t, calc_h = parse_time_range(time_val)
        try:
            hours = float(hrs_val) if hrs_val not in (None, "", "—", "-") else calc_h
        except Exception:
            hours = calc_h
        if ns == "Completed" and hours <= 0 and calc_h > 0:
            hours = calc_h
        sessions.append({
            "session_date": di,
            "status": ns,
            "start_time": start_t or None,
            "end_time": end_t or None,
            "hours": hours,
            "therapist_cell": ther_val,
        })
    if not sessions:
        return None
    sessions.sort(key=lambda x: x["session_date"])
    pkg = package_size_from_tab(ws)
    closed = is_closed_tab(ws)
    return {
        "invoice_number": inv,
        "tab": tab.strip(),
        "is_closed": closed,
        "package_size": pkg,
        "start_date": sessions[0]["session_date"],
        "close_date": sessions[-1]["session_date"] if closed else None,
        "sessions": sessions,
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
        self.therapists = self.get("/therapists")
        self.name_to_id = self._build_therapist_map()

    def _build_therapist_map(self) -> dict:
        m = {}
        for t in self.therapists:
            name = (t.get("name") or "").replace("Ms.", "").replace("ms.", "").strip()
            if not name:
                continue
            first = name.split()[0].lower()
            m[first] = t["id"]
            m[name.lower()] = t["id"]
            aliases = {
                "hajer": "hajar", "hajar": "hajar",
                "shrooq": "shroug", "shroug": "shroug",
                "bodoor": "bodour", "bodour": "bodour",
                "fhdah": "fahda", "fahda": "fahda",
                "alhnuof": "alhanouf", "alhanouf": "alhanouf",
                "shorog": "shroug",
            }
            if first in aliases:
                m[first] = m.get(aliases[first], t["id"])
        return m

    def resolve_therapist_ids(self, cell: str, fallback: str | None) -> list[str]:
        s = (cell or "").lower()
        if not s.strip():
            return [fallback] if fallback else []
        parts = re.split(r"[-/,]", s)
        out = []
        for p in parts:
            tok = p.strip().split()[0].lower() if p.strip() else ""
            if not tok:
                continue
            tid = self.name_to_id.get(tok)
            if not tid:
                for k, v in self.name_to_id.items():
                    if k.startswith(tok[:3]) or tok.startswith(k[:3]):
                        tid = v
                        break
            if tid and tid not in out:
                out.append(tid)
        if not out and fallback:
            out = [fallback]
        return out

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
        "package_size": fields.get("package_size", inv.get("package_size") or 24),
        "payment_status": fields.get("payment_status", inv.get("payment_status") or "pending"),
        "start_date": fields.get("start_date", inv.get("start_date")),
        "service_type": "HS",
        "is_closed": fields.get("is_closed", inv.get("is_closed")),
        "close_date": fields.get("close_date", inv.get("close_date")),
        "week_overrides": {},
    }
    return api.send("PUT", f"/invoices/{inv['id']}", payload)


def rebuild_hs_invoice(api: Api, client: dict, inv: dict, excel: dict) -> dict:
    cid = client["id"]
    iid = inv["id"]
    fallback = client.get("main_therapist_id")
    invs = api.get(f"/clients/{cid}/invoices")

    for other in invs:
        if other["id"] == iid:
            continue
        st = other.get("service_type")
        if st == "HS" or (st in (None, "?") and (other.get("package_size") or 0) > 8):
            if not other.get("is_closed"):
                put_invoice(api, other, is_closed=True, close_date=other.get("close_date"))

    put_invoice(
        api, inv,
        is_closed=False,
        start_date=excel["start_date"],
        package_size=excel["package_size"],
        service_type="HS",
    )

    for s in api.get(f"/sessions?client_id={cid}&invoice_id={iid}"):
        api.send("DELETE", f"/sessions/{s['id']}")

    posted = 0
    for sess in excel["sessions"]:
        tids = api.resolve_therapist_ids(sess.get("therapist_cell"), fallback)
        body = {
            "client_id": cid,
            "session_date": sess["session_date"],
            "status": sess["status"],
            "hours": float(sess.get("hours") or 0),
            "service_type": "HS",
            "start_time": sess.get("start_time"),
            "end_time": sess.get("end_time"),
            "therapist_ids": tids,
        }
        api.send("POST", "/sessions", body)
        posted += 1

    updated = put_invoice(
        api, inv,
        is_closed=excel["is_closed"],
        start_date=excel["start_date"],
        close_date=excel["close_date"],
        package_size=excel["package_size"],
        payment_status="complete" if excel["is_closed"] else inv.get("payment_status"),
    )
    used = sum(
        float(s.get("hours") or 0)
        for s in excel["sessions"]
        if s["status"] in ("Completed", "Cancelled")
    )
    return {
        "invoice": inv["invoice_number"],
        "posted": posted,
        "used": used,
        "pkg": excel["package_size"],
        "closed": excel["is_closed"],
        "start": excel["start_date"],
        "portal_closed": updated.get("is_closed"),
    }


def rebuild_client_hs(api: Api, file_no: str, invoice_filter=None, from_date="2025-01-01"):
    client = next(c for c in api.get("/clients") if c.get("file_no") == file_no)
    url = client.get("attendance_sheet_url")
    if not url:
        raise ValueError(f"No sheet for {file_no}")
    wb = fetch_workbook_from_url(url)
    invs = api.get(f"/clients/{client['id']}/invoices")
    by_num = {inv_key(i["invoice_number"]): i for i in invs}
    results = []
    for tab in wb.sheetnames:
        ex = parse_hs_tab(wb[tab], tab)
        if not ex or ex["start_date"] < from_date:
            continue
        if invoice_filter and inv_key(ex["invoice_number"]) not in [inv_key(x) for x in invoice_filter]:
            continue
        inv = by_num.get(ex["invoice_number"])
        if not inv:
            continue
        r = rebuild_hs_invoice(api, client, inv, ex)
        results.append(r)
        print(f"OK {file_no} {r['invoice']}: {r['posted']} sess, {r['used']:.0f}/{r['pkg']:.0f}h, closed={r['closed']}")
    return results


def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--file-no", action="append", required=True)
    p.add_argument("--invoice", action="append")
    p.add_argument("--from-date", default="2025-01-01")
    args = p.parse_args()
    api = Api()
    for fn in args.file_no:
        rebuild_client_hs(api, fn, args.invoice, args.from_date)


if __name__ == "__main__":
    main()
