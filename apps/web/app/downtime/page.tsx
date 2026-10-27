// 비가동 (M23 · 017) — OEE 가동률의 재료
// 10/26 재구성 — 하루 타임라인(생산 · 기록된 비가동 · 사유 미입력 정지) · 미입력 정지에 사유 고르기(일괄) · 직접 추가는 모달
//   🔵 미입력 정지는 "추정" 이 아니다 — 샷 간격으로 찾아 보여줄 뿐, 사람이 사유를 고르는 순간 기록이 된다 (026 · ADR 016 의 걱정에 답)
//   시연 데이터(2026)는 기본에서 뺀다 — 다른 화면과 같은 토글 (?demo=1)
import Link from "next/link";

import { PLANNED_CANDIDATE_MIN, dayWindow, hourTicks, isPlannedCandidate, segment, withStops } from "@/lib/downtime";
import { 날짜, 분길이, 시분, 시각 } from "@/lib/format";
import { isDemo } from "@/lib/lots";
import { selectable } from "@/lib/master";
import { aggregateOee } from "@/lib/oee";
import { getDowntimeReasons, getEquipments, getLotOee, getLots, getMyRole, getRecentDowntimes, getUnrecordedStops } from "@/lib/queries";

import { Info } from "../Info";
import { Box, Legend } from "../Legend";
import { AddDowntime } from "./AddDowntime";
import { StopList, type StopItem } from "./StopList";

