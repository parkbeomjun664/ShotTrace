// 현황판 — 잘 돌아가고 있나 · 설비는 살아있나
// 이 화면이 답하는 질문 (M09): 전체가 잘 나오나 · 어느 설비가 문제인가
// M09(정보 위계) · M10(숫자 표시) → M11(View) → M18(실시간) → M24(OEE)
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { byEquipment, getEquipment, getLots, summarize } from "@/lib/queries";

export const revalidate = 60;                          // 60초 캐시 (M13)
                                                       // 실시간 갱신은 M18에서

export default async function Page() {                 // async = 서버 컴포넌트
  const [lots, equipment] = await Promise.all([        // 서로 안 기다린다
    getLots(),                                         // 130ms → 80ms
    getEquipment(),
  ]);
  const sum = summarize(lots);                         // 전체 합계
  const perEquip = byEquipment(lots);                  // 설비별 합계 (Map)

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">현황판</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          2020-10-16 ~ 11-06 · KAMP 사출성형기 실데이터
        </p>
      </div>

      {/* 1층 — 숫자 하나. 3초 안에 판단 (M09 정보 위계) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            전체 수율
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* tabular-nums: 숫자가 갱신돼도 자릿수가 안 흔들린다 (M10) */}
          <p className="text-4xl font-bold tabular-nums">
            {sum.yield.toFixed(2)}%
          </p>
          <p className="mt-2 text-sm tabular-nums text-muted-foreground">
            양품 {sum.pass.toLocaleString()} / 생산{" "}
            {sum.total.toLocaleString()} · 불량 {sum.fail.toLocaleString()}
          </p>
        </CardContent>
      </Card>

      {/* 2층 — 설비별 맥락 */}
      <div className="grid gap-4 sm:grid-cols-3">
        {equipment.map((eq) => {
          const stat = perEquip.get(eq.equip_cd);
          const active = (stat?.shots ?? 0) > 0;
          return (
            <Card key={eq.equip_cd}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="font-mono">{eq.equip_cd}</span>
                  {/* 색만으로 구분하지 않는다 — 텍스트가 뜻을 진다 (M10) */}
                  <Badge variant={active ? "secondary" : "outline"}>
                    {active ? `● LOT ${stat?.lots}` : "■ 실적 없음"}
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
                    {(stat?.shots ?? 0).toLocaleString()}
                  </span>
                  <span className="ml-1 text-sm text-muted-foreground">
                    개 · 불량 {stat?.fail ?? 0}
                  </span>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 3층 — 상세로 가는 길 */}
      <div className="text-sm text-muted-foreground">
        LOT {lots.length}건 ·{" "}
        <Link href="/lots" className="underline underline-offset-4">
          목록 보기
        </Link>
      </div>
    </section>
  );
}
