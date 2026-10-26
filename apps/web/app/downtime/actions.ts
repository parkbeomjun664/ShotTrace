"use server";   // 🔴 1행 — async 함수만 내보낸다 (records/actions.ts 와 같은 뼈대)

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { parseSelected } from "@/lib/downtime";
import { getMyRole } from "@/lib/queries";
import { createSessionClient } from "@/lib/supabase/session";

const kst = (local: string) => new Date(`${local}:00+09:00`);   // 🔴 datetime-local 은 "어디의" 시각인지 없다 — 서울로 읽는다

const DowntimeInput = z                                // 비가동의 검문소
  .object({
    requestId: z.uuid({ error: "화면을 새로고침한 뒤 다시 저장하세요" }),
    equipCd: z.string().min(1, { error: "설비를 고르세요" }),
    reasonCode: z.string().min(1, { error: "사유를 고르세요" }),
    startedAt: z.string().min(1, { error: "시작 시각을 넣으세요" }).transform(kst),   // 검사한 뒤 글자 → Date
    endedAt: z.string().min(1, { error: "종료 시각을 넣으세요" }).transform(kst),
    note: z.string().trim(),                           // 선택 칸 — 비어도 된다
  })
  .refine((d) => d.endedAt > d.startedAt, { error: "종료가 시작보다 뒤여야 해요" })   // DB 의 downtime_time_order 와 짝
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

  // 쓰기 전에 역할 — 화면의 잠금은 친절, RLS 는 마지막 문 (10/26 · LLM 가이드와 같은 순서)
  const role = await getMyRole();
  if (role !== "worker" && role !== "admin") return { ok: false, message: "둘러보기 계정은 조회만 가능해요", values };

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

// ── 사유 미입력 정지에 사유를 고른다 → 비가동 기록 · 여러 줄을 한 번에 (026 · 10/26) ──
// 🔵 화면이 보낸 시각을 그대로 믿지 않는다 — unrecorded_stop 에 그 구간이 지금도 있는지 줄마다 다시 찾고, 구간은 DB 값을 쓴다
export type ConfirmState = { ok: boolean; message: string } | null;

export async function confirmStops(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  const picked = parseSelected(formData.getAll("stop").map(String));   // "설비|시작 시각" — 틀린 모양 · 중복은 버린다
  const reason = z.string().min(1).safeParse(formData.get("reasonCode"));
  if (picked.length === 0) return { ok: false, message: "기록할 정지를 고르세요" };
  if (!reason.success) return { ok: false, message: "사유를 고르세요" };

  const role = await getMyRole();                      // 쓰기 전에 역할 — 화면의 잠금은 친절, RLS 는 마지막 문
  if (role !== "worker" && role !== "admin") return { ok: false, message: "둘러보기 계정은 조회만 가능해요" };

  const supabase = await createSessionClient();
  let done = 0, skipped = 0;
  for (const p of picked) {
    const { data: stop, error: findErr } = await supabase
      .from("unrecorded_stop")
      .select("started_at, ended_at")
      .eq("equip_cd", p.equipCd)
      .eq("started_at", p.startedAt)
      .maybeSingle();
    if (findErr) {
      console.error(findErr);
      return { ok: false, message: "저장하지 못했어요. 잠시 뒤 다시 해보세요" };
    }
    if (!stop?.started_at || !stop.ended_at) { skipped++; continue; }   // 누가 먼저 기록했거나 · 겹치는 비가동이 새로 생겼다

    const { error } = await supabase.from("downtime").insert({
      equip_cd: p.equipCd,
      reason_code: reason.data,
      started_at: stop.started_at,
      ended_at: stop.ended_at,
      source: "inferred",                              // 샷 간격으로 찾은 빈 곳에 사람이 사유를 고른 기록
      request_id: crypto.randomUUID(),                 // 줄마다 새 번호표 — 같은 줄 두 번은 위의 "다시 찾기" 와 EXCLUDE 가 막는다
    });
    if (error?.code === "23P01" || error?.code === "23505") { skipped++; continue; }
    if (error?.code === "42501") return { ok: false, message: "둘러보기 계정은 조회만 가능해요" };
    if (error) {
      console.error(error);
      return { ok: false, message: `${done}건 기록 뒤 멈췄어요. 잠시 뒤 다시 해보세요` };
    }
    done++;
  }

  revalidatePath("/downtime");
  revalidatePath("/oee");                              // 가동률이 바뀐다
  return { ok: true, message: `${done}건을 비가동으로 기록했어요${skipped ? ` · ${skipped}건은 이미 처리돼 있었어요` : ""}` };
}
