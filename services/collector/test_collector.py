"""수집기 테스트 — 진짜 DB · 시계 · 브로커 없이 (M26). 실행: pytest services/collector"""

import json
from datetime import datetime, timezone
from types import SimpleNamespace

from collector import on_message, to_part_rows, to_shot_row

NOW = datetime(2026, 10, 26, 0, 0, tzinfo=timezone.utc)   # 고정된 시계 — 진짜 시계면 매번 달라 테스트를 못 쓴다
PRODUCTS = {"CN7 LH": 1, "CN7 RH": 2}
MSG = {
    "equipment_id": "S14",
    "measured_at": "2020-10-16T08:00:00+00:00",
    "values": {"cycle_time": 59.5},
    "parts": [
        {"part_name": "CN7 LH", "pass_or_fail": "Y", "fail_reason": None},
        {"part_name": "CN7 RH", "pass_or_fail": "N", "fail_reason": "가스"},
    ],
}


def test_이벤트_시각은_그대로_처리_시각은_밖에서():   # ADR 010 — 두 시각을 나눈다
    row = to_shot_row(MSG, NOW)
    assert row["measured_at"] == "2020-10-16T08:00:00+00:00"
    assert row["received_at"] == NOW.isoformat()
    assert row["cycle_time"] == 59.5


def test_부품의_제품명은_번호로_바뀐다():
    rows = to_part_rows(MSG, PRODUCTS)
    assert [r["product_id"] for r in rows] == [1, 2]
    assert [r["fail_reason"] for r in rows] == [None, "가스"]


class FakeTable:                                       # 🔵 가짜 — .upsert().execute() 를 받아주고 표 이름만 적는다
    def __init__(self, name, writes):
        self.name, self.writes = name, writes

    def upsert(self, rows, on_conflict=None):
        self.writes.append(self.name)
        return self

    def execute(self):
        return SimpleNamespace(data=[])


class FakeDB:                                          # 진짜 Supabase 클라이언트인 척 — userdata["db"] 로 끼워 넣는다
    def __init__(self):
        self.writes = []

    def table(self, name):
        return FakeTable(name, self.writes)


def run(msg):                                          # on_message 를 가짜 DB 로 돌리고, 무엇을 썼는지 돌려준다
    db = FakeDB()
    state = {"db": db, "products": PRODUCTS, "defects": {"가스", "미성형"}, "ok": 0, "bad": 0}
    message = SimpleNamespace(topic="shottrace/S14/shot", payload=json.dumps(msg).encode())
    on_message(None, state, message)
    return db.writes, state


def test_아는_메시지는_샷_다음_부품을_쓴다():
    writes, state = run(MSG)
    assert writes == ["shot", "shot_part"]             # 샷 다음 부품 — 둘 다
    assert state["ok"] == 1


def test_모르는_불량_사유면_아무것도_안_쓴다():
    bad = {**MSG, "parts": [{"part_name": "CN7 LH", "pass_or_fail": "N", "fail_reason": "GAS"}]}   # 바꿀 칸만 (Vitest 의 { ...base })
    writes, state = run(bad)
    assert writes == []                                # 🔴 반쪽(샷만)이 다시 생기면 여기서 빨간불 (10/21)
    assert state["bad"] == 1


def test_모르는_제품이면_아무것도_안_쓴다():
    bad = {**MSG, "parts": [{"part_name": "모르는 제품", "pass_or_fail": "Y", "fail_reason": None}]}
    writes, state = run(bad)
    assert writes == []
    assert state["bad"] == 1
