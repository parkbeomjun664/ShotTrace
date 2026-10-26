// 품질 — 불량이 어디에 몰려 있나 · M11(View) → M12(차트)
// 10/26 — 파레토(막대 + 누적 % + 80% 선) · 작은 표 · 일별 수율 선 그래프(95% 목표) · 시연 날짜는 그래프에서 뺀다
import { isDemo, yieldLevel } from "@/lib/lots";
import { pareto } from "@/lib/quality";
import { getDailyYield, getDefectPareto } from "@/lib/queries";
import { DailyYieldChart } from "./DailyYieldChart";
import { ParetoChart } from "./ParetoChart";

const LEVEL_TEXT = { ok: "", warn: "text-status-warn", bad: "text-status-bad" } as const;   // LOT 목록과 같은 색
const LEVEL_DOT = { ok: "", warn: "bg-status-warn", bad: "bg-status-bad" } as const;

export default async function Page() {
  const [defects, daily] = await Promise.all([   // 왕복 2번을 동시에
    getDefectPareto(),                          // View 3행
    getDailyYield(),                            // View 14행 (오름차순)
  ]);

  const rows = pareto(defects);                 // 많은 순 + 비율 + 누적 % — 순수함수 (lib/quality.ts)
  const total = daily.reduce((a, d) => a + (d.total_qty ?? 0), 0);
  const fail = daily.reduce((a, d) => a + (d.fail_qty ?? 0), 0);
  const clean = daily.filter((d) => (d.fail_qty ?? 0) === 0).length;  // 무결점 일수
                                                       // ?? 0 — View 컬럼은 전부 null 허용

  // 🔴 그래프에는 KAMP 기간만 — 시연 날짜(2026)를 넣으면 x 축이 2020 → 2026 으로 6년을 건너뛴다 (LOT 목록과 같은 규칙)
  const points = daily
    .filter((d) => d.plan_date && d.yield_pct !== null && !isDemo(d.plan_date))
    .map((d) => ({ date: d.plan_date!, label: `${d.plan_date!.slice(5, 7)}. ${d.plan_date!.slice(8, 10)}.`, yield: d.yield_pct! }));   // plan_date 는 date — 시각이 아니라 잘라도 된다 (ADR 002 는 timestamp 얘기)

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
        <p className="mt-1 text-sm text-muted-foreground">점선(80%)을 처음 넘는 데까지가 먼저 손볼 유형이에요</p>
        {/* 차트 옆에 작은 표 — 같은 내용을 막대로 두 번 보여주던 진행 막대 목록을 대신한다 */}
        <div className="mt-3 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ParetoChart data={rows} />
          </div>
          <table className="h-fit w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">유형</th>
                <th className="py-2 pr-4 text-right font-medium">건수</th>
                <th className="py-2 pr-4 text-right font-medium">비율</th>
                <th className="py-2 text-right font-medium">누적</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.reason} className="border-b last:border-0">
                  <td className="py-2 pr-4">{r.reason}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{r.count}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{r.share.toFixed(1)}%</td>
                  <td className="py-2 text-right tabular-nums">{r.cum.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="font-semibold">일별 수율</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          점선은 목표 95% · 주황은 95% 미만, 빨강은 90% 미만 (LOT 목록과 같은 기준)
        </p>
        <div className="mt-3">
          <DailyYieldChart data={points} />
        </div>

        {/* 표는 접어 둔다 — 그래프가 먼저, 숫자가 필요할 때만 펼친다 */}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">일별 상세 보기</summary>
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
                {[...daily].reverse().map((d) => {   // 🔴 [...] 없으면 원본이 뒤집힌다
                  const lv = yieldLevel(d.yield_pct);
                  return (
                    <tr key={d.plan_date} className="border-b last:border-0">
                      <td className="py-2 pr-4 tabular-nums">
                        {d.plan_date}
                        {d.plan_date && isDemo(d.plan_date) && (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">시연</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{(d.total_qty ?? 0).toLocaleString()}</td>
                      <td className={`py-2 pr-4 text-right tabular-nums ${(d.fail_qty ?? 0) > 0 ? "font-medium" : "text-muted-foreground"}`}>
                        {d.fail_qty}
                      </td>
                      <td className={`py-2 text-right tabular-nums ${lv ? LEVEL_TEXT[lv] : ""}`}>
                        {lv && lv !== "ok" && <span aria-hidden className={`mr-1.5 inline-block size-1.5 rounded-full align-middle ${LEVEL_DOT[lv]}`} />}
                        {d.yield_pct === null ? "—" : `${d.yield_pct.toFixed(2)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  );
}
