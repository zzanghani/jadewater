"use client";

import { toggleLayoutMode } from "@/app/actions/layoutMode";

export default function LayoutModeToggle({ desktopMode }: { desktopMode: boolean }) {
  return (
    <form action={toggleLayoutMode}>
      <button
        type="submit"
        title={desktopMode ? "모바일 화면으로 전환" : "데스크탑 화면으로 전환"}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-sm text-muted transition-colors hover:text-brand"
      >
        {desktopMode ? "📱" : "🖥️"}
      </button>
    </form>
  );
}
