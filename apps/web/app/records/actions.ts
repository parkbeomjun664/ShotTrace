"use server";   // 🔴 1행 — 이 파일은 async 함수만 내보낼 수 있다

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { shotDiffWarn } from "@/lib/records";
import { getMyRole } from "@/lib/queries";
import { createSessionClient } from "@/lib/supabase/session";

const RecordInput = z                                  // 서버의 검문소 — required 는 안내문일 뿐
  .object({
    lotId: z.string().min(1, { error: "LOT 을 고르세요" }),     // 빈 선택("")을 막는다
    requestId: z.uuid({ error: "화면을 새로고침한 뒤 다시 저장하세요" }),   // 번호표가 uuid 모양인가 — 지워지거나 바뀌면 여기서
    passQty: z.coerce.number({ error: "양품 수량은 숫자로 넣으세요" }).int({ error: "양품은 정수로 넣으세요" }).min(0, { error: "양품은 0 이상이어야 해요" }),   // 🔴 FormData 는 전부 글자 — coerce 로 숫자로
    failQty: z.coerce.number({ error: "불량 수량은 숫자로 넣으세요" }).int({ error: "불량은 정수로 넣으세요" }).min(0, { error: "불량은 0 이상이어야 해요" }),   // 숫자인가 → 정수인가 → 0 이상인가
  })
  .refine((r) => r.passQty + r.failQty > 0, { error: "양품과 불량이 둘 다 0 이에요" });   // 칸끼리의 관계 — DB CHECK 와 짝

type RecordValues = { lotId: string; passQty: string; failQty: string; note: string };   // 반려할 때 돌려줄 "아까 쓴 서류" — 글자 그대로

export type RecordState = { ok: boolean; message: string; values?: RecordValues } | null;   // 폼에 돌려줄 쪽지 · 타입은 실행 때 사라져서 export 가능

export async function createRecord(_prev: RecordState, formData: FormData): Promise<RecordState> {   // 🔴 _prev 자리를 빼면 formData 가 밀린다
  const values = {
    lotId: String(formData.get("lotId") ?? ""),        // 🔴 ?? "" 먼저 — String(null) 은 "null" 이라는 글자가 된다
    passQty: String(formData.get("passQty") ?? ""),
    failQty: String(formData.get("failQty") ?? ""),
    note: String(formData.get("note") ?? "").trim(),
  };

  const parsed = RecordInput.safeParse({ ...values, requestId: formData.get("requestId") });   // 번호표는 검사만 — values(돌려줄 서류)엔 안 넣는다
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message, values };   // 첫 메시지 하나 + 아까 쓴 값

  const role = await getMyRole();                      // 쓰기 전에 역할 — 화면의 잠금은 친절, RLS 는 마지막 문 (10/26)
  if (role !== "worker" && role !== "admin") return { ok: false, message: "둘러보기 계정은 조회만 가능해요", values };

  const supabase = await createSessionClient();        // 쿠키의 신분으로 — RLS 가 "그 사람" 으로 검사한다

  // 샷 수 차이 — 설비가 센 수량과 10% 넘게 다르면 메모가 있어야 한다. 🔴 화면의 경고를 믿지 않고 서버가 다시 센다 (lib/records.ts)
  const { data: lot } = await supabase.from("production_lot").select("total_qty").eq("lot_id", parsed.data.lotId).maybeSingle();
  if (lot && shotDiffWarn(parsed.data.passQty + parsed.data.failQty, lot.total_qty) && !values.note)
    return { ok: false, message: `설비가 센 ${lot.total_qty}개와 10% 넘게 달라요 — 이유를 메모에 적어 주세요`, values };
  const { error } = await supabase.from("production_record").insert({
    lot_id: parsed.data.lotId,
    pass_qty: parsed.data.passQty,
    fail_qty: parsed.data.failQty,                     // parsed.data = 통과해서 숫자로 바뀐 값
    request_id: parsed.data.requestId,                 // 🔴 requestId 를 함께 전달
    note: values.note || null,                         // 적은 게 없으면 "" 가 아니라 NULL (027 CHECK)
  });                                                  // 🔴 recorded_by 는 안 보낸다 — DB 의 DEFAULT 가 채운다

  if (error?.code === "23505") {                       // UNIQUE 위반 = 같은 번호표가 또 왔다
    revalidatePath("/records");                        // 새 번호표 · 최근 실적 다시 그리기
    return { ok: true, message: "이미 저장된 실적이에요 — 같은 제출이 두 번 왔어요" };   // 🔵 실패가 아니라 "이미 됐다" — ok: true
  }
  if (error?.code === "42501") return { ok: false, message: "실적 입력 권한이 없어요 (worker 만 쓸 수 있어요)", values };   // WITH CHECK 에 걸림 — 사람 말로
  if (error) {
    console.error(error);                              // 사람에게는 사람 말, 로그에는 진짜 에러
    return { ok: false, message: "저장하지 못했어요. 잠시 뒤 다시 해보세요", values };
  }

  revalidatePath("/records");                          // 이 화면을 새로 그려라 — 최근 실적 목록이 바뀐다
  return { ok: true, message: `저장했어요 — 양품 ${parsed.data.passQty} · 불량 ${parsed.data.failQty}` };   // 🔵 values 없음 → 빈 양식
}

