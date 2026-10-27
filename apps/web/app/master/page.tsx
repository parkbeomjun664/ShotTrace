// 마스터 — 무엇이 있나. 지우지 않고 사용 중지 · admin 만 바꾼다 (019 · 028)
// 10/26 — 탭 다섯(설비 · 제품 · 비가동 사유 · 불량 사유 · 판정 기준 · ?tab=) · 추가 · 수정 모달 · 사용 중지 · 줄마다 변경 이력
//   🔴 버튼을 숨기는 건 친절일 뿐 — 막는 건 액션의 역할 확인과 RLS(insert_admin · update_admin). 이력은 트리거가 쓴다 (028)
import Link from "next/link";

import { 날짜, 시각 } from "@/lib/format";
import { MASTER_TABS, auditChanges, parseTab, type MasterTab } from "@/lib/master";
import { getAllDowntimeReasons, getDefectCodes, getEquipments, getMasterAudit, getMyRole, getParameterSpec, getProducts } from "@/lib/queries";
import { createSessionClient } from "@/lib/supabase/session";

import { setActive } from "./actions";
import { HistoryDialog, type HistoryEntry } from "./HistoryDialog";
import { Field, MasterDialog } from "./MasterDialog";

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
const INPUT = "h-10 w-full rounded-md border px-3 text-sm font-normal";
const TABLE_OF: Record<MasterTab, string> = { equipment: "equipment", product: "product", downtime: "downtime_reason", defect: "defect_code", spec: "parameter_spec" };
const SPEC_LABEL: Record<string, string> = { cycle_time: "사이클 타임", max_injection_pressure: "최대 사출압", barrel_temperature_1: "배럴1 온도", mold_temperature_3: "금형3 온도" };