const kstDay = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 10);   // 시각 → 그 시각의 서울 날짜 'YYYY-MM-DD'
const 길이 = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}시간 ${min % 60}분` : `${min}분`);
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);

// 사유별 색 — 계획 정지는 옅은 파랑 계열, 계획 외는 호박 · 빨강 계열 (생산 막대 primary 와 겹치지 않게)
const REASON_COLOR: Record<string, string> = {
  MOLD_CHANGE: "#93c5fd",
  PM: "#a5b4fc",
  BREAK: "#c7d2fe",
  BREAKDOWN: "#ef4444",
  MATERIAL: "#f59e0b",
  QUALITY: "#fb923c",
};
const HATCH = "repeating-linear-gradient(45deg, #d1d5db 0 4px, transparent 4px 8px)";

export default async function Page({ searchParams }: PageProps<"/downtime">) {
  const sp = await searchParams;
  const showDemo = sp.demo === "1";
  const [equipments, reasons, downtimes, allStops, lots, role, oeeRows] = await Promise.all([
    getEquipments(),
    getDowntimeReasons(),
    getRecentDowntimes(),
    getUnrecordedStops(),
    getLots(),
    getMyRole(),
    getLotOee(),
  ]);
  const readOnly = role !== "worker" && role !== "admin";   // 둘러보기 — 화면은 잠그고, 서버 액션 · RLS 가 진짜로 막는다

  // 시연 데이터는 기본에서 뺀다 — 날짜 탭 · 타임라인 · 목록 모두 같은 규칙
  const keep = (iso: string) => showDemo || !isDemo(kstDay(iso));
  const stops = allStops.filter((s) => s.started_at && keep(s.started_at));
  const lotsShown = lots.filter((l) => keep(l.started_at));
  const demoStops = allStops.length - stops.length;

  // 날짜 — LOT 이 있는 날만 · 오름차순. 기본은 미입력 정지가 가장 긴 날
  const days = [...new Set(lotsShown.map((l) => kstDay(l.started_at)))].sort();
  const stopMinutes = new Map<string, number>();
  for (const s of stops) stopMinutes.set(kstDay(s.started_at!), (stopMinutes.get(kstDay(s.started_at!)) ?? 0) + (s.minutes ?? 0));
  const fallback = [...stopMinutes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? days.at(-1);
  const day = typeof sp.day === "string" && days.includes(sp.day) ? sp.day : fallback;
  const q = (d: string | undefined, demo = showDemo) => {   // 주소 — 날짜 · 시연 토글을 함께 들고 다닌다
    const u = new URLSearchParams();
    if (d) u.set("day", d);
    if (demo) u.set("demo", "1");
    const t = u.toString();
    return `/downtime${t ? `?${t}` : ""}`;
  };

  // 그날의 막대들 — 마스터의 모든 설비를 한 줄씩 (그날 생산이 없으면 "생산 없음")
  const dayLots = lotsShown.filter((l) => kstDay(l.started_at) === day && l.ended_at !== "infinity");
  const win = dayWindow(dayLots.map((l) => ({ start: Date.parse(l.started_at), end: Date.parse(l.ended_at) })));
  const bar = (s: string, e: string) => (win ? segment(win, { start: Date.parse(s), end: Date.parse(e) }) : null);
  const ticks = win ? hourTicks(win) : [];
  const dayReasons = [...new Set(downtimes.filter((d) => kstDay(d.started_at) === day).map((d) => d.reason_code))];   // 범례 — 그날 막대에 실제로 나온 사유만
  const anchor = (equip: string, startedAt: string) => `stop-${equip}-${Date.parse(startedAt)}`;   // 빗금 → 목록 줄

  // 목록 — 240분 이상은 계획 정지 후보로 따로
  const toItem = (s: (typeof stops)[number]): StopItem => ({
    key: `${s.equip_cd}|${s.started_at}`,
    anchor: anchor(s.equip_cd!, s.started_at!),
    equipCd: s.equip_cd!,
    lotId: s.lot_id!,
    range: `${날짜(s.started_at!)} ${시분(s.started_at!)} ~ ${시분(s.ended_at!)}`,
    minutes: s.minutes ?? 0,
  });
  const candidates = stops.filter((s) => isPlannedCandidate(s.minutes ?? 0)).map(toItem);
  const unrecorded = stops.filter((s) => !isPlannedCandidate(s.minutes ?? 0)).map(toItem);
  const plannedFirst = [...reasons].sort((a, b) => Number(b.planned) - Number(a.planned));   // 후보 섹션은 계획 사유를 위에

  // 요약 — 모두 기록하면 가동률이 얼마가 되나 (KAMP LOT 만 · OEE 화면과 같은 가중 합산)
  const minutesByLot = new Map<string, number>();
  for (const s of stops.filter((x) => !isPlannedCandidate(x.minutes ?? 0))) minutesByLot.set(s.lot_id!, (minutesByLot.get(s.lot_id!) ?? 0) + (s.minutes ?? 0));
  const kampInputs = oeeRows.filter((r) => !isDemo(lots.find((l) => l.lot_id === r.lot_id)?.plan_date ?? "")).map((r) => r.input);
  const now = aggregateOee(kampInputs).availability;
  const after = aggregateOee(
    oeeRows
      .filter((r) => !isDemo(lots.find((l) => l.lot_id === r.lot_id)?.plan_date ?? ""))
      .map((r) => withStops(r.input, minutesByLot.get(r.lot_id) ?? 0)),
  ).availability;
  const totalMin = unrecorded.reduce((a, s) => a + s.minutes, 0);

  return (
    <section className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">비가동</h1>
          <p className="mt-2 text-base text-muted-foreground">설비가 멈춘 시간과 이유 · 찾은 정지는 사유만 고르면 끝</p>
        </div>
        <div className="flex items-center gap-2">
          {demoStops > 0 || lots.some((l) => isDemo(l.plan_date)) ? (
            <Link
              href={q(undefined, !showDemo)}
              aria-pressed={showDemo}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${showDemo ? "border-foreground bg-foreground text-background" : "hover:bg-muted"}`}
            >
              {showDemo ? "✓ " : ""}시연 포함
            </Link>
          ) : null}
          <AddDowntime equipments={selectable(equipments)} reasons={reasons} requestId={crypto.randomUUID()} readOnly={readOnly} />
        </div>
      </div>

      {/* 1 — 하루 타임라인. 3주를 한 줄에 그리면 10분짜리 멈춤이 1px 도 안 된다 */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">타임라인</h2>
          {/* 날짜 고르기 — 링크라 주소에 남는다 (?day=) */}
          <div className="flex flex-wrap gap-1 text-sm">
            {days.map((d) => (
              <Link
                key={d}
                href={q(d)}
                aria-current={d === day ? "date" : undefined}
                className={`rounded px-2 py-0.5 tabular-nums ${d === day ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}
              >
                {d.slice(5).replace("-", ".")}
                {stopMinutes.get(d) ? " •" : ""}
              </Link>
            ))}
          </div>
        </div>
        {/* 범례 — 긴 "A = B" 문장 대신 막대와 같은 색 견본 (10/27) */}
        <Legend
          className="mt-2"
          items={[
            { mark: <Box className="bg-primary/80" />, label: "생산" },
            ...dayReasons.map((c) => ({
              mark: <Box style={{ background: REASON_COLOR[c] ?? "#9ca3af" }} />,
              label: reasons.find((x) => x.code === c)?.name ?? c,
            })),
            { mark: <Box className="border border-gray-400" style={{ background: HATCH }} />, label: "사유 미입력 (누르면 목록)" },
            { mark: <span className="text-base leading-none text-foreground">•</span>, label: "미입력 있는 날" },
          ]}
        />

        {win ? (
          <div className="mt-3 space-y-3 rounded-xl border p-4">
            {equipments.map((e) => {
              const prod = dayLots.filter((l) => l.equip_cd === e.equip_cd);
              const down = downtimes.filter((d) => d.equip_cd === e.equip_cd && kstDay(d.started_at) === day);
              const gaps = stops.filter((s) => s.equip_cd === e.equip_cd && kstDay(s.started_at!) === day);
              return (
                <div key={e.equip_cd} className="flex items-center gap-3">
                  <span className="w-12 shrink-0 font-mono text-sm">{e.equip_cd}</span>
                  {prod.length === 0 ? (
                    <span className="flex h-7 flex-1 items-center rounded bg-muted/30 px-3 text-xs text-muted-foreground">생산 없음</span>
                  ) : (
                    <div className="relative h-7 flex-1 rounded bg-muted/50">
                      {prod.map((l) => {
                        const p = bar(l.started_at, l.ended_at);
                        return p && (
                          <div
                            key={l.lot_id}
                            title={`${l.lot_id} · ${시분(l.started_at)} ~ ${시분(l.ended_at)} · ${길이(분길이(l.started_at, l.ended_at))}`}
                            className="absolute inset-y-1.5 rounded-sm bg-primary/80"
                            style={{ left: `${p.left}%`, width: `${p.width}%` }}
                          />
                        );
                      })}
                      {down.map((d) => {
                        const p = bar(d.started_at, d.ended_at);
                        return p && (
                          <div
                            key={d.downtime_id}
                            title={`${d.downtime_reason?.name} · ${시분(d.started_at)} ~ ${시분(d.ended_at)} · ${길이(분길이(d.started_at, d.ended_at))}`}
                            className="absolute inset-y-0 rounded-sm"
                            style={{ left: `${p.left}%`, width: `${p.width}%`, background: REASON_COLOR[d.reason_code] ?? "#9ca3af" }}
                          />
                        );
                      })}
                      {gaps.map((g) => {
                        const p = bar(g.started_at!, g.ended_at!);
                        return p && (
                          <a
                            key={g.started_at}
                            href={`#${anchor(g.equip_cd!, g.started_at!)}`}
                            title={`사유 미입력 · ${시분(g.started_at!)} ~ ${시분(g.ended_at!)} · ${길이(g.minutes ?? 0)}`}
                            aria-label={`사유 미입력 정지 ${시분(g.started_at!)} — 목록으로`}
                            className="absolute inset-y-0 rounded-sm border border-gray-400 hover:border-gray-700"
                            style={{ left: `${p.left}%`, width: `${p.width}%`, background: HATCH }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {/* x 축 — 정시마다 눈금 (HH:00) */}
            <div className="flex items-center gap-3">
              <span className="w-12 shrink-0" />
              <div className="relative h-4 flex-1">
                {ticks.map((t) => {
                  const p = segment(win, { start: t, end: t + 1 });
                  return p && (
                    <span key={t} className="absolute -translate-x-1/2 text-xs tabular-nums text-muted-foreground" style={{ left: `${p.left}%` }}>
                      {시분(new Date(t).toISOString())}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-xl border p-8 text-center text-sm text-muted-foreground">이 날은 생산 기록이 없어요</p>
        )}
      </div>

      {/* 2 — 사유 미입력 정지. LOT 안에서 샷 사이가 표준 CT × 5 를 넘은 곳 · 기록된 비가동과 안 겹치는 것만 */}
      <div>
        <h2 className="font-semibold">사유 미입력 정지</h2>
        <p className="mt-1 text-sm tabular-nums text-muted-foreground">
          미입력 {unrecorded.length}건 · 총 {길이(totalMin)}
          {unrecorded.length > 0 && ` · 모두 기록하면 가동률 약 ${pct(after)} (지금 ${pct(now)})`}
        </p>
        <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
          기록해도 OEE는 그대로
          <Info id="stop-oee" label="기록해도 OEE 가 그대로인 이유">
            <p>멈춘 시간은 이미 성능 손실(느리게 돈 시간)에 들어가 있어요.</p>
            <p>사유를 고르면 그 시간이 가동률 손실로 옮겨 갈 뿐, 곱한 OEE 는 같아요.</p>
          </Info>
        </div>
        {unrecorded.length === 0 ? (
          <p className="mt-3 rounded-xl border p-8 text-center text-sm text-muted-foreground">사유를 기다리는 정지가 없어요</p>
        ) : (
          <StopList items={unrecorded} reasons={reasons} readOnly={readOnly} />
        )}
      </div>

      {/* 2' — 계획 정지 후보. 이만큼 길면 교대 · 휴식 · 점검일 가능성이 크다 — 계획 사유로 고르면 OEE 계획 시간에서 빠진다 */}
      {candidates.length > 0 && (
        <div>
          <h2 className="font-semibold">
            계획 정지 후보 <span className="font-normal text-muted-foreground">({PLANNED_CANDIDATE_MIN}분 이상)</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">계획 사유를 고르면 OEE 계산에서 빠져요</p>
          <StopList items={candidates} reasons={plannedFirst} readOnly={readOnly} />
        </div>
      )}

      {/* 3 — 기록된 비가동 (직접 입력 · 샷 간격에 사유를 고른 것) */}
      <div>
        <h2 className="font-semibold">기록된 비가동</h2>
        {downtimes.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">아직 기록이 없어요</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">설비</th>
                <th className="px-4 py-2 font-medium">사유</th>
                <th className="px-4 py-2 font-medium">시작</th>
                <th className="px-4 py-2 font-medium">분</th>
                <th className="px-4 py-2 font-medium">출처</th>
                <th className="px-4 py-2 font-medium">메모</th>
              </tr>
            </thead>
            <tbody>
              {downtimes.map((d) => (
                <tr key={d.downtime_id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono">{d.equip_cd}</td>
                  <td className="px-4 py-2">{d.downtime_reason?.name}</td>{/* FK 를 따라 온 이름 — 표에는 코드뿐 */}
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">
                    {날짜(d.started_at)} {시각(d.started_at)}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{분길이(d.started_at, d.ended_at)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{d.source === "inferred" ? "샷 간격" : "직접 입력"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{d.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
