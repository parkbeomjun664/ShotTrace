"use client";   // 🔴 반드시 1행. 위에 코드가 있으면 지시어로 안 읽힌다 (주석은 괜찮다)

// 실시간 신호 담당 — 알림을 받아 "서버야 다시 그려줘" 만 한다 (M18)
// 🔵 숫자를 계산하는 코드가 한 줄도 없다. 집계는 계속 DB 가 한다 (ADR 008)

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { supabase } from "@/lib/supabase/client";     // 🔴 server.ts 아니다 — 연결은 브라우저가 든다

export function LiveRefresh() {
  const router = useRouter();
  const dirty = useRef(false);                        // 🔵 메모지. 바뀌어도 화면을 다시 안 그린다
                                                      //    useState 였으면 1초에 6번 다시 그려진다
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
        console.log("[realtime]", status);           // 수요일의 ● 수신 중 표시에 쓸 재료
        if (status === "SUBSCRIBED") dirty.current = true;
      });   // 🔴 붙는 순간 한 번 받아온다. 끊긴 동안 놓친 알림은 다시 안 온다
            //    첫 연결의 틈 메우기와 재연결 복구를 이 한 줄이 같이 한다

    const timer = setInterval(() => {
      if (!dirty.current) return;                     // 조용하면 아무것도 안 한다
      dirty.current = false;                          // 🔴 먼저 끈다. 켠 채로 두면 매초 조회한다
      router.refresh();                               // 서버를 다시 그린다 = 값은 DB 에서 온다
    }, 1000);                                         // 사람 눈에는 1초면 "살아 있다"

    return () => {                                    // 🔴 화면을 떠날 때 치운다
      clearInterval(timer);
      supabase.removeChannel(channel);                //    안 치우면 구독이 쌓여 알림이 2배·3배
    };
  }, [router]);

  return null;                                        // 보이는 건 없다 — 신호만 담당하는 부품
}
