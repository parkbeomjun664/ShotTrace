# ETL — CSV를 Supabase로

📓 필기 **M05**(ETL) · **M14**(Python·pandas)

## 준비 (Windows PowerShell)

```powershell
cd scripts\etl
python -m venv .venv
.venv\Scripts\activate          # 프롬프트에 (.venv) 가 뜨는지 확인
pip install -r requirements.txt
```

> 🔴 **활성화 전에 `pip install` 하면 전역에 깔린다.** `(.venv)` 표시를 먼저 확인한다. (M14 ③)

## 데이터

`data/labeled_data.csv` 에 원본을 둔다. `.gitignore` 에 있어서 커밋되지 않는다.

## 실행

```powershell
python load.py
```

## 끝나면 반드시 확인 (M04 ⑧)

에러 없이 끝난 건 성공이 아니다. **숫자로 확인해야 성공이다.**

```sql
SELECT COUNT(*) FROM equipment_param;    -- 7996
SELECT COUNT(*) FROM production_lot;     -- 25
SELECT COUNT(*) FROM equipment;          -- 3
SELECT COUNT(*) FROM product;            -- 6

SELECT SUM(total_qty) FROM production_lot;                          -- 7996
SELECT COUNT(*) FROM equipment_param WHERE fail_reason = 'None';    -- 0
SELECT COUNT(*) FROM equipment_param WHERE pass_or_fail = 'N';      -- 71
```

**마지막으로 LOT 경계 검증** — 결과가 0건이어야 한다 (M05 ⑤)

```sql
SELECT l.lot_id, l.total_qty, COUNT(p.param_id) AS 실제조회
FROM production_lot l
JOIN equipment_param p
  ON  p.equipment_id = l.equip_cd
  AND p.measured_at >= l.started_at
  AND p.measured_at <  l.ended_at
GROUP BY l.lot_id, l.total_qty
HAVING l.total_qty <> COUNT(p.param_id);
```

결과가 나오면 `ended_at` 처리가 틀린 것이다.
