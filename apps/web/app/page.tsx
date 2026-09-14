// 현황판 — 잘 돌아가고 있나 · 설비는 살아있나
// 이 화면이 답하는 질문 (M09): 전체가 잘 나오나 · 어느 설비가 문제인가
// M09(정보 위계) · M10(숫자 표시) · M11(집계는 DB) → M18(실시간) → M24(OEE)
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEquipmentSummary, getPlantSummary } from "@/lib/queries";

export const revalidate = 60;

export default async function Page() {
  const [plant, equipment] = await Promise.all([
    getPlantSummary(),
    getEquipmentSummary(),
  ]);

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
          <p className="text-4xl font-bold tabular-nums">
            {(plant?.yield_pct ?? 0).toFixed(2)}%
          </p>
          <p className="mt-2 text-sm tabular-nums text-muted-foreground">
            양품 {(plant?.pass_qty ?? 0).toLocaleString()} / 생산{" "}
            {(plant?.total_qty ?? 0).toLocaleString()} · 불량{" "}
            {(plant?.fail_qty ?? 0).toLocaleString()}
          </p>
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
                  {/* 색만으로 구분하지 않는다 — 텍스트가 뜻을 진다 (M09) */}
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

      {/* 3층 — 상세로 가는 길 */}
      <div className="text-sm text-muted-foreground">
        LOT {plant?.lot_count ?? 0}건 ·{" "}
        <Link href="/lots" className="underline underline-offset-4">
          목록 보기
        </Link>
      </div>
    </section>
  );
}
