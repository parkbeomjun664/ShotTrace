# ETL — CSV를 Supabase로

📓 필기 **M05**(ETL) · **M14**(Python·pandas)

## 준비 (Windows PowerShell)

🔴 **venv는 프로젝트 루트에 하나만 둔다.** 여러 개면 어느 걸 활성화했는지 헷갈린다.

```powershell
# 프로젝트 루트에서
python -m venv .venv
.venv\Scripts\activate                       # 프롬프트에 (.venv) 확인
pip install -r scripts\etl\requirements.txt
```

> 🔴 **활성화 전에 `pip install` 하면 전역에 깔린다.** `(.venv)` 표시를 먼저 확인한다. (M14 ③)
>
> 🔴 **venv를 두 개 만들지 않는다.** pandas는 A에, 다른 패키지는 B에 깔리면
> *"아까는 됐는데"* 가 반복된다. 에러 메시지의 **python.exe 경로**를 보면
> 어느 venv가 실행했는지 알 수 있다. (M04 ③)

VS Code에서 `Ctrl+Shift+P` → `Python: Select Interpreter` → 루트 `.venv` 를 고르면
터미널을 새로 열 때 자동으로 활성화된다.

## 데이터

`data/labeled_data.csv` 에 원본을 둔다. `.gitignore` 에 있어서 커밋되지 않는다.

## 실행

```powershell
cd scripts\etl        # ← ../../data/ 경로 기준이라 여기서 실행한다
python load.py
```

### 저장하면 자동 실행 (선택)

```powershell
python -m watchfiles --filter python "..\..\.venv\Scripts\python.exe explore.py" .
```

🔴 자식 프로세스가 실행할 python을 **경로로 직접** 지목해야 한다. `python` 이라고만
쓰면 watchfiles가 venv가 아닌 전역 python을 띄워서 `ModuleNotFoundError` 가 난다.

터미널 하나를 이것 전용으로 쓴다. 프롬프트가 안 돌아오는 게 정상이다 — 계속
살아서 감시하는 프로세스이기 때문. (M15 ①) 끄려면 `Ctrl+C`.

`requirements.txt` 에는 넣지 않았다. 적재에 필요한 게 아니라 개발 편의 도구다.

## 끝나면 반드시 확인 (M04 ⑧)

에러 없이 끝난 건 성공이 아니다. **숫자로 확인해야 성공이다.**

```sql
SELECT COUNT(*) FROM equipment_param;    -- 5232
SELECT COUNT(*) FROM production_lot;     -- 25
SELECT COUNT(*) FROM equipment;          -- 3
SELECT COUNT(*) FROM product;            -- 6

SELECT SUM(total_qty) FROM production_lot;                          -- 5232
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
