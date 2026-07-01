#!/usr/bin/env python3
"""Smoke tests for prep week scoping helpers (no DB)."""
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "boost_growth_test")
os.environ.setdefault("JWT_SECRET", "test-secret")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from server import (  # noqa: E402
    _normalize_week_start,
    _schedule_week_start_variants,
    _week_start_variants_for_session_date,
    _session_date_query,
    _session_date_range_query,
    _session_date_iso,
    _shift_calendar_year,
    _prep_week_marker_scope_query,
    _schedule_cell_date_iso,
)


def test_week_variants():
    assert _normalize_week_start("2026-06-30") == "2026-06-28"
    variants = _week_start_variants_for_session_date("2026-06-30")
    assert "2026-06-28" in variants
    assert any(v.startswith("2025-06-") for v in variants)


def test_session_date_iso():
    assert _session_date_iso("2026-06-30T15:00:00Z") == "2026-06-30"
    assert _session_date_iso(datetime(2026, 6, 30, 12, 0, tzinfo=timezone.utc)) == "2026-06-30"
    assert _shift_calendar_year("2025-06-28", 1) == "2026-06-28"


def test_session_date_query():
    q = _session_date_query("2026-06-30")
    assert "$regex" in q["session_date"]
    assert "2026" in q["session_date"]["$regex"]


def test_session_date_range():
    q = _session_date_range_query("2026-06-28", "2026-07-02")
    assert "$or" in q
    assert len(q["$or"]) >= 2


def test_prep_week_marker_scope():
    q = _prep_week_marker_scope_query("2026-06-28", "2026-07-02")
    assert "$or" in q
    assert any("week_start" in clause for clause in q["$or"])


def test_cell_date_iso():
    cell = {"week_start": "2026-06-28", "day": 2}
    assert _schedule_cell_date_iso(cell) == "2026-06-30"


if __name__ == "__main__":
    test_week_variants()
    test_session_date_iso()
    test_session_date_query()
    test_session_date_range()
    test_prep_week_marker_scope()
    test_cell_date_iso()
    print("ok")
