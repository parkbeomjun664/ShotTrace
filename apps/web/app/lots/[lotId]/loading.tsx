// 이 파일만 두면 Next가 Suspense 껍데기를 자동으로 씌운다 (M07)
export default function Loading() {
  return (
    <p className="text-sm text-black/40 dark:text-white/40">불러오는 중…</p>
  );
}
