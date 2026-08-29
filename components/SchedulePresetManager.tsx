"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deletePreset, savePreset } from "@/app/(app)/schedule/actions";
import { BREAK_MINUTE_OPTIONS } from "@/lib/scheduleColors";
import AmPmTimeSelect, { parseTimeTo12h, type TimeValue } from "@/components/AmPmTimeSelect";
import type { ScheduleShiftPreset } from "@/lib/types";

function formatTime12h(time: string): string {
  const { period, hour, minute } = parseTimeTo12h(time);
  return `${period} ${hour}:${String(minute).padStart(2, "0")}`;
}

function PresetForm({
  preset,
  onCancel,
  onSaved,
}: {
  preset: ScheduleShiftPreset | null; // null = 새 프리셋 추가
  onCancel: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(savePreset, undefined);
  const [name, setName] = useState(preset?.name ?? "");
  const [start, setStart] = useState<TimeValue>(parseTimeTo12h(preset?.start_time ?? "09:00"));
  const [end, setEnd] = useState<TimeValue>(parseTimeTo12h(preset?.end_time ?? "18:00"));
  const [breakMinutes, setBreakMinutes] = useState(preset?.break_minutes ?? 0);

  useEffect(() => {
    if (!state?.success) return;
    router.refresh();
    onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-xl border border-brand bg-background p-3"
    >
      <input type="hidden" name="id" value={preset?.id ?? ""} />
      <input
        type="text"
        name="name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="예: 오픈조"
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
      />
      <div className="flex flex-col gap-1 text-xs font-medium text-muted">
        출근
        <AmPmTimeSelect name="start_time" value={start} onChange={setStart} />
      </div>
      <div className="flex flex-col gap-1 text-xs font-medium text-muted">
        퇴근
        <AmPmTimeSelect name="end_time" value={end} onChange={setEnd} />
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        휴게시간
        <select
          name="break_minutes"
          value={breakMinutes}
          onChange={(e) => setBreakMinutes(Number(e.target.value))}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none ring-brand/30 focus:ring-2"
        >
          {BREAK_MINUTE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m === 0 ? "없음" : `${m}분`}
            </option>
          ))}
        </select>
      </label>

      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-border py-2 text-xs font-semibold text-muted"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-brand py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {pending ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}

export default function SchedulePresetManager({
  presets,
  onClose,
}: {
  presets: ScheduleShiftPreset[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function handleDelete(preset: ScheduleShiftPreset) {
    if (!window.confirm(`"${preset.name}" 프리셋을 삭제할까요?`)) return;
    const formData = new FormData();
    formData.set("id", preset.id);
    deletePreset(formData).then(() => router.refresh());
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => {
        // 이 배경 클릭이 부모 셀 편집 팝업의 배경 클릭 핸들러까지 버블링돼
        // 두 팝업이 한 번에 닫히지 않도록 막는다.
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-card p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">빠른입력 프리셋 관리</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-muted">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {presets.length === 0 && !adding && (
            <p className="text-sm text-muted">등록된 프리셋이 없습니다.</p>
          )}
          {presets.map((p) =>
            editingId === p.id ? (
              <PresetForm
                key={p.id}
                preset={p}
                onCancel={() => setEditingId(null)}
                onSaved={() => setEditingId(null)}
              />
            ) : (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted">
                    {formatTime12h(p.start_time)} ~ {formatTime12h(p.end_time)}
                    {p.break_minutes > 0 ? ` · 휴게 ${p.break_minutes}분` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingId(p.id)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:text-brand"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-red-500"
                  >
                    삭제
                  </button>
                </div>
              </div>
            )
          )}

          {adding ? (
            <PresetForm preset={null} onCancel={() => setAdding(false)} onSaved={() => setAdding(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-xl border border-dashed border-border py-2.5 text-sm font-semibold text-muted transition-colors hover:border-brand hover:text-brand"
            >
              + 새 프리셋 추가
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
