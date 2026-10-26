// 마스터의 규칙 — 탭 · 고를 수 있는 항목 (10/26 · M26 테스트 대상)
// 순수함수 — DB 를 안 부른다

export const MASTER_TABS = [
  { key: "equipment", label: "설비" },
  { key: "product", label: "제품" },
  { key: "downtime", label: "비가동 사유" },
  { key: "defect", label: "불량 사유" },
] as const;
export type MasterTab = (typeof MASTER_TABS)[number]["key"];

export const parseTab = (v: unknown): MasterTab =>     // 주소의 ?tab= — 모르는 값이면 첫 탭
  MASTER_TABS.some((t) => t.key === v) ? (v as MasterTab) : "equipment";

// 고를 수 있는 항목 — 사용 중지된 것은 새 기록에 못 쓴다. 🔵 옛 기록은 계속 가리킨다 (지우지 않는 이유 · ADR 015)
export const selectable = <T extends { active: boolean }>(items: T[]) => items.filter((x) => x.active);
