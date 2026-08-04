"use client";

import { useActionState, useRef, useState } from "react";
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
  // 모바일에서 저장 버튼이 겹눌림(더블탭)되면 두 번째 제출은 파일 없이
  // 나가서 "사진을 선택해 주세요" 오류가 뜬다. state 업데이트를 기다리지
  // 않고 즉시 막기 위해 ref로 막는다.
  const submittingRef = useRef(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (submittingRef.current) {
      e.preventDefault();
      return;
    }
    submittingRef.current = true;
    setTimeout(() => {
      submittingRef.current = false;
    }, 2000);
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className="flex flex-col items-center gap-4"
    >
      <Avatar name={name} avatarUrl={preview ?? avatarUrl} size={88} />

      <label className="cursor-pointer rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground">
        사진 선택
        <input
          type="file"
          name="avatar"
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
        disabled={pending || !preview}
        className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
      >
        {pending ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
