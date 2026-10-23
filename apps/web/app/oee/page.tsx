// OEE — LOT 별 가동률 × 성능 × 품질 · 화면은 계산하지 않는다 (재료 = View · 계산 = computeOee) (M24)
import { getLotOee } from "@/lib/queries";

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);   // null = 계산 안 함 → "—"

export default async function Page() {
  const lots = await getLotOee();

  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">OEE</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        LOT 별 가동률 × 성능 × 품질. 셋업은 손실, 계획 정지는 뺀다. 표준 사이클타임은 실측 중앙값(임시).
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="py-2 pr-4 font-medium">LOT</th>
              <th className="py-2 pr-4 text-right font-medium">가동률</th>
              <th className="py-2 pr-4 text-right font-medium">성능</th>
              <th className="py-2 pr-4 text-right font-medium">품질</th>
              <th className="py-2 text-right font-medium">OEE</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((l) => (
              <tr key={l.lot_id} className="border-b last:border-0">
                <td className="py-2 pr-4 font-mono">{l.lot_id}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{pct(l.oee.availability)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {pct(l.oee.performance)}
                  {l.oee.performanceRaw !== null && l.oee.performanceRaw > 1.1 && (   // 🔴 자르기 전 110% 초과 = 새 버그 신호 (지금은 0개여야 맞다)
                    <span className="ml-1 text-red-600" title={`자르기 전 ${pct(l.oee.performanceRaw)}`}>
                      ⚠
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">{pct(l.oee.quality)}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{pct(l.oee.oee)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
