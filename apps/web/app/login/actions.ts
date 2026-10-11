"use server";   // 🔴 1행 — 이 파일의 함수는 전부 서버에서 돈다 (Server Action)

// 로그인 · 로그아웃 — 폼이 이 함수를 바로 부른다. API 라우트를 따로 안 만든다 (M19)
import { redirect } from "next/navigation";

import { createSessionClient } from "@/lib/supabase/session";

export async function login(formData: FormData) {     // 폼의 name 이 그대로 들어온다
  const supabase = await createSessionClient();        // 🔵 Server Action 은 쿠키를 쓸 수 있다

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),              // get 은 null 일 수 있다 → 문자열로
    password: String(formData.get("password")),
  });                                                  // 성공하면 setAll 이 손목밴드를 채운다

  if (error) redirect("/login?error=1");               // 🔴 이유를 안 나눈다 — 계정 존재 여부가 샌다
  redirect("/");                                       // 🔴 redirect 는 던진다 · try 안에서 쓰지 않는다
}

export async function logout() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();                       // 손목밴드 쿠키를 지운다
  redirect("/login");
}
