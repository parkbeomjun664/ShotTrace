// LOT 목록 — 최근 LOT을 훑고 하나를 고른다
// 이 화면이 답하는 질문 (M09): 어느 LOT이 문제였나 · 어디를 눌러야 하나
// M09(정보 위계) · M10(표) · M27(N+1) · 10/26 — 생산 구간 · 수율 상태 · 불량만 · 정렬 · 줄 클릭
// 🔵 거르기 · 정렬 상태는 주소(?defect=1&sort=yield&dir=asc)에 — 새로고침 · 공유해도 같은 화면
// 10/27 — 불량 유형(?reason=가스) · 품질 파레토의 막대 · 표에서 넘어온다. 그 유형이 난 LOT 만 · 많은 순 (029 lot_defect)
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { 같은날, 날짜, 시분, 진행중 } from "@/lib/format";
import { applyList, isDemo, parseListParams, rateOf, yieldLevel, type ListParams, type SortKey } from "@/lib/lots";
import { getLotDefects, getLots } from "@/lib/queries";

const LEVEL_TEXT = { ok: "", warn: "text-status-warn", bad: "text-status-bad" } as const;
const LEVEL_DOT = { ok: "", warn: "bg-status-warn", bad: "bg-status-bad" } as const;

function href(p: ListParams) {                         // 상태 → 주소. 기본값은 주소에 안 적는다
  const q = new URLSearchParams();
  if (p.defectOnly) q.set("defect", "1");
  if (p.reason) q.set("reason", p.reason);
  if (p.sort !== (p.reason ? "reason" : "start")) q.set("sort", p.sort);   // 기본 정렬 — 유형이 있으면 그 유형이 많은 순
  if (p.dir !== "desc") q.set("dir", p.dir);
  const s = q.toString();
  return s ? `/lots?${s}` : "/lots";
}

function 구간(start: string, end: string) {            // 생산 구간 — 날짜 시:분 ~ 시:분 (자정을 넘기면 끝에도 날짜)
  if (진행중(end)) return `${날짜(start)} ${시분(start)} ~ 진행 중`;
  return `${날짜(start)} ${시분(start)} ~ ${같은날(start, end) ? "" : `${날짜(end)} `}${시분(end)}`;
}

