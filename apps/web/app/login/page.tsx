// 로그인 — 나는 누구인가 (인증). 무엇을 해도 되는가(인가)는 RLS 가 정한다 (M19)
import { login } from "./actions";
import { SubmitButton } from "./SubmitButton";   // 누른 뒤 "로그인 중…" — 브라우저에서 (10/26)

export default async function Page({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;                // 🔴 Next 15+ 는 Promise — await
                                                       // ?error=1 이면 실패 문구를 띄운다
  return (
    // 세로 가운데 — main 위아래 여백(5rem)을 뺀 높이를 채우고 가운데로 (10/26)
    <section className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-md flex-col justify-center space-y-8">
      {/* README 링크로 온 사람이 처음 보는 화면 — 무슨 앱인지 한 줄로 · 카드와 사이를 조금 더 (pb-4 · 32 → 48px) (10/26) */}
      <div className="pb-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight">ShotTrace</h1>
        <p className="mt-2 break-keep text-base text-muted-foreground">
          사출성형 공장의 LOT과 설비 상태를 시간으로 잇는 MES
        </p>
      </div>

      {/* action 에 함수를 그대로 — 제출하면 서버에서 login(formData) 가 돈다 */}
      {/* 🔴 name 이 formData.get() 과 철자가 같아야 한다. 다르면 null 이 조용히 들어간다 */}
      <form action={login} className="space-y-4 rounded-xl border bg-white p-8 shadow-sm">
        <input
          name="email"
          type="email"
          required
          placeholder="이메일"
          className="h-12 w-full rounded-md border bg-white px-4 text-base outline-none transition-colors duration-150 focus:border-gray-900 motion-reduce:transition-none"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="비밀번호"
          className="h-12 w-full rounded-md border bg-white px-4 text-base outline-none transition-colors duration-150 focus:border-gray-900 motion-reduce:transition-none"
        />
        {/* 입력칸 · 버튼 36 → 48px — 크고 꽉 찬 버튼 (10/26) */}
        <SubmitButton />
        {/* 🔴 required · type="email" 은 편의일 뿐 — 진짜 검사는 서버가 한다 */}
        {/* 실패 문구는 버튼 바로 아래 — 눌렀는데 안 되면 눈은 버튼 근처를 본다 (10/26) */}
        {error && (
          <p className="text-sm text-red-600">이메일 또는 비밀번호가 맞지 않습니다</p>
        )}
      </form>
      {/* 둘러보기 계정 안내는 화면에서 뺐다 — README 에만 (10/26) */}

      {/* 작은 푸터 — 첫 화면에서 이게 무엇인지 (10/26) */}
      <p className="text-center text-xs text-muted-foreground">© 2026 ShotTrace · 포트폴리오 프로젝트</p>
    </section>
  );
}
