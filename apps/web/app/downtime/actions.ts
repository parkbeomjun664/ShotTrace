"use server";   // 🔴 1행 — async 함수만 내보낸다 (records/actions.ts 와 같은 뼈대)

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSessionClient } from "@/lib/supabase/session";

const kst = (local: string) => new Date(`${local}:00+09:00`);   // 🔴 datetime-local 은 "어디의" 시각인지 없다 — 서울로 읽는다

const DowntimeInput = z                                // 비가동의 검문소
  .object({
    requestId: z.uuid({ error: "화면을 새로고침한 뒤 다시 저장하세요" }),
    equipCd: z.string().min(1, { error: "설비를 고르세요" }),
    reasonCode: z.string().min(1, { error: "사유를 고르세요" }),
    startedAt: z.string().min(1, { error: "시작 시각을 넣으세요" }).transform(kst),   // 검사한 뒤 글자 → Date
    endedAt: z.string().min(1, { error: "끝 시각을 넣으세요" }).transform(kst),
    note: z.string().trim(),                           // 선택 칸 — 비어도 된다
  })
  .refine((d) => d.endedAt > d.startedAt, { error: "끝이 시작보다 뒤여야 해요" })   // DB 의 downtime_time_order 와 짝
  .refine((d) => d.endedAt <= new Date(), { error: "끝난 비가동만 적을 수 있어요" });   // downtime_not_future 와 짝

type DowntimeValues = { equipCd: string; reasonCode: string; startedAt: string; endedAt: string; note: string };   // 반려할 때 돌려줄 "아까 쓴 서류"

export type DowntimeState = { ok: boolean; message: string; values?: DowntimeValues } | null;   // 폼에 돌려줄 쪽지

export async function createDowntime(_prev: DowntimeState, formData: FormData): Promise<DowntimeState> {
  const values = {
    equipCd: String(formData.get("equipCd") ?? ""),
    reasonCode: String(formData.get("reasonCode") ?? ""),
    startedAt: String(formData.get("startedAt") ?? ""),
    endedAt: String(formData.get("endedAt") ?? ""),
    note: String(formData.get("note") ?? ""),
  };

  const parsed = DowntimeInput.safeParse({ ...values, requestId: formData.get("requestId") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message, values };

  const supabase = await createSessionClient();
  const { error } = await supabase.from("downtime").insert({
    equip_cd: parsed.data.equipCd,
    reason_code: parsed.data.reasonCode,
    started_at: parsed.data.startedAt.toISOString(),   // UTC 글자로 — 저장은 UTC (ADR 002)
    ended_at: parsed.data.endedAt.toISOString(),
    note: parsed.data.note || null,                    // 적은 게 없으면 "" 가 아니라 NULL
    request_id: parsed.data.requestId,
  });                                                  // 🔴 recorded_by 는 안 보낸다 — DEFAULT 가 채운다

  if (error?.code === "23505") {               // 같은 번호표 두 번 — "이미 됐다"
    revalidatePath("/downtime");
    return { ok: true, message: "이미 저장된 비가동이에요" };
  }
  if (error?.code === "23P01") return { ok: false, message: "그 시간에 이 설비의 비가동이 이미 있어요", values };   // 겹침 (downtime_no_overlap) — 사람 말로
  if (error?.code === "42501") return { ok: false, message: "비가동 입력 권한이 없어요 (worker 만 쓸 수 있어요)", values };
  if (error) {
    console.error(error);
    return { ok: false, message: "저장하지 못했어요. 잠시 뒤 다시 해보세요", values };
  }

  revalidatePath("/downtime");
  return { ok: true, message: "비가동을 저장했어요" };
}