export default async function Page({ searchParams }: PageProps<"/lots">) {
  const p = parseListParams(await searchParams);       // 🔴 Next 15+ 는 Promise — await
  const [all, counts] = await Promise.all([
    getLots(),                                         // 26건 — 다 받아 거르기 · 정렬은 순수함수가 (lib/lots.ts)
    p.reason ? getLotDefects(p.reason) : Promise.resolve(new Map<string, number>()),   // 유형이 있을 때만 — LOT → 그 유형 건수
  ]);
  const countOf = (l: { lot_id: string }) => counts.get(l.lot_id) ?? 0;
  const lots = applyList(all, p, countOf);

  // 정렬 머리 — 같은 열을 다시 누르면 방향이 바뀐다. 새 열은 "나쁜 쪽 먼저"(수율 오름 · 불량 내림 · 구간 최신)
  const sortHead = (key: SortKey, label: string) => {   // 정렬은 globals.css 의 th · td 가운데 (10/27)
    const on = p.sort === key;
    const first = key === "yield" ? "asc" : "desc";
    const dir = on ? (p.dir === "asc" ? "desc" : "asc") : first;
    return (
      <th className="px-4 py-2 font-medium" aria-sort={on ? (p.dir === "asc" ? "ascending" : "descending") : undefined}>
        <Link href={href({ ...p, sort: key, dir })} className={`hover:text-foreground ${on ? "text-foreground" : ""}`}>
          {label}
          {on ? (p.dir === "asc" ? " ↑" : " ↓") : ""}
        </Link>
      </th>
    );
  };

  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">LOT 목록</h1>
      <p className="mt-1 text-base text-muted-foreground">
        총 {all.length}건 · 누르면 그때 설비 상태
      </p>

      {/* 거르기 — 하나뿐. 기간 · 소량 숨김은 뺐다 (3주 데이터 · 1개짜리 LOT 은 경계 문제의 흔적이라 숨기지 않는다) */}
      <div className="mt-6 flex items-center gap-3 text-sm">
        <Link
          href={href({ ...p, defectOnly: !p.defectOnly })}
          aria-pressed={p.defectOnly}
          className={`rounded-full border px-3 py-1 transition-colors ${
            p.defectOnly ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
          }`}
        >
          {p.defectOnly ? "✓ " : ""}불량 있는 LOT만
        </Link>
        {/* 불량 유형 — 품질 파레토에서 왔을 때만. ✕ 로 풀면 원래 목록 (정렬이 유형 순이었으면 기본으로) */}
        {p.reason && (
          <Link
            href={href({ ...p, reason: null, sort: p.sort === "reason" ? "start" : p.sort })}
            aria-label={`불량 유형 ${p.reason} 거르기 풀기`}
            className="rounded-full border border-foreground bg-foreground px-3 py-1 text-background transition-colors hover:bg-foreground/80"
          >
            불량 유형: {p.reason} ✕
          </Link>
        )}
        {(p.defectOnly || p.reason) && <span className="text-muted-foreground">{lots.length}건</span>}
      </div>

      {lots.length === 0 ? (
        // 빈 결과 — 무엇을 하면 되는지까지
        <div className="mt-6 rounded-xl border p-10 text-center">
          <p className="text-sm text-muted-foreground">조건에 맞는 LOT가 없어요</p>
          <Link href="/lots" className="mt-3 inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
            필터 초기화
          </Link>
        </div>
      ) : (
        // 넓은 표는 자기 안에서 가로 스크롤한다 — 페이지가 밀리지 않게 (M10)
        <div className="mt-4 overflow-x-auto rounded-xl border">
          {/* 🔴 주석을 <table> 뒤에 두면 공백이 "글자" 로 들어간다 — 그래서 여기 */}
          <table className="w-full whitespace-nowrap text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">LOT</th>
                <th className="px-4 py-2 font-medium">제품</th>
                {sortHead("start", "생산 구간")}
                <th className="px-4 py-2 font-medium">생산</th>
                {sortHead("fail", "불량")}
                {p.reason && sortHead("reason", p.reason)}
                {sortHead("yield", "수율")}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => {
                const rate = rateOf(lot);
                const lv = yieldLevel(rate);
                return (
                  // 줄 전체가 링크 — 진짜 링크는 LOT 칸 하나, after:inset-0 으로 줄 전체를 덮는다 (키보드 · 화면 읽기에도 링크 하나)
                  <tr key={lot.lot_id} className="relative border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-2.5 font-mono">
                      <Link href={`/lots/${lot.lot_id}`} className="after:absolute after:inset-0">
                        {lot.lot_id}
                      </Link>
                      {isDemo(lot.plan_date) && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-sans text-xs text-muted-foreground">
                          시연
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {lot.product?.car_model} {lot.product?.side}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{구간(lot.started_at, lot.ended_at)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{lot.total_qty.toLocaleString()}</td>
                    {/* 불량 0은 흐리게 — 눈이 0이 아닌 곳에 먼저 가야 한다 (M09) */}
                    <td className={`px-4 py-2.5 tabular-nums ${lot.fail_qty > 0 ? "font-medium" : "text-muted-foreground"}`}>
                      {lot.fail_qty}
                    </td>
                    {p.reason && <td className="px-4 py-2.5 font-medium tabular-nums">{countOf(lot)}</td>}
                    {/* 수율 상태 — 95 이상 기본 · 90 이상 주의 · 그 아래 나쁨. 색 + 점 (색만으로 구분하지 않게 숫자가 뜻을 진다) */}
                    <td className={`px-4 py-2.5 tabular-nums ${lv ? LEVEL_TEXT[lv] : ""}`}>
                      {lv && lv !== "ok" && <span aria-hidden className={`mr-1.5 inline-block size-1.5 rounded-full align-middle ${LEVEL_DOT[lv]}`} />}
                      {rate === null ? "—" : `${rate.toFixed(2)}%`}
                    </td>
                    <td className="pr-3 text-muted-foreground">
                      <ChevronRight aria-hidden className="size-4" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
