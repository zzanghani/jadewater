"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/webpush";

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

export type RoomFormState = { error?: string } | undefined;

export async function createChatRoom(
  _prevState: RoomFormState,
  formData: FormData
): Promise<RoomFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "채팅방 이름을 입력해 주세요." };

  const inviteeIds = [...new Set(formData.getAll("invitee_ids").map(String))].filter(
    (id) => id !== user.id
  );

  const { data: room, error } = await supabase
    .from("chat_rooms")
    .insert({ name, created_by: user.id })
    .select()
    .single();

  if (error || !room) {
    return { error: "채팅방을 만드는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  const now = new Date().toISOString();
  await supabase.from("chat_room_members").insert([
    { room_id: room.id, user_id: user.id, last_read_at: now },
    ...inviteeIds.map((id) => ({ room_id: room.id, user_id: id })),
  ]);

  try {
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single();
    const creatorName = creatorProfile?.name ?? "누군가";
    await Promise.all(
      inviteeIds.map((id) =>
        sendPushToUser(supabase, id, {
          title: `${creatorName}님이 채팅방에 초대했습니다`,
          body: name,
          url: `/messages/rooms/${room.id}`,
        })
      )
    );
  } catch (err) {
    console.error("[createChatRoom] 초대 알림 발송 중 오류", err);
  }

  revalidatePath("/messages/rooms");
  redirect(`/messages/rooms/${room.id}`);
}

export type SendRoomMessageState = { error?: string } | undefined;

export async function sendRoomMessage(
  _prevState: SendRoomMessageState,
  formData: FormData
): Promise<SendRoomMessageState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const roomId = String(formData.get("room_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!roomId) return { error: "잘못된 요청입니다." };
  if (!body) return { error: "메시지를 입력해 주세요." };

  const { error } = await supabase
    .from("chat_messages")
    .insert({ room_id: roomId, sender_id: user.id, body });

  if (error) {
    return { error: "전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  // 내가 방금 보낸 메시지가 내 화면에서 "안읽음"으로 뜨지 않게, 보낸
  // 사람 자신의 읽음 시각도 같이 갱신한다(참여 기록 없으면 새로 생김).
  await supabase
    .from("chat_room_members")
    .upsert(
      { room_id: roomId, user_id: user.id, last_read_at: new Date().toISOString() },
      { onConflict: "room_id,user_id" }
    );

  revalidatePath("/messages/rooms");
  revalidatePath(`/messages/rooms/${roomId}`);

  try {
    const [{ data: senderProfile }, { data: room }, { data: members }] = await Promise.all([
      supabase.from("profiles").select("name").eq("id", user.id).single(),
      supabase.from("chat_rooms").select("name").eq("id", roomId).single(),
      supabase.from("chat_room_members").select("user_id").eq("room_id", roomId),
    ]);
    const senderName = senderProfile?.name ?? "누군가";
    const roomName = room?.name ?? "채팅방";
    const targets = (members ?? []).map((m) => m.user_id).filter((id) => id !== user.id);
    await Promise.all(
      targets.map((id) =>
        sendPushToUser(supabase, id, {
          title: `${roomName} · ${senderName}`,
          body: body.slice(0, 80),
          url: `/messages/rooms/${roomId}`,
        })
      )
    );
  } catch (err) {
    console.error("[sendRoomMessage] 알림 발송 중 오류", err);
  }

  return undefined;
}

// 방에 들어갈 때 읽음 시각을 갱신한다. 참여 기록이 아직 없으면 이
// 호출로 새로 생긴다(= 입장). 누구나 아무 방이나 볼 수 있어서 이건
// 권한이 아니라 순전히 안읽음 표시용 기록이다.
export async function markRoomRead(roomId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("chat_room_members")
    .upsert(
      { room_id: roomId, user_id: user.id, last_read_at: new Date().toISOString() },
      { onConflict: "room_id,user_id" }
    );

  revalidatePath("/messages/rooms");
}
