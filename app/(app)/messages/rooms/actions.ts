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

export type ResolvedFileUrls = Record<string, { url: string; downloadUrl: string }>;

// 실시간으로 새로 도착한 메시지 안에 사진/파일 참조가 있으면, 그
// 경로들만 즉석에서 서명 URL을 받아온다(초기 로드 때 하던 일괄 서명과
// 같은 방식, 새 메시지 하나 분량만).
export async function resolveChatFileUrls(paths: string[]): Promise<ResolvedFileUrls> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || paths.length === 0) return {};

  const [{ data: signedUrls }, { data: downloadSignedUrls }] = await Promise.all([
    supabase.storage.from("chat").createSignedUrls(paths, 3600),
    supabase.storage.from("chat").createSignedUrls(paths, 3600, { download: true }),
  ]);

  const downloadByPath = new Map((downloadSignedUrls ?? []).map((s) => [s.path, s.signedUrl]));
  const result: ResolvedFileUrls = {};
  for (const s of signedUrls ?? []) {
    const downloadUrl = s.path ? downloadByPath.get(s.path) : null;
    if (s.path && s.signedUrl && downloadUrl) {
      result[s.path] = { url: s.signedUrl, downloadUrl };
    }
  }
  return result;
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

  // 채팅방 개설은 지점장·마스터만 — 팀(본사) 계정과 직원(staff) 계정은
  // 초대받아 참여만 할 수 있다. RLS(chat_rooms_insert_own)에서도 같은
  // 조건으로 다시 막아준다.
  const { data: creatorProfile } = await supabase
    .from("profiles")
    .select("name, department, store_id, role")
    .eq("id", user.id)
    .single();
  const isMasterCreator = !creatorProfile?.department && !creatorProfile?.store_id;
  const isManagerCreator =
    !creatorProfile?.department && !!creatorProfile?.store_id && creatorProfile.role === "owner";
  if (!isMasterCreator && !isManagerCreator) {
    return { error: "채팅방은 지점장 또는 마스터 계정만 만들 수 있습니다." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "채팅방 이름을 입력해 주세요." };

  const inviteeIds = [...new Set(formData.getAll("invitee_ids").map(String))].filter(
    (id) => id !== user.id
  );

  // 매장(지점장) 계정은 항상 자기 매장 전용 방만 만든다(폼 값을 신뢰하지
  // 않고 서버에서 강제). 마스터는 폼에서 고른 store_id를 그대로 쓰고,
  // 비어 있으면 회사(전사) 방이 된다.
  const storeId = isManagerCreator
    ? creatorProfile!.store_id
    : String(formData.get("store_id") ?? "").trim() || null;

  // 방을 select까지 해서 돌려받으려 하면, 초대 전용으로 바뀐 select
  // 정책(chat_rooms_select_member) 때문에 "만든 사람 자신도 아직
  // chat_room_members에 없는" 이 시점엔 막혀서 room이 null로 온다.
  // id를 미리 만들어서 넘기면 insert만으로 끝나 select 권한이 필요 없다.
  const roomId = crypto.randomUUID();
  const { error } = await supabase
    .from("chat_rooms")
    .insert({ id: roomId, name, created_by: user.id, store_id: storeId });

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

  // 대화창 안의 새 메시지는 이제 Realtime 구독으로 바로 반영되므로,
  // 여기서 그 경로를 다시 revalidate하면 서버가 다시 렌더링한 목록이
  // Realtime으로 받은 목록과 겹쳐 중복으로 보일 수 있어 뺐다. 방 목록
  // 화면의 "마지막 메시지 미리보기"만 최신화한다.
  revalidatePath("/messages/rooms");

  try {
    const [{ data: senderProfile }, { data: room }, { data: members }] = await Promise.all([
      supabase.from("profiles").select("name").eq("id", user.id).single(),
      supabase.from("chat_rooms").select("name").eq("id", roomId).single(),
      supabase.from("chat_room_members").select("user_id").eq("room_id", roomId),
    ]);
    const senderName = senderProfile?.name ?? "누군가";
    const roomName = room?.name ?? "채팅방";
    const targets = (members ?? []).map((m) => m.user_id).filter((id) => id !== user.id);

    // 메시지에 "@이름"으로 태그된 사람에게는 일반 새 메시지 알림 대신
    // 태그 전용 알림을 보낸다(둘 다 보내면 같은 메시지로 알림이 중복됨).
    const { data: targetProfiles } = await supabase.from("profiles").select("id, name").in("id", targets);
    const nameById = new Map((targetProfiles ?? []).map((p) => [p.id, p.name]));

    await Promise.all(
      targets.map((id) => {
        const name = nameById.get(id);
        const mentioned = name ? body.includes(`@${name}`) : false;
        return sendPushToUser(supabase, id, mentioned
          ? {
              title: `${senderName}님이 회원님을 태그했습니다`,
              body: body.slice(0, 80),
              url: `/messages/rooms/${roomId}`,
            }
          : {
              title: `${roomName} · ${senderName}`,
              body: body.slice(0, 80),
              url: `/messages/rooms/${roomId}`,
            });
      })
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
