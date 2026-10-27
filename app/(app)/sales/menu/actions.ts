"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { addYmd, kstYmd } from "@/lib/adReport";
import { buildStoreMenus, buildUpsell, type StoreMenu, type Upsell } from "@/lib/menuSales";

export type MenuResult = { ok: true; from: string; to: string; days: number; menus: StoreMenu[]; upsell: Upsell[] } | { ok: false; error: string };

export async function loadMenuSales(days = 28): Promise<MenuResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { data: p } = await supabase.from("profiles").select("role, store_id, department, status").eq("id", user.id).maybeSingle();
  if (!p || p.status !== "approved" || p.department || p.role !== "owner") return { ok: false, error: "지점장·대표 계정만 볼 수 있어요." };

  const service = createServiceClient();
  const today = kstYmd(0);
  const to = addYmd(today, -1);
  const from = addYmd(to, -(days - 1));
  const { data: merchants } = await service.from("store_toss_merchants").select("store_id").eq("is_test", false);
  const ids = (merchants ?? []).map((m) => m.store_id);
  if (!ids.length) return { ok: false, error: "토스가 연결된 매장이 없어요." };
  const [{ data: stores }, { data: daily }, { data: items }] = await Promise.all([
    supabase.from("stores").select("id, name").in("id", ids).order("name"),
    service.from("toss_daily_sales").select("store_id, orders").in("store_id", ids).gte("date", from).lte("date", to),
    service.from("toss_daily_items").select("store_id, name, category, qty, amount, orders").in("store_id", ids).gte("date", from).lte("date", to),
  ]);
  const ordersBy = new Map<string, number>();
  for (const d of daily ?? []) ordersBy.set(d.store_id, (ordersBy.get(d.store_id) ?? 0) + d.orders);
  // 비교(업셀링)는 전 매장으로 계산하고, 지점장에게는 자기 매장 것만 돌려준다
  const all = (stores ?? []).map((s) => ({ id: s.id, name: s.name, orders: ordersBy.get(s.id) ?? 0 }));
  const menus = buildStoreMenus(all, items ?? []);
  const upsell = buildUpsell(menus, days);
  const mine = (list: { storeId: string }[]) => (p.store_id ? list.filter((x) => x.storeId === p.store_id) : list);
  return { ok: true, from, to, days, menus: mine(menus) as StoreMenu[], upsell: mine(upsell) as Upsell[] };
}
