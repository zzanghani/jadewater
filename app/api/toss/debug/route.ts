import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { callToss } from "@/lib/tossPlace";

// 토스 주문 조회 응답 "모양" 점검용 (본사 마스터 세션만). 금액·개인정보는 안 돌려주고
// 응답의 키 이름·건수만 보여준다. 연동 초기 디버그용이라 나중에 지워도 된다.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  const { data: p } = await supabase.from("profiles").select("role, store_id, department").eq("id", user.id).maybeSingle();
  if (!p || p.role !== "owner" || p.store_id || p.department) return NextResponse.json({ error: "hq only" }, { status: 403 });

  const url = new URL(request.url);
  const merchantId = url.searchParams.get("m") ?? "";
  const date = url.searchParams.get("date") ?? new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
  const service = createServiceClient();
  const { data: keys } = await service.from("toss_settings").select("access_key, access_secret").eq("id", 1).maybeSingle();
  if (!keys || !merchantId) return NextResponse.json({ error: "keys or merchant missing" }, { status: 400 });
  const k = { accessKey: keys.access_key, secretKey: keys.access_secret };

  const start = Date.parse(date + "T00:00:00+09:00");
  const shape = (v: unknown): unknown => {
    if (Array.isArray(v)) return { array: v.length, first: v.length ? shape(v[0]) : null };
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).slice(0, 40).map(([key, val]) => [key, Array.isArray(val) ? `array(${val.length})` : val && typeof val === "object" ? "object" : typeof val]));
    return typeof v;
  };
  const out: Record<string, unknown> = { merchantId, date };
  try {
    out.merchant = shape(await callToss(k, `/merchants/${merchantId}`));
  } catch (e) {
    out.merchantError = (e as Error).message;
  }
  const variants: Record<string, Record<string, string | number>> = {
    a_from_to: { from: new Date(start - 12 * 36e5).toISOString(), to: new Date(Math.min(start + 36 * 36e5, Date.now())).toISOString(), page: 1, size: 100, sortOrder: "ASC" },
    b_no_params: {},
    c_startAt_endAt: { startAt: new Date(start).toISOString(), endAt: new Date(Math.min(start + 24 * 36e5, Date.now())).toISOString(), page: 1, size: 100 },
  };
  // 실시간 매출(미결제 포함) 검증용: 오늘 주문의 상태별 건수와, 결제 합이 주문 금액보다 적은 주문 요약
  try {
    const r = await callToss<unknown>(k, `/merchants/${merchantId}/order/orders`, { from: new Date(start - 12 * 36e5).toISOString(), to: new Date(Math.min(start + 36 * 36e5, Date.now())).toISOString(), page: 1, size: 500, sortOrder: "ASC" });
    const l = r as { content?: unknown[] } | unknown[];
    const arr = (Array.isArray(l) ? l : l?.content ?? []) as { orderState?: string; openedAt?: string; createdAt?: string; completedAt?: string | null; cancelledAt?: string | null; chargePrice?: { totalAmount?: number; discountAmount?: number }; payments?: { state?: string; amount?: number; approvedAt?: string }[] }[];
    const states: Record<string, number> = {};
    for (const o of arr) states[o.orderState ?? "?"] = (states[o.orderState ?? "?"] ?? 0) + 1;
    const unpaid = arr
      .map((o) => ({
        orderState: o.orderState,
        openedAt: o.openedAt,
        completedAt: o.completedAt,
        cancelledAt: o.cancelledAt,
        total: o.chargePrice?.totalAmount,
        paid: (o.payments ?? []).filter((q) => q.state !== "CANCELLED" && q.approvedAt).reduce((sum, q) => sum + Number(q.amount ?? 0), 0),
        payStates: (o.payments ?? []).map((q) => q.state),
      }))
      .filter((o) => Number(o.total ?? 0) > o.paid)
      .slice(0, 10);
    out.d_states = { states, unpaid };
  } catch (e) {
    out.d_states = { error: (e as Error).message };
  }
  for (const [name, q] of Object.entries(variants)) {
    try {
      const r = await callToss<unknown>(k, `/merchants/${merchantId}/order/orders`, q);
      out[name] = shape(r);
    } catch (e) {
      out[name] = { error: (e as Error).message };
    }
  }
  return NextResponse.json(out);
}
