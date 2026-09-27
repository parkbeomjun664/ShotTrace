"""MQTT 를 구독해 shot 을 적재한다. 📓 M15 · M17"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from paho.mqtt import client as mqtt
from supabase import create_client

log = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")   # RLS 우회 — 서버 전용 · 절대 공개 금지

SHOT_TOPIC = "shottrace/+/shot"                         # 설비는 여럿 · 수집기는 하나 (ADR 009)
QOS = 1                                                 # 🔴 구독에도 붙인다 · QoS 는 구간별


def to_shot_row(msg: dict) -> dict:                     # 순수함수 — 브로커도 DB도 안 건드린다
    return {
        "equipment_id": msg["equipment_id"],
        "measured_at": msg["measured_at"],
        **msg["values"],                                # 키를 DB 컬럼명에 맞춰둔 값 (ADR 009)
    }


def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code != 0:
        log.error("브로커가 연결을 거부했다 — %s", reason_code)
        return
    client.subscribe(SHOT_TOPIC, qos=QOS)               # 🔴 재연결하면 구독이 사라진다
    log.info("구독 %s", SHOT_TOPIC)


def on_message(client, userdata, msg):
    try:
        row = to_shot_row(json.loads(msg.payload))
    except (ValueError, KeyError) as e:                 # 메시지가 이상하다
        userdata["bad"] += 1
        log.error("메시지를 못 읽었다 %s — %s", msg.topic, e)
        return
    try:
        userdata["db"].table("shot").upsert(       # 없으면 넣고 있으면 덮는다 · 행이 안 는다
            row, on_conflict="equipment_id,measured_at").execute()      # shot 의 PK
    except Exception as e:                              # DB 가 거부했다 · 한 건 실패로 안 죽는다
        userdata["bad"] += 1
        log.error("적재 실패 %s %s — %s", row["equipment_id"], row["measured_at"], e)
        return
    userdata["ok"] += 1                                 # 🔴 조용히 버리지 않는다 · 센다
    log.info("%s  %s  %6.2fs", row["equipment_id"], row["measured_at"][:19], row["cycle_time"])


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="MQTT 를 구독해 shot 을 적재한다.")
    p.add_argument("--host", default="localhost", help="브로커 주소 (기본 localhost)")
    p.add_argument("--port", type=int, default=1883, help="브로커 포트 (기본 1883)")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)-7s %(message)s", datefmt="%H:%M:%S")
    logging.getLogger("httpx").setLevel(logging.WARNING)    # 끄는 게 아니라 조용히 시킨다

    if not SUPABASE_URL or not SUPABASE_KEY:
        sys.exit("🔴 .env 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다")

    state = {"db": create_client(SUPABASE_URL, SUPABASE_KEY), "ok": 0, "bad": 0}

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, userdata=state)
    client.on_connect = on_connect
    client.on_message = on_message
    try:
        client.connect(args.host, args.port)
    except OSError as e:
        sys.exit(f"🔴 브로커에 연결 못 함 {args.host}:{args.port} — {e}")

    try:
        client.loop_forever()                           # 메인 스레드에서 돈다 → Ctrl+C 가 바로 잡힌다
    except KeyboardInterrupt:
        log.warning("중지 요청 — 정리하고 멈춥니다")
    finally:
        log.info("적재 %d건 · 실패 %d건", state["ok"], state["bad"])
        client.disconnect()


if __name__ == "__main__":
    main()
