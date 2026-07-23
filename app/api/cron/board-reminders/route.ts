import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPush } from "@/lib/webpush";
import { kstDateString } from "@/lib/date";

// Vercel Cron이 매일 KST 06:00에 호출한다 (vercel.json 참고).
// 게시 다음날부터 매일, 아직 확인(체크) 안 한 Follower에게 리마인드 알림을 보낸다.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const todayMidnightKST = `${kstDateString(0)}T00:00:00+09:00`;

  const { data: posts, error } = await supabase
    .from("board_posts")
    .select("id, title, created_at")
    .is("completed_at", null)
    .lt("created_at", todayMidnightKST);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Record<string, string> = {};

  for (const post of posts ?? []) {
    const { data: followers } = await supabase
      .from("board_post_followers")
      .select("user_id")
      .eq("post_id", post.id)
      .eq("confirmed", false);

    if (!followers?.length) {
      results[post.id] = "확인 안 한 Follower 없음";
      continue;
    }

    const payload = {
      title: "체크리스트 확인 요청",
      body: `"${post.title}" 글을 아직 확인하지 않으셨어요.`,
      url: `/board/${post.id}`,
    };

    let sent = 0;
    for (const f of followers) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", f.user_id);

      if (!subs?.length) continue;

      const expiredIds: string[] = [];
      await Promise.all(
        subs.map(async (s) => {
          const { expired } = await sendPush(
            { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
            payload
          );
          if (expired) expiredIds.push(s.id);
          else sent++;
        })
      );

      if (expiredIds.length > 0) {
        await supabase.from("push_subscriptions").delete().in("id", expiredIds);
      }
    }

    results[post.id] = `${sent}건 발송`;
  }

  return NextResponse.json({ results });
}
