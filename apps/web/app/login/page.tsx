// 로그인 — 나는 누구인가 (인증). 무엇을 해도 되는가(인가)는 RLS 가 정한다
import { LoginForm } from "./LoginForm";

export default function Page() {
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

      {/* 폼은 브라우저 컴포넌트로 — 실패해도 이메일을 남기려면 결과를 들고 있어야 한다 (10/27) */}
      <LoginForm />
      {/* 둘러보기 계정 안내는 화면에서 뺐다 (10/26) · README 에서도 뺐다 (공개용 정리) */}

      {/* 작은 푸터 — 첫 화면에서 이게 무엇인지 (10/26) */}
      <p className="text-center text-xs text-muted-foreground">© 2026 ShotTrace · 포트폴리오 프로젝트</p>
    </section>
  );
}
