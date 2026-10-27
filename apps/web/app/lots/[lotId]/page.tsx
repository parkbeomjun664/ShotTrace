// LOT 추적 ★ — 이 프로젝트의 핵심 화면
//
// 이 화면이 답하는 질문 3개
//   1. 이 LOT은 얼마나 잘 나왔나          → 수율
//   2. 불량은 언제 몇 개 났나              → 파레토 + 표의 표시
//   3. 그때 설비는 어땠나                  → 시간 구간 조인으로 붙인 공정변수
//
// 담당: 정보 위계 · RPC → 시계열 차트 → 대응 제안
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLot, getLotBaseline, getLotGuide, getLotShots, getMyRole, getParameterSpec, pareto, tally } from "@/lib/queries";
import { metricStats } from "@/lib/evidence";


// 시각 포맷은 lib/format.ts 한 곳에서만 만든다 (ADR 002)
import { 날짜, 분길이, 소수, 시각, 시분, 진행중 } from "@/lib/format";
import { isDemo } from "@/lib/lots";
import { CHART_METRICS, bands, indexGaps, isAnomaly, outOfBand, type Band, type ChartMetric } from "@/lib/shots";
import { getSpecBand, toleranceFrom } from "@/lib/spec";             // 범위는 한 곳에서 — 차트 띠 · 점 · 표가 같은 값 (10/26)   // 빈 구간 · 기준 범위 · 이상 샷 — 차트와 표가 같은 판정 (10/26)
import { Info } from "@/app/Info";
import { Diamond, Dot, Legend, VDash } from "@/app/Legend";
import { LotCharts } from "./LotCharts";
import { LiveRefresh } from "@/app/LiveRefresh";   // 어제 만든 부품을 그대로
import { GuidePanel } from "./GuidePanel";


export const revalidate = 0;   // 🔴 캐시를 끈다. 실시간 화면에 캐시를 켜두면 실시간이 아니다
export const maxDuration = 60; // 가이드 버튼(Server Action)이 Claude 를 기다리는 시간 — 초

const PAGE_SIZE = 20;                                  // 샷 표 한 쪽 — 463샷이면 HTML 이 611KB 였다 (ADR README · 10/26 페이지 나누기)

