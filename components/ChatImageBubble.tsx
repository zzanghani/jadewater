"use client";

import { useState } from "react";
import { saveOrShareFile } from "@/lib/saveFile";

export default function ChatImageBubble({
  src,
  downloadHref,
  alt,
}: {
  src: string;
  downloadHref: string;
  alt: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="h-40 w-40 rounded-xl border border-black/10 object-cover"
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[85vh] max-w-[90vw] flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[70vh] max-w-full rounded-xl object-contain"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => saveOrShareFile(downloadHref, alt)}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand/30"
              >
                다운로드
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-muted"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
