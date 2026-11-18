// 보안 — 위협 현황. admin 만 본다. login_threats()·scan_threats() 를 읽어 두 섹션으로
//   🔴 화면을 가리는 건 친절 — 막는 건 RLS. 두 함수 다 SECURITY INVOKER 라 비admin 은 0행
//   🔴 지금은 admin 이 '직접 들어와 봐야' 보인다 — Slack 통지(③)가 탐지+알림의 실시간 쪽
import { notFound } from "next/navigation";

import { 날짜, 시각 } from "@/lib/format";
import { getMyRole } from "@/lib/queries";
import { createSessionClient } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";                 // 🔴 매번 지금 기준으로 판정 — 캐시된 "안전"을 영원히 보여주지 않게

const TH = "px-4 py-2 font-medium";
const TD = "px-4 py-2";

type ThreatRow = { kind: string; target: string; distinct_n: number; since: string | null };

function ThreatSection({ title, hint, rows }: { title: string; hint: string; rows: ThreatRow[] }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      {rows.length === 0 ? (
        <p className="mt-4 rounded-lg border p-4 text-sm text-muted-foreground">지금 감지된 위협이 없어요.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={TH}>종류</th>
                <th className={TH}>대상</th>
                <th className={TH}>수</th>
                <th className={TH}>기준 시각(이후)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <tr key={i}>
                  <td className={TD}>{t.kind}</td>
                  <td className={`${TD} font-mono`}>{t.target}</td>
                  <td className={`${TD} tabular-nums`}>{t.distinct_n}</td>
                  <td className={`${TD} text-muted-foreground`}>
                    {t.since ? `${날짜(t.since)} ${시각(t.since)}` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function Page() {
  const role = await getMyRole();
  if (role !== "admin") notFound();                     // 🔴 비admin 에겐 패널 존재 자체를 숨긴다 (404) · RLS 는 그 뒤의 문

  const supabase = await createSessionClient();
  const [{ data: loginRows }, { data: scanRows }] = await Promise.all([
    supabase.rpc("login_threats"),                      // 로그인 위협 (W1)
    supabase.rpc("scan_threats"),                       // 경로 스캔 (W2)
  ]);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-lg font-semibold">보안 위협</h1>
      <ThreatSection
        title="로그인 위협"
        hint="최근 15분 · 비밀번호 스프레이 · 계정 집중 · 단순 무차별 · 문턱 5"
        rows={loginRows ?? []}
      />
      <ThreatSection
        title="경로 스캔"
        hint="최근 15분 · 한 IP 가 서로 다른 탐침 경로 5개 이상"
        rows={scanRows ?? []}
      />
    </main>
  );
}
