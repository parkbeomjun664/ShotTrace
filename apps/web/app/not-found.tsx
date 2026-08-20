import Link from "next/link";

export default function NotFound() {
  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">404</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        없는 경로입니다.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block text-sm underline underline-offset-4"
      >
        현황판으로
      </Link>
    </section>
  );
}
