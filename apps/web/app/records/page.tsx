// 실적 입력 — 작업자가 생산·불량 수량을 기록한다
// 수정 불가. 취소 후 재등록만 가능하다 (제조 기록은 감사 대상)
// 담당: M19(쓰기 정책 · 012) · M20(폼 · 검증) → M21(취소 · 트랜잭션)
import { 날짜, 시각 } from "@/lib/format";
import { getLots, getRecentRecords } from "@/lib/queries";

import RecordForm from "./RecordForm";               // 우체통이 필요한 폼만 클라이언트
import CorrectForm from "./CorrectForm";             // 정정 폼도 클라이언트

export default async function Page() {               // 서버 컴포넌트 — DB 를 읽어 폼에 건넨다
  const [lots, records] = await Promise.all([getLots(), getRecentRecords()]);   // 두 번 읽기를 동시에

  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">실적 입력</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        작업자가 생산·불량 수량을 기록한다. 수정은 불가하고 취소 후 재등록만 가능하다.
      </p>

      <RecordForm lotIds={lots.map((lot) => lot.lot_id)} requestId={crypto.randomUUID()} /> {/* 그릴 때마다 새 번호표 — 성공하면 revalidatePath 가 다시 그린다 */}

      <h2 className="mt-10 text-lg font-semibold">최근 실적</h2> {/* 저장하면 revalidatePath 가 이 목록을 새로 그린다 */}
      {records.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">아직 기록이 없습니다</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="py-2 pr-4 font-medium">시각</th>
              <th className="py-2 pr-4 font-medium">LOT</th>
              <th className="py-2 pr-4 text-right font-medium">양품</th>
              <th className="py-2 text-right font-medium">불량</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (                    // key = record_id — 구멍은 있어도 겹치지 않는다
              <tr key={r.record_id} className="border-b last:border-0">
                <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                  {날짜(r.recorded_at)} {시각(r.recorded_at)}
                </td>
                <td className="py-2 pr-4 font-mono">{r.lot_id}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{r.pass_qty}</td>
                <td className="py-2 text-right tabular-nums">{r.fail_qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="mt-10 text-lg font-semibold">정정</h2> {/* 고치지 않는다 — 빨간 줄 + 새 줄 (M21) */}
      <p className="mt-1 text-sm text-muted-foreground">고르면 원래 줄은 취소되고, 새 수량으로 다시 적힌다.</p>
      <CorrectForm records={records} requestId={crypto.randomUUID()} /> {/* 저장과 다른 번호표 — 같으면 정정이 "이미 됐다" 로 막힌다 */}
    </section>
  );
}
