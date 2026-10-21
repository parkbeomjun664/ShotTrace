// 마스터 — 무엇이 있나. 지우지 않고 사용 중지 · 사유 명단은 admin 만 바꾼다 (M23 · 019)
import { getAllDowntimeReasons, getDefectCodes, getEquipments, getMyRole, getProducts } from "@/lib/queries";

import { setActive } from "./actions";

function Toggle({ table, keyValue, active }: { table: string; keyValue: string; active: boolean }) {   // 버튼 하나짜리 작은 폼 — 줄마다 하나
  return (
    <form action={setActive}>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="key" value={keyValue} />
      <input type="hidden" name="active" value={String(!active)} /> {/* 지금의 반대로 뒤집는다 */}
      <button className="rounded border px-2 py-1 text-xs">{active ? "사용 중지" : "다시 사용"}</button>
    </form>
  );
}

export default async function Page({ searchParams }: PageProps<"/master">) {
  const { denied } = await searchParams;               // ?denied=1 — RLS 에 막혀 0줄이었다
  const [equipments, products, reasons, defects, role] = await Promise.all([
    getEquipments(),
    getProducts(),
    getAllDowntimeReasons(),
    getDefectCodes(),
    getMyRole(),
  ]);
  const admin = role === "admin";                      // 🔴 버튼을 숨기는 건 친절일 뿐 — 막는 건 RLS (019)

  return (
    <section className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">마스터</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          무엇이 있나. 지우지 않고 사용 중지한다. 사유 명단은 admin 만 바꿀 수 있다.
        </p>
        {denied && <p className="mt-2 text-sm text-red-600">바꿀 권한이 없어요 (admin 만 할 수 있어요)</p>}
      </div>

      <div>
        <h2 className="text-lg font-semibold">설비</h2>
        <ul className="mt-2 text-sm">
          {equipments.map((e) => (
            <li key={e.equip_cd} className="py-1">
              <span className="font-mono">{e.equip_cd}</span> · {e.equip_name}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-lg font-semibold">제품</h2>
        <ul className="mt-2 text-sm">
          {products.map((p) => (
            <li key={p.product_id} className="py-1">
              {p.part_name}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-lg font-semibold">비가동 사유</h2>
        <ul className="mt-2 text-sm">
          {reasons.map((r) => (
            <li key={r.code} className={`flex items-center justify-between py-1 ${r.active ? "" : "text-muted-foreground line-through"}`}>
              <span>
                <span className="font-mono">{r.code}</span> · {r.name}
                {r.planned && " (계획)"}
              </span>
              {admin && <Toggle table="downtime_reason" keyValue={r.code} active={r.active} />}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-lg font-semibold">불량 사유</h2>
        <ul className="mt-2 text-sm">
          {defects.map((d) => (
            <li key={d.reason} className={`flex items-center justify-between py-1 ${d.active ? "" : "text-muted-foreground line-through"}`}>
              <span>{d.reason}</span>
              {admin && <Toggle table="defect_code" keyValue={d.reason} active={d.active} />}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
