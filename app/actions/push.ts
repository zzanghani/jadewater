"use server";

import { createClient } from "@/lib/supabase/server";

export async function savePushSubscription(params: {
  storeId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      store_id: params.storeId,
      endpoint: params.endpoint,
      p256dh: params.p256dh,
      auth: params.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) return { error: "알림 등록 중 오류가 발생했습니다." };
  return {};
}
