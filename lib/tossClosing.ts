// 토스 주문 목록 → 하루 마감 자료 (인수인계 문서 C-① closingSummary를 우리 마감입력 칸에 맞게 옮김).
// 기준: 그날(KST) 승인되고 취소되지 않은 결제가 있는 주문. 결제는 승인 시각으로 날짜를 정한다.
import { callToss, type TossKeys } from "@/lib/tossPlace";

type TossPayment = {
  id?: string | number;
  amount?: number | string;
  state?: string;
  approvedAt?: string;
  cancelledAt?: string;
  updatedAt?: string;
  sourceType?: string; // CARD | CASH | BARCODE | EXTERNAL ...
  paymentMethod?: string;
  externalDetails?: { source?: string };
};
type TossLineItem = {
  title?: string;
  name?: string;
  quantity?: number | string;
  diningOption?: string; // DELIVERY 등
  itemPrice?: { priceValue?: number | string };
  optionChoices?: { priceValue?: number | string; quantity?: number | string }[];
  appliedDiscounts?: { amount?: number | string }[];
  item?: { title?: string; name?: string; category?: { title?: string } };
};
type TossOrder = {
  orderState?: string;
  source?: string;
  createdAt?: string;
  openedAt?: string;
  completedAt?: string;
  cancelledAt?: string | null;
  updatedAt?: string;
  chargePrice?: { discountAmount?: number | string; totalAmount?: number | string; listPrice?: number | string };
  payments?: TossPayment[];
  lineItems?: TossLineItem[];
};

const N = (v: unknown) => Number(v) || 0;
function toMs(ts?: string): number | null {
  if (!ts) return null;
  const s = String(ts);
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s);
  const ms = Date.parse(hasZone ? s : s + "+09:00");
  return Number.isFinite(ms) ? ms : null;
}

export type TossClosing = {
  day: string;
  fetchedOrders: number;
  orders: number;
  paid: number; // 승인 결제 합계(배달 포함)
  store: number; // 매장 결제 = paid − 배달
  payments: Record<string, number>; // CARD / CASH / BARCODE / EXTERNAL ...
  external: Record<string, number>; // EXTERNAL 결제의 출처별 금액(쿠팡이츠·배민 등)
  delivery: { amount: number; orders: number; bySource: Record<string, number> };
  discount: number;
  cancelled: { n: number; amount: number };
  categories: Record<string, number>; // 매장 카테고리별 실판매액(배달 제외)
  lastPayAt: string | null; // "21:40"
  /** 시간대별 승인 결제 합계 ("0"~"23", KST) — 마감 추정·시간대 분석용 */
  byHour: Record<string, number>;
  /** 메뉴별 판매 (결제된 주문만, 배달 포함): 이름 → 카테고리·수량·실판매액·주문 수 */
  items: Record<string, { category: string; qty: number; amount: number; orders: number }>;
  /** 오늘 열린 주문 중 아직 결제가 안 된 금액(테이블에 앉아 있는 손님) — 실시간 매출용 */
  open: { amount: number; orders: number };
  /** 결제 완료 + 미결제 = 지금까지의 매출 */
  live: number;
};

