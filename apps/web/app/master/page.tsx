// 마스터 — 무엇이 있나. 지우지 않고 사용 중지 · 사유 명단은 admin 만 바꾼다 (M23 · 019)
// 10/26 — 탭 넷(설비 · 제품 · 비가동 사유 · 불량 사유 · ?tab=) · 표 · 「사용 중지 포함」 · 사용 중지는 회색 + 배지
// 🔵 추가 · 수정 · 설비/제품 사용 중지 · 변경 이력은 다음 단계 (마이그레이션 028 이 필요하다)
import Link from "next/link";

import { MASTER_TABS, parseTab, type MasterTab } from "@/lib/master";
import { getAllDowntimeReasons, getDefectCodes, getEquipments, getMyRole, getProducts } from "@/lib/queries";

import { setActive } from "./actions";

function Toggle({ table, keyValue, active }: { table: string; keyValue: string; active: boolean }) {   // 버튼 하나짜리 작은 폼 — 줄마다 하나
  return (
    <form action={setActive}>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="key" value={keyValue} />
      <input type="hidden" name="active" value={String(!active)} /> {/* 지금의 반대로 뒤집는다 */}
      <button className="rounded border px-2 py-1 text-xs hover:bg-muted">{active ? "사용 중지" : "다시 사용"}</button>
    </form>
  );
}

const Status = ({ active }: { active: boolean }) =>
  active ? <span className="text-xs text-muted-foreground">사용 중</span> : <span className="rounded bg-muted px-1.5 py-0.5 text-xs">사용 중지</span>;

const TH = "px-4 py-2 font-medium";
const TD = "px-4 py-2";

export default async function Page({ searchParams }: PageProps<"/master">) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const showInactive = sp.inactive === "1";
  const denied = sp.denied;                            // ?denied=1 — 역할 확인이나 RLS 에 막혔다
  const [equipments, products, reasons, defects, role] = await Promise.all([
    getEquipments(),
    getProducts(),
    getAllDowntimeReasons(),
    getDefectCodes(),
    getMyRole(),
  ]);
  const admin = role === "admin";                      // 🔴 버튼을 숨기는 건 친절일 뿐 — 막는 건 액션의 역할 확인 · RLS (019)
  const href = (t: MasterTab, inactive = showInactive) => `/master?tab=${t}${inactive ? "&inactive=1" : ""}`;
  const shownReasons = showInactive ? reasons : reasons.filter((r) => r.active);
  const shownDefects = showInactive ? defects : defects.filter((d) => d.active);
  const hasInactive = tab === "downtime" ? reasons.some((r) => !r.active) : tab === "defect" ? defects.some((d) => !d.active) : false;
  const canToggle = tab === "downtime" || tab === "defect";   // 사용 중지 칸은 사유 명단에만 있다 (설비 · 제품은 028 에서)

  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">마스터</h1>
      <p className="mt-2 text-sm text-muted-foreground">설비·제품·사유 기준 정보를 관리해요 · 삭제 대신 사용 중지로 이력이 남아요</p>
      {denied && <p className="mt-2 text-sm text-red-600">바꿀 권한이 없어요 (admin 만 할 수 있어요)</p>}
      {!admin && <p className="mt-2 text-sm text-muted-foreground">admin 계정만 바꿀 수 있어요 — 지금은 읽기 전용이에요</p>}

      {/* 탭 — 링크라 주소에 남는다 (?tab=) */}
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-b">
        <nav aria-label="마스터 종류" className="flex">
          {MASTER_TABS.map((t) => (
            <Link
              key={t.key}
              href={href(t.key)}
              aria-current={t.key === tab ? "page" : undefined}
              className={`border-b-2 px-3 py-2 text-sm ${t.key === tab ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {canToggle && (
          <Link
            href={href(tab, !showInactive)}
            aria-pressed={showInactive}
            className={`mb-2 rounded-full border px-3 py-1 text-sm transition-colors ${showInactive ? "border-foreground bg-foreground text-background" : "hover:bg-muted"}`}
          >
            {showInactive ? "✓ " : ""}사용 중지 포함{hasInactive ? "" : " (없음)"}
          </Link>
        )}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border">
        {/* 🔴 주석을 <table> 뒤에 두면 공백이 "글자" 로 들어간다 — 그래서 여기 */}
        <table className="w-full whitespace-nowrap text-sm">
          {tab === "equipment" && (
            <>
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className={TH}>코드</th>
                  <th className={TH}>이름</th>
                  <th className={`${TH} text-right`}>톤수</th>
                </tr>
              </thead>
              <tbody>
                {equipments.map((e) => (
                  <tr key={e.equip_cd} className="border-b last:border-0">
                    <td className={`${TD} font-mono`}>{e.equip_cd}</td>
                    <td className={TD}>{e.equip_name}</td>
                    <td className={`${TD} text-right tabular-nums`}>{e.tonnage ? `${e.tonnage}톤` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}

          {tab === "product" && (
            <>
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className={TH}>코드</th>
                  <th className={TH}>품명</th>
                  <th className={`${TH} text-right`}>
                    표준 CT (s){" "}
                    <span title="OEE 성능 계산 기준 — 샷 수 × 표준 CT ÷ 가동 시간 (ADR 016)" className="cursor-help">ⓘ</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.product_id} className="border-b last:border-0">
                    <td className={`${TD} font-mono`}>{p.product_id}</td>
                    <td className={TD}>
                      {p.part_name} <span className="text-muted-foreground">({p.car_model} {p.side})</span>
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{p.std_cycle_sec ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}

          {tab === "downtime" && (
            <>
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className={TH}>코드</th>
                  <th className={TH}>이름</th>
                  <th className={TH}>
                    구분 <span title="계획 정지는 OEE 계획 시간에서 빠지고, 비계획은 가동률 손실이 돼요 (ADR 016)" className="cursor-help">ⓘ</span>
                  </th>
                  <th className={TH}>상태</th>
                  {admin && <th className={TH}>작업</th>}
                </tr>
              </thead>
              <tbody>
                {shownReasons.map((r) => (
                  <tr key={r.code} className={`border-b last:border-0 ${r.active ? "" : "text-muted-foreground"}`}>
                    <td className={`${TD} font-mono`}>{r.code}</td>
                    <td className={TD}>{r.name}</td>
                    <td className={TD}>
                      <span className={`rounded px-1.5 py-0.5 text-xs ${r.planned ? "bg-blue-50 text-blue-900" : "bg-amber-50 text-amber-900"}`}>
                        {r.planned ? "계획" : "비계획"}
                      </span>
                    </td>
                    <td className={TD}><Status active={r.active} /></td>
                    {admin && <td className={TD}><Toggle table="downtime_reason" keyValue={r.code} active={r.active} /></td>}
                  </tr>
                ))}
              </tbody>
            </>
          )}

          {tab === "defect" && (
            <>
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className={TH}>사유</th>
                  <th className={TH}>상태</th>
                  {admin && <th className={TH}>작업</th>}
                </tr>
              </thead>
              <tbody>
                {shownDefects.map((d) => (
                  <tr key={d.reason} className={`border-b last:border-0 ${d.active ? "" : "text-muted-foreground"}`}>
                    <td className={TD}>{d.reason}</td>
                    <td className={TD}><Status active={d.active} /></td>
                    {admin && <td className={TD}><Toggle table="defect_code" keyValue={d.reason} active={d.active} /></td>}
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      </div>
    </section>
  );
}
