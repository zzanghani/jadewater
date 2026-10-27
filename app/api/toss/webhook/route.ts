import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// 토스플레이스 웹훅 수신. 개발자센터 → 앱 → 웹훅에 이 주소를 등록한다.
// - 서명(x-toss-signature = v1=hex(HMAC-SHA256(secret, "<timestamp>.<rawBody>")))을 검증한다.
// - x-toss-webhook-id로 같은 이벤트가 두 번 와도 한 번만 처리한다(at-least-once).
// - 앱 설치 이벤트는 toss_installations에 매장을 적어 설정 화면에서 바로 고를 수 있게 한다.
export async function POST(request: Request) {
  const raw = await request.text();
  const h = request.headers;
  const webhookId = h.get("x-toss-webhook-id") ?? "";
  const ts = h.get("x-toss-timestamp") ?? "";
  const sig = h.get("x-toss-signature") ?? "";

  const supabase = createServiceClient();
  const { data: settings } = await supabase.from("toss_settings").select("webhook_secret").eq("id", 1).maybeSingle();
  const secret = settings?.webhook_secret ?? null;

  if (secret) {
    // 시각이 10분 넘게 어긋나면 거부
    if (!ts || Math.abs(Date.now() - Number(ts)) > 10 * 60_000) {
      return NextResponse.json({ error: "stale timestamp" }, { status: 400 });
    }
    const expected = "v1=" + crypto.createHmac("sha256", secret).update(`${ts}.${raw}`, "utf8").digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "bad signature" }, { status: 401 });
    }
  } else {
    console.warn("[toss-webhook] webhook_secret 미설정 — 서명 검증 없이 받음");
  }

  let event: { id?: string; type?: string; createdAt?: string; merchantId?: number | string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const id = webhookId || event.id || "";
  if (!id || !event.type) return NextResponse.json({ error: "missing id/type" }, { status: 400 });
  const merchantId = event.merchantId != null ? String(event.merchantId) : null;

  // 멱등: 이미 받은 이벤트면 200으로 끝낸다.
  const { error: insertError } = await supabase.from("toss_webhook_events").insert({
    id,
    type: event.type,
    merchant_id: merchantId,
    created_at: event.createdAt ?? null,
    payload: event as unknown as Record<string, unknown>,
  });
  if (insertError) {
    if (insertError.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    console.error("[toss-webhook] insert failed", insertError);
    return NextResponse.json({ error: "store failed" }, { status: 500 });
  }

  if (event.type === "app.installation.created.v1" && merchantId) {
    const m = (event.data?.merchant ?? {}) as { name?: string; businessNumber?: string; businessRegistrationNumber?: string };
    await supabase.from("toss_installations").upsert(
      {
        merchant_id: merchantId,
        merchant_name: m.name ?? null,
        business_number: m.businessNumber ?? m.businessRegistrationNumber ?? null,
        installed_at: event.createdAt ?? new Date().toISOString(),
        removed_at: null,
      },
      { onConflict: "merchant_id" }
    );
  } else if (event.type === "app.installation.deleted.v1" && merchantId) {
    await supabase.from("toss_installations").update({ removed_at: event.createdAt ?? new Date().toISOString() }).eq("merchant_id", merchantId);
  } else if (merchantId) {
    // 설치 알림을 놓쳤어도(서명 거절 등) 주문·결제 알림이 오면 그 가맹점을 목록에 올려 설정 화면에서 고를 수 있게 한다.
    const { data: known } = await supabase.from("toss_installations").select("merchant_id").eq("merchant_id", merchantId).maybeSingle();
    if (!known) await supabase.from("toss_installations").insert({ merchant_id: merchantId, merchant_name: null, installed_at: event.createdAt ?? new Date().toISOString() });
  }

  return NextResponse.json({ ok: true });
}

// 개발자센터에서 주소 확인용으로 GET을 보낼 수도 있어 200을 돌려준다.
export async function GET() {
  return NextResponse.json({ ok: true, service: "jadewater toss webhook" });
}
