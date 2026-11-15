// 보안 — 로그인 위협 (W1). admin 만 본다. login_threats() 를 읽어 스프레이·계정집중을 표로
//   🔴 버튼/화면을 가리는 건 친절 — 막는 건 RLS. login_threats 는 SECURITY INVOKER 라 비admin 은 0행
//   🔴 지금은 admin 이 '직접 들어와 봐야' 보인다 — 통지(③)가 붙어야 탐지+알림으로 W1 이 완성된다 (인수인계)
import { 날짜, 시각 } from "@/lib/format";
import { getMyRole } from "@/lib/queries";
import { createSessionClient } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";                 // 🔴 매번 지금 기준으로 판정 — 캐시된 "안전"을 영원히 보여주지 않게

const TH = "px-4 py-2 font-medium";
const TD = "px-4 py-2";

export default async function Page() {
  const role = await getMyRole();
  if (role !== "admin") {                               // 친절한 안내 — 진짜 문은 RLS(아래 0행)
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-lg font-semibold">보안</h1>
        <p className="mt-3 text-sm text-muted-foreground">admin 전용 화면이에요.</p>
      </main>
    );
  }

  const supabase = await createSessionClient();
  const { data } = await supabase.rpc("login_threats");  // 기본값: 최근 15분 · 문턱 5
  const rows = data ?? [];

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-lg font-semibold">로그인 위협</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        최근 15분 · 비밀번호 스프레이(한 IP → 여러 계정) · 계정 집중(한 계정 → 여러 IP) · 문턱 5
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-lg border p-4 text-sm text-muted-foreground">지금 감지된 위협이 없어요.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={TH}>종류</th>
                <th className={TH}>대상</th>
                <th className={TH}>횟수</th>
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
    </main>
  );
}
