#!/usr/bin/env python3
"""Sync co-therapist access from schedule grid + relink prep badges for a week."""
import asyncio
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

WEEK_START = os.environ.get("WEEK_START", "2026-07-19")


async def main() -> None:
    from server import (
        _sync_co_therapists_from_schedule_week,
        _sync_schedule_preparations_for_week,
        _prep_week_diagnostics,
        _normalize_week_start,
    )

    ws = _normalize_week_start(WEEK_START)
    base = datetime.fromisoformat(ws[:10])
    start = base.strftime("%Y-%m-%d")
    end = (base + timedelta(days=4)).strftime("%Y-%m-%d")

    print(f"=== Sync schedule caseload · week {ws} ===")
    caseload = await _sync_co_therapists_from_schedule_week(ws)
    print("caseload:", json.dumps(caseload, indent=2))

    before = await _prep_week_diagnostics(start, end)
    print("prep before:", json.dumps(before, indent=2))
    recovery = await _sync_schedule_preparations_for_week(start, end)
    print("recovery:", json.dumps(recovery, indent=2))
    after = await _prep_week_diagnostics(start, end)
    print("prep after:", json.dumps(after, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
