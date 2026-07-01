#!/usr/bin/env python3
"""Smoke tests for prep week scoping helpers (no DB)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Import after path — only pure helpers, no DB init needed if we import selectively
from server import (  # noqa: E402
    _normalize_week_start,
    _schedule_week_start_variants,
    _week_start_variants_for_session_date,
    _session_date_query,
    _session_date_range_query,
    _schedule_cell_date_iso,
)


def test_week_variants():
    assert _normalize_week_start("2026-06-30") == "2026-06-28"
    variants = _week_start_variants_for_session_date("2026-06-30")
    assert "2026-06-28" in variants
    assert "2025-06-28" in variants


def test_session_date_query():
    q = _session_date_query("2026-06-30")
    assert "regex" in q["session_date"]
    assert "2026-06-30" in q["session_date"]["$regex"]


def test_session_date_range():
    q = _session_date_range_query("2026-06-28", "2026-07-02")
    assert "$or" in q
    assert len(q["$or"]) == 2


def test_cell_date_iso():
    cell = {"week_start": "2026-06-28", "day": 2}
    assert _schedule_cell_date_iso(cell) == "2026-06-30"


if __name__ == "__main__":
    test_week_variants()
    test_session_date_query()
    test_session_date_range()
    test_cell_date_iso()
    print("ok")