export async function fetchTossClosing(keys: TossKeys, merchantId: string, ymd: string, now = Date.now()): Promise<TossClosing> {
  const start = Date.parse(ymd + "T00:00:00+09:00");
  const end = start + 864e5;
  const inDay = (t: number | null) => t != null && t >= start && t < end;

  const orders: TossOrder[] = [];
  for (let page = 1; page <= 40; page++) {
    const list = await callToss<unknown>(keys, `/merchants/${encodeURIComponent(merchantId)}/order/orders`, {
      from: new Date(start - 12 * 36e5).toISOString(),
      to: new Date(Math.min(end + 12 * 36e5, now)).toISOString(),
      page,
      size: 500,
      sortOrder: "ASC",
    });
    const l = list as { content?: TossOrder[]; items?: TossOrder[] } | TossOrder[];
    const arr = Array.isArray(l) ? l : l?.content || l?.items || [];
    orders.push(...arr);
    if (arr.length < 500) break;
  }

  const add = (o: Record<string, number>, k: string, v: number) => {
    o[k] = (o[k] ?? 0) + v;
  };
  const pay: Record<string, number> = {};
  const ext: Record<string, number> = {};
  const cat: Record<string, number> = {};
  const deliv = { amount: 0, orders: 0, bySource: {} as Record<string, number> };
  const cancelled = { n: 0, amount: 0 };
  const seen = new Set<string>();
  let discount = 0;
  let nOrders = 0;
  let lastPayAt = 0;
  const open = { amount: 0, orders: 0 };
  const byHour: Record<string, number> = {};
  const items: Record<string, { category: string; qty: number; amount: number; orders: number }> = {};

  for (const o of orders) {
    const ps = (o.payments ?? []).filter((p) => p && !seen.has(String(p.id)) && inDay(toMs(p.approvedAt)));
    ps.forEach((p) => seen.add(String(p.id)));
    const ok = ps.filter((p) => p.state !== "CANCELLED");
    for (const p of ps) {
      if (p.state === "CANCELLED") {
        cancelled.n++;
        cancelled.amount += N(p.amount);
        continue;
      }
      const t = p.sourceType || "UNDEFINED";
      const ta = toMs(p.approvedAt) ?? 0;
      if (ta > lastPayAt) lastPayAt = ta;
      add(pay, t, N(p.amount));
      add(byHour, String(new Date(ta + 9 * 36e5).getUTCHours()), N(p.amount));
      if (t === "EXTERNAL") add(ext, p.externalDetails?.source || "(이름 없음)", N(p.amount));
    }
    if (o.orderState !== "CANCELLED" && !o.cancelledAt) {
      // 오늘 연 주문인데 결제 합이 주문 금액보다 적으면 그 차액은 아직 안 받은 돈(미결제)
      const opened = toMs(o.openedAt ?? o.createdAt);
      if (inDay(opened)) {
        const paidSum = (o.payments ?? []).filter((p) => p && p.state !== "CANCELLED" && p.approvedAt).reduce((s, p) => s + N(p.amount), 0);
        const total = N(o.chargePrice?.totalAmount);
        if (total > paidSum) {
          open.amount += total - paidSum;
          open.orders++;
        }
      }
    }
    if (!ok.length || o.orderState === "CANCELLED") continue;
    nOrders++;
    const cp = o.chargePrice ?? {};
    // 토스는 주문 할인액을 음수로 줄 때가 있다 → 크기로 센다
    const dAmt = Math.abs(N(cp.discountAmount));
    discount += dAmt;

    const lines = (o.lineItems ?? []).map((li) => {
      const unit = N(li.itemPrice?.priceValue) + (li.optionChoices ?? []).reduce((s, c) => s + N(c.priceValue) * (N(c.quantity) || 1), 0);
      const gross = unit * (N(li.quantity) || 1);
      const ld = (li.appliedDiscounts ?? []).reduce((s, d) => s + N(d.amount), 0);
      return { c: li.item?.category?.title || "(카테고리 없음)", n: li.item?.title || li.item?.name || li.title || li.name || "(이름 없음)", q: N(li.quantity) || 1, gross, net: gross - ld, d: li.diningOption };
    });
    for (const l of lines) {
      const it = (items[l.n] ??= { category: l.c, qty: 0, amount: 0, orders: 0 });
      it.qty += l.q;
      it.amount += l.net;
      it.orders++;
    }
    // 주문 전체 할인 중 상품에 안 붙은 몫은 금액 비율로 나눠 뺀다. 배달 메뉴는 매장 카테고리에서 뺀다.
    const sumNet = lines.reduce((s, l) => s + l.net, 0);
    const rest = dAmt - lines.reduce((s, l) => s + (l.gross - l.net), 0);
    for (const l of lines) {
      const v = l.net - (rest > 0 && sumNet > 0 ? (rest * l.net) / sumNet : 0);
      if (l.d !== "DELIVERY") add(cat, l.c, v);
    }
    if (lines.some((l) => l.d === "DELIVERY")) {
      const amt = ok.reduce((s, p) => s + N(p.amount), 0);
      deliv.amount += amt;
      deliv.orders++;
      add(deliv.bySource, o.source || "-", amt);
    }
  }

  const round = (o: Record<string, number>) =>
    Object.fromEntries(
      Object.entries(o)
        .map(([k, v]) => [k, Math.round(v)] as [string, number])
        .sort((a, b) => b[1] - a[1])
    );
  const paid = Object.values(pay).reduce((s, v) => s + v, 0);
  return {
    day: ymd,
    fetchedOrders: orders.length,
    orders: nOrders,
    paid: Math.round(paid),
    store: Math.round(paid - deliv.amount),
    payments: round(pay),
    external: round(ext),
    delivery: { amount: Math.round(deliv.amount), orders: deliv.orders, bySource: round(deliv.bySource) },
    discount: Math.round(discount),
    cancelled,
    categories: round(cat),
    lastPayAt: lastPayAt ? new Date(lastPayAt + 9 * 36e5).toISOString().slice(11, 16) : null,
    byHour: round(byHour),
    items: Object.fromEntries(Object.entries(items).map(([k, v]) => [k, { ...v, amount: Math.round(v.amount) }])),
    open: { amount: Math.round(open.amount), orders: open.orders },
    live: Math.round(paid + open.amount),
  };
}

