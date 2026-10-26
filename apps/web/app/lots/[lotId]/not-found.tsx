// 없는 LOT 번호 — page.tsx 의 notFound() 가 여기로 온다. 공통 404 보다 가까워서 이게 이긴다 (10/27)
import Link from "next/link";

import { HomeLink, Notice, PRIMARY } from "../../Notice";

export default function LotNotFound() {
  return (
    <Notice
      tag="404"
      title="해당 LOT을 찾을 수 없습니다"
      actions={
        <>
          <Link href="/lots" className={PRIMARY}>
            LOT 목록으로
          </Link>
          <HomeLink />
        </>
      }
    >
      LOT 번호가 잘못됐거나 아직 열리지 않은 LOT이에요.
    </Notice>
  );
}
