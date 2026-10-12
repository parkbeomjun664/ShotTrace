// 로그인 — 나는 누구인가 (인증). 무엇을 해도 되는가(인가)는 RLS 가 정한다 (M19)
import { login } from "./actions";

export default async function Page({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;                // 🔴 Next 15+ 는 Promise — await
                                                       // ?error=1 이면 실패 문구를 띄운다
  return (
    <section className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">로그인</h1>

      {/* action 에 함수를 그대로 — 제출하면 서버에서 login(formData) 가 돈다 */}
      {/* 🔴 name 이 formData.get() 과 철자가 같아야 한다. 다르면 null 이 조용히 들어간다 */}
      <form action={login} className="space-y-3">
        <input
          name="email"
          type="email"
          required
          placeholder="이메일"
          className="w-full rounded border px-3 py-2 text-sm"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="비밀번호"
          className="w-full rounded border px-3 py-2 text-sm"
        />
        <button className="w-full rounded bg-black py-2 text-sm text-white dark:bg-white dark:text-black">
          로그인
        </button>
      </form>

      {/* 데모 계정 — 비밀번호를 일부러 공개한다. 🔴 그래서 끝까지 viewer(읽기만)여야 한다 (10/13) */}
      <p className="text-xs text-muted-foreground">
        둘러보기 — <span className="font-mono">viewer@example.com</span> /{" "}
        <span className="font-mono">parkbeomjun122!!</span> · 읽기 전용
      </p>

      {/* 🔴 required · type="email" 은 편의일 뿐 — 진짜 검사는 서버가 한다 */}
      {error && (
        <p className="text-sm text-red-600">이메일 또는 비밀번호가 맞지 않습니다</p>
      )}
    </section>
  );
}
