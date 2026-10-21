"use server";   // 🔴 1행 — 마스터 사용 중지 켜고 끄기 (M23 · 019)

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSessionClient } from "@/lib/supabase/session";

export async function setActive(formData: FormData) {
  const key = String(formData.get("key") ?? "");
  const active = formData.get("active") === "true";   // 폼 값은 글자 — "true" 와 비교해 boolean 으로
  const supabase = await createSessionClient();

  const { data, error } =                              // 🔴 표 이름은 폼에서 받지 않는다 — 비교만 하고 코드에 직접 적는다
    formData.get("table") === "defect_code"
      ? await supabase.from("defect_code").update({ active }).eq("reason", key).select("reason")
      : await supabase.from("downtime_reason").update({ active }).eq("code", key).select("code");   // select = 고친 줄을 돌려받는다

  if (error) throw error;
  if (data.length === 0) redirect("/master?denied=1"); // 🔴 RLS 에 막힌 UPDATE 는 에러 없이 0줄 — 직접 확인한다 · redirect 는 던진다
  revalidatePath("/master");
}
