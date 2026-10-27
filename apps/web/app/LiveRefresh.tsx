"use client";   // 🔴 반드시 1행. 위에 코드가 있으면 지시어로 안 읽힌다 (주석은 괜찮다)

// 실시간 신호 담당 — 알림을 받아 "서버야 다시 그려줘" 만 하고, 연결 상태를 보여준다
// 🔵 숫자를 계산하는 코드가 한 줄도 없다. 집계는 계속 DB 가 한다 (ADR 008)

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { 날짜, 시분 } from "@/lib/format";
import { receiveState, 전 } from "@/lib/receive";      // 무엇을 보여줄지는 순수함수가 정한다 (테스트 · 10/26)
import { supabase } from "@/lib/supabase/client";     // 🔴 server.ts 아니다 — 연결은 브라우저가 든다

export function LiveRefresh({ lastAt }: { lastAt?: string | null }) {   // lastAt — 마지막 수신 (현황판만 넘긴다)
  const router = useRouter();
  const dirty = useRef(false);                        // 🔵 메모지 — 바뀌어도 화면을 다시 안 그린다
  const [연결, set연결] = useState(false);              // 🔵 이건 화면에 보여야 하니 useState
  // 🔴 지금 시각도 상태로 — 그리는 도중 Date.now() 를 부르면 그릴 때마다 값이 달라진다 (10/27 린트)
  //    초기값 함수는 처음 한 번만 돈다 · 아래 1초 타이머가 같이 갱신해 "N분 전" 이 저절로 늘어난다
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const channel = supabase
      .channel("shot_part-changes")                   // 채널 이름은 자유 — 구분용
      .on(
        "postgres_changes",                           // DB 행 변경 알림 (Broadcast·Presence 아님)
        { event: "*", schema: "public", table: "shot_part" },   // 🔴 upsert 는 UPDATE 로도 온다
        () => {
          dirty.current = true;                       // 🔵 여기서 조회하지 않는다. 표시만 남긴다
        },
      )
      .subscribe((status) => {
        console.log("[realtime]", status);
        set연결(status === "SUBSCRIBED");             // 화면의 ● 수신 중 / ○ 연결 끊김
        if (status === "SUBSCRIBED") dirty.current = true;
      });   // 🔴 붙는 순간 한 번 받아온다. 끊긴 동안 놓친 알림은 다시 안 온다
            //    첫 연결의 틈 메우기와 재연결 복구를 이 한 줄이 같이 한다

    const timer = setInterval(() => {
      setNow(Date.now());
      if (!dirty.current) return;                     // 조용하면 아무것도 안 한다
      dirty.current = false;                          // 🔴 먼저 끈다. 켠 채로 두면 매초 조회한다
      router.refresh();                               // 서버를 다시 그린다 = 값은 DB 에서 온다
    }, 1000);                                         // 사람 눈에는 1초면 "살아 있다"

    return () => {                                    // 🔴 화면을 떠날 때 치운다
      clearInterval(timer);
      supabase.removeChannel(channel);                //    안 치우면 구독이 쌓여 알림이 2배·3배
    };
  }, [router]);

  // 🔴 색만으로 구분하지 않는다 — 글자가 뜻을 지고 색은 거든다
  // 🔵 한 줄 · 한 상태 (10/26) — 연결은 살아 있어도 데이터는 끊길 수 있다. 끊기면 "연결됨" 은 지우고 끊김만
  const { kind, minutes } = receiveState({ connected: 연결, lastAt, now });

  if (kind === "stale" && lastAt && minutes !== null) {
    return (
      <p className="text-xs text-orange-700 dark:text-orange-400">
        ● 수신 끊김 · 마지막 수신 {날짜(lastAt)} {시분(lastAt)} ({전(minutes)}) — 수집기나 설비를 확인하세요
      </p>
    );
  }
  return (
    <p className={kind === "live" ? "text-xs text-emerald-700 dark:text-emerald-400" : "text-xs text-muted-foreground"}>
      {kind === "live" ? "● 실시간 연결됨" : "○ 연결 끊김"}
    </p>
  );
}
