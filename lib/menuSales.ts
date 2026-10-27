// 메뉴 판매 비교 + 업셀링 (운영관리 앱 "매장 매출 › 메뉴 판매 / 업셀링"): toss_daily_items(메뉴별 판매)로 매장을 나란히 본다.
import { splitCategories } from "@/lib/tossClosing";

export type Group = "food" | "beverage" | "wine" | "dessert" | "set" | "other";
export const GROUP_LABEL: Record<Group, string> = { food: "음식", beverage: "음료", wine: "주류", dessert: "디저트", set: "세트", other: "기타" };
const DESSERT_RE = /디저트|dessert|케이크|cake|젤라또|gelato|아이스크림|타르트|tart|푸딩|티라미수|빵|브레드|bread/i;
const SET_RE = /세트|set|코스|course|정식|콤보|combo|런치|lunch\s*set/i;

export function groupOf(name: string, category: string): Group {
  const text = `${category} ${name}`;
  if (SET_RE.test(category) || SET_RE.test(name)) return "set";
  if (DESSERT_RE.test(text)) return "dessert";
  const s = splitCategories({ [category || name]: 1 });
  if (s.wine) return "wine";
  if (s.beverage) return "beverage";
  if (!category) return "other";
  return "food";
}

export type ItemRow = { store_id: string; name: string; category: string; qty: number; amount: number; orders: number };
export type StoreMenu = {
  storeId: string;
  name: string;
  sales: number; // 메뉴 실판매액 합
  orders: number; // 결제 주문 수
  qty: number;
  perOrder: number | null; // 객단가(주문당)
  byGroup: Record<Group, { amount: number; qty: number; share: number; perOrder: number | null; avgPrice: number | null }>;
  zeroItems: number; // 0원 항목 수
  topItems: { name: string; group: Group; qty: number; amount: number }[];
};
export type Upsell = {
  storeId: string;
  name: string;
  monthly: number; // 다른 매장 평균 수준이면 월 약 N원 더
  items: { group: Group; mine: number; others: number; best: { name: string; v: number } | null; monthly: number; text: string }[];
  strengths: string[];
};

export function buildStoreMenus(stores: { id: string; name: string; orders: number }[], items: ItemRow[]): StoreMenu[] {
  const byStore = new Map<string, ItemRow[]>();
  for (const it of items) (byStore.get(it.store_id) ?? byStore.set(it.store_id, []).get(it.store_id)!).push(it);
  return stores.map((s) => {
    const rows = byStore.get(s.id) ?? [];
    const agg = new Map<string, { group: Group; qty: number; amount: number }>();
    for (const r of rows) {
      const a = agg.get(r.name) ?? { group: groupOf(r.name, r.category), qty: 0, amount: 0 };
      a.qty += r.qty;
      a.amount += r.amount;
      agg.set(r.name, a);
    }
    const sales = [...agg.values()].reduce((x, a) => x + a.amount, 0);
    const qty = [...agg.values()].reduce((x, a) => x + a.qty, 0);
    const byGroup = {} as StoreMenu["byGroup"];
    for (const g of Object.keys(GROUP_LABEL) as Group[]) {
      const list = [...agg.values()].filter((a) => a.group === g);
      const amount = list.reduce((x, a) => x + a.amount, 0);
      const q = list.reduce((x, a) => x + a.qty, 0);
      const paidQty = list.filter((a) => a.amount > 0).reduce((x, a) => x + a.qty, 0);
      byGroup[g] = { amount, qty: q, share: sales ? amount / sales : 0, perOrder: s.orders ? q / s.orders : null, avgPrice: paidQty ? amount / paidQty : null };
    }
    const zeroItems = [...agg.values()].filter((a) => a.amount === 0 && a.qty > 0).length;
    const topItems = [...agg.entries()]
      .map(([name, a]) => ({ name, ...a }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 30);
    return { storeId: s.id, name: s.name, sales, orders: s.orders, qty, perOrder: s.orders ? sales / s.orders : null, byGroup, zeroItems, topItems };
  });
}

// 업셀링 기회: 주문당 세트/주류/디저트/음료가 다른 매장 평균보다 낮으면, 평균까지 올렸을 때 월 매출 증가분
export function buildUpsell(menus: StoreMenu[], days: number): Upsell[] {
  const groups: Group[] = ["set", "wine", "dessert", "beverage"];
  const withData = menus.filter((m) => m.orders > 0 && m.sales > 0);
  return withData.map((m) => {
    const others = withData.filter((o) => o.storeId !== m.storeId);
    const items: Upsell["items"] = [];
    const strengths: string[] = [];
    for (const g of groups) {
      const mine = m.byGroup[g].perOrder ?? 0;
      const vals = others.map((o) => o.byGroup[g].perOrder ?? 0);
      if (!vals.length) continue;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const bestStore = others.reduce((a, b) => ((b.byGroup[g].perOrder ?? 0) > (a.byGroup[g].perOrder ?? 0) ? b : a));
      const best = { name: bestStore.name, v: bestStore.byGroup[g].perOrder ?? 0 };
      const price = m.byGroup[g].avgPrice ?? (others.map((o) => o.byGroup[g].avgPrice).filter((v): v is number => v != null)[0] ?? 0);
      if (avg > mine && price > 0) {
        const monthly = Math.round((avg - mine) * m.orders * price * (30 / days));
        items.push({ group: g, mine, others: avg, best, monthly, text: `${GROUP_LABEL[g]}을 주문 100건당 ${Math.round(mine * 100)}개 팔아요. 다른 매장 평균은 ${Math.round(avg * 100)}개 — 평균만큼 팔면 월 약 ${man(monthly)}원.` });
      } else if (mine > 0 && avg > 0 && mine >= avg * 1.2) {
        strengths.push(`주문당 ${GROUP_LABEL[g]} ${Math.round((mine / avg) * 100)}% (다른 매장 평균 대비)`);
      }
    }
    items.sort((a, b) => b.monthly - a.monthly);
    return { storeId: m.storeId, name: m.name, monthly: items.reduce((s, i) => s + i.monthly, 0), items: items.slice(0, 3), strengths };
  });
}

export const man = (n: number) => (Math.abs(n) >= 10000 ? `${Math.round(n / 10000).toLocaleString("ko-KR")}만` : Math.round(n).toLocaleString("ko-KR"));
