// 현황판 — 오늘 잘 돌아가고 있나 · 설비는 살아있나 · OEE는
// 담당: M11(쿼리) → M17(실시간) → M23(OEE)
//
// 지금 숫자는 전부 가짜다. M11에서 실제 쿼리로 바꾼다.
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// M11에서 production_lot 집계 쿼리로 대체된다
const 오늘 = { 총생산: 1_284, 양품: 1_248, 수율: 97.2 };

// M15에서 equipment_status_log 로 대체된다 (지금은 스키마에 없음 — M09에서 발견)
const 설비 = [
  { code: "S14", name: "650톤-우진2호기", online: true, shots: 512 },
  { code: "S17", name: "850톤-우진1호기", online: true, shots: 480 },
  { code: "S22", name: "1300톤-3호기", online: false, shots: 292 },
];

export default function Page() {
  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">현황판</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          오늘 잘 돌아가고 있나 · 설비는 살아있나
        </p>
      </div>

      {/* 1층 — 숫자 하나. 3초 안에 판단 (M09 정보 위계) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            오늘 수율
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* tabular-nums: 숫자가 갱신돼도 자릿수가 안 흔들린다 (M10) */}
          <p className="text-4xl font-bold tabular-nums">{오늘.수율}%</p>
          <p className="mt-2 text-sm tabular-nums text-muted-foreground">
            양품 {오늘.양품.toLocaleString()} / 총생산{" "}
            {오늘.총생산.toLocaleString()}
          </p>
        </CardContent>
      </Card>

      {/* 3층 — 설비별 맥락 */}
      <div className="grid gap-4 sm:grid-cols-3">
        {설비.map((eq) => (
          <Card key={eq.code}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="font-mono">{eq.code}</span>
                {/* 색만으로 구분하지 않는다 — 텍스트가 뜻을 진다 (M10) */}
                <Badge variant={eq.online ? "secondary" : "destructive"}>
                  {eq.online ? "● 가동" : "■ 정지"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{eq.name}</p>
              <p className="mt-2 tabular-nums">
                <span className="text-2xl font-semibold">
                  {eq.shots.toLocaleString()}
                </span>
                <span className="ml-1 text-sm text-muted-foreground">샷</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        숫자는 아직 가짜다. M11에서 실제 쿼리로 바꾼다.
      </p>
    </section>
  );
}
