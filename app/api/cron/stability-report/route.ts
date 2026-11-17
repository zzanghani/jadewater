import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { kstDateString } from "@/lib/date";

// 아침 자동 점검 루틴이 결과를 올리고(POST) 대표 피드백을 읽어가는(GET) 통로.
// 대표는 /stability 화면에서 결과를 보고 확인·피드백을 남긴다.
// 인증: Vercel CRON_SECRET 또는 Supabase Vault의 cron_secret(맥미니 루틴이 쓰는 값) — 헬스체크와 같다.
export const dynamic = "force-dynamic";
export const maxDuration = 20;

type Verdict = "정상" | "경고" | "이상";

async function authorized(request: Request): Promise<{ ok: boolean; supabase: ReturnType<typeof createServiceClient> }> {
  const supabase = createServiceClient();
  const authHeader = request.headers.get("authorization") ?? "";
  const { data: dbToken } = await supabase.rpc("attendance_cron_token");
  const accepted = [process.env.CRON_SECRET, dbToken].filter(
    (t): t is string => typeof t === "string" && t.length > 0
  );
  return { ok: accepted.some((t) => authHeader === `Bearer ${t}`), supabase };
}

function deriveVerdict(summary: string): Verdict {
  if (/⚠|이상|멈춤|접속 불가|실패/.test(summary)) return "이상";
  if (/경고/.test(summary)) return "경고";
  return "정상";
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

// POST { date?: 'YYYY-MM-DD', verdict?: '정상'|'경고'|'이상', summary, fixed?, todo?, detail? }
// 같은 날짜가 있으면 덮어쓴다(루틴이 같은 날 다시 돌 때). 확인 표시(checked_at)는 그대로 둔다.
export async function POST(request: Request) {
  const { ok, supabase } = await authorized(request);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다" }, { status: 400 });
  }

  const summary = str(body.summary, 1000);
  if (!summary) return NextResponse.json({ error: "summary(결론 한 줄)가 필요합니다" }, { status: 400 });
  const dateRaw = str(body.date, 10) ?? kstDateString(0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    return NextResponse.json({ error: "date는 YYYY-MM-DD 형식" }, { status: 400 });
  }
  const verdictRaw = str(body.verdict, 2);
  const verdict: Verdict =
    verdictRaw === "정상" || verdictRaw === "경고" || verdictRaw === "이상" ? verdictRaw : deriveVerdict(summary);

  const { error } = await supabase.from("stability_reports").upsert(
    {
      date: dateRaw,
      verdict,
      summary,
      fixed: str(body.fixed, 4000),
      todo: str(body.todo, 4000),
      detail: str(body.detail, 60000),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "date" }
  );
  if (error) {
    console.error("[stability-report] 저장 실패:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, date: dateRaw, verdict });
}

// GET → 아직 답하지 않은 대표 피드백(status=open)과 최근 보고서의 확인 여부.
// 루틴이 아침에 읽어 보고서에 '대표님 피드백' 항목으로 반영하고, 처리한 건 PATCH 로 답을 남긴다.
export async function GET(request: Request) {
  const { ok, supabase } = await authorized(request);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: feedback, error: fbError }, { data: reports }] = await Promise.all([
    supabase
      .from("stability_feedback")
      .select("id, report_date, body, created_at, status, reply, replied_at")
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(50),
    supabase
      .from("stability_reports")
      .select("date, verdict, summary, checked_at")
      .order("date", { ascending: false })
      .limit(7),
  ]);
  if (fbError) return NextResponse.json({ error: fbError.message }, { status: 500 });
  return NextResponse.json({ ok: true, openFeedback: feedback ?? [], recentReports: reports ?? [] });
}

// PATCH { id, reply, status?: 'done'|'open' } → 피드백에 답을 남긴다(루틴 전용).
export async function PATCH(request: Request) {
  const { ok, supabase } = await authorized(request);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다" }, { status: 400 });
  }
  const id = str(body.id, 64);
  const reply = str(body.reply, 4000);
  if (!id || !reply) return NextResponse.json({ error: "id와 reply가 필요합니다" }, { status: 400 });
  const status = body.status === "open" ? "open" : "done";

  const { error } = await supabase
    .from("stability_feedback")
    .update({ reply, status, replied_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id, status });
}
