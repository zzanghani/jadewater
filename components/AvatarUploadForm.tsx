"use client";

import { useActionState, useState } from "react";
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  return (
    <form action={formAction} className="flex flex-col items-center gap-4">
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
