"""RLS 전수 점검 — 역할 다섯 × 모든 테이블 · View · 함수를 실제로 두드려본다 (M19).

    python scripts/verify/rls_matrix.py

역할
  비로그인   anon 키만
  명단없음   로그인은 했지만 user_role 에 없는 사람 — 실행할 때 임시로 만들고 끝나면 지운다
  viewer    공개 데모 계정
  worker    비밀번호를 실행할 때 입력 (엔터 = 건너뛰기)
  admin     위와 같다

읽기  — 몇 행이 보이나
쓰기  — INSERT {} (빈 행) · UPDATE (같은 값으로 덮기 → 실제로는 아무것도 안 바뀐다)
DELETE 는 두드리지 않는다. 뚫려 있으면 진짜 데이터가 지워진다 — 정책 목록(pg_policies)으로 본다.
"""
import getpass
import os
import secrets
import sys
import uuid

from dotenv import load_dotenv
from postgrest.exceptions import APIError
from supabase import create_client

sys.stdout.reconfigure(encoding="utf-8")  # Windows 터미널(cp949)은 — · ■ 를 못 찍고 멈춘다 (10/26)
load_dotenv()
URL =os.environ["NEXT_PUBLIC_SUPABASE_URL"]
ANON = os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

TABLES = ["equipment", "product", "production_lot", "shot", "shot_part", "user_role", "production_record", "record_cancel", "downtime_reason", "downtime", "defect_code", "lot_guide", "parameter_spec", "master_audit"]
VIEWS = ["equipment_summary", "plant_summary", "daily_yield", "defect_pareto", "active_record", "lot_oee_input"]
UPDATE_KEYS = {  # 테이블: (거를 컬럼들, 같은 값으로 덮을 컬럼)
    "equipment": (["equip_cd"], "equip_name"),
    "product": (["product_id"], "part_name"),
    "production_lot": (["lot_id"], "equip_cd"),
    "shot": (["equipment_id", "measured_at"], "cycle_time"),
    "shot_part": (["equipment_id", "measured_at", "product_id"], "pass_or_fail"),
    "user_role": (["user_id"], "role"),
    "production_record": (["record_id"], "lot_id"),
    "record_cancel": (["record_id"], "reason"),
    "downtime_reason": (["code"], "active"),
    "downtime": (["downtime_id"], "note"),
    "defect_code": (["reason"], "active"),
    "lot_guide": (["lot_id"], "model"),  # 023 — 가이드도 고치지 않는다
    "parameter_spec": (["metric"], "value"),  # 028 — admin 만 값을 고친다
    "master_audit": (["audit_id"], "action"),  # 028 — 아무도 못 고친다 (트리거만 쓴다)
}
STAFF = {"viewer", "worker", "admin"}
ADMIN_UPDATES = {"downtime_reason", "defect_code", "equipment", "product", "parameter_spec"}  # UPDATE 정책이 admin 에게 열린 마스터 (019 · 028)
ADMIN_INSERTS = {"equipment", "product", "downtime_reason", "defect_code"}  # INSERT 정책이 admin 에게 열린 마스터 (028) — 빈 행이라 NOT NULL · CHECK 에 걸린다

admin_db = create_client(URL, SERVICE)  # RLS 를 건너뛰는 열쇠 — 기준값 · 임시 사용자에만
sample = {t: (admin_db.table(t).select("*").limit(1).execute().data or [None])[0] for t in TABLES}
lot_id = sample["production_lot"]["lot_id"]


def login(email, password):
    c = create_client(URL, ANON)
    c.auth.sign_in_with_password({"email": email, "password": password})
    return c


# ── 역할 준비 ───────────────────────────────────────────
clients = {"비로그인": create_client(URL, ANON)}

