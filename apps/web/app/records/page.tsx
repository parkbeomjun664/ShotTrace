// 실적 입력 — 작업자가 생산·불량 수량을 기록한다
// 수정 불가. 취소 후 재등록만 가능하다 (제조 기록은 감사 대상)
// 담당: M19(쓰기 정책 · 012) · M20(폼 · 검증) → M21(취소 · 트랜잭션)
// 10/26 재구성 — 왼쪽 입력(고정) · 오른쪽 원장(취소선 · 정정 잇기 · 줄의 정정 버튼). 모바일은 입력 → 원장
import { 날짜, 시분, 시각 } from "@/lib/format";
import { ledger } from "@/lib/records";
import { getActiveSums, getLedger, getLots, getMyRole } from "@/lib/queries";
import { createSessionClient } from "@/lib/supabase/session";

import { CorrectDialog } from "./CorrectDialog";
import RecordForm, { type LotOption } from "./RecordForm";

export default async function Page() {               // 서버 컴포넌트 — DB 를 읽어 폼에 건넨다
  const supabase = await createSessionClient();
  const [lots, { records, cancels }, sums, role, { data: { user } }] = await Promise.all([
    getLots(),
    getLedger(),
    getActiveSums(),
    getMyRole(),
    supabase.auth.getUser(),                           // "나" — 원장의 입력자 칸 (남의 이메일은 RLS 로 못 읽는다 · 읽게 열지도 않는다)
  ]);
  const readOnly = role !== "worker" && role !== "admin";   // 화면은 잠그고, 서버 액션 · RLS 가 진짜로 막는다

  const options: LotOption[] = lots.map((l) => ({
    id: l.lot_id,
    product: `${l.product?.car_model ?? ""} ${l.product?.side ?? ""}`.trim(),
    equip: l.equip_cd,
    range: l.ended_at === "infinity" ? `${날짜(l.started_at)} ${시분(l.started_at)} ~ 진행 중` : `${날짜(l.started_at)} ${시분(l.started_at)} ~ ${시분(l.ended_at)}`,
    shots: l.total_qty,
    recordedPass: sums.get(l.lot_id)?.pass ?? 0,
    recordedFail: sums.get(l.lot_id)?.fail ?? 0,
  }));
  const rows = ledger(records, cancels, user?.id ?? null);   // 취소 · 정정 잇기 — 순수함수 (lib/records.ts)

  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">실적 입력</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        작업자가 생산·불량 수량을 기록해요 · 수정 대신 취소 후 재등록으로 이력이 남아요
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[360px_1fr]">
        {/* 왼쪽 — 입력. 넓은 화면에서는 원장을 내려도 따라온다 (머리 띠 아래에 붙는다) */}
        <aside className="h-fit space-y-3 rounded-xl border p-5 lg:sticky lg:top-24">
          <h2 className="font-semibold">새 실적</h2>
          {readOnly && <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">둘러보기 계정은 읽기 전용이에요. 저장 · 정정 버튼이 잠겨 있어요.</p>}
          <RecordForm lots={options} requestId={crypto.randomUUID()} readOnly={readOnly} />
        </aside>

        {/* 오른쪽 — 원장. 지우개가 없다: 취소된 줄도 남는다 */}
        <div>
          <h2 className="font-semibold">최근 실적</h2>
          {rows.length === 0 ? (
            <p className="mt-3 rounded-xl border p-8 text-center text-sm text-muted-foreground">아직 기록이 없습니다</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border">
              {/* 🔴 주석을 <table> 뒤에 두면 공백이 "글자" 로 들어간다 — 그래서 여기 */}
              <table className="w-full whitespace-nowrap text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">시각</th>
                    <th className="px-4 py-2 font-medium">LOT</th>
                    <th className="px-4 py-2 text-right font-medium">양품</th>
                    <th className="px-4 py-2 text-right font-medium">불량</th>
                    <th className="px-4 py-2 font-medium">입력자</th>
                    <th className="px-4 py-2 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.record_id} id={`rec-${r.record_id}`} className={`border-b last:border-0 ${r.canceled ? "text-muted-foreground" : ""}`}>
                      <td className="px-4 py-2 tabular-nums">{날짜(r.recorded_at)} {시각(r.recorded_at)}</td>
                      <td className={`px-4 py-2 font-mono ${r.canceled ? "line-through" : ""}`}>{r.lot_id}</td>
                      <td className={`px-4 py-2 text-right tabular-nums ${r.canceled ? "line-through" : ""}`}>{r.pass_qty}</td>
                      <td className={`px-4 py-2 text-right tabular-nums ${r.canceled ? "line-through" : ""}`}>{r.fail_qty}</td>
                      <td className="px-4 py-2">{r.mine ? "나" : "다른 계정"}</td>
                      <td className="px-4 py-2">
                        {r.canceled ? (
                          r.replacedBy ? <a href={`#rec-${r.replacedBy}`} className="text-xs hover:underline">정정됨 → #{r.replacedBy}</a> : <span className="text-xs">취소됨</span>
                        ) : (
                          <span className="flex items-center gap-2">
                            {r.correctionOf && (
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900" title={`#${r.correctionOf.record_id} 을 정정`}>
                                정정({r.correctionOf.reason})
                              </span>
                            )}
                            {r.note && <span className="text-xs text-muted-foreground" title={r.note}>메모</span>}
                            <CorrectDialog recordId={r.record_id} lotId={r.lot_id} pass={r.pass_qty} fail={r.fail_qty} requestId={crypto.randomUUID()} readOnly={readOnly} />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
