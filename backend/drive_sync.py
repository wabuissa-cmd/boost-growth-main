"""Public Google Drive folder crawling for active-client attendance workbooks."""
from __future__ import annotations

import io
import re
import urllib.request
from html import unescape
from typing import Any, Dict, List, Optional, Tuple

UA = "Mozilla/5.0 BoostGrowthSync/1.0"
ACTIVE_CLIENTS_FOLDER_ID = "1iMDwfucwzsEIl9WxwhJi_h6tg2vVtAFr"

_DRIVE_LINK_RE = re.compile(
    r'href="(https://(?:drive\.google\.com/(?:drive/folders/|file/d/)[^"]+|docs\.google\.com/(?:spreadsheets|document|presentation)/d/[^"]+))"'
    r'.*?flip-entry-title">([^<]+)</div>',
    re.S,
)


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


def _classify_url(url: str) -> Tuple[str, Optional[str]]:
    """Return (kind, id) for a Drive/Docs URL."""
    if not url:
        return "unknown", None
    if "spreadsheets" in url:
        m = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", url)
        return "sheet", m.group(1) if m else None
    if "document" in url:
        m = re.search(r"/document/d/([a-zA-Z0-9-_]+)", url)
        return "doc", m.group(1) if m else None
    if "presentation" in url:
        m = re.search(r"/presentation/d/([a-zA-Z0-9-_]+)", url)
        return "presentation", m.group(1) if m else None
    if "/folders/" in url:
        m = re.search(r"/folders/([^?]+)", url)
        return "folder", m.group(1) if m else None
    if "/file/d/" in url:
        m = re.search(r"/file/d/([a-zA-Z0-9-_]+)", url)
        return "file", m.group(1) if m else None
    return "unknown", None


