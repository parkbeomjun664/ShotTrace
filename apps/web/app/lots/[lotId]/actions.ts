"use server";   // 🔴 1행 — 키를 쓰는 코드는 서버에서만 돈다

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { notifyThreats } from "@/lib/alert";
import { buildEvidence, guideContradictsData, metricStats, scanForInjection } from "@/lib/evidence";
import { generateGuide } from "@/lib/guide";
import { getLot, getLotDowntimes, getLotGuide, getLotShots, getMyRole, pareto } from "@/lib/queries";
import { 진행중 } from "@/lib/format";
import { createSessionClient } from "@/lib/supabase/session";

export type GuideState = { ok: boolean; message: string } | null;

const GuideInput = z.object({ lotId: z.string().min(1) });

export async function createGuide(_prev: GuideState, formData: FormData): Promise<GuideState> {
  const parsed = GuideInput.safeParse({ lotId: formData.get("lotId") });
  if (!parsed.success) return { ok: false, message: "LOT 을 알 수 없어요. 새로고침해 보세요" };
  const { lotId } = parsed.data;

  // 🔴 돈이 나가기 전에 막는다 — RLS 는 저장할 때 막지만, 그땐 이미 Claude 를 부른 뒤다
  const role = await getMyRole();
  if (role !== "worker" && role !== "admin") return { ok: false, message: "가이드 만들기 권한이 없어요 (worker 만 할 수 있어요)" };

  if (await getLotGuide(lotId)) {                      // 영수증이 있으면 택시를 또 부르지 않는다
    revalidatePath(`/lots/${lotId}`);
    return { ok: true, message: "이미 만들어진 가이드가 있어요" };
  }

  const lot = await getLot(lotId);
  if (!lot) return { ok: false, message: "없는 LOT 이에요" };
  if (진행중(lot.ended_at)) return { ok: false, message: "진행 중인 LOT 이에요 — 끝난 뒤에 만들 수 있어요" };   // 데이터가 아직 다 안 왔다

  const shots = await getLotShots(lotId);
  const reasons = pareto(shots);
  if (reasons.length === 0) return { ok: false, message: "불량이 없는 LOT 이에요" };

  const evidence = buildEvidence({                     // 📚 오픈북 — 우리 숫자만
    lotId,
    product: lot.product?.part_name ?? "",
    equipment: lot.equipment?.equip_name ?? lot.equip_cd,
    startedAt: lot.started_at,
    shots,
    reasons,
    downtimes: await getLotDowntimes(lot.equip_cd, lot.started_at, lot.ended_at),
  });

  let result;
  try {
    result = await generateGuide(evidence);
  } catch (e) {                                        // 키 없음 · 만료 · 잔액 0 · 네트워크 — 앱은 멀쩡하고 이 버튼만 안 된다
    console.error(e);                                  // 사람에게는 사람 말, 로그에는 진짜 에러
    return { ok: false, message: "지금은 가이드를 만들 수 없어요. 잠시 뒤 다시 해보세요" };
  }
  if (!result.ok) return { ok: false, message: result.message };

  const supabase = await createSessionClient();

  // 🔴 AI 엔드포인트 보안 게이트 (저장 직전) — 인젝션 ②·③
  // ③ 노골적 인젝션 패턴: note 가 오염 신호 → 기록·경보만 (차단 아님 · #1 은 ② 가 막는다)
  const injHits = scanForInjection(evidence.downtimes.map((d) => d.note ?? "").filter(Boolean));
  if (injHits.length) {
    try {
      const { data } = await supabase.rpc("record_ai_guard_event", { p_lot_id: lotId, p_kind: "인젝션 패턴", p_detail: injHits.join(", ") });
      if (data?.length) await notifyThreats(data);
    } catch {}
  }

  // ② 출력-데이터 교차검증: 강한 신호인데 '정상'이라 하면(위장 은폐 의심) 저장하지 않는다
  const contra = guideContradictsData(result.guide, metricStats(shots));
  if (contra.contradiction) {
    try {
      const { data } = await supabase.rpc("record_ai_guard_event", { p_lot_id: lotId, p_kind: "교차검증 차단", p_detail: contra.reason });
      if (data?.length) await notifyThreats(data);
    } catch {}
    return { ok: false, message: "가이드가 데이터와 모순돼 저장하지 않았어요 (검토가 필요해요)" };   // 🔴 저장 차단
  }

  const { error } = await supabase.from("lot_guide").insert({
    lot_id: lotId,
    content: result.guide,
    model: result.model,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
  });                                                  // 🔴 created_by 는 안 보낸다 — DB 의 DEFAULT 가 채운다

  if (error?.code === "23505") {                       // 두 사람이 동시에 눌렀다 — 먼저 저장된 쪽이 남는다 (PK)
    revalidatePath(`/lots/${lotId}`);
    return { ok: true, message: "이미 만들어진 가이드가 있어요" };
  }
  if (error?.code === "42501") return { ok: false, message: "가이드 저장 권한이 없어요" };
  if (error) {
    console.error(error);
    return { ok: false, message: "가이드를 저장하지 못했어요" };
  }

  revalidatePath(`/lots/${lotId}`);
  return { ok: true, message: `가이드를 만들었어요 — 토큰 ${result.inputTokens} + ${result.outputTokens}` };
}
