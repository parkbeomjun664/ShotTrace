// 품질 — 불량이 어디에 몰려 있나 · M11(View) → M12(차트)
// 10/26 — 파레토(막대 + 누적 % + 80% 선) · 작은 표 · 일별 수율 선 그래프(95% 목표) · 시연 날짜는 그래프에서 뺀다
import { isDemo, yieldLevel } from "@/lib/lots";
import { dailySeries, pareto } from "@/lib/quality";
import { getDailyYield, getDefectPareto, getPartsWithoutLot } from "@/lib/queries";
import { DailyYieldChart } from "./DailyYieldChart";
import { Info } from "../Info";
import { Box, Dash, Dot, Legend, LineDot } from "../Legend";
import { ParetoChart } from "./ParetoChart";

const LEVEL_TEXT = { ok: "", warn: "text-status-warn", bad: "text-status-bad" } as const;   // LOT 목록과 같은 색
const LEVEL_DOT = { ok: "", warn: "bg-status-warn", bad: "bg-status-bad" } as const;

export default async function Page() {
  const [defects, daily, orphan] = await Promise.all([   // 왕복 3번을 동시에
    getDefectPareto(),                          // View 3행
    getDailyYield(),                            // View 14행 (오름차순)
    getPartsWithoutLot(),                       // LOT 에 안 묶인 부품 — 현황판 합계와의 차이 (024)
  ]);

  const rows = pareto(defects);                 // 많은 순 + 비율 + 누적 % — 순수함수 (lib/quality.ts)
  const total = daily.reduce((a, d) => a + (d.total_qty ?? 0), 0);
  const fail = daily.reduce((a, d) => a + (d.fail_qty ?? 0), 0);
  // 🔴 일수는 그래프와 같은 기준 — KAMP 날만. 시연 날짜(2026)는 그래프에서 빼니 여기서도 따로 센다 (10/26 · "14일" vs 점 13개)
  const kamp = daily.filter((d) => d.plan_date && !isDemo(d.plan_date));
  const clean = kamp.filter((d) => (d.fail_qty ?? 0) === 0).length;  // 무결점 일수
  const demoDays = daily.length - kamp.length;
                                                       // ?? 0 — View 컬럼은 전부 null 허용
  // 그래프 — KAMP 날을 달력 하루하루로 펼친다. 생산 없는 날은 null 이라 선이 끊긴다 (lib/quality.ts)
  const points = dailySeries(kamp.map((d) => ({ plan_date: d.plan_date!, yield_pct: d.yield_pct })));

  return (
    <section className="space-y-6">
      <div className="pb-2">
        <h1 className="text-2xl font-bold tracking-tight">품질</h1>
        {/* 부제는 숫자 한 줄 — 집계 범위 설명은 ⓘ 안으로 (10/27) */}
        <div className="mt-2 flex items-center gap-1 text-base tabular-nums text-muted-foreground">
          불량 {fail}건 / 전체 {total.toLocaleString()}개 · {kamp.length}일 중 {clean}일 무결점
          {(demoDays > 0 || orphan > 0) && (
            <Info id="quality-scope" label="집계 범위">
              {demoDays > 0 && <p>시연 날짜 {demoDays}일은 그래프에서 빼고, 일별 상세 표에만 보여요.</p>}
              {/* 현황판(부품을 직접 셈)과 이만큼 다르다 — 숨기지 않는다 (024 · 10/26) */}
              {orphan > 0 && <p>LOT에 묶인 부품만 세요. LOT 없는 부품 {orphan.toLocaleString()}개는 현황판 합계에만 들어가요.</p>}
            </Info>
          )}
        </div>
      </div>

      {/* 영역마다 카드 — 차트 둘이 한 흰 바탕에 이어져 경계가 흐렸다 (10/27) */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold">불량 파레토</h2>
        <Legend
          className="mt-2"
          items={[
            { mark: <Box className="bg-primary" />, label: "불량 건수" },
            { mark: <LineDot color="#6b7280" />, label: "누적 비율" },
            { mark: <Dash />, label: "80% — 여기까지 먼저 손볼 유형" },
          ]}
        />
        {/* 차트 옆에 작은 표 — 같은 내용을 막대로 두 번 보여주던 진행 막대 목록을 대신한다 */}
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ParetoChart data={rows} />
          </div>
          <table className="h-fit w-full text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">유형</th>
                <th className="px-4 py-2 font-medium">건수</th>
                <th className="px-4 py-2 font-medium">비율</th>
                <th className="px-4 py-2 font-medium">누적</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.reason} className="border-b last:border-0">
                  <td className="px-4 py-2">{r.reason}</td>
                  <td className="px-4 py-2 tabular-nums">{r.count}</td>
                  <td className="px-4 py-2 tabular-nums">{r.share.toFixed(1)}%</td>
                  <td className="px-4 py-2 tabular-nums">{r.cum.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold">일별 수율</h2>
        {/* LOT 목록과 같은 기준 · 같은 색 */}
        <Legend
          className="mt-2"
          items={[
            { mark: <Dash />, label: "목표 95%" },
            { mark: <Dot className="bg-status-warn" />, label: "95% 미만" },
            { mark: <Dot className="bg-status-bad" />, label: "90% 미만" },
            { mark: <Box style={{ background: "#e5e7eb" }} />, label: "생산 없는 날" },
          ]}
        />
        <div className="mt-4">
          <DailyYieldChart data={points} />
        </div>

        {/* 표는 접어 둔다 — 그래프가 먼저, 숫자가 필요할 때만 펼친다 */}
        <details className="mt-4 border-t pt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">일별 상세 보기</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">계획일</th>
                  <th className="px-4 py-2 font-medium">생산</th>
                  <th className="px-4 py-2 font-medium">불량</th>
                  <th className="px-4 py-2 font-medium">수율</th>
                </tr>
              </thead>
              <tbody>
                {[...daily].reverse().map((d) => {   // 🔴 [...] 없으면 원본이 뒤집힌다
                  const lv = yieldLevel(d.yield_pct);
                  return (
                    <tr key={d.plan_date} className="border-b last:border-0">
                      <td className="px-4 py-2 tabular-nums">
                        {d.plan_date}
                        {d.plan_date && isDemo(d.plan_date) && (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">시연</span>
                        )}
                      </td>
                      <td className="px-4 py-2 tabular-nums">{(d.total_qty ?? 0).toLocaleString()}</td>
                      <td className={`px-4 py-2 tabular-nums ${(d.fail_qty ?? 0) > 0 ? "font-medium" : "text-muted-foreground"}`}>
                        {d.fail_qty}
                      </td>
                      <td className={`px-4 py-2 tabular-nums ${lv ? LEVEL_TEXT[lv] : ""}`}>
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
