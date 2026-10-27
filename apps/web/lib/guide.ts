// LOT 대응 가이드 — Claude 를 부르는 곳은 여기 하나
//
//   🔴 서버 전용 — 키(법인카드)가 이 파일에 있다. 브라우저 코드가 import 하면 빌드가 멈춘다
//   흐름: 오픈북(evidence) → Claude → 택배 확인(stop_reason · Zod) → 가이드
import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

import { GuideSchema, type Evidence, type Guide } from "@/lib/evidence";

const client = new Anthropic({                         // 키는 ANTHROPIC_API_KEY 에서 — 🔴 NEXT_PUBLIC_ 없음
  timeout: 60_000,                                     // ms — 1분 넘게 기다리지 않는다
  maxRetries: 1,                                       // 다시 시도도 돈이다 — 한 번만
});

const MODEL = "claude-opus-5-5";

const SYSTEM = `당신은 사출성형 공장의 공정 엔지니어를 돕습니다.
사용자 메시지의 JSON 은 불량이 난 LOT 하나의 데이터입니다.

규칙
- 원인 판단(summary, title, reasoning)은 이 JSON 에 있는 것만 근거로 씁니다. 없는 사실이나 수치를 만들지 않습니다.
- 점검할 곳(check)에는 사출성형 현장의 일반 지식을 써도 됩니다. 다만 데이터로 확인된 것처럼 쓰지 않습니다.
- metrics 의 z 는 (불량 평균 - 양품 평균) / 양품 표준편차 입니다. |z| 가 작으면(대략 1 미만) 원인이라고 단정하지 않습니다.
- defect_positions 는 불량이 LOT 의 몇 번째 샷(shot_no), 시작 후 몇 분(minutes_from_start)에 났는지입니다. 불량이 초기에 몰렸는지, 흩어졌는지 판단에 씁니다.
- 원인마다 metric 에 근거가 된 변수의 key 를 하나 고릅니다.
- 수치는 화면이 따로 보여주므로 reasoning 과 check 에 숫자를 쓰지 않습니다.
- 가능성이 높은 순서로 최대 3개를 씁니다. 데이터로 판단할 수 없으면 causes 를 비우고 summary 에 그렇게 씁니다.
- downtimes 가 있으면 불량과의 관계를 함께 봅니다.
- 한국어로, 현장 작업자가 바로 읽을 수 있게 짧게 씁니다.`;

export type GuideResult =
  | { ok: true; guide: Guide; model: string; inputTokens: number; outputTokens: number }
  | { ok: false; message: string };

export async function generateGuide(evidence: Evidence): Promise<GuideResult> {
  const res = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,                                 // 미터기 상한 — 생각 + 답
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",                              // 거절되면 서버가 알맞은 다른 모델로 다시 — 모델 목록은 안 관리한다
    output_config: {
      effort: "medium",                                // 생각의 양 — 표 하나 읽는 일이라 중간이면 된다
      format: betaZodOutputFormat(GuideSchema),        // 📦 상자 모양 — 이 모양으로만 답한다
    },
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(evidence) }],
  });

  // 🚚 배송 사고 — 상자가 비었거나 반쯤 찼다
  if (res.stop_reason === "refusal") return { ok: false, message: "가이드를 만들지 못했어요 (요청이 거절됐어요)" };
  if (res.stop_reason === "max_tokens") return { ok: false, message: "가이드가 너무 길어져 끊겼어요. 다시 해보세요" };

  // 🔍 내용물 — parse 가 GuideSchema 로 검사했다. 못 맞추면 null
  const guide = res.parsed_output;
  if (!guide) return { ok: false, message: "가이드 모양이 맞지 않아요. 다시 해보세요" };

  return {
    ok: true,
    guide: { ...guide, causes: guide.causes.slice(0, 3) },   // "최대 3개" 는 부탁 — 지키는 건 우리
    model: res.model,                                  // 🔵 요청한 모델이 아니라 실제로 답한 모델 (대체 모델일 수 있다)
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
  };
}
