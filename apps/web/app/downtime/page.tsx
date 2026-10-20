import { 날짜, 분길이, 시각 } from "@/lib/format";
import { getDowntimeReasons, getEquipments, getRecentDowntimes } from "@/lib/queries";

import DowntimeForm from "./DowntimeForm";           // 우체통이 필요한 폼만 클라이언트

export default async function Page() {               // 비가동 (M23 · 017) — OEE 가용성의 재료
  const [equipments, reasons, downtimes] = await Promise.all([getEquipments(), getDowntimeReasons(), getRecentDowntimes()]);   // 세 번 읽기를 동시에

  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">비가동</h1>
      <p className="mt-2 text-sm text-muted-foreground">설비가 멈춘 시간과 이유를 기록한다. 끝난 비가동만 적는다.</p>

      <DowntimeForm equipments={equipments} reasons={reasons} requestId={crypto.randomUUID()} /> {/* 그릴 때마다 새 번호표 */}

      <h2 className="mt-10 text-lg font-semibold">최근 비가동</h2>
      {downtimes.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">아직 기록이 없습니다</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="py-2 pr-4 font-medium">설비</th>
              <th className="py-2 pr-4 font-medium">사유</th>
              <th className="py-2 pr-4 font-medium">시작</th>
              <th className="py-2 pr-4 text-right font-medium">분</th>
              <th className="py-2 font-medium">메모</th>
            </tr>
          </thead>
          <tbody>
            {downtimes.map((d) => (
              <tr key={d.downtime_id} className="border-b last:border-0">
                <td className="py-2 pr-4 font-mono">{d.equip_cd}</td>
                <td className="py-2 pr-4">{d.downtime_reason?.name}</td>{/* FK 를 따라 온 이름 — 표에는 코드뿐 */}
                <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                  {날짜(d.started_at)} {시각(d.started_at)}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">{분길이(d.started_at, d.ended_at)}</td>
                <td className="py-2 text-muted-foreground">{d.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
