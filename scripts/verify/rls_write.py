"""실적 쓰기 정책 확인 (012) — 역할별로 실제 로그인해서 써본다.

    python scripts/verify/rls_write.py                 viewer + worker
    python scripts/verify/rls_write.py --viewer-only   viewer 만 (비밀번호를 안 묻는다)

viewer 는 공개 데모 계정이라 그대로 쓴다. worker 비밀번호는 실행할 때 입력받는다
(엔터만 치면 worker 확인은 건너뛴다). worker 확인이 남긴 행은 마지막에 service_role 로 치운다.
"""
import getpass
import os
import sys

from dotenv import load_dotenv
from postgrest.exceptions import APIError
from supabase import create_client
from supabase_auth.errors import AuthApiError

load_dotenv()
URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
ANON = os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

VIEWER = ("viewer@example.com", "parkbeomjun122!!")  # 로그인 화면에 공개된 값
WORKER_EMAIL = "worker@example.com"

results = []


def check(name, ok, detail):
    results.append(ok)
    print(f"  {'✅' if ok else '❌'} {name}\n      → {detail}")


def login(email, password):
    client = create_client(URL, ANON)
    user = client.auth.sign_in_with_password({"email": email, "password": password}).user
    return client, user.id


def try_insert(client, row):
    try:
        data = client.table("production_record").insert(row).execute().data
        return data, None
    except APIError as e:
        return None, e


# ── viewer ─────────────────────────────────────────────
print("\n[viewer] 공개 데모 계정")
viewer, viewer_id = login(*VIEWER)
lot_id = viewer.table("production_lot").select("lot_id").limit(1).execute().data[0]["lot_id"]
print(f"  (시험용 LOT: {lot_id})")

data, err = try_insert(viewer, {"lot_id": lot_id, "pass_qty": 1, "fail_qty": 0})
check(
    "viewer 는 실적을 쓸 수 없다",
    err is not None and err.code == "42501",
    f"{err.code} {err.message}" if err else f"🔴 들어갔다: {data}",
)

# ── worker ─────────────────────────────────────────────
worker_pw = ""
if "--viewer-only" not in sys.argv:  # Windows 는 NUL 도 tty 로 보여서 isatty 로는 못 거른다
    worker_pw = getpass.getpass(f"\n{WORKER_EMAIL} 비밀번호 (엔터 = 건너뛰기): ")

created = []
if worker_pw:
    print("\n[worker]")
    try:
        worker, worker_id = login(WORKER_EMAIL, worker_pw)
    except AuthApiError as e:
        sys.exit(f"  🔴 로그인 실패 — {e.message} (한/영 · Caps Lock 확인)")

    data, err = try_insert(worker, {"lot_id": lot_id, "pass_qty": 10, "fail_qty": 1})
    ok = err is None and bool(data) and data[0]["recorded_by"] == worker_id
    if data:
        created.append(data[0]["record_id"])
    check(
        "worker 는 실적을 쓸 수 있다 (recorded_by 는 DB 가 채운다)",
        ok,
        f"record_id={data[0]['record_id']} recorded_by=본인" if ok else f"{err.code} {err.message}" if err else data,
    )

    data, err = try_insert(
        worker, {"lot_id": lot_id, "pass_qty": 10, "fail_qty": 1, "recorded_by": viewer_id}
    )
    if data:
        created.append(data[0]["record_id"])
    check(
        "worker 도 남의 이름으로는 못 쓴다",
        err is not None and err.code == "42501",
        f"{err.code} {err.message}" if err else f"🔴 들어갔다: {data}",
    )

    if created:
        rid = created[0]
        upd = worker.table("production_record").update({"pass_qty": 999}).eq("record_id", rid).execute().data
        check("고칠 수 없다 (UPDATE 정책 없음)", upd == [], f"바뀐 행 {len(upd)}개 — 에러 없이 조용히")
        dele = worker.table("production_record").delete().eq("record_id", rid).execute().data
        check("지울 수 없다 (DELETE 정책 없음)", dele == [], f"지워진 행 {len(dele)}개 — 에러 없이 조용히")

    if created:
        admin = create_client(URL, SERVICE)  # RLS 를 건너뛰는 열쇠 — 시험 행 치우기에만
        admin.table("production_record").delete().in_("record_id", created).execute()
        print(f"\n  (시험 행 {len(created)}개 치움)")
else:
    print("\n[worker] 건너뜀")

print(f"\n{'모두 통과' if all(results) else '🔴 실패 있음'} — {sum(results)}/{len(results)}")
sys.exit(0 if all(results) else 1)
