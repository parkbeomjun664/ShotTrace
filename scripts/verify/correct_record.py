"""정정 RPC 확인 (015) — 전부 아니면 전무 · 동시에 두 번 · 권한.

    python scripts/verify/correct_record.py

worker 비밀번호는 실행할 때 입력받는다. 시험으로 만든 줄은 마지막에 service_role 로 치운다.
"""
import getpass
import os
import sys
import threading
import uuid

from dotenv import load_dotenv
from postgrest.exceptions import APIError
from supabase import create_client
from supabase_auth.errors import AuthApiError

load_dotenv()
URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
ANON = os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

results = []


def check(name, ok, detail):
    results.append(ok)
    print(f"  {'✅' if ok else '❌'} {name}\n      → {detail}")


def login(email, password):
    c = create_client(URL, ANON)
    c.auth.sign_in_with_password({"email": email, "password": password})
    return c


def correct(client, record_id, pass_qty, fail_qty, reason="시험 정정"):
    args = {"p_record_id": record_id, "p_pass_qty": pass_qty, "p_fail_qty": fail_qty,
            "p_reason": reason, "p_request_id": str(uuid.uuid4())}
    try:
        return client.rpc("correct_record", args).execute().data, None
    except APIError as e:
        return None, e


def err_text(err, data):
    return f"{err.code} {err.message}" if err else f"🔴 됐다: {data}"


pw = getpass.getpass("worker@example.com 비밀번호: ")
try:
    workers = [login("worker@example.com", pw) for _ in range(2)]  # 동시 시험용으로 둘
except AuthApiError as e:
    sys.exit(f"🔴 로그인 실패 — {e.message} (한/영 · Caps Lock 확인)")
viewer = login("viewer@example.com", os.environ["VIEWER_PASSWORD"])  # 루트 .env
admin = create_client(URL, SERVICE)  # RLS 를 건너뛰는 열쇠 — 기준 확인과 치우기에만

lot_id = workers[0].table("production_lot").select("lot_id").limit(1).execute().data[0]["lot_id"]
made = []  # 이번 실행이 만든 production_record 번호


def new_record(pass_qty=12, fail_qty=1):
    row = workers[0].table("production_record").insert(
        {"lot_id": lot_id, "pass_qty": pass_qty, "fail_qty": fail_qty, "request_id": str(uuid.uuid4())}
    ).execute().data[0]
    made.append(row["record_id"])
    return row["record_id"]


def canceled(record_id):
    return bool(admin.table("record_cancel").select("record_id").eq("record_id", record_id).execute().data)


def alive(record_id):
    return bool(workers[0].table("active_record").select("record_id").eq("record_id", record_id).execute().data)


try:
    # ① 권한
    print("\n[① viewer 가 정정]")
    rid = new_record()
    data, err = correct(viewer, rid, 21, 1)
    check("viewer 는 정정할 수 없다", err is not None and err.code == "42501", err_text(err, data))
    check("원래 줄은 멀쩡하다", not canceled(rid) and alive(rid), "빨간 줄 없음 · 살아 있음")

    # ② 전부 아니면 전무
    print("\n[② 새 줄이 실패하면]")
    data, err = correct(workers[0], rid, 0, 0)  # 0 + 0 → production_record 의 CHECK 에 걸린다
    check("새 줄이 CHECK 에 걸린다", err is not None and err.code == "23514", err_text(err, data))
    check("🔑 먼저 그은 빨간 줄도 없던 일이 된다", not canceled(rid) and alive(rid),
          "record_cancel 에 없음 · 원래 줄 살아 있음" if not canceled(rid) else "🔴 빨간 줄만 남았다 — 반쪽")

    # ③ 동시에 두 번
    print("\n[③ 둘이 동시에 정정]")
    start = threading.Barrier(2)
    outcome = [None, None]

    def run(i):
        start.wait()  # 둘이 같은 순간에 출발
        outcome[i] = correct(workers[i], rid, 20 + i, 1, f"동시 정정 {i}")

    threads = [threading.Thread(target=run, args=(i,)) for i in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    wins = [d for d, e in outcome if e is None]
    losses = [e for d, e in outcome if e is not None]
    made.extend(wins)
    check("한 명만 성공한다", len(wins) == 1, f"성공 {len(wins)} · 실패 {len(losses)}")
    check("다른 한 명은 23505 (record_cancel_pkey)",
          len(losses) == 1 and losses[0].code == "23505",
          f"{losses[0].code} {losses[0].message}" if losses else "🔴 실패한 쪽이 없다")
    new_rows = [r for r in workers[0].table("active_record").select("record_id, pass_qty")
                .eq("lot_id", lot_id).in_("record_id", made).execute().data]
    check("살아 있는 줄은 새 줄 하나뿐", len(new_rows) == 1 and new_rows[0]["record_id"] == (wins[0] if wins else None),
          f"active_record: {new_rows}")

    # ④ 이미 정정한 줄을 또
    print("\n[④ 이미 정정한 줄을 또 정정]")
    data, err = correct(workers[0], rid, 30, 0)
    check("두 번째 정정은 23505", err is not None and err.code == "23505", err_text(err, data))
finally:
    if made:
        admin.table("record_cancel").delete().in_("record_id", made).execute()  # FK — 취소 장부 먼저
        admin.table("production_record").delete().in_("record_id", made).execute()
        print(f"\n  (시험 줄 {len(made)}개 치움)")

print(f"\n{'모두 통과' if all(results) else '🔴 실패 있음'} — {sum(results)}/{len(results)}")
sys.exit(0 if all(results) else 1)