def parse_embedded_folder(html: str) -> List[Dict[str, Any]]:
    """Parse Google embedded folder view into folders, spreadsheets, docs, and files."""
    entries: List[Dict[str, Any]] = []
    seen: set = set()
    for m in _DRIVE_LINK_RE.finditer(html):
        url = m.group(1)
        if url in seen:
            continue
        seen.add(url)
        title = _clean_title(m.group(2))
        kind, item_id = _classify_url(url)
        entries.append({
            "title": title,
            "url": url,
            "kind": kind,
            "id": item_id,
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


def extract_doc_id(drive_url: str) -> Optional[str]:
    url = (drive_url or "").strip()
    m = re.search(r"/document/d/([a-zA-Z0-9-_]+)", url) or re.search(r"[?&]id=([a-zA-Z0-9-_]+)", url)
    return m.group(1) if m else None


def sheet_export_url(sheet_id: str) -> str:
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=xlsx"


def doc_export_url(doc_id: str, fmt: str = "txt") -> str:
    return f"https://docs.google.com/document/d/{doc_id}/export?format={fmt}"


def fetch_workbook_from_url(drive_url: str):
    """Download a Google Sheet as openpyxl workbook (data_only=True)."""
    import openpyxl

    sheet_id = extract_sheet_id(drive_url)
    if not sheet_id:
        raise ValueError("Could not extract Google Sheets ID from URL")
    content = _fetch_bytes(sheet_export_url(sheet_id))
    return openpyxl.load_workbook(io.BytesIO(content), data_only=True)


def fetch_doc_text(drive_url: str) -> str:
    """Download plain text from a shared Google Doc."""
    doc_id = extract_doc_id(drive_url)
    if not doc_id:
        raise ValueError("Could not extract Google Doc ID from URL")
    raw = _fetch_bytes(doc_export_url(doc_id, "txt"))
    return raw.decode("utf-8", errors="replace").strip()


_PHONE_RE = re.compile(
    r"(?:\+966[\s\-]?|966[\s\-]?|0)?(5\d{8})\b"
)


def extract_parent_phone_from_text(text: str) -> Optional[str]:
    """Find Saudi mobile number in free text (intake docs)."""
    if not text:
        return None
    compact = re.sub(r"[\s\-()]", "", text)
    for m in _PHONE_RE.finditer(compact):
        digits = m.group(1)
        if digits and len(digits) == 9:
            return f"0{digits}"
    return None


def fetch_intake_parent_phone(drive_url: str) -> Optional[str]:
    """Extract guardian phone from intake Google Doc or Sheet."""
    url = (drive_url or "").strip()
    if not url:
        return None
    if "document" in url:
        return extract_parent_phone_from_text(fetch_doc_text(url))
    if "spreadsheets" in url:
        import openpyxl
        wb = fetch_workbook_from_url(url)
        for ws in wb.worksheets:
            for row in ws.iter_rows(min_row=1, max_row=80, values_only=True):
                cells = [str(c).strip() if c is not None else "" for c in row]
                joined = " ".join(cells).lower()
                if not any(k in joined for k in ("phone", "mobile", "جوال", "هاتف", "ولي", "parent", "guardian")):
                    continue
                for c in cells:
                    ph = extract_parent_phone_from_text(c)
                    if ph:
                        return ph
                ph = extract_parent_phone_from_text(" ".join(cells))
                if ph:
                    return ph
    return None


def fetch_case_summary_content(drive_url: str) -> Dict[str, Any]:
    """Parse case summary from Google Doc or Sheet."""
    url = (drive_url or "").strip()
    if not url:
        return {"sections": [], "raw_preview": ""}
    if "document" in url:
        text = fetch_doc_text(url)
        return parse_case_summary_text(text)
    if "spreadsheets" in url:
        wb = fetch_workbook_from_url(url)
        rows: List[List[str]] = []
        for ws in wb.worksheets:
            for row in ws.iter_rows(min_row=1, max_row=120, values_only=True):
                cells = [str(c).strip() for c in row if c is not None and str(c).strip()]
                if cells:
                    rows.append(cells)
            if rows:
                break
        if not rows:
            return {"sections": [], "raw_preview": ""}
        sections: List[Dict[str, Any]] = []
        current: Optional[Dict[str, Any]] = None
        for cells in rows:
            if len(cells) == 1 and len(cells[0]) < 60:
                if current:
                    sections.append(current)
                current = {"heading": cells[0].rstrip(":"), "paragraphs": [], "bullets": [], "tables": []}
            elif len(cells) >= 2:
                if current is None:
                    current = {"heading": "Details", "paragraphs": [], "bullets": [], "tables": []}
                current.setdefault("tables", []).append(cells)
            elif current is not None:
                current["paragraphs"].append(cells[0])
        if current:
            sections.append(current)
        return {"sections": sections, "raw_preview": ""}
    return {"sections": [], "raw_preview": ""}


def _year_score(title: str) -> int:
    years = [int(y) for y in re.findall(r"(20\d{2})", title or "")]
    return max(years) if years else 0


def _is_attendance_related(title: str) -> bool:
    """True for attendance workbook folders/sheets (excluded from client link lists)."""
    t = (title or "").lower().strip()
    if not t:
        return False
    if "attendance" in t and ("sheet" in t or "sheets" in t or t.endswith("attendance")):
        return True
    if t in ("attendance sheets", "attendance sheet"):
        return True
    if re.search(r"attendance\s*(sheet|20\d{2})", t):
        return True
    return False


def _is_copy_of(title: str) -> bool:
    return (title or "").lower().startswith("copy of ")


def pick_attendance_sheet(entries: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    sheets = [e for e in entries if e.get("kind") == "sheet" and not _is_copy_of(e.get("title", ""))]
    if not sheets:
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
        (i for i in items if i.get("kind") == "folder" and _is_attendance_related(i.get("title", ""))),
        None,
    )
    if att_folder and att_folder.get("id"):
        inner = parse_embedded_folder(_embedded_folder_html(att_folder["id"]))
        picked = pick_attendance_sheet(inner)
        if picked:
            return picked.get("url")
    picked = pick_attendance_sheet([i for i in items if i.get("kind") == "sheet"])
    return picked.get("url") if picked else None


def list_client_folder_links(client_folder_id: str) -> Dict[str, Any]:
    """Crawl a client folder for non-attendance Drive links (Case Summary, Intake, etc.)."""
    folder_url = f"https://drive.google.com/drive/folders/{client_folder_id}"
    items = parse_embedded_folder(_embedded_folder_html(client_folder_id))
    links: List[Dict[str, str]] = []
    case_summary_url: Optional[str] = None
    intake_file_url: Optional[str] = None

    for item in items:
        title = item.get("title") or ""
        if _is_attendance_related(title):
            continue
        kind = item.get("kind") or "unknown"
        if kind == "folder" and _is_attendance_related(title):
            continue
        url = item.get("url") or ""
        if not url:
            continue
        entry = {"title": title, "url": url, "kind": kind}
        links.append(entry)
        tl = title.lower()
        if not case_summary_url and (
            "case summary" in tl or "ملخص الحالة" in title or "ملخص حالة" in title
        ):
            case_summary_url = url
        if not intake_file_url and (
            "intake" in tl or "انتيك" in title or "الانتيك" in title
        ):
            intake_file_url = url

    links.sort(key=lambda x: (x.get("title") or "").lower())
    return {
        "folder_id": client_folder_id,
        "folder_url": folder_url,
        "links": links,
        "case_summary_url": case_summary_url,
        "intake_file_url": intake_file_url,
    }


def parse_case_summary_text(text: str) -> Dict[str, Any]:
    """Turn exported Google Doc plain text into structured sections for the portal."""
    lines = [ln.rstrip() for ln in (text or "").splitlines()]
    sections: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    table_rows: List[List[str]] = []

    def flush_table():
        nonlocal table_rows, current
        if table_rows and current is not None:
            current.setdefault("tables", []).append(table_rows)
            table_rows = []

    def flush_section():
        nonlocal current
        flush_table()
        if current and (current.get("paragraphs") or current.get("tables") or current.get("bullets")):
            sections.append(current)
        current = None

    heading_re = re.compile(
        r"^("
        r"diagnosis|goals?|objectives?|strengths?|challenges?|"
        r"background|history|summary|recommendations?|"
        r"services?|interventions?|medications?|allergies?|"
        r"family|parent|school|notes?|plan|targets?"
        r")\s*:?\s*$",
        re.I,
    )

    for raw in lines:
        line = raw.strip()
        if not line:
            flush_table()
            continue
        if "\t" in line:
            cells = [c.strip() for c in line.split("\t") if c.strip()]
            if len(cells) >= 2:
                if current is None:
                    current = {"heading": "Details", "paragraphs": [], "bullets": [], "tables": []}
                table_rows.append(cells)
                continue
        if heading_re.match(line) or (line.endswith(":") and len(line) < 60 and line[0].isupper()):
            flush_section()
            heading = line.rstrip(":").strip()
            current = {"heading": heading, "paragraphs": [], "bullets": [], "tables": []}
            continue
        if line.startswith(("-", "•", "·", "*")) and len(line) > 2:
            if current is None:
                current = {"heading": "Overview", "paragraphs": [], "bullets": [], "tables": []}
            current["bullets"].append(line.lstrip("-•·* ").strip())
            continue
        if current is None:
            current = {"heading": "Overview", "paragraphs": [], "bullets": [], "tables": []}
        current["paragraphs"].append(line)

    flush_section()

    if not sections and text.strip():
        sections = [{
            "heading": "Case Summary",
            "paragraphs": [p.strip() for p in text.split("\n\n") if p.strip()],
            "bullets": [],
            "tables": [],
        }]

    return {"sections": sections, "raw_preview": text[:2000] if text else ""}


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
                "folder_url": item.get("url") or f"https://drive.google.com/drive/folders/{item['id']}",
            })
    out.sort(key=lambda x: x["file_no"])
    return out
