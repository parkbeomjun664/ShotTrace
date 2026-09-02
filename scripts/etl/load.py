"""
ShotTrace ETL — CSV를 Supabase로

📓 필기 M05(ETL) · M14(Python·pandas) 를 펴고 시작한다.

─────────────────────────────────────────────────────────────
순서 — FK가 이 순서를 강제한다 (M05 ②)
─────────────────────────────────────────────────────────────
  1. CSV 읽기
  2. 완전 중복 제거            🔴 집계보다 먼저 (ADR 004)
  3. 'None' → NA              안 하면 파레토 1등이 None (M02 ⑥)
  4. 한글 날짜 파싱            전부 '오전 12:00:00' 이라 앞 10자만 쓴다
  5. equipment / product 추출  중복 제거
  6. LOT 집계 (groupby)        🔴 ended_at = max + 1초 (ADR 006)
  7. 샷 / 부품 분리            🔴 패밀리 금형 — 1샷 = 2부품 (ADR 005)
  8. 적재 순서                 equipment → product → lot → shot → shot_part
  9. 검증                      행 수와 합계를 DB에 되물어본다

─────────────────────────────────────────────────────────────
데이터로 확인한 규칙 — 추측한 것이 하나도 없다
─────────────────────────────────────────────────────────────
  톤수      "650톤-우진2호기" · "1800TON-우진"   → 톤|TON 앞의 숫자
  차종      "CN7 W/S SIDE ... LH"              → 첫 토큰
  방향      끝의 LH / RH                        → 6개 제품이 차종+방향으로 고유
  계획일    "2020-10-16 오전 12:00:00"          → 오전만 존재. 시각은 의미 없다
  불량사유  빈 값의 정체는 문자열 "None" 7,925건 → pandas 가 NA 로 읽어준다

─────────────────────────────────────────────────────────────
잊지 말 것
─────────────────────────────────────────────────────────────
  🔴 변환 로직은 순수함수로 분리한다 (M05 ③) → M26 에서 테스트 대상
  🔴 멱등하게 만든다 (M05 ⑦) → 두 번 돌려도 행이 안 늘어난다
  🔴 배치로 넣는다 (M05 ⑥) → 한 줄씩이면 왕복 5,232번, 1,000개씩이면 6번
  🔴 빈 값은 0 이 아니라 NULL 로
  🔴 pandas 는 반복문을 쓰지 않는다 (M14 ⑤)
     단, 25행짜리 레코드 조립은 예외. 금지 대상은 수천 행 컬럼 연산이다
"""

import os
import re
import sys
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).resolve().parents[2]              # scripts/etl → 저장소 루트
load_dotenv(ROOT / ".env")                              # cwd 와 무관하게 찾는다

CSV_PATH     = ROOT / "data" / "labeled_data.csv"
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")   # RLS 우회 — 서버 전용

BATCH = 1000                                            # 왕복 6번 (M05 ⑥)

DEAD_COLS = [                                           # ADR 003 — 전 구간 0
    "Switch_Over_Position", "Barrel_Temperature_7",
    *[f"Mold_Temperature_{n}" for n in (1, 2, 5, 6, 7, 8, 9, 10, 11, 12)],
]

META_COLS = [                                           # 공정변수가 아닌 컬럼
    "_id", "TimeStamp", "PART_FACT_PLAN_DATE", "PART_FACT_SERIAL",
    "PART_NAME", "EQUIP_CD", "EQUIP_NAME", "PassOrFail", "Reason",
]

ISO = "%Y-%m-%dT%H:%M:%S+00:00"                         # timestamptz 로 보낼 문자열

RENAME = {                                              # 나머지 24개는 소문자만 하면 된다
    "_id": "part_id",
    "EQUIP_CD": "equipment_id",
    "PART_FACT_SERIAL": "part_serial",
    "PassOrFail": "pass_or_fail",
    "Reason": "fail_reason",
}


# ── 순수함수 — DB 도 파일도 안 건드린다 (M05 ③) ─────────────

def parse_tonnage(equip_name: str) -> int | None:
    m = re.search(r"(\d+)\s*(?:톤|TON)", equip_name, re.I)   # 650톤 / 1800TON
    return int(m.group(1)) if m else None


def parse_product(part_name: str) -> tuple[str, str | None]:
    car  = part_name.split()[0]                         # "CN7 W/S ..." → "CN7"
    side = re.search(r"\b(LH|RH)\b", part_name)         # 끝의 LH / RH
    return car, side.group(1) if side else None


def make_lot_id(equip_cd: str, plan_date, car: str, side: str) -> str:
    return f"{equip_cd}-{plan_date:%Y%m%d}-{car}{side}"  # S14-20201016-CN7LH


def to_records(frame: pd.DataFrame) -> list[dict]:
    return frame.astype(object).where(pd.notna(frame), None).to_dict("records")  # NaN → None


def to_equipment(df: pd.DataFrame) -> list[dict]:
    pairs = df[["EQUIP_CD", "EQUIP_NAME"]].drop_duplicates()
    return [{"equip_cd": cd, "equip_name": nm, "tonnage": parse_tonnage(nm)}
            for cd, nm in pairs.values]


def to_product(df: pd.DataFrame) -> list[dict]:
    out = []
    for nm in sorted(df["PART_NAME"].unique()):         # 정렬 → product_id 가 재현 가능
        car, side = parse_product(nm)
        out.append({"part_name": nm, "car_model": car, "side": side})
    return out


