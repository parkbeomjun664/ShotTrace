"""ETL 순수함수 테스트 — 9월에 데이터가 놀라게 한 가장자리를 남긴다. 실행: pytest scripts/etl"""

import pandas as pd

from load import make_lot_id, parse_product, parse_tonnage, to_lots, to_records


def test_톤수는_한글_톤과_영문_TON_둘_다_읽는다():       # 원본에 둘 다 있다
    assert parse_tonnage("650톤-우진2호기") == 650
    assert parse_tonnage("1800TON-우진") == 1800


def test_톤수가_없으면_0이_아니라_None():               # 0 이면 "0톤 설비" 라는 거짓말
    assert parse_tonnage("시험설비") is None


def test_제품명에서_차종과_좌우를_뽑는다():
    assert parse_product("CN7 W/S SIDE MLD'G LH") == ("CN7", "LH")
    assert parse_product("RG3 MOLD'G W/SHLD, LH") == ("RG3", "LH")   # 쉼표 뒤의 LH —  가 잡는다


def test_좌우가_없으면_None():
    assert parse_product("SP2 CVR ROOF RACK CTR") == ("SP2", None)   # 빈 글자도 에러도 아니라 None — DB CHECK(side IN LH, RH)를 통과한다


def test_LOT_번호는_설비_계획일_차종_좌우():
    assert make_lot_id("S14", pd.Timestamp("2020-10-16"), "CN7", "LH") == "S14-20201016-CN7LH"


def test_LOT_은_설비_계획일_제품으로_묶고_끝에_1초를_더한다():
    t = pd.Timestamp("2020-10-16 08:00:00", tz="UTC")
    df = pd.DataFrame({                                # 5,232행 대신 4줄 — 답을 머리로 계산할 수 있게
        "_id": ["a", "b", "c", "d"],
        "EQUIP_CD": ["S14"] * 4,
        "plan_date": [pd.Timestamp("2020-10-16")] * 4,
        "PART_NAME": ["CN7 LH", "CN7 LH", "CN7 LH", "CN7 RH"],
        "PassOrFail": ["Y", "Y", "N", "Y"],
        "measured_at": [t, t + pd.Timedelta(seconds=60), t + pd.Timedelta(seconds=120), t],
    })
    lots = to_lots(df).set_index("PART_NAME")
    lh = lots.loc["CN7 LH"]
    assert (lh.total_qty, lh.pass_qty, lh.fail_qty) == (3, 2, 1)
    assert lh.ended_at == t + pd.Timedelta(seconds=121)   # 🔴 마지막 샷 120초 + 1초 — 반열린 구간 (ADR 006)
    assert lots.loc["CN7 RH"].total_qty == 1           # 같은 설비 · 같은 날이어도 제품이 다르면 다른 LOT (패밀리 금형)


def test_빈_값은_NaN_이_아니라_None():
    rows = to_records(pd.DataFrame({"fail_reason": ["가스", float("nan")]}))
    assert rows == [{"fail_reason": "가스"}, {"fail_reason": None}]   # 🔴 NaN 이 그대로 가면 DB 에서 에러 · 숫자 NaN
