"use server";   // 🔴 1행 — 이 파일의 함수는 전부 서버에서 돈다 (Server Action)

// 로그인 · 로그아웃 — 폼이 이 함수를 바로 부른다. API 라우트를 따로 안 만든다
import { redirect } from "next/navigation";

import { createSessionClient } from "@/lib/supabase/session";

// useActionState 가 부른다 — 첫 칸은 이전 결과. 실패하면 쪽지로 이메일을 돌려줘 폼이 다시 채운다 (10/27)
export async function login(_prev: { email: string } | null, formData: FormData) {
  const supabase = await createSessionClient();        // 🔵 Server Action 은 쿠키를 쓸 수 있다
  const email = String(formData.get("email") ?? "");   // get 은 null 일 수 있다 → 문자열로

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: String(formData.get("password") ?? ""),
  });                                                  // 성공하면 setAll 이 손목밴드를 채운다

  if (error) return { email };                         // 🔴 이유를 안 나눈다 — 계정 존재 여부가 샌다 · 비밀번호는 돌려주지 않는다
  redirect("/");                                       // 🔴 redirect 는 던진다 · try 안에서 쓰지 않는다
}

// 「둘러보기로 시작」 — 서버가 대신 viewer 로 로그인한다 (공개용 정리)
// 🔴 비밀번호는 서버 환경변수에만 — NEXT_PUBLIC_ 이 아니라 브라우저 번들 · README · 코드 어디에도 안 나간다
// 무엇을 볼 수 있는지는 여전히 RLS 가 정한다 — viewer 는 읽기만 (ADR 013)
export async function loginAsViewer(): Promise<{ failed: true } | null> {   // useActionState 가 이전 결과를 넘기지만 쓰지 않는다
  const password = process.env.VIEWER_PASSWORD;
  if (!password) return { failed: true as const };    // 배포 환경에 값이 없다 — 화면은 안내만
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword({ email: "viewer@example.com", password });
  if (error) return { failed: true as const };
  redirect("/");
}

export async function logout() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();                       // 손목밴드 쿠키를 지운다
  redirect("/login");
}
