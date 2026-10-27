// OEE — LOT 별 가동률 × 성능 × 품질 · 화면은 계산하지 않는다 (재료 = View · 계산 = computeOee)
// 10/26 — 전체 KPI(생산량 가중) · 손실 워터폴(10/27 가로 막대 단계로) · 최신순 · OEE 상태 색 · 가장 약한 칸 강조 · 줄 클릭
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { isDemo } from "@/lib/lots";
import { aggregateOee, oeeLevel, waterfall, type Oee } from "@/lib/oee";
import { getLotOee, getLots } from "@/lib/queries";
import { CountUp } from "../CountUp";   // 큰 숫자는 0 에서 올라간다 (10/27)
import { Info } from "../Info";
import { Box, Dot, Legend } from "../Legend";
import { LossSteps, STRIPES } from "./LossSteps";

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);   // null = 계산 안 함 → "—"
const LEVEL_TEXT = { ok: "", warn: "text-status-warn", bad: "text-status-bad" } as const;
const LEVEL_DOT = { ok: "", warn: "bg-status-warn", bad: "bg-status-bad" } as const;

function weakest(o: Oee) {                             // A · P · Q 중 가장 낮은 칸 — 어디를 먼저 볼지 (모두 같으면 강조 안 함)
  const v = { a: o.availability, p: o.performance, q: o.quality };
  const nums = Object.values(v).filter((x): x is number => x !== null);
  if (nums.length < 3 || nums.every((x) => x === nums[0])) return null;
  const min = Math.min(...nums);
  return (Object.keys(v) as (keyof typeof v)[]).find((k) => v[k] === min) ?? null;
}

