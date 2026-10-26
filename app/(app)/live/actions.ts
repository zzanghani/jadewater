"use server";

// 홈 화면 실시간 매출: 토스포스가 연결된 매장은 오늘 결제 합계를 토스에서 바로 읽는다.
// 마감입력을 안 해도 지금까지 매출이 보이게 하는 용도. 연결 안 된 매장은 빈 값(화면은 마감 기준으로 표시).
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { kstYmd } from "@/lib/adReport";
import { fetchTossClosing } from "@/lib/tossClosing";

export type LiveSales = {
  sales: number; // 결제 완료 + 미결제
  paid: number;
  orders: number; // 결제 완료 주문 수
  openAmount: number; // 아직 결제 안 된 금액
  openOrders: number;
  lastPayAt: string | null;
  at: string;
};

export async function loadLiveSales(): Promise<Record<string, LiveSales>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};
  const { data: p } = await supabase.from("profiles").select("store_id, status").eq("id", user.id).maybeSingle();
  if (!p || p.status !== "approved") return {};

  const service = createServiceClient();
  const [{ data: toss }, { data: merchants }] = await Promise.all([
    service.from("toss_settings").select("access_key, access_secret").eq("id", 1).maybeSingle(),
    service.from("store_toss_merchants").select("store_id, merchant_id, is_test"),
  ]);
  if (!toss || !merchants?.length) return {};
  const keys = { accessKey: toss.access_key, secretKey: toss.access_secret };
  const targets = merchants.filter((m) => !m.is_test && (!p.store_id || m.store_id === p.store_id));
  const today = kstYmd(0);
  const out: Record<string, LiveSales> = {};
  await Promise.all(
    targets.map(async (m) => {
      try {
        const c = await fetchTossClosing(keys, m.merchant_id, today);
        out[m.store_id] = { sales: c.live, paid: c.paid, orders: c.orders, openAmount: c.open.amount, openOrders: c.open.orders, lastPayAt: c.lastPayAt, at: new Date().toISOString() };
      } catch {
        // 못 읽으면 그 매장만 마감 기준으로 남긴다
      }
    })
  );
  return out;
}