temp_email = f"norole-{uuid.uuid4().hex[:8]}@example.com"
temp_pw = secrets.token_urlsafe(16)
temp_user = admin_db.auth.admin.create_user({"email": temp_email, "password": temp_pw, "email_confirm": True}).user
try:
    clients["명단없음"] = login(temp_email, temp_pw)
    clients["viewer"] = login("viewer@example.com", "parkbeomjun122!!")  # 로그인 화면에 공개된 값
    for who in ("worker", "admin"):
        pw = "" if "--viewer-only" in sys.argv else getpass.getpass(f"{who}@example.com 비밀번호 (엔터 = 건너뛰기): ")
        if pw:
            clients[who] = login(f"{who}@example.com", pw)

    roles = list(clients)
    bad = []

    def cell(role, obj, got, ok):
        if not ok:
            bad.append(f"{role} · {obj} · {got}")
        return f"{got}{'' if ok else ' 🔴'}"

    def show(title, rows):
        print(f"\n■ {title}")
        w = max(len(r[0]) for r in rows) + 2
        print("  " + "".ljust(w) + "".join(r.ljust(12) for r in roles))
        for name, cells in rows:
            print("  " + name.ljust(w) + "".join(cells[r].ljust(12) for r in roles))

    # ── 읽기 ───────────────────────────────────────────
    rows = []
    for t in TABLES + VIEWS:
        cells = {}
        for r, c in clients.items():
            if t == "plant_summary":  # GROUP BY 없는 집계 — 비어도 1행. 값으로 본다
                d = c.table(t).select("total_qty").execute().data
                got = d[0]["total_qty"] if d else 0
            else:
                got = c.table(t).select("*", count="exact").limit(1).execute().count
            staff = r in STAFF
            if not staff:
                ok = got == 0
            elif t == "user_role":
                ok = got >= 2 if r == "admin" else got == 1  # 본인 한 줄 · admin 은 전부
            elif t in ("production_record", "record_cancel", "active_record", "downtime", "lot_guide", "master_audit"):
                ok = True  # 장부 · 가이드 · 이력은 비어 있을 수도 있다
            else:
                ok = got > 0
            cells[r] = cell(r, t, got, ok)
        rows.append((t, cells))

    cells = {}
    for r, c in clients.items():
        got = len(c.rpc("get_lot_shots", {"p_lot_id": lot_id}).execute().data)
        cells[r] = cell(r, "get_lot_shots()", got, (got > 0) == (r in STAFF))
    rows.append(("get_lot_shots()", cells))

    cells = {}
    for r, c in clients.items():
        got = c.rpc("app_role").execute().data
        cells[r] = cell(r, "app_role()", got, got == (r if r in STAFF else None))
    rows.append(("app_role()", cells))
    show("읽기 — 보이는 행 수 (plant_summary 는 total_qty)", rows)

    # ── 쓰기 · INSERT 빈 행 ─────────────────────────────
    rows = []
    for t in TABLES:
        cells = {}
        for r, c in clients.items():
            try:
                c.table(t).insert({}).execute()
                got = "들어감"
            except APIError as e:
                got = e.code
            if t in ("production_record", "record_cancel", "downtime", "lot_guide") and r in ("worker", "admin"):
                ok = got == "23502"  # RLS 는 통과 → NOT NULL 이 잡는다
            elif t in ADMIN_INSERTS and r == "admin":
                ok = got in ("23502", "23514")  # RLS 는 통과 → 빈 행이라 NOT NULL(23502) · CHECK(23514) 가 잡는다 (028)
            else:
                ok = got == "42501"  # RLS(또는 권한)가 막는다
            cells[r] = cell(r, f"INSERT {t}", got, ok)
        rows.append((t, cells))
    show("쓰기 — INSERT {} 의 결과 코드  (42501 = 막힘 · 23502 = RLS 통과, 빈칸이라 NOT NULL 에 걸림)", rows)

    # ── 쓰기 · UPDATE 같은 값으로 ───────────────────────
    rows = []
    for t in TABLES:
        row = sample[t]
        cells = {}
        for r, c in clients.items():
            if row is None:
                cells[r] = "(빈 표)"
                continue
            keys, col = UPDATE_KEYS[t]
            q = c.table(t).update({col: row[col]})
            for k in keys:
                q = q.eq(k, row[k])
            try:
                got = len(q.execute().data)
            except APIError as e:
                got = e.code
            expect = 1 if (r == "admin" and t in ADMIN_UPDATES) else 0   # 019 — 마스터는 admin 만 고친다
            cells[r] = cell(r, f"UPDATE {t}", got, got == expect)
        rows.append((t, cells))
    show("쓰기 — UPDATE (같은 값으로 덮기) 에 바뀐 행 수  (admin × 사유 명단 둘만 1)", rows)

    print(f"\n{'🔴 예상과 다른 칸 ' + str(len(bad)) + '개' if bad else '모든 칸이 예상대로'}")
    for b in bad:
        print("  -", b)
finally:
    admin_db.auth.admin.delete_user(temp_user.id)  # 임시 '명단없음' 사용자 정리
    print(f"\n(임시 사용자 {temp_email} 지움)")
