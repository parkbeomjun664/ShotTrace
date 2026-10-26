// 경고등 — "숫자가 안 움직인다" 가 쉬는 중인지 수집기가 죽었는지 화면이 말하게 한다 (M28 관측성)
import { 날짜, 시각 } from "@/lib/format";

const STALE_MINUTES = 10;                              // 사이클 1분 → 샷 10개를 놓쳤다 · 숫자에 이름을 붙인다

export function ReceiveStatus({ at }: { at: string | null }) {
  if (at === null) {
    return <p className="mt-1 text-xs text-muted-foreground">수집기 수신 기록이 아직 없습니다</p>;
  }

  const minutes = Math.round((Date.now() - Date.parse(at)) / 60000);   // 🔴 그릴 때 한 번 — 수집기가 죽으면 알림도 없어 새로고침 기준
  const stale = minutes > STALE_MINUTES;

  return (
    <p className={stale ? "mt-1 text-xs text-red-700 dark:text-red-400" : "mt-1 text-xs text-muted-foreground"}>
      마지막 수신 {날짜(at)} {시각(at)}
      {/* 경고는 무엇을 할지까지 말한다 */}
      {stale && ` · ${minutes.toLocaleString()}분째 신호 없음 — 수집기나 설비를 확인하세요`}
    </p>
  );
}
