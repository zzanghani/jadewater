"use client";

import { useState } from "react";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic"]);

type Attachment = { id: string; file_name: string; url?: string };

function isImageFile(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXT.has(ext);
}

export default function BoardAttachmentList({
  attachments,
}: {
  attachments: Attachment[];
}) {
  const [selected, setSelected] = useState<Attachment | null>(null);

  if (attachments.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {attachments.map((a) =>
          isImageFile(a.file_name) && a.url ? (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a)}
              className="block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url}
                alt={a.file_name}
                className="h-24 w-24 rounded-lg border border-border object-cover"
              />
            </button>
          ) : (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
            >
              📎 {a.file_name}
            </button>
          )
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative flex max-h-[85vh] w-full max-w-sm flex-col gap-3 overflow-y-auto rounded-2xl bg-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="닫기"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-lg text-white"
            >
              ✕
            </button>

            {isImageFile(selected.file_name) && selected.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.url}
                alt={selected.file_name}
                className="mt-6 w-full rounded-xl object-contain"
              />
            ) : (
              <div className="mt-6 flex h-40 w-full items-center justify-center rounded-xl bg-background text-3xl">
                📎
              </div>
            )}

            <p className="truncate text-sm font-medium text-foreground">{selected.file_name}</p>

            {selected.url && (
              <a
                href={selected.url}
                download={selected.file_name}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-brand py-2.5 text-center text-sm font-semibold text-white shadow-sm shadow-brand/30"
              >
                다운로드
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
