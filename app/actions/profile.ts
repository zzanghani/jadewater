"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AvatarFormState = { error?: string; success?: boolean } | undefined;

const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

export async function updateAvatar(
  _prevState: AvatarFormState,
  formData: FormData
): Promise<AvatarFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  const photo = formData.get("avatar");
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "사진을 선택해 주세요." };
  }
  if (!photo.type.startsWith("image/")) {
    return { error: "이미지 파일만 등록할 수 있습니다." };
  }
  if (photo.size > MAX_AVATAR_BYTES) {
    return { error: "3MB 이하 이미지만 등록할 수 있습니다." };
  }

  const ext = photo.name.split(".").pop() || "jpg";
  const path = `${user.id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, photo, { contentType: photo.type || "image/jpeg" });
  if (uploadError) {
    console.error(
      `[updateAvatar] 업로드 실패 (user_id=${user.id}, path=${path})`,
      uploadError
    );
    return { error: `사진 업로드 중 오류가 발생했습니다. (${uploadError.message})` };
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .single();

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", user.id);
  if (updateError) {
    return { error: "저장 중 오류가 발생했습니다." };
  }

  if (existing?.avatar_path) {
    await supabase.storage.from("avatars").remove([existing.avatar_path]);
  }

  revalidatePath("/", "layout");
  return { success: true };
}
