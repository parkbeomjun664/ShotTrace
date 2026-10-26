// 실적 입력의 규칙 — 샷 수 차이 경고 · 원장의 취소 · 정정 잇기 (10/26 · M26 테스트 대상)
// 순수함수 — DB 를 안 부른다. 화면과 서버 액션이 같은 규칙을 쓴다

export const SHOT_DIFF_LIMIT = 0.1;                    // 사람이 센 수량이 설비 샷 수와 10% 넘게 다르면 메모를 받는다

// 경고인가 — 샷 수가 없으면(진행 중 · 0) 비교할 기준이 없다
export function shotDiffWarn(entered: number, shots: number): boolean {
  if (!(shots > 0)) return false;
  // 🔴 "넘으면" — 딱 10% 는 아직 괜찮다. 나누지 않고 곱해서 비교 + 아주 작은 여유: 100 × 1.1 = 110.00000000000001 이라 딱 10% 가 경고가 됐다
  return Math.abs(entered - shots) > shots * SHOT_DIFF_LIMIT + 1e-9;
}

type Rec = { record_id: number; lot_id: string; recorded_at: string; recorded_by: string };
type Cancel = { record_id: number; reason: string; canceled_at: string };

export type LedgerRow<R extends Rec> = Omit<R, "canceled" | "replacedBy" | "correctionOf" | "mine"> & {
  canceled: boolean;                                   // 취소된 줄 — 취소선
  replacedBy: number | null;                           // 정정으로 생긴 새 줄 번호
  correctionOf: { record_id: number; reason: string } | null;   // 이 줄이 정정으로 생겼다면 — 원래 줄 · 사유
  mine: boolean;
};

// 원장 잇기 — 정정 함수(015)는 취소 + 새 줄을 한 트랜잭션에 넣는다. 트랜잭션 안의 now() 는 같은 시각이라
// 취소의 canceled_at = 새 줄의 recorded_at · 같은 LOT. 이 둘로 짝을 찾는다 (표에 새 줄 번호를 따로 적지 않았다)
export function ledger<R extends Rec>(records: R[], cancels: Cancel[], me: string | null): LedgerRow<R>[] {
  const cancelOf = new Map(cancels.map((c) => [c.record_id, c]));
  const byTime = new Map<string, R[]>();
  for (const r of records) byTime.set(`${r.lot_id}|${Date.parse(r.recorded_at)}`, [...(byTime.get(`${r.lot_id}|${Date.parse(r.recorded_at)}`) ?? []), r]);

  const out: LedgerRow<R>[] = records.map((r) => ({ ...r, canceled: cancelOf.has(r.record_id), replacedBy: null, correctionOf: null, mine: r.recorded_by === me }));
  const byId = new Map<number, LedgerRow<R>>(out.map((r) => [r.record_id, r]));
  for (const c of cancels) {
    const orig = byId.get(c.record_id);
    if (!orig) continue;
    const twin = (byTime.get(`${orig.lot_id}|${Date.parse(c.canceled_at)}`) ?? []).find((r) => r.record_id !== orig.record_id);
    if (!twin) continue;                               // 그냥 취소(정정 아님)거나 새 줄이 이 화면 밖에 있다
    orig.replacedBy = twin.record_id;
    byId.get(twin.record_id)!.correctionOf = { record_id: orig.record_id, reason: c.reason };
  }
  return out;
}
