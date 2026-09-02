// LOT 추적 ★ — 이 프로젝트의 핵심 화면
//
// 이 화면이 답하는 질문 3개 (M09)
//   1. 이 LOT은 얼마나 잘 나왔나          → 수율
//   2. 불량은 언제 몇 개 났나              → 파레토 + 표의 표시
//   3. 그때 설비는 어땠나                  → 시간 구간 조인으로 붙인 공정변수
//
// 담당: M09(정보 위계) · M11(집계) → M12(시계열 차트) → M24(대응 제안)
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLot, getLotShots, pareto } from "@/lib/queries";

// 🔴 DB는 UTC로 저장하고 화면은 KST로 보여준다 (ADR 002).
//    ISO 문자열을 잘라 쓰면 UTC가 그대로 나온다 — 한국 공장 기준으로 9시간 어긋난다.
const KST = "Asia/Seoul";
const fmt = (o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: KST, hour12: false, ...o });

const 시각 = (iso: string) =>
  fmt({ hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(iso));
const 날짜 = (iso: string) =>
  fmt({ month: "2-digit", day: "2-digit" }).format(new Date(iso));

const 소수 = (v: number | null, n = 1) => (v == null ? "—" : v.toFixed(n));

export default async function Page({ params }: PageProps<"/lots/[lotId]">) {
  const { lotId } = await params;

  const lot = await getLot(lotId);
  if (!lot) notFound(); // 없는 LOT은 404. 빈 화면을 띄우지 않는다 (M04 ⑧)

  const shots = await getLotShots(lot);
  const defects = pareto(shots);
  const rate = (lot.pass_qty / lot.total_qty) * 100;
  const 분 = Math.round(
    (Date.parse(lot.ended_at) - Date.parse(lot.started_at)) / 60000,
  );
  const 넘김 = 날짜(lot.started_at) !== 날짜(lot.ended_at); // 자정을 넘겼나

  return (
    <section className="space-y-8">
      <div>
        <Link
          href="/lots"
          className="font-mono text-xs tracking-widest text-muted-foreground hover:underline"
        >
          ← LOT 목록
        </Link>
        <h1 className="mt-2 font-mono text-2xl font-bold tracking-tight">
          {lot.lot_id}
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
              {rate.toFixed(2)}%
            </p>
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              양품 {lot.pass_qty} / {lot.total_qty}
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
            <p className="text-3xl font-bold tabular-nums">{lot.fail_qty}</p>
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
            {/* 반열린 구간 [시작, 끝) — 끝 시각의 샷은 이 LOT에 없다 (ADR 006) */}
            {/* 자정을 넘기는 LOT이 있다. 날이 다르면 날짜도 보여준다 */}
            <p className="font-mono text-lg tabular-nums">
              {넘김 ? `${날짜(lot.started_at)} ` : ""}
              {시각(lot.started_at)} –{" "}
              {넘김 ? `${날짜(lot.ended_at)} ` : ""}
              {시각(lot.ended_at)}
            </p>
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              {분}분 · 샷 {shots.length}개
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 2층 — 시간 구간 조인의 결과. 불량이 언제 났고 그때 설비가 어땠나 */}
      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">샷 이력</h2>
          <p className="text-xs text-muted-foreground">
            equipment_id + [started_at, ended_at) + product_id 로 조인
          </p>
        </div>

        <div className="mt-3 overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="border-b bg-black/[0.02] text-left text-muted-foreground dark:bg-white/[0.03]">
              <tr>
                <th className="px-3 py-2 font-medium">시각 KST</th>
                <th className="px-3 py-2 font-medium">판정</th>
                <th className="px-3 py-2 text-right font-medium">사이클 s</th>
                <th className="px-3 py-2 text-right font-medium">사출압 bar</th>
                <th className="px-3 py-2 text-right font-medium">쿠션 mm</th>
                <th className="px-3 py-2 text-right font-medium">배럴1 ℃</th>
                <th className="px-3 py-2 text-right font-medium">금형3 ℃</th>
              </tr>
            </thead>
            <tbody>
              {shots.map((s) => {
                const bad = s.pass_or_fail === "N";
                return (
                  <tr
                    key={s.part_id}
                    // 불량 행만 배경으로 띄운다 — 눈이 여기 먼저 가야 한다 (M09)
                    className={`border-b last:border-0 ${
                      bad ? "bg-red-50 dark:bg-red-950/30" : ""
                    }`}
                  >
                    <td className="px-3 py-1.5 font-mono tabular-nums">
                      {시각(s.measured_at)}
                    </td>
                    <td className="px-3 py-1.5">
                      {/* 색만으로 구분하지 않는다 — 텍스트가 뜻을 진다 (M09) */}
                      {bad ? (
                        <Badge variant="destructive">{s.fail_reason}</Badge>
                      ) : (
                        <span className="text-muted-foreground">양품</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {소수(s.shot?.cycle_time ?? null, 2)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {소수(s.shot?.max_injection_pressure ?? null)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {소수(s.shot?.cushion_position ?? null, 2)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {소수(s.shot?.barrel_temperature_1 ?? null)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {소수(s.shot?.mold_temperature_3 ?? null)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          공정변수는 <code>shot</code>에, 판정은 <code>shot_part</code>에 있다. 한 샷이
          LH·RH 두 부품을 찍으므로 <code>product_id</code>로 이 LOT의 부품만 남긴다
          (ADR 005). 차트는 M12에서 붙인다.
        </p>
      </div>
    </section>
  );
}
