"use client";

import { useActionState, useEffect, useState } from "react";
import { createMonthlyPlan, updateMonthlyPlan, type PlanFormState } from "@/app/(app)/plan/actions";
import AmPmTimeSelect, { parseTimeTo12h } from "@/components/AmPmTimeSelect";
import DateRangePicker from "@/components/DateRangePicker";
import type { MonthlyPlan, MonthlyPlanType } from "@/lib/types";

const PLAN_TYPE_LABEL: Record<MonthlyPlanType, string> = { task: "업무계획", vacation: "휴가" };
const TIME_MINUTES = [0, 15, 30, 45];

type HqProfile = { id: string; name: string };

export default function MonthlyPlanForm({
  today,
  existing,
  hqProfiles = [],
  onDone,
}: {
  today: string;
  existing?: MonthlyPlan;
  hqProfiles?: HqProfile[];
  onDone?: () => void;
}) {
  const action = existing ? updateMonthlyPlan : createMonthlyPlan;
  const [state, formAction, pending] = useActionState<PlanFormState, FormData>(action, undefined);
  const [planType, setPlanType] = useState<MonthlyPlanType>(existing?.plan_type ?? "task");
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(existing?.start_date ?? today);
  const [endDate, setEndDate] = useState(existing?.end_date ?? today);

  useEffect(() => {
    if (state?.success) onDone?.();
  }, [state, onDone]);

  function toggleFollower(id: string) {
    setFollowerIds((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }

  const timeDefault = parseTimeTo12h(existing?.start_time);

  return (
    <form action={formAction} className="mb-4 flex flex-col gap-2 rounded-xl bg-background p-3">
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <input type="hidden" name="plan_type" value={planType} />

      <div className="flex gap-1.5 rounded-lg border border-border bg-card p-1">
        {(Object.keys(PLAN_TYPE_LABEL) as MonthlyPlanType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setPlanType(t)}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
              planType === t ? "bg-brand text-white" : "text-muted"
            }`}
          >
            {PLAN_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <input
        type="text"
        name="title"
        required
        defaultValue={existing?.title}
        placeholder="일정 제목 (예: 여름 시즌 프로모션)"
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
      />
      <textarea
        name="description"
        rows={3}
        defaultValue={existing?.description ?? ""}
        placeholder="일정 내용 (선택)"
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
      />
      <input type="hidden" name="start_date" value={startDate} />
      <input type="hidden" name="end_date" value={endDate} />
      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onChange={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }}
      />

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        시각
        <AmPmTimeSelect
          name="start_time"
          defaultPeriod={timeDefault.period}
          defaultHour={timeDefault.hour}
          defaultMinute={timeDefault.minute}
          minutes={TIME_MINUTES}
        />
      </div>

      {!existing && hqProfiles.length > 0 && (
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          담당자 <span className="font-normal text-muted">(확인이 필요한 사람을 지정, 선택)</span>
          <div className="flex flex-wrap gap-1.5">
            {hqProfiles.map((p) => {
              const selected = followerIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleFollower(p.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selected ? "border-brand bg-brand/10 text-brand" : "border-border bg-card text-muted"
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
      )}

      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        {existing && onDone && (
          <button
            type="button"
            onClick={onDone}
            className="flex-1 rounded-lg border border-border py-2 text-sm font-semibold text-muted"
          >
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "저장 중..." : existing ? "수정 저장" : "추가"}
        </button>
      </div>
    </form>
  );
}
