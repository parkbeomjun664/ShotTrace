// 대응 가이드 — 서버 컴포넌트. Claude 의 말 옆에 DB 숫자를 붙인다
//
//   🔴 화면의 숫자는 Claude 가 적은 게 아니다. Claude 는 근거의 이름(metric)만 골랐고,
//      숫자는 이 LOT 의 샷에서 우리가 센 것(metricStats)이다 — ADR 012 "남이 건넨 값보다 내 DB"
import { 날짜, 소수, 시각 } from "@/lib/format";
import type { MetricStat } from "@/lib/evidence";
import type { LotGuide } from "@/lib/queries";

import GuideButton from "./GuideButton";

export function GuidePanel({
  lotId,
  guide,
  stats,
  blocked,
}: {
  lotId: string;
  guide: LotGuide | null;
  stats: MetricStat[];
  blocked: string | null;                              // 버튼을 못 누르는 이유 — null 이면 누를 수 있다
}) {
  const byKey = new Map(stats.map((s) => [s.key, s]));

  return (
    <div className="rounded border p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">대응 가이드</h2>
        <p className="text-xs text-muted-foreground">참고용 · 판단은 사람이</p>
      </div>

      {!guide && (
        <div className="mt-3">
          {blocked ? (
            <p className="text-sm text-muted-foreground">{blocked}</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                이 LOT 의 불량 · 공정변수 · 비가동 숫자만 Claude 에게 보내고, 의심 원인과 점검할 곳을 받아요.
              </p>
              <GuideButton lotId={lotId} />
            </>
          )}
        </div>
      )}

      {guide && (
        <div className="mt-3 space-y-4">
          <p className="text-sm">{guide.content.summary}</p>

          {guide.content.causes.length > 0 && (
            <ol className="space-y-3">
              {guide.content.causes.map((c, i) => {
                const s = byKey.get(c.metric);         // 근거의 숫자는 여기서 — Claude 의 답이 아니라
                return (
                  <li key={i} className="rounded bg-black/[0.02] p-3 dark:bg-white/[0.03]">
                    <p className="font-medium">
                      {i + 1}. {c.title}
                    </p>
                    {s && (
                      <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                        근거 · {s.label} — 양품 {소수(s.goodMean, 2)} ± {소수(s.goodStd, 2)} → 불량 {소수(s.failMean, 2)}
                        {s.z !== null && ` (${s.z >= 0 ? "+" : ""}${소수(s.z, 1)}σ)`}
                      </p>
                    )}
                    <p className="mt-2 text-sm">{c.reasoning}</p>
                    <p className="mt-1 text-sm">
                      <span className="font-medium">점검 · </span>
                      {c.check}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}

          <p className="text-xs text-muted-foreground">
            {guide.model} · 토큰 {guide.input_tokens} + {guide.output_tokens} · {날짜(guide.created_at)} {시각(guide.created_at)}
          </p>
        </div>
      )}
    </div>
  );
}
