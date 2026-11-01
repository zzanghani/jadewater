import Link from "next/link";
import { MODULE_BY_KEY, MODULES, type ModuleKey } from "@/lib/modules";

// 브랜드가 아직 켜지 않은 기능 모듈 화면으로 들어왔을 때 보여주는 안내.
// (app/(app)/layout.tsx 가 moduleForPath 로 판정해 여기로 보낸다.)
export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const { module } = await searchParams;
  const info = module && module in MODULE_BY_KEY ? MODULE_BY_KEY[module as ModuleKey] : null;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/" className="flex items-center gap-1 text-sm font-medium text-muted">
        <span aria-hidden>←</span> 홈으로
      </Link>

      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs font-semibold text-muted">추가 기능(유료)</p>
        <h1 className="mt-1 text-xl font-bold">{info ? info.name : "아직 켜지지 않은 기능이에요"}</h1>
        <p className="mt-2 text-sm text-muted">
          {info
            ? `${info.summary}. 이 기능은 우리 브랜드에 아직 켜져 있지 않아요.`
            : "이 화면은 추가 기능에 속해 있어서 지금은 쓸 수 없어요."}
        </p>
        {info && (
          <ul className="mt-4 flex list-disc flex-col gap-1 pl-5 text-sm">
            {info.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
        {info && (
          <p className="mt-4 text-sm">
            매장당 월 <b>{info.priceMonthly.toLocaleString()}원</b>
            <span className="ml-1 text-xs text-muted">(요금 초안 · 결제 기능 준비 중)</span>
          </p>
        )}
        <p className="mt-4 rounded-lg bg-brand-light px-3 py-2 text-sm text-brand-dark">
          사용을 원하시면 대표님(본사)에게 말씀해 주세요. 본사에서 켜 주면 바로 메뉴에 나타나요.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">추가할 수 있는 기능</h2>
        {MODULES.map((m) => (
          <div key={m.key} className={`rounded-xl border bg-card p-3 text-sm ${m.key === info?.key ? "border-brand" : "border-border"}`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold">{m.name}</span>
              <span className="text-xs text-muted">월 {m.priceMonthly.toLocaleString()}원</span>
            </div>
            <p className="mt-0.5 text-xs text-muted">{m.summary}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
