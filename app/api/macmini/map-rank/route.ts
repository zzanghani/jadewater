import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { kstYmd } from "@/lib/adReport";

// 맥미니 지도 순위 작업기가 부르는 API.
//   GET  → 할 일: 검색 노출 설정이 있는 매장마다 { store_id, store_name, terms, keywords }
//   POST → 결과: { results: [{ store_id, keyword, rank, pos, checked, name }], notes: [{ store_id, note }] }
//          rank = 광고 제외 순위(못 찾으면 null), pos = 광고 포함 위치, checked = 광고 제외 확인한 가게 수
// 인증: Vault의 cron_secret(맥미니 .env의 MACMINI_TOKEN) 또는 Vercel CRON_SECRET. 체험단 작업기와 같은 방식.

type Supa = ReturnType<typeof createServiceClient>;

async function authorized(request: Request, supabase: Supa): Promise<boolean> {
  const authHeader = request.headers.get("authorization") ?? "";
  const { data: dbToken } = await supabase.rpc("attendance_cron_token");
  const accepted = [process.env.CRON_SECRET, dbToken].filter((t): t is string => typeof t === "string" && t.length > 0);
  return accepted.length > 0 && accepted.some((t) => authHeader === `Bearer ${t}`);
}

export async function GET(request: Request) {
  const supabase = createServiceClient();
  if (!(await authorized(request, supabase))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [{ data: stores }, { data: settings, error }] = await Promise.all([
    supabase.from("stores").select("id, name"),
    supabase.from("store_search_settings").select("store_id, terms, keywords"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const nameById = new Map((stores ?? []).map((s) => [s.id, s.name]));
  const tasks = (settings ?? [])
    .filter((s) => (s.terms ?? []).length > 0 && (s.keywords ?? []).length > 0)
    .map((s) => ({ store_id: s.store_id, store_name: nameById.get(s.store_id) ?? "매장", terms: s.terms, keywords: s.keywords.slice(0, 10) }));
  return NextResponse.json({ date: kstYmd(0), tasks });
}

type Result = { store_id: string; keyword: string; rank: number | null; pos: number | null; checked: number; name: string | null };
type Note = { store_id: string; note: string };

export async function POST(request: Request) {
  const supabase = createServiceClient();
  if (!(await authorized(request, supabase))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { results?: Result[]; notes?: Note[] } | null;
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });
  const today = kstYmd(0);
  const now = new Date().toISOString();
  const rows = (body.results ?? [])
    .filter((r) => r && typeof r.store_id === "string" && typeof r.keyword === "string")
    .map((r) => ({
      store_id: r.store_id,
      date: today,
      keyword: r.keyword,
      map_deep_rank: r.rank == null ? null : Math.max(1, Math.min(32000, Math.round(r.rank))),
      map_pos: r.pos == null ? null : Math.max(1, Math.min(32000, Math.round(r.pos))),
      map_checked: Math.max(0, Math.min(32000, Math.round(r.checked ?? 0))),
      map_name: r.name ? String(r.name).slice(0, 120) : null,
      map_deep_at: now,
    }));
  // 같은 날 행이 있으면 지도 칸만 갱신(블로그 칸은 그대로), 없으면 새로 만든다.
  if (rows.length) {
    const { error } = await supabase.from("search_rank_daily").upsert(rows, { onConflict: "store_id,date,keyword" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  for (const n of body.notes ?? []) {
    if (!n || typeof n.store_id !== "string") continue;
    await supabase.from("store_search_settings").update({ map_note: String(n.note ?? "").slice(0, 300) || null, map_at: now }).eq("store_id", n.store_id);
  }
  return NextResponse.json({ ok: true, saved: rows.length, date: today });
}