export default async function Page({ searchParams }: PageProps<"/master">) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const showInactive = sp.inactive === "1";
  const supabase = await createSessionClient();
  const [equipments, products, reasons, defects, specs, audit, role, { data: { user } }] = await Promise.all([
    getEquipments(),
    getProducts(),
    getAllDowntimeReasons(),
    getDefectCodes(),
    getParameterSpec(),
    getMasterAudit(TABLE_OF[tab]),
    getMyRole(),
    supabase.auth.getUser(),
  ]);
  const admin = role === "admin";
  const href = (t: MasterTab, inactive = showInactive) => `/master?tab=${t}${inactive ? "&inactive=1" : ""}`;

  // 줄마다 이력 — 그 표의 이력을 키로 묶는다
  const history = new Map<string, HistoryEntry[]>();
  for (const a of audit) {
    const show = (v: unknown) => (v === null || v === undefined ? "—" : String(v));
    const entry: HistoryEntry = {
      id: a.audit_id,
      at: `${날짜(a.changed_at)} ${시각(a.changed_at)}`,
      action: a.action,
      by: a.changed_by === null ? "SQL Editor" : a.changed_by === user?.id ? "나" : "다른 계정",
      changes: auditChanges(a.before as Record<string, unknown> | null, a.after as Record<string, unknown>).map((c) => ({ field: c.field, from: show(c.from), to: show(c.to) })),
    };
    history.set(a.record_key, [...(history.get(a.record_key) ?? []), entry]);
  }
  const hist = (key: string | number, title: string) => <HistoryDialog title={title} entries={history.get(String(key)) ?? []} />;

  const keep = <T extends { active: boolean }>(xs: T[]) => (showInactive ? xs : xs.filter((x) => x.active));
  const inactiveCount =
    tab === "equipment" ? equipments.filter((x) => !x.active).length
    : tab === "product" ? products.filter((x) => !x.active).length
    : tab === "downtime" ? reasons.filter((x) => !x.active).length
    : tab === "defect" ? defects.filter((x) => !x.active).length
    : 0;
  const rowClass = (active: boolean) => `border-b last:border-0 ${active ? "" : "text-muted-foreground"}`;

  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">마스터</h1>
      <p className="mt-2 text-base text-muted-foreground">설비 · 제품 · 사유 기준 정보 · 삭제 대신 사용 중지</p>
      {sp.denied && <p className="mt-2 text-sm text-red-600">바꿀 권한이 없어요 (admin 만 할 수 있어요)</p>}
      {!admin && <p className="mt-2 text-sm text-muted-foreground">admin 계정만 바꿀 수 있어요 — 지금은 읽기 전용이에요</p>}

      {/* 탭 — 링크라 주소에 남는다 (?tab=) */}
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-b">
        <nav aria-label="마스터 종류" className="flex overflow-x-auto">
          {MASTER_TABS.map((t) => (
            <Link
              key={t.key}
              href={href(t.key)}
              aria-current={t.key === tab ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${t.key === tab ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {/* min-h-9 — 「추가」 버튼(34px)보다 크게 · 버튼이 없는 탭(판정 기준 · 버튼 없는 계정)에서도 높이를 지켜 표가 올라가지 않는다 (10/27) */}
        <div className="mb-2 flex min-h-9 items-center gap-2">
          {tab !== "spec" && (
            <Link
              href={href(tab, !showInactive)}
              aria-pressed={showInactive}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${showInactive ? "border-foreground bg-foreground text-background" : "hover:bg-muted"}`}
            >
              {showInactive ? "✓ " : ""}사용 중지 포함 ({inactiveCount})
            </Link>
          )}
          {/* 추가 — admin 만 · 판정 기준은 변수 넷이 고정이라 추가가 없다 */}
          {admin && tab === "equipment" && (
            <MasterDialog button="추가" title="설비 추가" table="equipment">
              <Field label="코드"><input name="equip_cd" required className={INPUT} /></Field>
              <Field label="이름"><input name="equip_name" required className={INPUT} /></Field>
              <Field label="톤수 (선택)"><input name="tonnage" type="number" min={1} step={1} inputMode="numeric" className={INPUT} /></Field>
            </MasterDialog>
          )}
          {admin && tab === "product" && (
            <MasterDialog button="추가" title="제품 추가" table="product">
              <Field label="품명"><input name="part_name" required className={INPUT} /></Field>
              <Field label="차종 (선택)"><input name="car_model" className={INPUT} /></Field>
              <Field label="좌우 (선택)">
                <select name="side" defaultValue="" className={INPUT}><option value="">—</option><option>LH</option><option>RH</option></select>
              </Field>
              <Field label="표준 CT (s)"><input name="std_cycle_sec" type="number" min={0.01} step={0.01} required className={INPUT} /></Field>
            </MasterDialog>
          )}
          {admin && tab === "downtime" && (
            <MasterDialog button="추가" title="비가동 사유 추가" table="downtime_reason">
              <Field label="코드 (영문 대문자 · _)"><input name="code" required pattern="[A-Z_]+" className={INPUT} /></Field>
              <Field label="이름"><input name="name" required className={INPUT} /></Field>
              <Field label="구분">
                <select name="planned" defaultValue="false" className={INPUT}><option value="false">비계획 — 가동률 손실</option><option value="true">계획 — 계획 시간에서 뺌</option></select>
              </Field>
            </MasterDialog>
          )}
          {admin && tab === "defect" && (
            <MasterDialog button="추가" title="불량 사유 추가" table="defect_code">
              <Field label="사유"><input name="reason" required className={INPUT} /></Field>
            </MasterDialog>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border">
        {/* 🔴 주석을 <table> 뒤에 두면 공백이 "글자" 로 들어간다 — 그래서 여기 */}
        <table className="w-full whitespace-nowrap text-sm">
          {tab === "equipment" && (
            <>
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className={TH}>코드</th>
                  <th className={TH}>이름</th>
                  <th className={`${TH}`}>톤수</th>
                  <th className={TH}>상태</th>
                  <th className={TH}>작업</th>
                </tr>
              </thead>
              <tbody>
                {keep(equipments).map((e) => (
                  <tr key={e.equip_cd} className={rowClass(e.active)}>
                    <td className={`${TD} font-mono`}>{e.equip_cd}</td>
                    <td className={TD}>{e.equip_name}</td>
                    <td className={`${TD} tabular-nums`}>{e.tonnage ? `${e.tonnage}톤` : "—"}</td>
                    <td className={TD}><Status active={e.active} /></td>
                    <td className={TD}>
                      <span className="flex justify-center gap-1.5">
                        {admin && (
                          <MasterDialog button="수정" title={`설비 수정 · ${e.equip_cd}`} table="equipment" recordKey={e.equip_cd}>
                            <input type="hidden" name="equip_cd" value={e.equip_cd} /> {/* 검문소용 — 액션은 키를 고치지 않는다 */}
                            <Field label="이름"><input name="equip_name" required defaultValue={e.equip_name} className={INPUT} /></Field>
                            <Field label="톤수 (선택)"><input name="tonnage" type="number" min={1} step={1} defaultValue={e.tonnage ?? ""} className={INPUT} /></Field>
                          </MasterDialog>
                        )}
                        {admin && <Toggle table="equipment" keyValue={e.equip_cd} active={e.active} />}
                        {hist(e.equip_cd, e.equip_cd)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}

          {tab === "product" && (
            <>
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className={TH}>코드</th>
                  <th className={TH}>품명</th>
                  <th className={`${TH}`}>
                    표준 CT (s){" "}
                    <span title="OEE 성능 계산 기준 — 샷 수 × 표준 CT ÷ 가동 시간 (ADR 016)" className="cursor-help">ⓘ</span>
                  </th>
                  <th className={TH}>상태</th>
                  <th className={TH}>작업</th>
                </tr>
              </thead>
              <tbody>
                {keep(products).map((p) => (
                  <tr key={p.product_id} className={rowClass(p.active)}>
                    <td className={`${TD} font-mono`}>{p.product_id}</td>
                    <td className={TD}>
                      {p.part_name} <span className="text-muted-foreground">({p.car_model} {p.side})</span>
                    </td>
                    <td className={`${TD} tabular-nums`}>{p.std_cycle_sec ?? "—"}</td>
                    <td className={TD}><Status active={p.active} /></td>
                    <td className={TD}>
                      <span className="flex justify-center gap-1.5">
                        {admin && (
                          <MasterDialog button="수정" title={`제품 수정 · ${p.product_id}`} table="product" recordKey={String(p.product_id)}>
                            <Field label="품명"><input name="part_name" required defaultValue={p.part_name} className={INPUT} /></Field>
                            <Field label="차종 (선택)"><input name="car_model" defaultValue={p.car_model ?? ""} className={INPUT} /></Field>
                            <Field label="좌우 (선택)">
                              <select name="side" defaultValue={p.side ?? ""} className={INPUT}><option value="">—</option><option>LH</option><option>RH</option></select>
                            </Field>
                            <Field label="표준 CT (s) — 바꾸면 OEE 성능이 다시 계산돼요"><input name="std_cycle_sec" type="number" min={0.01} step={0.01} required defaultValue={p.std_cycle_sec ?? ""} className={INPUT} /></Field>
                          </MasterDialog>
                        )}
                        {admin && <Toggle table="product" keyValue={String(p.product_id)} active={p.active} />}
                        {hist(p.product_id, p.part_name)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}

          {tab === "downtime" && (
            <>
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className={TH}>코드</th>
                  <th className={TH}>이름</th>
                  <th className={TH}>
                    구분 <span title="계획 정지는 OEE 계획 시간에서 빠지고, 비계획은 가동률 손실이 돼요 (ADR 016)" className="cursor-help">ⓘ</span>
                  </th>
                  <th className={TH}>상태</th>
                  <th className={TH}>작업</th>
                </tr>
              </thead>
              <tbody>
                {keep(reasons).map((r) => (
                  <tr key={r.code} className={rowClass(r.active)}>
                    <td className={`${TD} font-mono`}>{r.code}</td>
                    <td className={TD}>{r.name}</td>
                    <td className={TD}>
                      <span className={`rounded px-1.5 py-0.5 text-xs ${r.planned ? "bg-blue-50 text-blue-900" : "bg-amber-50 text-amber-900"}`}>{r.planned ? "계획" : "비계획"}</span>
                    </td>
                    <td className={TD}><Status active={r.active} /></td>
                    <td className={TD}>
                      <span className="flex justify-center gap-1.5">
                        {admin && (
                          <MasterDialog button="수정" title={`비가동 사유 수정 · ${r.code}`} table="downtime_reason" recordKey={r.code}>
                            <input type="hidden" name="code" value={r.code} />
                            <Field label="이름"><input name="name" required defaultValue={r.name} className={INPUT} /></Field>
                            <Field label="구분">
                              <select name="planned" defaultValue={String(r.planned)} className={INPUT}><option value="false">비계획 — 가동률 손실</option><option value="true">계획 — 계획 시간에서 뺌</option></select>
                            </Field>
                          </MasterDialog>
                        )}
                        {admin && <Toggle table="downtime_reason" keyValue={r.code} active={r.active} />}
                        {hist(r.code, r.name)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}

          {tab === "defect" && (
            <>
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className={TH}>사유</th>
                  <th className={TH}>상태</th>
                  <th className={TH}>작업</th>
                </tr>
              </thead>
              <tbody>
                {keep(defects).map((d) => (
                  <tr key={d.reason} className={rowClass(d.active)}>
                    <td className={TD}>{d.reason}</td>
                    <td className={TD}><Status active={d.active} /></td>
                    <td className={TD}>
                      {/* 불량 사유는 이름이 곧 키 — 바꾸면 5천 줄의 부품 기록이 따라 바뀐다(ON UPDATE CASCADE). 수정 대신 추가 + 사용 중지 */}
                      <span className="flex justify-center gap-1.5">
                        {admin && <Toggle table="defect_code" keyValue={d.reason} active={d.active} />}
                        {hist(d.reason, d.reason)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}

          {tab === "spec" && (
            <>
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className={TH}>파라미터</th>
                  <th className={`${TH}`}>
                    최소 허용 폭{" "}
                    <span title="LOT 상세의 기준 범위 = 평균 ± max(3σ, 최소 허용 폭)" className="cursor-help">ⓘ</span>
                  </th>
                  <th className={TH}>단위</th>
                  <th className={TH}>작업</th>
                </tr>
              </thead>
              <tbody>
                {specs.map((s) => (
                  <tr key={s.metric} className="border-b last:border-0">
                    <td className={TD}>{SPEC_LABEL[s.metric] ?? s.metric}</td>
                    <td className={`${TD} tabular-nums`}>{s.kind === "pct" ? `평균의 ${(Number(s.value) * 100).toFixed(1)}` : `± ${s.value}`}</td>
                    <td className={TD}>{s.unit}</td>
                    <td className={TD}>
                      <span className="flex justify-center gap-1.5">
                        {admin && (
                          <MasterDialog button="수정" title={`판정 기준 수정 · ${SPEC_LABEL[s.metric] ?? s.metric}`} table="parameter_spec" recordKey={s.metric}>
                            <Field label={s.kind === "pct" ? "평균에 대한 비율 (0.01 = 1%)" : `고정 폭 (${s.unit})`}>
                              <input name="value" type="number" min={0.001} step={0.001} required defaultValue={s.value} className={INPUT} />
                            </Field>
                          </MasterDialog>
                        )}
                        {hist(s.metric, SPEC_LABEL[s.metric] ?? s.metric)}
                      </span>
                    </td>
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
