"""
ShotTrace ETL — CSV를 Supabase로

📓 필기 M05(ETL) · M14(Python·pandas) 를 펴고 시작한다.

─────────────────────────────────────────────────────────────
순서 — FK가 이 순서를 강제한다 (M05 ②)
─────────────────────────────────────────────────────────────
  1. CSV 읽기
  2. 죽은 컬럼 찾기            min == max == 0 인 컬럼
  3. 'None' → NA              안 하면 파레토 1등이 None (M02 ⑥)
  4. 한글 날짜 파싱            🔴 추측하지 말고 데이터로 먼저 확인
  5. equipment / product 추출  중복 제거
  6. LOT 집계 (groupby)        🔴 ended_at = max + 1초 (M05 ⑤)
  7. 적재 순서                 equipment → product → lot → param
  8. 검증 쿼리                 README 참고

─────────────────────────────────────────────────────────────
잊지 말 것
─────────────────────────────────────────────────────────────
  🔴 변환 로직은 순수함수로 분리한다 (M05 ③)
     → M26에서 그대로 테스트 대상이 된다.
     → DB도 파일도 안 건드리는 함수로.
       예: parse_plan_date() · normalize_fail_reason() · to_lots()

  🔴 멱등하게 만든다 (M05 ⑦)
     → upsert(on_conflict='param_id'). 두 번 돌려도 행이 안 늘어나야 한다.

  🔴 배치로 넣는다 (M05 ⑥)
     → 한 줄씩이면 왕복 7,996번. 1,000개씩이면 8번.

  🔴 Number("") 는 0이 된다
     → "측정 안 됨"과 "0도"가 섞인다. 빈 값은 NULL 로.

  🔴 pandas 는 반복문을 쓰지 않는다 (M14 ⑤)
     → 컬럼 전체에 한 번에. 조건은 & | 와 괄호.
"""

import os
from dotenv import load_dotenv

load_dotenv()

CSV_PATH = os.getenv("SIMULATOR_CSV_PATH", "../../data/labeled_data.csv")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")   # RLS 우회 — 서버 전용


def main() -> None:
    # 여기부터 작성
    raise NotImplementedError("M05 필기를 펴고 순서대로 채운다")


if __name__ == "__main__":
    main()
