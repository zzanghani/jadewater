"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/webpush";

export type MessageFormState = { error?: string } | undefined;

async function sendPushToUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  payload: { title: string; body: string; url: string }
) {
  const { data: subs } = await supabase.rpc("get_push_subscriptions_for_user", {
    p_user_id: userId,
  });
  if (!subs?.length) return;

  const expiredIds: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      const { expired } = await sendPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        payload
      );
      if (expired) expiredIds.push(s.id);
    })
  );

  if (expiredIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", expiredIds);
  }
}

export async function sendDirectMessage(
  _prevState: MessageFormState,
  formData: FormData
): Promise<MessageFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const recipientId = String(formData.get("recipient_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!recipientId) return { error: "받는 사람을 선택해 주세요." };
  if (recipientId === user.id) return { error: "자기 자신에게는 보낼 수 없습니다." };
  if (!body) return { error: "메시지를 입력해 주세요." };

  // 직원(staff) 계정은 같은 매장 사람(지점장 포함)에게만 메시지를 보낼
  // 수 있다. RLS(direct_messages_insert_own)에서도 같은 조건으로 다시
  // 막아주지만, 여기서 먼저 확인해 더 알아보기 쉬운 오류를 보여준다.
  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("department, store_id, role")
    .eq("id", user.id)
    .single();
  const senderIsStaff =
    !senderProfile?.department && !!senderProfile?.store_id && senderProfile.role === "staff";

  if (senderIsStaff) {
    const { data: recipientProfile } = await supabase
      .from("profiles")
      .select("department, store_id")
      .eq("id", recipientId)
      .single();
    const sameStore =
      !recipientProfile?.department && recipientProfile?.store_id === senderProfile.store_id;
    if (!sameStore) {
      return { error: "같은 매장 사람에게만 메시지를 보낼 수 있습니다." };
    }
  }

  const { error } = await supabase
    .from("direct_messages")
    .insert({ sender_id: user.id, recipient_id: recipientId, body });

  if (error) {
    return { error: "전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${recipientId}`);

  try {
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single();
    const senderName = senderProfile?.name ?? "누군가";
    await sendPushToUser(supabase, recipientId, {
      title: `${senderName}님이 메시지를 보냈습니다`,
      body: body.slice(0, 80),
      url: `/messages/${user.id}`,
    });
  } catch (err) {
    console.error("[sendDirectMessage] 알림 발송 중 오류", err);
  }

  return undefined;
}

// 상대방과의 대화창을 열 때, 그 상대방이 나에게 보낸 안 읽은 메시지를
// 전부 읽음 처리한다.
export async function markThreadRead(otherUserId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("direct_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("sender_id", otherUserId)
    .eq("recipient_id", user.id)
    .is("read_at", null);

  revalidatePath("/messages");
}
