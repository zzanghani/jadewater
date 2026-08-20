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

export type InlineUploadResult =
  | { path: string; url: string; fileName: string; isImage: boolean }
  | { error: string };

// 채팅방 메시지 안에 사진·파일을 바로 넣기 위한 즉시 업로드. board의
// uploadInlineBoardFile과 같은 방식이되, 별도 'chat' 스토리지 버킷에
// 올린다. 방 멤버 여부는 확인하지 않는다 — 어차피 메시지를 보낼 때
// chat_messages insert RLS(멤버만 가능)가 다시 한번 막아준다.
export async function uploadInlineChatFile(formData: FormData): Promise<InlineUploadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "파일을 선택해 주세요." };

  const ext = file.name.split(".").pop() || "bin";
  const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("chat")
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (uploadError) return { error: "업로드 중 오류가 발생했습니다." };

  const { data: signed } = await supabase.storage.from("chat").createSignedUrl(path, 3600);
  if (!signed?.signedUrl) return { error: "미리보기를 불러오는 중 오류가 발생했습니다." };

  return {
    path,
    url: signed.signedUrl,
    fileName: file.name,
    isImage: file.type.startsWith("image/"),
  };
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

  // 방을 select까지 해서 돌려받으려 하면, 초대 전용으로 바뀐 select
  // 정책(chat_rooms_select_member) 때문에 "만든 사람 자신도 아직
  // chat_room_members에 없는" 이 시점엔 막혀서 room이 null로 온다.
  // id를 미리 만들어서 넘기면 insert만으로 끝나 select 권한이 필요 없다.
  const roomId = crypto.randomUUID();
  const { error } = await supabase
    .from("chat_rooms")
    .insert({ id: roomId, name, created_by: user.id });

  if (error) {
    return { error: "채팅방을 만드는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  // 방 만든 사람 본인의 참여 기록은 따로, 반드시 확인하면서 넣는다 —
  // 이게 실패하면 redirect 뒤에 자기가 만든 방이 select 정책에 막혀
  // 404로 보이게 되므로, 실패 시 리다이렉트하지 않고 바로 에러를 알린다.
  const now = new Date().toISOString();
  const { error: selfMemberError } = await supabase
    .from("chat_room_members")
    .insert({ room_id: roomId, user_id: user.id, last_read_at: now });

  if (selfMemberError) {
    console.error("[createChatRoom] 본인 참여 등록 실패", selfMemberError);
    return { error: "채팅방을 만드는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  if (inviteeIds.length > 0) {
    const { error: inviteError } = await supabase
      .from("chat_room_members")
      .insert(inviteeIds.map((id) => ({ room_id: roomId, user_id: id })));
    if (inviteError) {
      console.error("[createChatRoom] 초대 등록 실패", inviteError);
    }
  }

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
          url: `/messages/rooms/${roomId}`,
        })
      )
    );
  } catch (err) {
    console.error("[createChatRoom] 초대 알림 발송 중 오류", err);
  }

  revalidatePath("/messages/rooms");
  redirect(`/messages/rooms/${roomId}`);
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
