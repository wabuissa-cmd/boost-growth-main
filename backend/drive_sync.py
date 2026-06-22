"""Public Google Drive folder crawling for active-client attendance workbooks."""
from __future__ import annotations

import io
import re
import urllib.request
from html import unescape
from typing import Any, Dict, List, Optional

UA = "Mozilla/5.0 BoostGrowthSync/1.0"
ACTIVE_CLIENTS_FOLDER_ID = "1iMDwfucwzsEIl9WxwhJi_h6tg2vVtAFr"


def _fetch_bytes(url: str, timeout: int = 45) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _embedded_folder_html(folder_id: str) -> str:
    return _fetch_bytes(
        f"https://drive.google.com/embeddedfolderview?id={folder_id}"
    ).decode("utf-8", errors="replace")


def _clean_title(raw: str) -> str:
    return unescape(raw.replace("&#39;", "'")).strip()


def parse_embedded_folder(html: str) -> List[Dict[str, Any]]:
    """Parse Google embedded folder view into folders and spreadsheets."""
    entries: List[Dict[str, Any]] = []
    seen: set = set()
    pattern = re.compile(
        r'href="(https://(?:drive\.google\.com/drive/folders/[^"]+|docs\.google\.com/spreadsheets/d/[^"]+))"'
        r'.*?flip-entry-title">([^<]+)</div>',
        re.S,
    )
    for m in pattern.finditer(html):
        url = m.group(1)
        if url in seen:
            continue
        seen.add(url)
        title = _clean_title(m.group(2))
        if "spreadsheets" in url:
            sm = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", url)
            entries.append({
                "title": title,
                "url": url,
                "kind": "sheet",
                "id": sm.group(1) if sm else None,
            })
        else:
            fm = re.search(r"/folders/([^?]+)", url)
            entries.append({
                "title": title,
                "url": url,
                "kind": "folder",
                "id": fm.group(1) if fm else None,
            })
    return entries


def parse_file_no_from_title(title: str) -> Optional[str]:
    m = re.match(r"^(\d{3})\s*\|", (title or "").strip())
    return m.group(1) if m else None


def extract_folder_id(drive_url: str) -> Optional[str]:
    url = (drive_url or "").strip()
    m = re.search(r"/folders/([a-zA-Z0-9_-]+)", url) or re.search(r"[?&]id=([a-zA-Z0-9_-]+)", url)
    return m.group(1) if m else None


def extract_sheet_id(drive_url: str) -> Optional[str]:
    url = (drive_url or "").strip()
    m = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", url) or re.search(r"[?&]id=([a-zA-Z0-9-_]+)", url)
    return m.group(1) if m else None


def sheet_export_url(sheet_id: str) -> str:
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=xlsx"


def fetch_workbook_from_url(drive_url: str):
    """Download a Google Sheet as openpyxl workbook (data_only=True)."""
    import openpyxl

    sheet_id = extract_sheet_id(drive_url)
    if not sheet_id:
        raise ValueError("Could not extract Google Sheets ID from URL")
    content = _fetch_bytes(sheet_export_url(sheet_id))
    return openpyxl.load_workbook(io.BytesIO(content), data_only=True)


def _year_score(title: str) -> int:
    years = [int(y) for y in re.findall(r"(20\d{2})", title or "")]
    return max(years) if years else 0


def pick_attendance_sheet(entries: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    sheets = [e for e in entries if e.get("kind") == "sheet"]
    if not sheets:
        return None
    sheets.sort(key=lambda e: (_year_score(e.get("title", "")), e.get("title", "")), reverse=True)
    for s in sheets:
        t = (s.get("title") or "").lower()
        if "attendance" in t:
            return s
    return sheets[0]


def resolve_attendance_sheet_url(client_folder_id: str) -> Optional[str]:
    """Find the best attendance spreadsheet inside a client Drive folder."""
    items = parse_embedded_folder(_embedded_folder_html(client_folder_id))
    att_folder = next(
        (i for i in items if i.get("kind") == "folder" and "attendance" in (i.get("title") or "").lower()),
        None,
    )
    if att_folder and att_folder.get("id"):
        inner = parse_embedded_folder(_embedded_folder_html(att_folder["id"]))
        picked = pick_attendance_sheet(inner)
        if picked:
            return picked.get("url")
    picked = pick_attendance_sheet(items)
    return picked.get("url") if picked else None


def list_active_client_folders(parent_folder_id: str = ACTIVE_CLIENTS_FOLDER_ID) -> List[Dict[str, str]]:
    items = parse_embedded_folder(_embedded_folder_html(parent_folder_id))
    out: List[Dict[str, str]] = []
    for item in items:
        if item.get("kind") != "folder" or not item.get("id"):
            continue
        file_no = parse_file_no_from_title(item.get("title", ""))
        if file_no:
            out.append({
                "file_no": file_no,
                "folder_id": item["id"],
                "title": item.get("title", ""),
            })
    out.sort(key=lambda x: x["file_no"])
    return out
