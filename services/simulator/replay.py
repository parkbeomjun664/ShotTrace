"""CSV 를 시각 순으로 재생해 MQTT 로 발행한다. 📓 M14 · M16"""

import argparse
import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterator

import pandas as pd
from paho.mqtt import client as mqtt

log = logging.getLogger(__name__)                       # 이름표만 받는다 · 형식은 main 이 정한다

ROOT = Path(__file__).resolve().parents[2]              # 어느 폴더에서 실행해도 찾는다
CSV_PATH = ROOT / "data" / "labeled_data.csv"

META_COLS = ["_id", "TimeStamp", "PART_FACT_PLAN_DATE", "PART_FACT_SERIAL",
             "PART_NAME", "EQUIP_CD", "EQUIP_NAME", "PassOrFail", "Reason"]
DEAD_COLS = ["Switch_Over_Position", "Barrel_Temperature_7",        # ADR 003 — 전 구간 0
             *[f"Mold_Temperature_{n}" for n in (1, 2, 5, 6, 7, 8, 9, 10, 11, 12)]]

MAX_GAP = 300.0                                         # 🔴 데이터 시계 기준 — 벽시계가 아니다
TOPIC = "shottrace/{equipment_id}/shot"                 # 사건 — retain 을 끈다
STATUS_TOPIC = "shottrace/{equipment_id}/status"        # 상태 — retain 을 켠다
ISO = "%Y-%m-%dT%H:%M:%S+00:00"                         # 🔴 타임존 없으면 9시간 밀린다 (ADR 002)
QOS = 1                                                 # 중복은 오되 잃지 않는다 · 멱등은 DB 가
KEEPALIVE = 15                                          # 브로커가 죽음을 알아채는 데 걸리는 시간


@dataclass(frozen=True)
class Part:
    part_name: str
    pass_or_fail: str                                   # 🔴 판정은 부품마다 다르다 (ADR 005)
    fail_reason: str | None


@dataclass(frozen=True)
class Shot:
    measured_at: datetime
    equipment_id: str
    values: dict[str, float]                            # 🔴 frozen 이 껍데기만 언다 · 알고 쓴다
    parts: tuple[Part, ...]                             # 🔴 list 면 같은 구멍이 생긴다


def read_shots(path: Path) -> list[Shot]:
    df = pd.read_csv(path)                              # 45개 전부 — 공정변수가 필요하다
    df["TimeStamp"] = pd.to_datetime(df["TimeStamp"])
    return to_shots(df.drop_duplicates())               # 🔴 집계보다 중복 제거가 먼저 (ADR 004)


def proc_cols(df: pd.DataFrame) -> list[str]:           # 45 − 메타 9 − 죽은 12 = 24개
    return [c for c in df.columns if c not in META_COLS and c not in DEAD_COLS]


def to_shots(df: pd.DataFrame) -> list[Shot]:           # 순수함수 — 파일을 안 건드린다
    cols = proc_cols(df)
    out = []
    for (equip, ts), g in df.groupby(["EQUIP_CD", "TimeStamp"]):    # (설비, 시각) = shot 의 PK
        parts = tuple(
            Part(r.PART_NAME, r.PassOrFail, None if pd.isna(r.Reason) else r.Reason)
            for r in g.itertuples()                     # 🔴 NaN 은 None 도 아니고 자기와도 다르다
        )
        values = {c.lower(): float(g[c].iloc[0]) for c in cols}     # 공정변수는 샷의 속성
        out.append(Shot(ts.to_pydatetime(), equip, values, parts))
    return sorted(out, key=lambda s: s.measured_at)     # 🔴 없으면 간격이 음수가 된다


def wait_for(prev: Shot | None, curr: Shot, speed: float) -> float:
    if prev is None:
        return 0.0                                      # 첫 샷은 안 기다린다
    gap = (curr.measured_at - prev.measured_at).total_seconds()
    return min(gap, MAX_GAP) / speed                    # 🔴 자르고 나서 나눈다 · 순서가 배속을 정한다


def is_hole(prev: Shot, curr: Shot) -> bool:            # "구멍이란 무엇인가" 를 한 군데 둔다
    return (curr.measured_at - prev.measured_at).total_seconds() > MAX_GAP


def topic_for(shot: Shot) -> str:                       # 순수함수 — 브로커를 안 건드린다
    return TOPIC.format(equipment_id=shot.equipment_id)


def payload_for(shot: Shot) -> str:
    return json.dumps({
        "equipment_id": shot.equipment_id,              # 토픽과 중복 · 봉투가 사라져도 남게
        "measured_at": shot.measured_at.strftime(ISO),
        "values": shot.values,                          # 공정변수 24개
        "parts": [
            {"part_name": p.part_name,
             "pass_or_fail": p.pass_or_fail,
             "fail_reason": p.fail_reason}              # 🔴 키를 빼지 않는다 · null 을 적는다
            for p in shot.parts
        ],
    }, ensure_ascii=False)                              # 🔴 안 하면 한글이 이스케이프돼 나간다


