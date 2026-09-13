// 품질 — 불량이 어디에 몰려 있나 · M11(View) → M12(차트)
import { getDailyYield, getDefectPareto } from "@/lib/queries";
import { ParetoChart } from "./ParetoChart";

export const revalidate = 60;

export default async function Page() {
  const [pareto, daily] = await Promise.all([   // 왕복 2번을 동시에
    getDefectPareto(),                          // View 3행
    getDailyYield(),                            // View 13행 (오름차순)
  ]);

  const total = daily.reduce((a, d) => a + (d.total_qty ?? 0), 0);
  const fail = daily.reduce((a, d) => a + (d.fail_qty ?? 0), 0);
  const clean = daily.filter((d) => (d.fail_qty ?? 0) === 0).length;  // 무결점 일수
                                                       // ?? 0 — View 컬럼은 전부 null 허용

  return (
    <section className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">품질</h1>
        <p className="mt-1 text-sm tabular-nums text-muted-foreground">
          불량 {fail}건 / 전체 {total.toLocaleString()}개 ·{" "}
          {daily.length}일 중 {clean}일은 무결점
        </p>
      </div>

      <div>
        <h2 className="font-semibold">불량 파레토</h2>
          <div className="mt-3">
            <ParetoChart data={pareto} />
          </div>

        <div className="mt-3 space-y-3">
          {pareto.map((p) => (
            <div key={p.fail_reason}>
              <div className="flex items-baseline justify-between text-sm">
                <span>{p.fail_reason}</span>
                <span className="tabular-nums text-muted-foreground">
                  {p.fail_qty}건 · {(p.share_pct ?? 0).toFixed(2)}%
                </span>
              </div>
              <div className="mt-1 h-2 rounded bg-black/10 dark:bg-white/15">
                <div
                  className="h-2 rounded bg-black/60 dark:bg-white/70"
                  style={{ width: `${p.share_pct ?? 0}%` }}  // 값이 실행 중 정해져 style
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-semibold">일별 수율</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">계획일</th>
                <th className="py-2 pr-4 text-right font-medium">생산</th>
                <th className="py-2 pr-4 text-right font-medium">불량</th>
                <th className="py-2 text-right font-medium">수율</th>
              </tr>
            </thead>
            <tbody>
              {[...daily].reverse().map((d) => (   // 🔴 [...] 없으면 원본이 뒤집힌다
                <tr key={d.plan_date} className="border-b last:border-0">
                  <td className="py-2 pr-4 tabular-nums">{d.plan_date}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {(d.total_qty ?? 0).toLocaleString()}
                  </td>
                  <td
                    className={`py-2 pr-4 text-right tabular-nums ${
                      (d.fail_qty ?? 0) > 0
                        ? "font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {d.fail_qty}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {(d.yield_pct ?? 0).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
