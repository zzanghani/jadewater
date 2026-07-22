"use server";

import { createClient } from "@/lib/supabase/server";

export async function savePushSubscription(params: {
  storeId: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<{ error?: string }> {
  const endpointTail = params.endpoint.slice(-12);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error(`[savePushSubscription] 로그인 안 됨 (endpoint ...${endpointTail})`);
    return { error: "로그인이 필요합니다." };
  }

  // 일반 upsert(insert ... on conflict do update)는, 이 endpoint가 이미
  // 다른 계정 소유였을 때 그 기존 행이 현재 사용자에게 SELECT 정책상 보이지
  // 않아 RLS가 충돌 해소 자체를 막는다. 그래서 인증/매장 접근 권한 검사를
  // 자체적으로 수행하는 RPC(SECURITY DEFINER 함수)를 통해 저장한다.
  const { error } = await supabase.rpc("upsert_push_subscription", {
    p_store_id: params.storeId,
    p_endpoint: params.endpoint,
    p_p256dh: params.p256dh,
    p_auth: params.auth,
  });

  if (error) {
    console.error(
      `[savePushSubscription] 저장 실패 (user_id=${user.id}, store_id=${params.storeId}, endpoint ...${endpointTail})`,
      error
    );
    return { error: "알림 등록 중 오류가 발생했습니다." };
  }

  console.log(
    `[savePushSubscription] 저장 성공 (user_id=${user.id}, store_id=${params.storeId}, endpoint ...${endpointTail})`
  );
  return {};
}
