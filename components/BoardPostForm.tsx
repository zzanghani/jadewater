"use client";

import { useActionState, useRef, useState } from "react";
import { createBoardPost, type BoardFormState } from "@/app/(app)/board/actions";
import BoardBody from "@/components/BoardBody";
import BoardContentEditor from "@/components/BoardContentEditor";
import { uploadFileToBucket } from "@/lib/uploadToStorage";
import type { BoardCategory } from "@/lib/types";

type UploadedFile = { path: string; fileName: string };

const HAS_RICH_CONTENT = /[▶]|!\[.*\]\(.*\)|\[📎|^\|.*\|$/m;

const NOTICE: BoardCategory = "공지사항";
const WORK_CATEGORIES: BoardCategory[] = ["마케팅", "운영HR", "디자인", "R&D"];

type Profile = { id: string; name: string };

export default function BoardPostForm({
  profiles,
  defaultCategory,
  isMaster,
}: {
  profiles: Profile[];
  defaultCategory: BoardCategory;
  isMaster: boolean;
}) {
  const [state, formAction, pending] = useActionState<BoardFormState, FormData>(
    createBoardPost,
    undefined
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [category, setCategory] = useState<BoardCategory>(defaultCategory);
  const [bodyPreview, setBodyPreview] = useState("");
  const [urlByPath, setUrlByPath] = useState<Record<string, string>>({});

  function toggleFollower(id: string) {
    setFollowerIds((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }

  // 고르는 즉시 브라우저에서 스토리지로 올리고, 등록 때는 경로만 넘긴다.
  // 파일을 폼에 실어 서버 액션으로 보내면 Vercel 요청 한도(4.5MB)에 걸려
  // "페이지를 로드할 수 없습니다"로 죽는다.
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of files) {
        const result = await uploadFileToBucket("board", file);
        if ("error" in result) {
          setUploadError(`${file.name}: ${result.error}`);
          continue;
        }
        setUploaded((prev) => [...prev, { path: result.path, fileName: result.fileName }]);
      }
    } finally {
      setUploading(false);
    }
  }

  function removeUploaded(path: string) {
    setUploaded((prev) => prev.filter((f) => f.path !== path));
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 text-sm font-medium">
        카테고리
        <input type="hidden" name="category" value={category} />
        {isMaster && (
          <button
            type="button"
            onClick={() => setCategory(NOTICE)}
            className={`rounded-xl py-2 text-center text-xs font-semibold transition-colors ${
              category === NOTICE
                ? "bg-brand text-white shadow-sm"
                : "border border-border bg-card text-muted"
            }`}
          >
            공지사항
          </button>
        )}
        <div className="grid grid-cols-4 gap-2">
          {WORK_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-xl py-2 text-center text-xs font-semibold transition-colors ${
                category === c
                  ? "bg-brand text-white shadow-sm"
                  : "border border-border bg-card text-muted"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        제목
        <input
          type="text"
          name="title"
          required
          placeholder="제목을 입력하세요"
          className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
      </label>

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        내용
        <BoardContentEditor
          name="body"
          onSerializedChange={setBodyPreview}
          onUploaded={(path, url) => setUrlByPath((prev) => ({ ...prev, [path]: url }))}
        />
        {HAS_RICH_CONTENT.test(bodyPreview) && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-border bg-background p-3">
            <p className="text-xs font-semibold text-muted">미리보기</p>
            <BoardBody body={bodyPreview} urlByPath={urlByPath} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        Follower <span className="font-normal text-muted">(업무 처리가 필요한 글이면 여러 명 지정 가능)</span>
        <div className="flex flex-wrap gap-2">
          {profiles.map((p) => {
            const selected = followerIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleFollower(p.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selected
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border bg-card text-muted"
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
        {followerIds.map((id) => (
          <input key={id} type="hidden" name="follower_ids" value={id} />
        ))}
      </div>

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        파일/사진 첨부
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card py-4 text-sm font-semibold text-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
        >
          {uploading ? "업로드 중..." : "📎 파일 선택하기"}
        </button>
        {uploaded.length > 0 && (
          <div className="flex flex-col gap-1 rounded-xl bg-background px-3 py-2 text-xs text-muted">
            {uploaded.map((f) => (
              <div key={f.path} className="flex items-center gap-2">
                <span className="flex-1 truncate">{f.fileName}</span>
                <button
                  type="button"
                  onClick={() => removeUploaded(f.path)}
                  className="text-[11px] font-semibold text-red-600"
                >
                  빼기
                </button>
                <input type="hidden" name="attachment_path" value={f.path} />
                <input type="hidden" name="attachment_name" value={f.fileName} />
              </div>
            ))}
          </div>
        )}
        {uploadError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{uploadError}</p>
        )}
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
      >
        {pending ? "등록 중..." : "등록"}
      </button>
    </form>
  );
}
