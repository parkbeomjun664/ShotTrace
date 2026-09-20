"""CSV 를 시각 순으로 재생한다. 📓 M14"""

import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterator

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = ROOT / "data" / "labeled_data.csv"

USE_COLS = ["TimeStamp", "EQUIP_CD", "PART_NAME", "PassOrFail", "Reason", "Cycle_Time"]
MAX_GAP = 300.0


@dataclass(frozen=True)
class Part:
    part_name: str
    pass_or_fail: str
    fail_reason: str | None


@dataclass(frozen=True)
class Shot:
    measured_at: datetime
    equipment_id: str
    cycle_time: float
    parts: tuple[Part, ...]


def read_shots(path: Path) -> list[Shot]:
    df = pd.read_csv(path, usecols=USE_COLS)
    df["TimeStamp"] = pd.to_datetime(df["TimeStamp"])
    return to_shots(df.drop_duplicates())


def to_shots(df: pd.DataFrame) -> list[Shot]:
    out = []
    for (equip, ts), g in df.groupby(["EQUIP_CD", "TimeStamp"]):
        parts = tuple(
            Part(r.PART_NAME, r.PassOrFail, None if pd.isna(r.Reason) else r.Reason)
            for r in g.itertuples()
        )
        out.append(Shot(ts.to_pydatetime(), equip, float(g["Cycle_Time"].iloc[0]), parts))
    return sorted(out, key=lambda s: s.measured_at)


def wait_for(prev: Shot | None, curr: Shot, speed: float) -> float:
    if prev is None:
        return 0.0
    gap = (curr.measured_at - prev.measured_at).total_seconds()
    return min(gap, MAX_GAP) / speed


def replay(shots: list[Shot], speed: float) -> Iterator[Shot]:
    started = time.monotonic()
    due = 0.0
    prev = None
    for shot in shots:
        due += wait_for(prev, shot, speed)
        time.sleep(max(0.0, due - (time.monotonic() - started)))
        yield shot
        prev = shot


def main() -> None:
    shots = read_shots(CSV_PATH)
    print(f"{len(shots)}샷 · {shots[0].measured_at} ~ {shots[-1].measured_at}")
    for shot in replay(shots, speed=3600.0):
        marks = "".join("." if p.pass_or_fail == "Y" else "X" for p in shot.parts)
        print(f"{shot.measured_at:%m-%d %H:%M:%S}  {shot.equipment_id}  "
              f"{shot.cycle_time:6.2f}s  {marks}")


if __name__ == "__main__":
    main()