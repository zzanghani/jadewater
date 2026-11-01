"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type DeleteAccountState = { error: string } | undefined;

// 앱 내 계정 삭제(회원 탈퇴).
//
// 스토어 심사(애플·구글)가 요구하는 기능. profiles.id는 마감·입고·게시판 등
// 수십 개 업무 기록의 created_by가 참조하고 있어 행을 실제로 지울 수 없고,
// 그 기록들은 회사의 회계·노무 자료라 지워서도 안 된다. 그래서 "삭제"는
//   1) 개인 설정(푸시 구독·출퇴근 알림·팔로우·채팅방 멤버) 삭제
//   2) 프로필 사진 파일 삭제
//   3) 프로필 익명화 — 이름 '탈퇴한 사용자', 이메일 무작위, 소속·부서·사진 제거,
//      status = 'deleted', deleted_at 기록 (supabase/migration_account_deletion.sql)
//   4) 로그인 계정(auth.users) — 이메일을 무작위 값으로 바꾸고 비밀번호 교체,
//      영구 차단(ban). 원래 이메일로 다시 가입할 수 있게 된다.
// 로 처리한다. 이용자 입장에서는 개인정보가 모두 사라지고 다시 로그인할 수
// 없으므로 '삭제'이고, 회사 기록에는 '탈퇴한 사용자'가 쓴 것으로만 남는다.
//
// 서비스 롤 클라이언트는 원칙적으로 사용자 요청에서 쓰지 않지만(lib/supabase/service.ts),
// auth.users 변경은 서비스 키가 아니면 불가능하고, 여기서는 "본인이 비밀번호를
// 다시 입력해 확인한 자기 계정"에만 쓰므로 예외로 둔다.
export async function deleteMyAccount(
  _prevState: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  const password = String(formData.get("password") ?? "");
  const confirmed = formData.get("confirm") === "on";

  if (!confirmed) {
    return { error: "안내 내용을 읽고 확인란에 체크해 주세요." };
  }
  if (!password) {
    return { error: "본인 확인을 위해 비밀번호를 입력해 주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { error: "로그인이 필요합니다." };
  }

  // 본인 확인 — 현재 세션 쿠키와 별개로 비밀번호를 다시 검증한다. 쿠키를
  // 건드리지 않는 일회용 클라이언트를 쓴다.
  const verifier = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: verified, error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (verifyError || verified.user?.id !== user.id) {
    return { error: "비밀번호가 올바르지 않습니다." };
  }
  // 검증용으로 만든 세션은 바로 버린다(이 클라이언트 안에서만 정리).
  await verifier.auth.signOut({ scope: "local" }).catch(() => undefined);

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("role, store_id, department, status, avatar_path")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return { error: "계정 정보를 찾을 수 없습니다. 관리자에게 문의해 주세요." };
  }
  if (profile.status === "deleted") {
    await supabase.auth.signOut();
    redirect("/login?deleted=1");
  }

  // 마스터(대표) 계정 — 운영사 전체를 관리하는 유일한 계정이라 앱에서 지우면
  // 가입 승인·매장 연결을 아무도 못 하게 된다. 운영사 쪽에서 직접 처리한다.
  const isMaster = profile.role === "owner" && !profile.store_id && !profile.department;
  if (isMaster) {
    return {
      error:
        "대표(마스터) 계정은 앱에서 삭제할 수 없어요. 운영사(베스트메이트컴퍼니)에 문의해 주세요.",
    };
  }

  const anonymizedEmail = `deleted-${user.id.slice(0, 8)}-${Date.now().toString(36)}@deleted.invalid`;

  // 1) 개인 설정 삭제 — 알림이 더 가지 않게, 채팅방·팔로우 목록에서 빠지게.
  const cleanups = await Promise.all([
    service.from("push_subscriptions").delete().eq("user_id", user.id),
    service.from("attendance_reminders").delete().eq("user_id", user.id),
    service.from("board_post_followers").delete().eq("user_id", user.id),
    service.from("monthly_plan_followers").delete().eq("user_id", user.id),
    service.from("chat_room_members").delete().eq("user_id", user.id),
  ]);
  for (const { error } of cleanups) {
    if (error) console.error(`[deleteMyAccount] 개인 설정 삭제 실패 (user_id=${user.id})`, error);
  }

  // 2) 프로필 사진 파일 삭제
  if (profile.avatar_path) {
    const { error } = await service.storage.from("avatars").remove([profile.avatar_path]);
    if (error) console.error(`[deleteMyAccount] 사진 삭제 실패 (user_id=${user.id})`, error);
  }

  // 3) 프로필 익명화 (서비스 롤이므로 prevent_profile_privilege_escalation 트리거의
  //    auth.uid() 검사에 걸리지 않는다)
  const { error: profileError } = await service
    .from("profiles")
    .update({
      name: "탈퇴한 사용자",
      email: anonymizedEmail,
      avatar_path: null,
      store_id: null,
      department: null,
      role: "staff",
      status: "deleted",
      deleted_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (profileError) {
    console.error(`[deleteMyAccount] 프로필 익명화 실패 (user_id=${user.id})`, profileError);
    return { error: "계정 삭제 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  // 4) 로그인 계정 잠금 + 개인정보 제거. 실패해도 프로필은 이미 'deleted'라
  //    레이아웃이 앱 화면을 막는다(app/(app)/layout.tsx의 DeletedScreen).
  const { error: authError } = await service.auth.admin.updateUserById(user.id, {
    email: anonymizedEmail,
    email_confirm: true,
    password: `${randomUUID()}${randomUUID()}`,
    user_metadata: { name: "탈퇴한 사용자" },
    ban_duration: "876000h", // 100년 = 영구 차단
  });
  if (authError) {
    console.error(`[deleteMyAccount] 로그인 계정 잠금 실패 (user_id=${user.id})`, authError);
  }

  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
