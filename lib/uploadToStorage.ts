"use client";

import { createClient } from "@/lib/supabase/client";
import type { InlineUploadResult } from "@/components/MediaInsertButton";

// 브라우저에서 Supabase 스토리지로 바로 올린다. 서버 액션(Vercel 함수)을
// 거치면 요청 본문 4.5MB 한도에 걸려 폰 사진·PDF 몇 장에 "페이지를 로드할 수
// 없습니다"로 죽는다 — 스토리지에 직접 올리면 그 한도를 안 탄다.
export async function uploadFileToBucket(bucket: string, file: File): Promise<InlineUploadResult> {
  if (file.size === 0) return { error: "파일을 선택해 주세요." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const ext = file.name.split(".").pop() || "bin";
  const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (uploadError) {
    console.error("[uploadFileToBucket]", bucket, uploadError);
    return { error: "업로드 중 오류가 발생했습니다. 파일이 너무 크면 나눠서 올려 주세요." };
  }

  const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (!signed?.signedUrl) return { error: "미리보기를 불러오는 중 오류가 발생했습니다." };

  return {
    path,
    url: signed.signedUrl,
    fileName: file.name,
    isImage: file.type.startsWith("image/"),
  };
}

// MediaInsertButton의 uploadAction 자리에 그대로 꽂을 수 있는 형태.
export function makeInlineUploader(bucket: string) {
  return async (formData: FormData): Promise<InlineUploadResult> => {
    const file = formData.get("file");
    if (!(file instanceof File)) return { error: "파일을 선택해 주세요." };
    return uploadFileToBucket(bucket, file);
  };
}