def to_lots(df: pd.DataFrame) -> pd.DataFrame:
    df = df.assign(is_pass=(df["PassOrFail"] == "Y").astype(int))
    g = df.groupby(["EQUIP_CD", "plan_date", "PART_NAME"], as_index=False).agg(
        total_qty =("_id", "size"),
        pass_qty  =("is_pass", "sum"),
        started_at=("measured_at", "min"),
        ended_at  =("measured_at", "max"),
    )
    g["fail_qty"] = g["total_qty"] - g["pass_qty"]
    g["ended_at"] = g["ended_at"] + pd.Timedelta(seconds=1)   # 🔴 반열린 구간 (ADR 005)
    return g


def lot_records(g: pd.DataFrame, product_id: dict[str, int]) -> list[dict]:
    out = []
    for r in g.itertuples():                            # 25행뿐 — 반복문 허용
        car, side = parse_product(r.PART_NAME)
        out.append({
            "lot_id"    : make_lot_id(r.EQUIP_CD, r.plan_date, car, side),
            "equip_cd"  : r.EQUIP_CD,
            "product_id": product_id[r.PART_NAME],
            "plan_date" : f"{r.plan_date:%Y-%m-%d}",
            "total_qty" : int(r.total_qty),
            "pass_qty"  : int(r.pass_qty),
            "fail_qty"  : int(r.fail_qty),
            "started_at": r.started_at.isoformat(),
            "ended_at"  : r.ended_at.isoformat(),
        })
    return out


def shot_records(df: pd.DataFrame, source_cols: list[str]) -> list[dict]:
    """한 번의 사출. 공정변수는 샷의 속성이라 LH·RH 가 같은 값을 공유한다 (ADR 005)."""
    proc = [c for c in source_cols                      # 45 − 메타 9 − 죽은 12 = 24개
            if c not in META_COLS and c not in DEAD_COLS]
    one = df.drop_duplicates(subset=["EQUIP_CD", "measured_at"])   # 2부품 → 1샷
    out = one[["EQUIP_CD", "measured_at"] + proc].rename(columns=RENAME)
    out = out.rename(columns=str.lower)
    out["measured_at"] = one["measured_at"].dt.strftime(ISO)
    return to_records(out)


def part_records(df: pd.DataFrame, product_id: dict[str, int]) -> list[dict]:
    """한 샷에서 나온 부품. 품질은 부품의 속성이라 LH·RH 가 따로 갈린다."""
    cols = ["_id", "EQUIP_CD", "measured_at", "PART_FACT_SERIAL", "PassOrFail", "Reason"]
    out = df[cols].rename(columns=RENAME).rename(columns=str.lower)
    out["measured_at"] = df["measured_at"].dt.strftime(ISO)
    out["product_id"]  = df["PART_NAME"].map(product_id)   # 이름 → DB가 발급한 번호
    return to_records(out)


# ── 여기부터는 바깥 세계를 건드린다 ─────────────────────────

def read_csv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)                              # "None" 은 pandas 가 NA 로
    before = len(df)
    df = df.drop_duplicates().reset_index(drop=True)    # 🔴 groupby 보다 먼저 (ADR 004)
    print(f"  {before}행 → 중복 {before - len(df)}행 제거 → {len(df)}행")
    assert df["_id"].is_unique, "_id 가 중복이다 — PK 로 못 쓴다"
    return df


def prepare(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["measured_at"] = pd.to_datetime(df["TimeStamp"]).dt.tz_localize("UTC")   # ADR 002
    df["plan_date"]   = pd.to_datetime(df["PART_FACT_PLAN_DATE"].str[:10])      # 시각 버림
    return df


def upsert(client, table: str, rows: list[dict], conflict: str) -> None:
    for i in range(0, len(rows), BATCH):                # 1,000개씩 (M05 ⑥)
        client.table(table).upsert(rows[i:i + BATCH], on_conflict=conflict).execute()
    print(f"  {table:16} {len(rows):>5}행")


def verify(client, df: pd.DataFrame, n_shot: int) -> None:
    ok = True
    for table, want in [("equipment", 3), ("product", 6), ("production_lot", 25),
                        ("shot", n_shot), ("shot_part", len(df))]:
        got = client.table(table).select("*", count="exact").limit(1).execute().count
        ok &= got == want
        print(f"  {table:16} {got:>5} / {want:>5}  {'OK' if got == want else '🔴 불일치'}")

    lots  = client.table("production_lot").select("total_qty").execute().data
    total = sum(r["total_qty"] for r in lots)
    ok &= total == len(df)
    print(f"  LOT 합계         {total:>5} / {len(df):>5}  "
          f"{'OK' if total == len(df) else '🔴 불일치'}")
    print("\n" + ("완료" if ok else "🔴 검증 실패 — 위 불일치를 먼저 본다"))


def main() -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        sys.exit("🔴 .env 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다")

    print("읽기:")
    raw = read_csv(CSV_PATH)
    source_cols = list(raw.columns)
    df = prepare(raw)

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("적재:")
    upsert(client, "equipment", to_equipment(df), "equip_cd")
    upsert(client, "product",   to_product(df),   "part_name")

    got = client.table("product").select("product_id, part_name").execute().data
    product_id = {r["part_name"]: r["product_id"] for r in got}   # IDENTITY 는 DB 가 발급

    shots = shot_records(df, source_cols)                         # 부모 먼저 (복합 FK)
    upsert(client, "production_lot", lot_records(to_lots(df), product_id), "lot_id")
    upsert(client, "shot",           shots,                       "equipment_id,measured_at")
    upsert(client, "shot_part",      part_records(df, product_id), "part_id")

    print("검증:")
    verify(client, df, len(shots))


if __name__ == "__main__":
    main()
