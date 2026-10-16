"use server";   // 🔴 1행 — 이 파일은 async 함수만 내보낼 수 있다

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSessionClient } from "@/lib/supabase/session";

const RecordInput = z                                  // 서버의 검문소 — required 는 안내문일 뿐 (M20)
  .object({
    lotId: z.string().min(1, { error: "LOT 을 고르세요" }),     // 빈 선택("")을 막는다
    passQty: z.coerce.number({ error: "양품 수량은 숫자로 넣으세요" }).int({ error: "양품은 정수로 넣으세요" }).min(0, { error: "양품은 0 이상이어야 해요" }),   // 🔴 FormData 는 전부 글자 — coerce 로 숫자로
    failQty: z.coerce.number({ error: "불량 수량은 숫자로 넣으세요" }).int({ error: "불량은 정수로 넣으세요" }).min(0, { error: "불량은 0 이상이어야 해요" }),   // 숫자인가 → 정수인가 → 0 이상인가
  })
  .refine((r) => r.passQty + r.failQty > 0, { error: "양품과 불량이 둘 다 0 이에요" });   // 칸끼리의 관계 — DB CHECK 와 짝

type RecordValues = { lotId: string; passQty: string; failQty: string };   // 반려할 때 돌려줄 "아까 쓴 서류" — 글자 그대로

export type RecordState = { ok: boolean; message: string; values?: RecordValues } | null;   // 폼에 돌려줄 쪽지 · 타입은 실행 때 사라져서 export 가능

export async function createRecord(_prev: RecordState, formData: FormData): Promise<RecordState> {   // 🔴 _prev 자리를 빼면 formData 가 밀린다
  const values = {
    lotId: String(formData.get("lotId") ?? ""),        // 🔴 ?? "" 먼저 — String(null) 은 "null" 이라는 글자가 된다
    passQty: String(formData.get("passQty") ?? ""),
    failQty: String(formData.get("failQty") ?? ""),
  };

  const parsed = RecordInput.safeParse(values);        // safe — 실패해도 던지지 않고 결과를 준다
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message, values };   // 첫 메시지 하나 + 아까 쓴 값

  const supabase = await createSessionClient();        // 쿠키의 신분으로 — RLS 가 "그 사람" 으로 검사한다
  const { error } = await supabase.from("production_record").insert({
    lot_id: parsed.data.lotId,
    pass_qty: parsed.data.passQty,
    fail_qty: parsed.data.failQty,                     // parsed.data = 통과해서 숫자로 바뀐 값
  });                                                  // 🔴 recorded_by 는 안 보낸다 — DB 의 DEFAULT 가 채운다

  if (error?.code === "42501") return { ok: false, message: "실적 입력 권한이 없어요 (worker 만 쓸 수 있어요)", values };   // WITH CHECK 에 걸림 — 사람 말로
  if (error) {
    console.error(error);                              // 사람에게는 사람 말, 로그에는 진짜 에러
    return { ok: false, message: "저장하지 못했어요. 잠시 뒤 다시 해보세요", values };
  }

  revalidatePath("/records");                          // 이 화면을 새로 그려라 — 최근 실적 목록이 바뀐다
  return { ok: true, message: `저장했어요 — 양품 ${parsed.data.passQty} · 불량 ${parsed.data.failQty}` };   // 🔵 values 없음 → 빈 양식
}
