"""제약 거부 실험 (M22) — 종류마다 하나씩 일부러 어겨보고, DB 가 막는지 본다.

    python scripts/verify/constraints.py

service_role 로 두드린다 — RLS 를 건너뛰어야 제약만 따로 보인다 (RLS 가 먼저 막으면 제약까지 안 닿는다).
요청 하나가 트랜잭션 하나라서 막히면 아무것도 안 남는다. 혹시 들어가 버리면(= 구멍) 그 자리에서 지운다.
결과는 docs/evidence/constraints-reject.md 에 표로 남긴다.
"""
import datetime as dt
import os
import uuid

from dotenv import load_dotenv
from postgrest.exceptions import APIError
from supabase import create_client

load_dotenv()
db = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

equip = db.table("equipment").select("equip_cd").limit(1).execute().data[0]["equip_cd"]
product = db.table("product").select("product_id, part_name").limit(1).execute().data[0]
lot = (db.table("production_lot").select("*").neq("ended_at", "infinity")
       .order("started_at").limit(1).execute().data[0])          # 끝난 LOT 하나 — 겹침 실험의 상대
someone = db.table("user_role").select("user_id").limit(1).execute().data[0]["user_id"]
far = "2099-01-01T00:00:00+00:00"                                 # 실제 LOT 과 안 겹치는 먼 미래


def shifted(iso, minutes):
    return (dt.datetime.fromisoformat(iso) + dt.timedelta(minutes=minutes)).isoformat()


def fake_lot(lot_id, **over):
    row = {"lot_id": lot_id, "equip_cd": lot["equip_cd"], "product_id": lot["product_id"],
           "plan_date": lot["plan_date"], "total_qty": 0, "pass_qty": 0, "fail_qty": 0,
           "started_at": far, "ended_at": shifted(far, 60)}
    row.update(over)
    return row


CASES = [  # (종류, 무엇을 어기나, 테이블, 행, 지울 때 쓸 키, 기대 코드)
    ("p", "있는 설비 코드로 또 넣기", "equipment",
     {"equip_cd": equip, "equip_name": "중복"}, "equip_cd", "23505"),
    ("u", "있는 제품명으로 또 넣기", "product",
     {"part_name": product["part_name"]}, "part_name", "23505"),
    ("f", "없는 LOT 에 실적", "production_record",
     {"lot_id": "NO-SUCH-LOT", "pass_qty": 1, "fail_qty": 0, "recorded_by": someone,
      "request_id": str(uuid.uuid4())}, "lot_id", "23503"),
    ("c", "side = 'lh' (소문자)", "product",
     {"part_name": f"TEST-{uuid.uuid4().hex[:6]}", "side": "lh"}, "part_name", "23514"),
    ("c", "양품 5 + 불량 1 ≠ 생산 10", "production_lot",
     fake_lot("TEST-SUM", total_qty=10, pass_qty=5, fail_qty=1), "lot_id", "23514"),
    ("c", "끝이 시작보다 빠른 LOT", "production_lot",
     fake_lot("TEST-TIME", ended_at=shifted(far, -60)), "lot_id", "23514"),
    ("c", "빨간 줄 이유가 공백뿐", "record_cancel",
     {"record_id": 1, "reason": "   ", "canceled_by": someone}, "record_id", "23514"),
    ("x", "같은 설비 · 제품 · 시간이 겹치는 LOT", "production_lot",
     fake_lot("TEST-OVERLAP", started_at=shifted(lot["started_at"], 1), ended_at=lot["ended_at"]),
     "lot_id", "23P01"),
    ("n", "번호표(request_id) 없는 실적", "production_record",
     {"lot_id": lot["lot_id"], "pass_qty": 1, "fail_qty": 0, "recorded_by": someone}, "lot_id", "23502"),
]

rows, holes = [], 0
for kind, what, table, row, key, expect in CASES:
    try:
        db.table(table).insert(row).execute()
        db.table(table).delete().eq(key, row[key]).execute()     # 🔴 구멍 — 들어갔으니 바로 지운다
        got, name, ok = "들어감", "—", False
    except APIError as e:
        msg = e.message or ""
        quoted = msg.split('"')[1::2]                                    # 메시지 속 "…" 들
        name = (f"{quoted[0]} NOT NULL" if e.code == "23502" else quoted[-1]) if quoted else msg[:40]   # NOT NULL 은 칸 이름이 먼저
        got, ok = e.code, e.code == expect
    holes += not ok
    rows.append(f"| {kind} | {what} | `{table}` | {expect} | {got} | `{name}` | {'✅' if ok else '🔴'} |")
    print(f"  {'✅' if ok else '🔴'} [{kind}] {what:<28} {got:<6} {name}")

today = dt.date.today().isoformat()
md = f"""# 제약 거부 실험 — 코드가 실수해도 DB 가 막는다 (M22)

- **날짜**: {today}
- **방법**: `scripts/verify/constraints.py` — service_role 로 종류마다 하나씩 일부러 어긴다
  (RLS 를 건너뛰어 제약만 본다 · 요청 하나 = 트랜잭션 하나라 막히면 아무것도 안 남는다)
- **결과**: {len(CASES) - holes} / {len(CASES)} 막힘{' — 구멍 없음' if holes == 0 else f' — 🔴 구멍 {holes}개'}

| 종류 | 어긴 것 | 테이블 | 기대 | 실제 | 막은 제약 | |
|---|---|---|---|---|---|---|
""" + "\n".join(rows) + """

종류 — p PRIMARY KEY · u UNIQUE · f FOREIGN KEY · c CHECK · x EXCLUDE · n NOT NULL

## 읽는 법

- **겹침 실험(x)** 의 상대는 실제로 있는 끝난 LOT 이다. 같은 설비 · 제품으로 그 LOT 이 시작한 1분 뒤부터
  끝날 때까지를 새 LOT 으로 열려고 했다. `lot_no_overlap`(009) 이 23P01 로 거절했다
- 없었으면 어땠나 — 모든 칸이 **에러가 아니라 조용히 틀린 숫자**가 된다. 열린 LOT 하나가 미래를 삼켜
  187개가 1,985개로 부푼 것이 10/01 의 실측이다
- 막힌 요청은 트랜잭션째 없던 일이 된다. 실험 뒤에 남은 행은 없다
- 🔵 `lot_qty_sum` · `lot_time_order` 는 016 에서 이름을 붙였다. 그 전에는 `production_lot_check` · `_check1` 로
  찍혀서 에러만 보고는 무엇을 어겼는지 알 수 없었다. **제약에는 이름을 붙인다**

면접 문장 — **"애플리케이션 버그로 겹치는 LOT 이 들어가면요?" → "DB 가 막습니다. 23P01 로 거절됩니다."**
"""
path = os.path.join("docs", "evidence", "constraints-reject.md")
open(path, "w", encoding="utf-8").write(md)
print(f"\n{len(CASES) - holes}/{len(CASES)} 막힘 · {path} 에 남김")
