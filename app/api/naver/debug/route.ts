import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { callNaver, STAT_FIELDS } from "@/lib/naverAds";
import { addYmd, kstYmd } from "@/lib/adReport";

// 네이버 stats 응답 "모양" 점검용 (본사 마스터 세션만). 키는 안 돌려주고 응답의 키 이름·첫 행만.
// 시간대(hh24) 분해 응답이 어떤 필드로 오는지 확인하려고 만듦. 안정화 후 지워도 된다.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  const { data: p } = await supabase.from("profiles").select("role, store_id, department").eq("id", user.id).maybeSingle();
  if (!p || p.role !== "owner" || p.store_id || p.department) return NextResponse.json({ error: "hq only" }, { status: 403 });

  const url = new URL(request.url);
  const storeId = url.searchParams.get("store") ?? "";
  const service = createServiceClient();
  const { data: a } = await service.from("store_ad_accounts").select("*").eq("store_id", storeId).maybeSingle();
  if (!a) return NextResponse.json({ error: "no account" }, { status: 400 });
  const acct = { customerId: a.naver_customer_id, apiKey: a.naver_api_key, secretKey: a.naver_secret_key };
  const today = kstYmd(0);
  const since = addYmd(today, -3);
  const until = addYmd(today, -1);
  const camps = (await callNaver<{ nccCampaignId: string; status?: string }[]>(acct, "/ncc/campaigns")) ?? [];
  const id = camps.find((c) => c.status !== "DELETED")?.nccCampaignId;
  if (!id) return NextResponse.json({ error: "no campaign" });
  const out: Record<string, unknown> = {};
  const variants: Record<string, Record<string, string>> = {
    a_daily: { id, fields: STAT_FIELDS, timeRange: JSON.stringify({ since, until }), timeIncrement: "1" },
    b_daily_hh24: { id, fields: STAT_FIELDS, timeRange: JSON.stringify({ since, until }), timeIncrement: "1", breakdown: "hh24" },
    c_hh24_only: { id, fields: STAT_FIELDS, timeRange: JSON.stringify({ since, until }), breakdown: "hh24" },
    d_ids_hh24: { ids: id, fields: STAT_FIELDS, timeRange: JSON.stringify({ since, until }), breakdown: "hh24" },
  };
  for (const [name, q] of Object.entries(variants)) {
    try {
      const r = (await callNaver<{ data?: Record<string, unknown>[] }>(acct, "/stats", q)) ?? {};
      const rows = r.data ?? [];
      out[name] = { rows: rows.length, keys: rows[0] ? Object.keys(rows[0]) : [], first: rows[0] ?? null, second: rows[1] ?? null, topKeys: Object.keys(r) };
    } catch (e) {
      out[name] = { error: (e as Error).message };
    }
  }
  return NextResponse.json(out);
}
