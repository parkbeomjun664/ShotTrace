import { HomeLink, Notice } from "./Notice";

export default function NotFound() {
  return (
    <Notice tag="404" title="없는 페이지예요" actions={<HomeLink primary />}>
      주소가 바뀌었거나 잘못 입력됐어요. 위 메뉴에서 가려던 화면을 골라 주세요.
    </Notice>
  );
}