export default async function Page({ searchParams }: PageProps<"/oee">) {
  const showDemo = (await searchParams).demo === "1";  // 「시연 LOT 포함」 — 주소에 남는다 (10/26)
  const [rows, lots] = await Promise.all([getLotOee(), getLots()]);   // LOT 표에서 시작 시각 · 계획일 (최신순 · 시연 구분)
  const meta = new Map(lots.map((l) => [l.lot_id, l]));
  const list = rows
    .map((r) => ({ ...r, started_at: meta.get(r.lot_id)?.started_at ?? "", plan_date: meta.get(r.lot_id)?.plan_date ?? "" }))
    .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));   // 기본: 최신순
  // 표 — 시연 LOT 은 기본 숨김 · 포함해도 맨 아래 (KAMP 기간의 최신순이 먼저 보이게)
  const table = showDemo
    ? [...list.filter((r) => !isDemo(r.plan_date)), ...list.filter((r) => isDemo(r.plan_date))]
    : list.filter((r) => !isDemo(r.plan_date));
  const demoCount = list.length - list.filter((r) => !isDemo(r.plan_date)).length;

  // 🔴 전체는 KAMP LOT 만 — 시연 LOT 은 3주 열려 있어 성능 2.8% 로 전체를 끌어내린다 (LOT 목록 · 품질과 같은 규칙)
  const kamp = list.filter((r) => !isDemo(r.plan_date));
  const total = aggregateOee(kamp.map((r) => r.input));   // 비율 평균이 아니라 분 · 개수를 더해 다시 나눈다
  const w = waterfall(total);
  const lv = oeeLevel(total.oee);
  // 비가동 기록이 하나도 겹치지 않으면 가동률 100% 는 "완벽" 이 아니라 "기록 없음" — 카드에서 그렇게 말한다
  // 🔵 샷 간격으로 정지를 추정하지 않는다 (ADR 016 버린 대안 ⑥ — 사유 · 기준이 없다. 추정해도 OEE 는 같고 손실 칸만 바뀐다)
  const noDowntime = kamp.every((r) => r.input.lossMinutes === 0 && r.planned_minutes === 0);

  const cards = [
    { label: "OEE", value: total.oee, main: true },
    { label: "가동률", value: total.availability, unrecorded: noDowntime },
    { label: "성능", value: total.performance },
    { label: "품질", value: total.quality },
  ];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">OEE</h1>
        {/* 부제는 핵심 한 줄 — 계산 규칙은 ⓘ 안으로 (10/27) */}
        <div className="mt-2 flex items-center gap-1 text-base text-muted-foreground">
          OEE = 가동률 × 성능 × 품질
          <Info id="oee-rule" label="OEE 계산 규칙">
            <p>계획 정지(교대 · 휴식 · 점검)는 계획 시간에서 빼요. 셋업(금형 교체)은 손실로 넣어요.</p>
            <p>표준 사이클타임은 제품 마스터 값이에요. 처음 값은 실측 중앙값으로 넣었어요.</p>
          </Info>
        </div>
      </div>

      {/* 전체 KPI — KAMP LOT {kamp.length}개를 생산량으로 가중 */}
      <div>
        <div className="grid gap-4 sm:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border p-4">
              <p className="flex items-center justify-between text-sm text-muted-foreground">
                {c.label}
                {"unrecorded" in c && c.unrecorded && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">비가동 기록 없음</span>
                )}
              </p>
              <p
                className={`mt-2 text-3xl font-bold tabular-nums ${c.main && lv ? LEVEL_TEXT[lv] : ""} ${"unrecorded" in c && c.unrecorded ? "text-muted-foreground" : ""}`}
              >
                {c.value === null ? "—" : <CountUp value={c.value * 100} suffix="%" />}
              </p>
              {c.main && <p className="mt-1 text-xs text-muted-foreground">World-class 85%</p>}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
          KAMP LOT {kamp.length}개 · 생산량 가중 · 시연 제외
          {noDowntime && (
            <Info id="oee-no-downtime" label="가동률이 100% 인 이유">
              <p>비가동 기록이 없어서 가동률이 100%로 나와요.</p>
              <p>기록 안 된 멈춤은 성능 손실에 들어가 있어요. 비가동 화면에서 사유를 넣으면 가동률 손실로 옮겨 가요.</p>
            </Info>
          )}
        </div>
      </div>

      {/* 영역마다 카드 — 품질 화면과 같다 (10/27) */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold">OEE가 되기까지</h2>
        <Legend
          className="mt-2"
          items={[
            { mark: <Box className="bg-foreground/30" />, label: "남은 시간" },
            { mark: <Box className="bg-muted" style={{ backgroundImage: STRIPES }} />, label: "이 단계에서 빠진 몫" },
          ]}
        />
        <div className="mt-4">
          <LossSteps a={(1 - w.availabilityLoss) * 100} p={(1 - w.availabilityLoss - w.performanceLoss) * 100} q={w.oee * 100} />
        </div>
      </div>

      {/* 표는 카드 가장자리까지 — 표 테두리를 따로 두면 카드 안에 테두리가 겹친다 */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="p-6 pb-4">
          <h2 className="font-semibold">LOT 별</h2>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <Legend
              items={[
                { mark: <Dot className="bg-status-warn" />, label: "OEE 85% 미만" },
                { mark: <Dot className="bg-status-bad" />, label: "60% 미만" },
                { mark: <Box className="border border-sky-200 bg-sky-50" />, label: "가장 약한 지표" },
              ]}
            />
            {demoCount > 0 && (
              <Link
                href={showDemo ? "/oee" : "/oee?demo=1"}
                aria-pressed={showDemo}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  showDemo ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
                }`}
              >
                {showDemo ? "✓ " : ""}시연 LOT 포함 ({demoCount})
              </Link>
            )}
          </div>
        </div>
        <div className="overflow-x-auto border-t">
          {/* 🔴 주석을 <table> 뒤에 두면 공백이 "글자" 로 들어간다 — 그래서 여기 */}
          <table className="w-full whitespace-nowrap text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="px-6 py-2 font-medium">LOT</th>
                <th className="px-4 py-2 font-medium">가동률</th>
                <th className="px-4 py-2 font-medium">성능</th>
                <th className="px-4 py-2 font-medium">품질</th>
                <th className="px-4 py-2 font-medium">OEE</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {table.map((l) => {
                const weak = weakest(l.oee);
                const olv = oeeLevel(l.oee.oee);
                const cell = (k: "a" | "p" | "q") => `px-4 py-2.5 tabular-nums ${weak === k ? "bg-sky-50 dark:bg-sky-950" : ""}`;   // 옅은 하늘색 — 머리글 회색과 겹치지 않고, 상태 색(호박 · 빨강)과도 다른 "여기 봐" (10/27)
                return (
                  // 줄 전체가 링크 — 진짜 링크는 LOT 칸 하나, after:inset-0 으로 줄 전체를 덮는다 (LOT 목록과 같다)
                  <tr key={l.lot_id} className="relative border-b last:border-0 hover:bg-muted/50">
                    <td className="px-6 py-2.5 font-mono">
                      <Link href={`/lots/${l.lot_id}`} className="after:absolute after:inset-0">
                        {l.lot_id}
                      </Link>
                      {isDemo(l.plan_date) && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-sans text-xs text-muted-foreground">시연</span>
                      )}
                    </td>
                    <td className={cell("a")}>{pct(l.oee.availability)}</td>
                    <td className={cell("p")}>
                      {pct(l.oee.performance)}
                      {l.oee.performanceRaw !== null && l.oee.performanceRaw > 1.1 && (   // 🔴 자르기 전 110% 초과 = 새 버그 신호 (지금은 0개여야 맞다)
                        <span className="ml-1 text-status-bad" title={`자르기 전 ${pct(l.oee.performanceRaw)}`}>
                          ⚠
                        </span>
                      )}
                    </td>
                    <td className={cell("q")}>{pct(l.oee.quality)}</td>
                    <td className={`px-4 py-2.5 font-semibold tabular-nums ${olv ? LEVEL_TEXT[olv] : ""}`}>
                      {olv && olv !== "ok" && <span aria-hidden className={`mr-1.5 inline-block size-1.5 rounded-full align-middle ${LEVEL_DOT[olv]}`} />}
                      {pct(l.oee.oee)}
                    </td>
                    <td className="pr-5 text-muted-foreground">
                      <ChevronRight aria-hidden className="size-4" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
