"use server";   // 🔴 1행 — 이 파일의 함수는 전부 서버에서 돈다 (Server Action)

// 로그인 · 로그아웃 — 폼이 이 함수를 바로 부른다. API 라우트를 따로 안 만든다
import { redirect } from "next/navigation";
import { headers } from "next/headers";                 // ⭐ 요청 헤더에서 IP 를 읽는다 (W1)

import { notifyThreats } from "@/lib/alert";             // ⭐ 위협 알림 전송 (③)
import { createSessionClient } from "@/lib/supabase/session";

// useActionState 가 부른다 — 첫 칸은 이전 결과. 실패하면 쪽지로 이메일을 돌려줘 폼이 다시 채운다 (10/27)
export async function login(_prev: { email: string } | null, formData: FormData) {
  const supabase = await createSessionClient();        // 🔵 Server Action 은 쿠키를 쓸 수 있다
  const email = String(formData.get("email") ?? "");   // get 은 null 일 수 있다 → 문자열로

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: String(formData.get("password") ?? ""),
  });                                                  // 성공하면 setAll 이 손목밴드를 채운다

  // ⭐ 성패를 장부에 남긴다 (W1) — 접근 로그엔 안 보이는 '계정' 신호. 🔴 기록 실패가 로그인을 막지 않게 best-effort
  try {
    // 🔴 x-forwarded-for 첫 홉은 위조 가능 → Vercel 이 직접 채우는 x-real-ip 를 쓴다 (로컬엔 없어 "")
    const ip = (await headers()).get("x-real-ip")?.trim() ?? "";
    await supabase.rpc("record_login_attempt", { p_account: email, p_success: !error, p_ip: ip });
    if (error) {                                         // ⭐ 실패일 때만 — 이 IP·계정이 문턱을 넘었나 (경량·원자적 중복방지)
      const { data: hits } = await supabase.rpc("check_login_alert", { p_account: email, p_ip: ip });
      if (hits?.length) await notifyThreats(hits);       // 넘었고 쿨다운 밖이면 알림 (best-effort)
    }
  } catch {}

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
