"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateAvatar } from "@/app/actions/profile";
import Avatar from "@/components/Avatar";

export default function AvatarUploadForm({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateAvatar, undefined);
  const [preview, setPreview] = useState<string | null>(null);
  // 선택한 파일을 state로 직접 들고 있다가 제출한다. 네이티브 <input>의
  // files를 제출 시점에 다시 읽으면, 일부 모바일 브라우저(사진 라이브러리에서
  // 고른 직후 등)에서 그 사이 값이 비어버려 "사진을 선택해 주세요" 오류가
  // 나는 경우가 있었다.
  const [file, setFile] = useState<File | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!pending) submittingRef.current = false;
  }, [pending]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current || !file) return;
    submittingRef.current = true;
    const formData = new FormData();
    formData.append("avatar", file);
    formAction(formData);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
      <Avatar name={name} avatarUrl={preview ?? avatarUrl} size={88} />

      <label className="cursor-pointer rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground">
        사진 선택
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      {state?.success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          프로필 사진이 저장되었습니다.
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !file}
        className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
      >
        {pending ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