const CorrectInput = z                                 // 정정의 검문소 — 🔴 양품 · 불량 두 줄은 RecordInput 과 중복 (나중에 묶기)
  .object({
    recordId: z.coerce.number().int().positive({ error: "정정할 실적을 고르세요" }),   // 안 고르면 "" → 0 — 그래서 양수로 막는다
    requestId: z.uuid({ error: "화면을 새로고침한 뒤 다시 저장하세요" }),
    passQty: z.coerce.number({ error: "양품 수량은 숫자로 넣으세요" }).int({ error: "양품은 정수로 넣으세요" }).min(0, { error: "양품은 0 이상이어야 해요" }),
    failQty: z.coerce.number({ error: "불량 수량은 숫자로 넣으세요" }).int({ error: "불량은 정수로 넣으세요" }).min(0, { error: "불량은 0 이상이어야 해요" }),
    reason: z.string().trim().min(1, { error: "정정 이유를 적으세요" }),   // DB 의 CHECK (length(trim(reason)) > 0) 와 짝
  })
  .refine((r) => r.passQty + r.failQty > 0, { error: "양품과 불량이 둘 다 0 이에요" });

export type CorrectState = { ok: boolean; message: string } | null;   // 정정 폼에 돌려줄 쪽지

export async function correctRecord(_prev: CorrectState, formData: FormData): Promise<CorrectState> {
  const parsed = CorrectInput.safeParse({
    recordId: formData.get("recordId"),
    requestId: formData.get("requestId"),
    passQty: formData.get("passQty"),
    failQty: formData.get("failQty"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const role = await getMyRole();                      // 쓰기 전에 역할 (10/26)
  if (role !== "worker" && role !== "admin") return { ok: false, message: "둘러보기 계정은 조회만 가능해요" };

  const supabase = await createSessionClient();
  const { error } = await supabase.rpc("correct_record", {   // 🔵 한 번 부른다 = 트랜잭션 하나 — 취소 + 새 줄이 함께
    p_record_id: parsed.data.recordId,
    p_pass_qty: parsed.data.passQty,
    p_fail_qty: parsed.data.failQty,
    p_reason: parsed.data.reason,
    p_request_id: parsed.data.requestId,               // p_ 이름은 함수 매개변수와 같아야 — 틀리면 tsc 가 잡는다
  });

  if (error?.code === "23505") {
    revalidatePath("/records");
    return { ok: true, message: "이미 정정된 실적이에요" };   // 먼저 정정됨(record_cancel_pkey) 또는 같은 제출 두 번(request_id) — 둘 다 "이미 됐다"
  }
  if (error?.code === "42501") return { ok: false, message: "정정 권한이 없어요 (worker 만 할 수 있어요)" };   // INVOKER 라 RLS 가 막는다
  if (error) {
    console.error(error);
    return { ok: false, message: "정정하지 못했어요. 잠시 뒤 다시 해보세요" };
  }

  revalidatePath("/records");
  return { ok: true, message: `정정했어요 — 양품 ${parsed.data.passQty} · 불량 ${parsed.data.failQty}` };
}