export default async function Page({ params, searchParams }: PageProps<"/lots/[lotId]">) {
  const { lotId } = await params;                      // 주소의 [lotId] · await 필요
  const sp = await searchParams;
  const showAll = sp.shots === "all";                  // 기본은 이상 샷만 (?shots=all 이면 전부)
  const pageNo = Math.max(1, Number(sp.page) || 1);

  const lot = await getLot(lotId);
  if (!lot) notFound();                                // 없는 LOT은 404
                                                       // 이 아래로 lot 은 null 아님

  const [shots, guide, role, baseline, specRows] = await Promise.all([   // 서로 기다릴 필요 없는 다섯 — 한 번에
    getLotShots(lot.lot_id),                           // ★ RPC — 조인은 DB 안에
    getLotGuide(lot.lot_id),                           // 저장된 가이드
    getMyRole(),
    getLotBaseline(lot.lot_id),                        // 기준 범위 재료 — 이전 정상 LOT (025)
    getParameterSpec(),                                // 최소 허용 폭 — admin 이 마스터에서 바꾼다 (028)
  ]);
  const tol = toleranceFrom(specRows);                 // 빠진 변수는 코드의 기본값으로
  const defects = pareto(shots);                       // 불량 사유별, 많은 순
  const 집계 = tally(shots);                            // 🔴 저장값(lot.*_qty) 은 진행 중이면 낡는다
  const 진행 = 진행중(lot.ended_at);                    // 아직 안 끝난 LOT (009)
  const 분 = 진행 ? null : 분길이(lot.started_at, lot.ended_at);
  // 10/26 — 차트 · 표가 같이 쓰는 재료
  const std = lot.product?.std_cycle_sec ?? null;      // 표준 사이클타임 (제품 마스터)
  // 기준 범위 — 이전 정상 LOT 들(없으면 설비 전체)의 양품 평균 ± max(3σ, 최소 허용 폭). 양품이 하나도 없으면 이 LOT 양품으로
  const fromDb = new Map(baseline.map((r) => [r.metric, r]));
  const b = baseline.length
    ? (Object.fromEntries(
        CHART_METRICS.map((k) => {
          const r = fromDb.get(k);
          return [k, getSpecBand(k, r?.mean ?? null, r?.std ?? null, tol)];
        }),
      ) as Record<ChartMetric, Band>)
    : bands(shots, tol);
  const 기준 =
    baseline[0]?.source === "lots" ? `기준: 과거 정상 LOT ${baseline[0].lot_count}개`
    : baseline[0]?.source === "all" ? "기준: 설비 전체 (과거 정상 LOT 없음)"
    : "기준: 이 LOT 양품";
  const times = shots.map((x) => Date.parse(x.measured_at));
  const gaps = indexGaps(times, std ?? 0);             // 순번 축의 빈 곳 (표준 CT × 5 초과) — get_lot_shots 는 시간순
  const rows = shots.map((x, i) => ({
    n: i + 1,                                          // x 축 = 샷 순번
    time: `${날짜(x.measured_at)} ${시각(x.measured_at)}`,   // 툴팁 — 실제 시각
    date: 날짜(x.measured_at),                         // 눈금 — 앞 눈금과 날짜가 다를 때만 붙인다 (tickLabels)
    hm: 시분(x.measured_at),
    fail: x.pass_or_fail === "N",
    cycle_time: x.cycle_time,
    max_injection_pressure: x.max_injection_pressure,
    barrel_temperature_1: x.barrel_temperature_1,
    mold_temperature_3: x.mold_temperature_3,
  }));
  const avgCt = shots.length ? shots.reduce((a, x) => a + (x.cycle_time ?? 0), 0) / shots.length : 0;
  const 생산분 = Math.round((shots.length * avgCt) / 60);   // 실제로 찍은 시간 ≈ 샷 수 × 평균 CT
  const 길이 = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}시간 ${min % 60}분` : `${min}분`);

  // 샷 표 — 이상 샷만(기본) · 20행씩
  const anomalies = shots.filter((x) => isAnomaly(x, b));
  const view = showAll ? shots : anomalies;
  const pages = Math.max(1, Math.ceil(view.length / PAGE_SIZE));
  const cur = Math.min(pageNo, pages);
  const pageRows = view.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const href = (q: { all?: boolean; page?: number }) => {
    const u = new URLSearchParams();
    if (q.all) u.set("shots", "all");
    if (q.page && q.page > 1) u.set("page", String(q.page));
    const t = u.toString();
    return `/lots/${lot.lot_id}${t ? `?${t}` : ""}#shots`;
  };
  const 막힘 =                                          // 가이드 버튼을 못 누르는 이유 — 막는 건 actions.ts · RLS, 여기는 안내
    role !== "worker" && role !== "admin" ? "가이드는 worker 계정만 만들 수 있어요 (비용이 드는 버튼)"
    : 진행 ? "진행 중인 LOT 이에요 — 끝난 뒤에 만들 수 있어요"
    : null;

  return (
    <section className="space-y-8">
      {/* 신호 담당 — 알림이 오면 이 화면을 다시 받는다 */}
      <LiveRefresh />
      <div>
        <Link href="/lots" className="text-sm text-muted-foreground hover:underline">
          ← LOT 목록
        </Link>
        <h1 className="mt-2 flex items-center gap-2 font-mono text-2xl font-bold tracking-tight">
          {lot.lot_id}
          {isDemo(lot.plan_date) && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-sans text-xs font-normal text-muted-foreground">시연</span>
          )}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {lot.product?.part_name} · {lot.equipment?.equip_name}
          {lot.equipment?.tonnage ? ` (${lot.equipment.tonnage}톤)` : ""} ·
          계획일 {lot.plan_date}
        </p>
      </div>

      {/* 1층 — 이 LOT이 얼마나 잘 나왔나 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              수율
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">
              {집계.yield_pct === null ? "—" : `${집계.yield_pct.toFixed(2)}%`}
            </p>
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              {집계.total ? `양품 ${집계.pass} / ${집계.total}` : "아직 들어온 샷이 없다"}
            </p>

          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              불량
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{집계.fail}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {defects.length ? defects.map(([r, n]) => `${r} ${n}`).join(" · ") : "없음"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              가동 구간 <span className="font-normal">KST</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* 반열린 구간 [시작, 끝) — 끝 시각의 샷은 이 LOT에 없다 (ADR 006) · 한 줄 "MM.DD HH:mm → MM.DD HH:mm" (10/26) */}
            <p className="text-lg tabular-nums">
              {날짜(lot.started_at)} {시분(lot.started_at)} →{" "}
              {진행 ? <span className="text-emerald-700 dark:text-emerald-400">진행 중</span> : `${날짜(lot.ended_at)} ${시분(lot.ended_at)}`}
            </p>
            {/* 구간 길이와 실제로 찍은 시간 — 둘의 차이가 멈춰 있던 시간이다 */}
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              {/* 한 줄로 — 세부(샷 수 × 평균 CT)는 마우스를 올리면 (10/26) */}
              <span title={`샷 ${shots.length}개 × 평균 CT ${avgCt.toFixed(1)}s`}>
                {진행 ? "" : `총 ${길이(분 ?? 0)} · `}실제 생산 약 {길이(생산분)}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 1.5층 — 불량이 있으면 대응 가이드 · 숫자는 Claude 가 아니라 이 샷들에서 */}
      {집계.fail > 0 && (
        <GuidePanel lotId={lot.lot_id} guide={guide} stats={metricStats(shots)} blocked={막힘} />
      )}

      {/* 2층 — 시간 구간 조인의 결과. 불량이 언제 났고 그때 설비가 어땠나 */}
      <div>
        <div className="flex items-center gap-1.5">
          <h2 className="font-semibold">그때 설비 상태</h2>
          {/* 개발 메모 대신 ⓘ 팝오버 (10/26) — 궁금한 사람만 연다 · 10/27 범례에서 뺀 계산 방법도 여기로 */}
          <Info id="join-info" label="차트 읽는 법">
            <p>
              샷은 <code>started_at ≤ 측정 시각 &lt; ended_at</code> 반열린 구간으로 LOT 에 연결해요 (<code>get_lot_shots</code>).
              설비 신호에는 LOT 번호가 없어요 — 설비와 시간으로 찾아요 (ADR 001).
            </p>
            <p>정상 범위 = 양품 평균 ± 3σ (최소 허용 폭 적용) · {기준}</p>
            <p>샷 없음 = 샷 사이가 표준 CT × 5 를 넘은 곳 · 가로축은 샷 순번</p>
          </Info>
        </div>
        <Legend
          className="mt-2"
          items={[
            { mark: <span className="h-3 w-5 rounded-sm border border-emerald-300" style={{ background: "#d1fae5" }} />, label: "정상 범위" },
            { mark: <Dot className="bg-status-bad" />, label: "범위 밖" },
            { mark: <Diamond color="var(--status-bad)" />, label: "불량 샷" },
            { mark: <VDash />, label: "샷 없음" },
          ]}
        />
        <div className="mt-3">
          <LotCharts rows={rows} gaps={gaps} bands={b} stdCycleSec={std} />
        </div>
      </div>

      {/* 3층 — 샷 표. 기본은 이상 샷만 · 20행씩 */}
      <div id="shots">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">샷 이력</h2>
          <Link
            href={href({ all: !showAll })}
            aria-pressed={!showAll}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              showAll ? "hover:bg-muted" : "border-foreground bg-foreground text-background"
            }`}
          >
            {showAll ? "" : "✓ "}이상 샷만 ({anomalies.length} / {shots.length})
          </Link>
        </div>

        {pageRows.length === 0 ? (
          <p className="mt-3 rounded-xl border p-8 text-center text-sm text-muted-foreground">
            이상 샷이 없어요 — 불량도, 기준 범위를 벗어난 값도 없어요
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border">
            {/* 🔴 주석을 <table> 뒤에 두면 공백이 "글자" 로 들어간다 — 그래서 여기 */}
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">시각 KST</th>
                  <th className="px-3 py-2 font-medium">판정</th>
                  <th className="px-3 py-2 font-medium">사이클 s</th>
                  <th className="px-3 py-2 font-medium">사출압 bar</th>
                  {/* 원본 Cushion_Position 그대로 — S14 는 650 대라 쿠션량이 아니라 스크루 절대 위치로 보인다 (10/26 확인 · 단위 표기 뺌) */}
                  <th className="px-3 py-2 font-medium">쿠션 위치(원본)</th>
                  <th className="px-3 py-2 font-medium">배럴1 ℃</th>
                  <th className="px-3 py-2 font-medium">금형3 ℃</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((x) => {
                  const bad = x.pass_or_fail === "N";
                  const off = (k: "cycle_time" | "max_injection_pressure" | "barrel_temperature_1" | "mold_temperature_3") =>
                    outOfBand(x[k], b[k]) ? "font-medium text-status-bad" : "";   // 범위 밖 값만 빨강
                  return (
                    <tr
                      key={x.measured_at}     // LOT 안에서 시각이 곧 부품이다 (007)
                      // 불량 행만 배경으로 띄운다 — 눈이 여기 먼저 가야 한다
                      className={`border-b last:border-0 ${bad ? "bg-destructive/10" : ""}`}
                    >
                      <td className="px-3 py-1.5 font-mono tabular-nums">{시각(x.measured_at)}</td>
                      <td className="px-3 py-1.5">
                        {/* 색만으로 구분하지 않는다 — 텍스트가 뜻을 진다 */}
                        {bad ? <Badge variant="destructive">{x.fail_reason}</Badge> : <span className="text-muted-foreground">양품</span>}
                      </td>
                      <td className={`px-3 py-1.5 tabular-nums ${off("cycle_time")}`}>{소수(x.cycle_time, 2)}</td>
                      <td className={`px-3 py-1.5 tabular-nums ${off("max_injection_pressure")}`}>{소수(x.max_injection_pressure)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{소수(x.cushion_position, 2)}</td>
                      <td className={`px-3 py-1.5 tabular-nums ${off("barrel_temperature_1")}`}>{소수(x.barrel_temperature_1)}</td>
                      <td className={`px-3 py-1.5 tabular-nums ${off("mold_temperature_3")}`}>{소수(x.mold_temperature_3)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <nav aria-label="샷 표 쪽" className="mt-3 flex items-center justify-center gap-3 text-sm">
            {cur > 1 ? <Link href={href({ all: showAll, page: cur - 1 })} className="hover:underline">← 이전</Link> : <span className="text-muted-foreground">← 이전</span>}
            <span className="tabular-nums text-muted-foreground">{cur} / {pages}</span>
            {cur < pages ? <Link href={href({ all: showAll, page: cur + 1 })} className="hover:underline">다음 →</Link> : <span className="text-muted-foreground">다음 →</span>}
          </nav>
        )}
      </div>
    </section>
  );
}
