"use client";

import { useEffect, useState, useTransition } from "react";
import { loadMenuSales, type MenuResult } from "@/app/(app)/sales/menu/actions";
import { GROUP_LABEL, man, type Group, type StoreMenu } from "@/lib/menuSales";

const short = (n: string) => n.replace(/^제이드앤워터\s*/, "").replace(/^정다미\s*/, "정다미 ");
const GROUPS: Group[] = ["food", "beverage", "wine", "dessert", "set"];

export default function MenuSalesClient({ isMaster }: { isMaster: boolean }) {
  const [res, setRes] = useState<MenuResult | null>(null);
  const [loading, start] = useTransition();
  const [tab, setTab] = useState<"summary" | "upsell" | "items">("summary");
  const [pick, setPick] = useState<string | null>(null);
  useEffect(() => {
    start(async () => setRes(await loadMenuSales(28)));
  }, []);
  if (!res) return <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted">{loading ? "메뉴 판매를 모으는 중..." : ""}</p>;
  if (!res.ok) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{res.error}</p>;
  const menus = res.menus.filter((m) => m.sales > 0);
  if (!menus.length) return <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted">아직 메뉴별 판매가 쌓이지 않았어요. 효율 분석에서 &lsquo;최근 8주 동기화&rsquo;를 누르면 채워져요.</p>;
  const current = menus.find((m) => m.storeId === pick) ?? menus[0];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 rounded-xl bg-background p-1 text-xs font-semibold">
        {(["summary", "upsell", "items"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-lg py-2 ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted"}`}>
            {t === "summary" ? "매장 비교" : t === "upsell" ? "업셀링" : "메뉴별"}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted">
        {res.from.slice(5).replace("-", "/")}~{res.to.slice(5).replace("-", "/")} · 메뉴 실판매액 기준(할인 반영, 배달 포함)
      </p>

      {tab === "summary" && <SummaryTable menus={menus} />}

      {tab !== "summary" && menus.length > 1 && isMaster && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
          {menus.map((m) => (
            <button key={m.storeId} type="button" onClick={() => setPick(m.storeId)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${current.storeId === m.storeId ? "bg-brand text-white" : "border border-border bg-card"}`}>
              {short(m.name)}
            </button>
          ))}
        </div>
      )}
      {tab === "upsell" && <UpsellCard u={res.upsell.find((x) => x.storeId === current.storeId) ?? null} m={current} others={menus.filter((m) => m.storeId !== current.storeId)} />}
      {tab === "items" && <ItemsTable m={current} />}
    </div>
  );
}

function SummaryTable({ menus }: { menus: StoreMenu[] }) {
  const rows: { label: string; v: (m: StoreMenu) => number | null; fmt: (n: number | null) => string; hiGood?: boolean }[] = [
    { label: "매출", v: (m) => m.sales, fmt: (n) => (n == null ? "-" : man(n)) },
    { label: "주문 수", v: (m) => m.orders, fmt: (n) => (n == null ? "-" : n.toLocaleString("ko-KR")) },
    { label: "객단가(주문당)", v: (m) => m.perOrder, fmt: (n) => (n == null ? "-" : man(n)) },
    ...GROUPS.map((g) => ({ label: `${GROUP_LABEL[g]} 비중`, v: (m: StoreMenu) => m.byGroup[g].share * 100, fmt: (n: number | null) => (n == null ? "-" : n.toFixed(0) + "%") })),
    ...(["beverage", "wine", "dessert", "set"] as Group[]).map((g) => ({ label: `주문당 ${GROUP_LABEL[g]}`, v: (m: StoreMenu) => m.byGroup[g].perOrder, fmt: (n: number | null) => (n == null ? "-" : n.toFixed(2)) })),
    { label: "0원 항목", v: (m) => m.zeroItems, fmt: (n) => (n == null ? "-" : String(n)) },
  ];
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-[11px] tabular-nums">
        <thead>
          <tr className="text-left text-muted">
            <th className="px-3 py-2 font-medium">항목</th>
            {menus.map((m) => (
              <th key={m.storeId} className="px-2 py-2 text-right font-medium whitespace-nowrap">
                {short(m.name)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const vals = menus.map((m) => r.v(m));
            const nums = vals.filter((v): v is number => v != null);
            const hi = nums.length > 1 ? Math.max(...nums) : null;
            const lo = nums.length > 1 ? Math.min(...nums) : null;
            return (
              <tr key={r.label} className="border-t border-border">
                <td className="px-3 py-1.5 text-muted whitespace-nowrap">{r.label}</td>
                {vals.map((v, i) => (
                  <td key={i} className={`px-2 py-1.5 text-right font-semibold ${v != null && v === hi && hi !== lo ? "text-green-700" : v != null && v === lo && hi !== lo ? "text-red-600" : ""}`}>
                    {r.fmt(v)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[10px] text-muted">초록 = 매장 중 최고, 빨강 = 최저</p>
    </div>
  );
}

function UpsellCard({ u, m, others }: { u: { monthly: number; items: { group: Group; mine: number; others: number; best: { name: string; v: number } | null; monthly: number; text: string }[]; strengths: string[] } | null; m: StoreMenu; others: StoreMenu[] }) {
  if (!others.length) return <p className="rounded-2xl border border-border bg-card p-4 text-xs text-muted">비교할 다른 매장의 메뉴 자료가 아직 없어요.</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-brand bg-card p-4">
        <p className="text-xs text-muted">{short(m.name)} · 다른 매장 평균 수준으로 팔면</p>
        <p className="text-xl font-bold">월 약 {u ? man(u.monthly) : "0"}원 더</p>
        {u?.strengths.length ? <p className="mt-1 text-[11px] text-green-700">강점: {u.strengths.join(" · ")}</p> : null}
      </div>
      {u?.items.length ? (
        <ol className="flex flex-col gap-2">
          {u.items.map((it, i) => (
            <li key={it.group} className="rounded-2xl border border-border bg-card p-3">
              <p className="text-sm font-semibold">
                <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">{i + 1}</span>
                주문당 {GROUP_LABEL[it.group]} 늘리기 · 월 {man(it.monthly)}원
              </p>
              <p className="mt-1 text-xs leading-snug">{it.text}</p>
              {it.best && <p className="mt-0.5 text-[11px] text-muted">가장 잘 파는 매장: {short(it.best.name)} (주문 100건당 {Math.round(it.best.v * 100)}개)</p>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-2xl border border-border bg-card p-4 text-xs text-green-700">세트·주류·디저트·음료 모두 다른 매장 평균 이상이에요.</p>
      )}
    </div>
  );
}

function ItemsTable({ m }: { m: StoreMenu }) {
  const [g, setG] = useState<Group | "all">("all");
  const list = m.topItems.filter((it) => g === "all" || it.group === g);
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-3 pt-3">
        {(["all", ...GROUPS] as const).map((k) => (
          <button key={k} type="button" onClick={() => setG(k)} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${g === k ? "bg-brand text-white" : "border border-border"}`}>
            {k === "all" ? "전체" : GROUP_LABEL[k]}
          </button>
        ))}
      </div>
      <table className="mt-2 w-full text-[11px] tabular-nums">
        <thead>
          <tr className="text-left text-muted">
            <th className="px-3 py-1.5 font-medium">메뉴</th>
            <th className="px-2 py-1.5 text-right font-medium">수량</th>
            <th className="px-3 py-1.5 text-right font-medium">매출</th>
          </tr>
        </thead>
        <tbody>
          {list.map((it) => (
            <tr key={it.name} className="border-t border-border">
              <td className="px-3 py-1.5">
                {it.name}
                <span className="ml-1 text-[9px] text-muted">{GROUP_LABEL[it.group]}</span>
              </td>
              <td className="px-2 py-1.5 text-right">{it.qty}</td>
              <td className="px-3 py-1.5 text-right font-semibold">{man(it.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
