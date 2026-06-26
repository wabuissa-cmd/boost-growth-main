#!/usr/bin/env python3
"""One-shot production fixes for urgent client invoice/session issues (Jun 2026)."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

BASE = "https://boost-growth-main-production-7283.up.railway.app/api"


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

    def client_by_file(self, file_no: str) -> dict:
        return next(c for c in self.get("/clients") if c.get("file_no") == file_no)

    def invoices(self, cid: str) -> list:
        return self.get(f"/clients/{cid}/invoices")

    def sessions(self, cid: str, iid: str | None = None) -> list:
        path = f"/sessions?client_id={cid}"
        if iid:
            path += f"&invoice_id={iid}"
        return self.get(path)


def put_client(api: Api, client: dict, **patch):
    payload = {k: client.get(k) for k in (
        "name", "file_no", "age", "parent_name", "parent_phone", "package_hours",
        "billing_mode", "cycle_weeks", "cycle_start_date", "package_end_date",
        "payment_status", "package_reset_at", "notes", "main_therapist_id",
        "co_therapist_ids", "supervisor", "locations", "color", "drive_url",
        "schedule_color", "status", "service_type", "address", "intake_file_url",
        "attendance_sheet_url", "progress_reports_url", "case_summary_url",
        "drive_folder_id", "drive_links", "case_summary_sections",
    )}
    payload.update(patch)
    return api.send("PUT", f"/clients/{client['id']}", payload)


def put_invoice(api: Api, inv: dict, **fields):
    payload = {
        "invoice_number": inv["invoice_number"],
        "notes": inv.get("notes"),
        "amount": inv.get("amount"),
        "period_from": inv.get("period_from"),
        "period_to": inv.get("period_to"),
        "package_size": fields.get("package_size", inv.get("package_size")),
        "payment_status": fields.get("payment_status", inv.get("payment_status") or "pending"),
        "start_date": fields.get("start_date", inv.get("start_date")),
        "service_type": fields.get("service_type", inv.get("service_type")),
        "is_closed": fields.get("is_closed", inv.get("is_closed")),
        "close_date": fields.get("close_date", inv.get("close_date")),
        "week_overrides": fields.get("week_overrides", inv.get("week_overrides") or {}),
        "ss_week_count": inv.get("ss_week_count") or 4,
    }
    return api.send("PUT", f"/invoices/{inv['id']}", payload)


def reopen_invoice(api: Api, inv: dict, service_type: str | None = None):
    fields = {"is_closed": False, "close_date": None, "payment_status": "pending"}
    if service_type:
        fields["service_type"] = service_type
    if service_type == "SS":
        fields["package_size"] = 4
        fields["week_overrides"] = {}
    put_invoice(api, inv, **fields)
    print(f"  reopened {inv['invoice_number']}")


def delete_invoice(api: Api, iid: str, label: str = ""):
    api.send("DELETE", f"/invoices/{iid}")
    print(f"  deleted invoice {label or iid}")


def delete_invoices_by_service(api: Api, cid: str, service: str):
    for inv in api.invoices(cid):
        st = (inv.get("service_type") or "").upper()
        pkg = float(inv.get("package_size") or 0)
        is_match = st == service or (
            service == "HS" and st in ("", "NONE", "?") and pkg > 8
        ) or (
            service == "SS" and (st == "SS" or pkg == 4)
        )
        if service == "HS" and st == "SS":
            is_match = False
        if service == "SS" and st == "HS":
            is_match = False
        if st == service or (
            service == "HS" and not inv.get("service_type") and pkg > 8
        ):
            delete_invoice(api, inv["id"], inv.get("invoice_number"))


def fix_salman_038(api: Api):
    """HS only — remove SS from profile; HS invoices rebuilt separately."""
    print("\n[038 Salman] HS only")
    c = api.client_by_file("038")
    put_client(
        api, c,
        service_type="HS",
        locations=[{"service": "HS", "address": c.get("address") or "Stars of Knowledge"}],
        package_hours=24,
    )
    for inv in api.invoices(c["id"]):
        st = (inv.get("service_type") or "").upper()
        pkg = float(inv.get("package_size") or 0)
        if st == "SS" or (pkg == 4 and st != "HS"):
            delete_invoice(api, inv["id"], inv.get("invoice_number"))
    print("  profile → HS only")


def fix_saleh_009(api: Api):
    print("\n[009 Saleh] HS rebuild scheduled via rebuild_hs_from_excel.py")


def fix_fahad_011(api: Api):
    """SS only — delete HS invoices."""
    print("\n[011 Fahad] SS only")
    c = api.client_by_file("011")
    put_client(
        api, c,
        service_type="SS",
        locations=[{"service": "SS", "address": c.get("address") or "Alyasmin"}],
        billing_mode="weeks",
    )
    for inv in api.invoices(c["id"]):
        st = (inv.get("service_type") or "").upper()
        pkg = float(inv.get("package_size") or 0)
        if st == "HS" or (pkg > 8 and st != "SS"):
            delete_invoice(api, inv["id"], inv.get("invoice_number"))
    print("  profile → SS only, HS invoices removed")


def fix_alaqel_027(api: Api):
    print("\n[027 Mohammed Alaqel] reopen current HS invoice")
    c = api.client_by_file("027")
    invs = api.invoices(c["id"])
    open_hs = [i for i in invs if not i.get("is_closed") and (i.get("service_type") or "HS") == "HS"]
    for o in open_hs:
        put_invoice(api, o, is_closed=True, close_date=o.get("close_date"))
    target = next((i for i in invs if i.get("invoice_number") == "INV0502"), None)
    if target:
        reopen_invoice(api, target, "HS")
        sess = api.sessions(c["id"], target["id"])
        print(f"  INV0502 open, {len(sess)} sessions visible")
    else:
        print("  WARN: INV0502 not found")


def fix_aljouhrah_034(api: Api):
    """SS only — wrong HS invoices; reopen/create SS cycle."""
    print("\n[034 Aljouhrah] SS only, fix invoices")
    c = api.client_by_file("034")
    put_client(
        api, c,
        service_type="SS",
        locations=[{"service": "SS", "address": "Alnakheel Talat"}],
        billing_mode="weeks",
        package_hours=24,
    )
    invs = api.invoices(c["id"])
    for inv in invs:
        st = (inv.get("service_type") or "").upper()
        if st == "HS" or float(inv.get("package_size") or 0) > 8:
            delete_invoice(api, inv["id"], inv.get("invoice_number"))
    invs = api.invoices(c["id"])
    ss_open = [i for i in invs if not i.get("is_closed") and (i.get("service_type") or "SS") == "SS"]
    if ss_open:
        print(f"  open SS: {ss_open[0]['invoice_number']}")
        return
    ss_closed = sorted(
        [i for i in invs if (i.get("service_type") or "SS") == "SS"],
        key=lambda x: x.get("invoice_number") or "",
        reverse=True,
    )
    if ss_closed:
        reopen_invoice(api, ss_closed[0], "SS")
    else:
        api.send("POST", f"/clients/{c['id']}/invoices", {
            "invoice_number": "INV0516",
            "service_type": "SS",
            "package_size": 4,
            "start_date": "2026-06-18",
            "is_closed": False,
            "payment_status": "pending",
        })
        print("  created INV0516 open SS")


def fix_ameerah_041(api: Api):
    print("\n[041 Ameerah] reopen current invoice")
    c = api.client_by_file("041")
    invs = api.invoices(c["id"])
    for inv in invs:
        if not inv.get("is_closed") and inv.get("invoice_number") != "INV0497":
            put_invoice(api, inv, is_closed=True, close_date=inv.get("close_date"))
    target = next((i for i in invs if i.get("invoice_number") == "INV0497"), None)
    if target:
        reopen_invoice(api, target, "HS")
        print(f"  sessions: {len(api.sessions(c['id'], target['id']))}")


def fix_ibrahim_061(api: Api):
    print("\n[061 Ibrahim] HS enabled, reopen current")
    c = api.client_by_file("061")
    put_client(api, c, service_type="HS/SS", package_hours=24)
    invs = api.invoices(c["id"])
    target = next((i for i in invs if i.get("invoice_number") == "INV0506"), None)
    if target:
        reopen_invoice(api, target, "HS")
        print(f"  INV0506 open, {len(api.sessions(c['id'], target['id']))} sessions")


def fix_lulu_062(api: Api):
    print("\n[062 Lulu] SS/HS — rebuild scheduled via excel scripts")
    c = api.client_by_file("062")
    put_client(api, c, service_type="HS/SS", package_hours=24)


def fix_abdulelah_070(api: Api):
    print("\n[070 Abdulelah] SS only, remove wrong HS")
    c = api.client_by_file("070")
    put_client(
        api, c,
        service_type="SS",
        locations=[{"service": "SS", "address": "Manarat Riyadh"}],
        billing_mode="weeks",
        package_hours=40,
    )
    invs = api.invoices(c["id"])
    for inv in invs:
        st = (inv.get("service_type") or "").upper()
        if st == "HS" or float(inv.get("package_size") or 0) > 8:
            delete_invoice(api, inv["id"], inv.get("invoice_number"))
    invs = api.invoices(c["id"])
    open_ss = [i for i in invs if not i.get("is_closed") and (i.get("service_type") or "SS") == "SS"]
    if open_ss:
        print(f"  open SS: {open_ss[0]['invoice_number']}")
        return
    ss_all = sorted(invs, key=lambda x: x.get("invoice_number") or "", reverse=True)
    if ss_all:
        reopen_invoice(api, ss_all[0], "SS")
    else:
        api.send("POST", f"/clients/{c['id']}/invoices", {
            "invoice_number": "INV0517",
            "service_type": "SS",
            "package_size": 4,
            "start_date": "2026-06-25",
            "is_closed": False,
        })
        print("  created INV0517 open SS")


def audit(api: Api, file_no: str):
    c = api.client_by_file(file_no)
    invs = api.invoices(c["id"])
    open_inv = [i for i in invs if not i.get("is_closed")]
    print(f"\n--- {file_no} {c.get('name')} service={c.get('service_type')} ---")
    print(f"  open invoices: {len(open_inv)}")
    for inv in open_inv:
        n = len(api.sessions(c["id"], inv["id"]))
        used = sum(
            float(s.get("hours") or 0)
            for s in api.sessions(c["id"], inv["id"])
            if s.get("status") in ("Completed", "Cancelled")
        )
        print(
            f"    {inv.get('invoice_number')} {inv.get('service_type')} "
            f"pkg={inv.get('package_size')} sess={n} used={used:.0f}h"
        )


def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--api-only", action="store_true")
    p.add_argument("--rebuild-only", action="store_true")
    args = p.parse_args()

    api = Api()
    if not args.rebuild_only:
        fix_salman_038(api)
        fix_saleh_009(api)
        fix_fahad_011(api)
        fix_alaqel_027(api)
        fix_aljouhrah_034(api)
        fix_ameerah_041(api)
        fix_ibrahim_061(api)
        fix_lulu_062(api)
        fix_abdulelah_070(api)

    if args.api_only:
        print("\n=== API FIXES DONE ===")
        for fn in ("038", "009", "011", "027", "034", "041", "061", "062", "070"):
            audit(api, fn)
        return

    print("\n=== Running HS rebuilds ===", flush=True)
    script = Path(__file__).resolve().parent / "rebuild_hs_from_excel.py"
    for fn in ("038", "009", "061"):
        print(f"\n>> rebuild_hs {fn}", flush=True)
        subprocess.check_call([sys.executable, str(script), "--file-no", fn, "--from-date", "2026-01-01"])

    print("\n=== Running SS rebuilds ===", flush=True)
    ss_script = Path(__file__).resolve().parent / "rebuild_ss_from_excel.py"
    for fn in ("062",):
        print(f"\n>> rebuild_ss {fn}", flush=True)
        subprocess.check_call([sys.executable, str(ss_script), "--file-no", fn])

    print("\n=== POST-FIX AUDIT ===", flush=True)
    for fn in ("038", "009", "011", "027", "034", "041", "061", "062", "070"):
        audit(api, fn)


if __name__ == "__main__":
    main()
