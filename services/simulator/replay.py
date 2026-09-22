"""CSV 를 시각 순으로 재생한다. 📓 M14"""

import argparse
import logging
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterator

import pandas as pd

log = logging.getLogger(__name__)

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


def is_hole(prev: Shot, curr: Shot) -> bool:
    return (curr.measured_at - prev.measured_at).total_seconds() > MAX_GAP


def replay(shots: list[Shot], speed: float) -> Iterator[Shot]:
    started = time.monotonic()
    due = 0.0
    prev = None
    for shot in shots:
        due += wait_for(prev, shot, speed)
        time.sleep(max(0.0, due - (time.monotonic() - started)))
        yield shot
        prev = shot


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="CSV 를 시각 순으로 재생한다.")
    p.add_argument("--speed", type=float, default=3600.0, help="재생 배속 (기본 3600)")
    p.add_argument("--equipment", help="이 설비만 재생 (예 : S14)")
    p.add_argument("--limit", type=int, help="앞에서 N샷만 재생")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)-7s %(message)s", datefmt="%H:%M:%S")

    shots = read_shots(CSV_PATH)
    if args.equipment:
        shots = [s for s in shots if s.equipment_id == args.equipment]
    if args.limit:
        shots = shots[: args.limit]
    if not shots:
        log.error("재생할 샷이 없다 — 조건을 확인하세요")
        return

    total = len(shots)
    log.info("%d샷 · %s ~ %s · %.0f배속",
             total, shots[0].measured_at, shots[-1].measured_at, args.speed)

    sent = fails = holes = 0
    last = None
    started = time.monotonic()
    try:
        for shot in replay(shots, args.speed):
            sent += 1
            fails += sum(1 for p in shot.parts if p.pass_or_fail == "N")
            if last is not None and is_hole(last, shot):
                holes += 1
            last = shot
            marks = "".join("." if p.pass_or_fail == "Y" else "X" for p in shot.parts)
            log.info("%s  %s  %6.2fs  %s", shot.measured_at.strftime("%m-%d %H:%M:%S"),
                     shot.equipment_id, shot.cycle_time, marks)
    except KeyboardInterrupt:
        log.warning("중지 요청 — 정리하고 멈춥니다")
    finally:
        elapsed = time.monotonic() - started
        covered = (last.measured_at - shots[0].measured_at).total_seconds() if last else 0.0
        log.info("재생 %d / %d 샷 (%.1f%%) · 불량 %d", sent, total, sent / total * 100, fails)
        log.info("경과 %.1f초 · 데이터 %.1f시간 · 건너뛴 구멍 %d개",
                 elapsed, covered / 3600, holes)


if __name__ == "__main__":
    main()