// LOT 목록 — 최근 LOT을 훑고 하나를 고른다
// 담당: M09(정보 위계) · M10(표) · M27(N+1)
import Link from "next/link";

import { getLots } from "@/lib/queries";

export const revalidate = 60;

export default async function Page() {
  const lots = await getLots();

  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">LOT 목록</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {lots.length}건 · 하나를 고르면 그 시간대 설비 상태를 본다
      </p>

      {/* 넓은 표는 자기 안에서 가로 스크롤한다 — 페이지가 밀리지 않게 (M10) */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="py-2 pr-4 font-medium">LOT</th>
              <th className="py-2 pr-4 font-medium">계획일</th>
              <th className="py-2 pr-4 font-medium">제품</th>
              <th className="py-2 pr-4 text-right font-medium">생산</th>
              <th className="py-2 pr-4 text-right font-medium">불량</th>
              <th className="py-2 text-right font-medium">수율</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => {
              const rate = (lot.pass_qty / lot.total_qty) * 100;
              return (
                <tr key={lot.lot_id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono">
                    <Link
                      href={`/lots/${lot.lot_id}`}
                      className="underline underline-offset-4"
                    >
                      {lot.lot_id}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                    {lot.plan_date}
                  </td>
                  <td className="py-2 pr-4">
                    {lot.product?.car_model} {lot.product?.side}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {lot.total_qty.toLocaleString()}
                  </td>
                  {/* 불량 0은 흐리게 — 눈이 0이 아닌 곳에 먼저 가야 한다 (M09) */}
                  <td
                    className={`py-2 pr-4 text-right tabular-nums ${
                      lot.fail_qty > 0 ? "font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {lot.fail_qty}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {rate.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
