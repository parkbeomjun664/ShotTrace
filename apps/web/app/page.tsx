// 현황판 — 잘 돌아가고 있나 · 설비는 살아있나
// 이 화면이 답하는 질문: 전체가 잘 나오나 · 어느 설비가 문제인가
// 정보 위계 · 숫자 표시 · 집계는 DB → 실시간 → OEE
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEquipmentSummary, getLastReceived, getLots, getPartsWithoutLot, getPlantSummary } from "@/lib/queries";
import { CountUp } from "./CountUp";               // 큰 숫자는 0 에서 올라간다 (10/27)
import { LiveRefresh } from "./LiveRefresh";       // 알림을 듣고 이 화면을 다시 그리게 한다

export const revalidate = 0;   // 🔴 캐시를 끈다. 60 이면 refresh 해도 묵은 화면이 온다

export default async function Page() {
  const [plant, equipment, lastReceived, lots, orphan] = await Promise.all([
    getPlantSummary(),
    getEquipmentSummary(),
    getLastReceived(),
    getLots(),                                         // 최근 LOT — 26건이라 다 받아 앞 5건만 (10/26)
    getPartsWithoutLot(),                              // LOT 에 안 묶인 부품 — 숨기지 않고 드러낸다 (024)
  ]);
  const recent = lots.slice(0, 5);                     // getLots 는 최근 시작 순

  return (
    <section className="space-y-8">
      {/* 제목 묶음 — 아래 선으로 내용과 경계를 둔다 (10/26 · 붙어 보였다) */}
      <div className="border-b pb-6">
        <h1 className="text-2xl font-bold tracking-tight">현황판</h1>
        <p className="mt-1 text-base text-muted-foreground">
          2020-10-16 ~ 11-06 · KAMP 사출성형기 실데이터
        </p>
        {/* 🔵 상태는 한 줄 · 한 상태 (10/26) — 연결(브라우저가 앎) + 마지막 수신(서버가 앎)을 LiveRefresh 가 하나로 */}
        <div className="mt-2">
          <LiveRefresh lastAt={lastReceived} />
        </div>
      </div>

      {/* 1층 — 숫자 하나. 3초 안에 판단 (정보 위계) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            전체 수율
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 🔴 ?? 0 이면 "0.00%" — 명단에 없는 사람에게 "전부 불량" 이라고 거짓말한다 (10/13)
              == null 은 null 과 undefined 를 같이 잡는다 (plant?. 가 undefined 를 낼 수 있다) */}
          <p className="text-4xl font-bold tabular-nums">
            {plant?.yield_pct == null ? "—" : <CountUp value={plant.yield_pct} decimals={2} suffix="%" />}
          </p>
          <p className="mt-2 text-sm tabular-nums text-muted-foreground">
            양품 {(plant?.pass_qty ?? 0).toLocaleString()} / 생산{" "}
            {(plant?.total_qty ?? 0).toLocaleString()} · 불량{" "}
            {(plant?.fail_qty ?? 0).toLocaleString()}
          </p>
          {/* 0 이 아니면 — LOT 을 안 열었거나 경계가 틀렸다는 신호. 품질 화면(LOT 합계)과 이만큼 다르다 */}
          {orphan > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              LOT에 안 묶인 부품 {orphan.toLocaleString()}개 포함 (품질 화면엔 없음)
            </p>
          )}
        </CardContent>
      </Card>

      {/* 2층 — 설비별 맥락 */}
      <div className="grid gap-4 sm:grid-cols-3">
        {equipment.map((eq) => {
          const active = (eq.total_qty ?? 0) > 0;
          return (
            <Card key={eq.equip_cd}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="font-mono">{eq.equip_cd}</span>
                  {/* 색만으로 구분하지 않는다 — 텍스트가 뜻을 진다 */}
                  <Badge variant={active ? "secondary" : "outline"}>
                    {active ? `● LOT ${eq.lot_count}` : "■ 실적 없음"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {eq.equip_name}
                  {eq.tonnage ? ` · ${eq.tonnage}톤` : ""}
                </p>
                <p className="mt-2 tabular-nums">
                  <span className="text-2xl font-semibold">
                    {(eq.total_qty ?? 0).toLocaleString()}
                  </span>
                  <span className="ml-1 text-sm text-muted-foreground">
                    개 · 불량 {eq.fail_qty ?? 0}
                  </span>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 3층 — 상세로 가는 길. 최근 LOT 5건 · 누르면 그 LOT (10/26 — 아래가 비어 있었다) */}
      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">최근 LOT</h2>
          <Link href="/lots" className="text-sm text-muted-foreground underline underline-offset-4">
            전체 {plant?.lot_count ?? 0}건 보기
          </Link>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border">
          {/* 좁은 화면 — 글자를 쪼개지 않고 표 안에서 옆으로 민다 · 🔴 주석을 <table> 뒤에 두면 공백이 "글자" 로 들어간다 */}
          <table className="w-full whitespace-nowrap text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">LOT</th>
                <th className="px-4 py-2 font-medium">제품</th>
                <th className="px-4 py-2 font-medium">생산</th>
                <th className="px-4 py-2 font-medium">불량</th>
                <th className="px-4 py-2 font-medium">수율</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((lot) => {
                const rate = lot.total_qty ? (lot.pass_qty / lot.total_qty) * 100 : null;   // 🔴 0 이 아니라 null — LOT 목록과 같다
                return (
                  <tr key={lot.lot_id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 font-mono">
                      <Link href={`/lots/${lot.lot_id}`} className="underline underline-offset-4">
                        {lot.lot_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{lot.product?.car_model} {lot.product?.side}</td>
                    <td className="px-4 py-2 tabular-nums">{lot.total_qty.toLocaleString()}</td>
                    <td className={`px-4 py-2 tabular-nums ${lot.fail_qty > 0 ? "font-medium" : "text-muted-foreground"}`}>
                      {lot.fail_qty}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{rate === null ? "—" : `${rate.toFixed(2)}%`}</td>
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