/** 토스 마감 자료 → 우리 마감입력 칸. 쿠팡이츠·배민은 배달 주문 출처나 외부 결제 이름으로 찾는다. */
export function tossClosingToForm(c: TossClosing) {
  const pick = (re: RegExp) => {
    let sum = 0;
    for (const [k, v] of Object.entries(c.delivery.bySource)) if (re.test(k)) sum += v;
    if (sum === 0) for (const [k, v] of Object.entries(c.external)) if (re.test(k)) sum += v;
    return Math.round(sum);
  };
  const coupang = pick(/쿠팡|coupang/i);
  const baemin = pick(/배민|배달의민족|baemin/i);
  // 매장 결제(배달 제외)를 결제수단별로. EXTERNAL 중 배달이 아닌 것(기타 외부결제)은 간편결제에 넣는다.
  const externalNonDelivery = Math.max(0, (c.payments.EXTERNAL ?? 0) - coupang - baemin);
  const cat = splitCategories(c.categories);
  return {
    card_sales: c.payments.CARD ?? 0,
    cash_sales: c.payments.CASH ?? 0,
    easypay_sales: (c.payments.BARCODE ?? 0) + externalNonDelivery,
    discount_amount: c.discount,
    coupang_eats_sales: coupang,
    baemin_sales: baemin,
    food_sales: cat.food,
    beverage_sales: cat.beverage,
    wine_sales: cat.wine,
    category_note: cat.note,
  };
}

// 토스 카테고리명 → 우리 마감 칸(음식/음료/와인·주류). 이름에 든 단어로 나누고,
// 어디에도 안 걸리면 음식으로 본다. 어떻게 나눴는지 메모로 돌려줘 화면에서 확인할 수 있게 한다.
const WINE_RE = /와인|wine|주류|술|맥주|beer|소주|칵테일|cocktail|하이볼|위스키|whisky|whiskey|샴페인|champagne|스파클링|사케|막걸리|보틀|bottle|glass|글라스/i;
const BEV_RE = /음료|beverage|drink|커피|coffee|라떼|latte|아메리카노|차|tea|에이드|ade|주스|juice|탄산|소다|soda|논알콜|non.?alc|스무디|smoothie|콜라|사이다|생수|water/i;
export function splitCategories(categories: Record<string, number>): { food: number; beverage: number; wine: number; note: string } {
  const out = { food: 0, beverage: 0, wine: 0 };
  const names = { food: [] as string[], beverage: [] as string[], wine: [] as string[] };
  for (const [name, amount] of Object.entries(categories)) {
    const k: keyof typeof out = WINE_RE.test(name) ? "wine" : BEV_RE.test(name) ? "beverage" : "food";
    out[k] += amount;
    if (amount > 0) names[k].push(name);
  }
  const part = (label: string, list: string[]) => (list.length ? `${label}: ${list.join(", ")}` : "");
  return {
    food: Math.round(out.food),
    beverage: Math.round(out.beverage),
    wine: Math.round(out.wine),
    note: [part("음식", names.food), part("음료", names.beverage), part("와인·주류", names.wine)].filter(Boolean).join(" / "),
  };
}