def status_payload(state: str) -> str:                  # 🔴 시각을 안 넣는다 · 유언은 연결할 때 만들어진다
    return json.dumps({"state": state})


def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code != 0:                                # 🔴 실패해도 이 콜백은 불린다
        log.error("브로커가 연결을 거부했다 — %s", reason_code)
        return
    log.info("브로커 연결됨")
    client.publish(userdata, status_payload("online"), qos=QOS, retain=True)    # 재연결도 여기를 탄다


def on_disconnect(client, userdata, flags, reason_code, properties):
    if reason_code != 0:                                # 조용히 끊기는 것을 막는다
        log.warning("브로커 연결이 끊겼다 — 재연결 시도 중 (%s)", reason_code)


def replay(shots: list[Shot], speed: float) -> Iterator[Shot]:
    started = time.monotonic()                          # 🔴 기준점 하나 · time.time() 은 뒤로 점프한다
    due = 0.0
    prev = None
    for shot in shots:
        due += wait_for(prev, shot, speed)              # 🔴 = 가 아니라 += · 오차가 안 쌓인다
        time.sleep(max(0.0, due - (time.monotonic() - started)))    # 🔴 음수면 sleep 이 터진다
        yield shot                                      # 다 만들고 주는 게 아니라 만들면서 준다
        prev = shot


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="CSV 를 시각 순으로 재생한다.")
    p.add_argument("--speed", type=float, default=3600.0, help="재생 배속 (기본 3600)")
    p.add_argument("--equipment", default="S14", help="재생할 설비 (기본 S14)")   # 한 프로세스 = 한 설비
    p.add_argument("--limit", type=int, help="앞에서 N샷만 재생")        # 🔴 default=0 이면 빈 목록
    p.add_argument("--host", default="localhost", help="브로커 주소 (기본 localhost)")
    p.add_argument("--port", type=int, default=1883, help="브로커 포트 (기본 1883)")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=logging.INFO,             # 🔴 딱 한 번 · 두 번째부터 조용히 무시된다
                        format="%(asctime)s %(levelname)-7s %(message)s", datefmt="%H:%M:%S")

    shots = read_shots(CSV_PATH)
    shots = [s for s in shots if s.equipment_id == args.equipment]
    if args.limit:
        shots = shots[: args.limit]
    if not shots:
        log.error("재생할 샷이 없다 — 조건을 확인하세요")    # 🔴 걸렀으면 0인 경우를 묻는다
        return

    status_topic = STATUS_TOPIC.format(equipment_id=args.equipment)
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, userdata=status_topic)
    client.on_connect = on_connect                      # 우리가 부르는 게 아니라 라이브러리가 부른다
    client.on_disconnect = on_disconnect
    client.will_set(status_topic, status_payload("offline"), qos=QOS, retain=True)   # 🔴 connect 전에
    try:
        client.connect(args.host, args.port, keepalive=KEEPALIVE)
    except OSError as e:                                # 주소·거부·방화벽이 전부 이 밑이다
        log.error("브로커에 연결 못 함 %s:%d — %s", args.host, args.port, e)
        return
    client.loop_start()                                 # 🔴 없으면 발행이 조용히 안 나간다
    for _ in range(50):                                 # 🔴 connect() 가 돌아와도 아직 연결 전이다
        if client.is_connected():
            break
        time.sleep(0.1)                                 # online 이 첫 샷보다 늦게 나가지 않도록

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
            client.publish(topic_for(shot), payload_for(shot), qos=QOS)     # retain 안 켬 · 샷은 이력
            marks = "".join("." if p.pass_or_fail == "Y" else "X" for p in shot.parts)
            log.info("%s  %s  %6.2fs  %s", shot.measured_at.strftime("%m-%d %H:%M:%S"),
                     shot.equipment_id, shot.values["cycle_time"], marks)
    except KeyboardInterrupt:                           # 🔴 Exception 이 아니라 BaseException 밑이다
        log.warning("중지 요청 — 정리하고 멈춥니다")
    finally:                                            # 어떻게 끝났든 실행된다
        elapsed = time.monotonic() - started
        covered = (last.measured_at - shots[0].measured_at).total_seconds() if last else 0.0
        log.info("재생 %d / %d 샷 (%.1f%%) · 불량 %d", sent, total, sent / total * 100, fails)
        log.info("경과 %.1f초 · 데이터 %.1f시간 · 건너뛴 구멍 %d개",     # 🔴 "실질배속" 은 구멍에 부푼다
                 elapsed, covered / 3600, holes)
        info = client.publish(status_topic, status_payload("offline"), qos=QOS, retain=True)
        info.wait_for_publish(2)                        # 🔴 정상 종료엔 유언이 안 나간다 · 직접 보낸다
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":                              # 🔴 없으면 import 만 해도 재생이 시작된다
    main()
