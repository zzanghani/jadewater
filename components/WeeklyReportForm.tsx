"use client";

import { useActionState } from "react";
import { saveWeeklyReport, type WeeklyFormState } from "@/app/(app)/weekly-report/actions";
import WeeklyListEditor from "@/components/WeeklyListEditor";
import WeeklySalesTableEditor from "@/components/WeeklySalesTableEditor";
import type { WeeklyReport } from "@/lib/types";

function Section({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold">
        {icon} {label}
      </h3>
      {children}
    </div>
  );
}

export default function WeeklyReportForm({
  storeId,
  weekStart,
  weekLabel,
  existing,
}: {
  storeId: string;
  weekStart: string;
  weekLabel: string;
  existing?: WeeklyReport;
}) {
  const [state, formAction, pending] = useActionState<WeeklyFormState, FormData>(
    saveWeeklyReport,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="store_id" value={storeId} />
      <input type="hidden" name="week_start" value={weekStart} />

      <h1 className="text-lg font-bold">{weekLabel} 주간보고</h1>

      <Section icon="🎯" label="주간목표">
        <WeeklyListEditor fieldName="goals_json" initial={existing?.goals ?? []} />
      </Section>

      <Section icon="👥" label="HR - 진행상황">
        <WeeklyListEditor fieldName="hr_items_json" initial={existing?.hr_items ?? []} />
      </Section>

      <Section icon="💰" label="매출">
        <WeeklyListEditor fieldName="sales_notes_json" initial={existing?.sales_notes ?? []} />
        <div className="mt-4">
          <WeeklySalesTableEditor fieldName="sales_table_json" initial={existing?.sales_table ?? []} />
        </div>
      </Section>

      <Section icon="⭐" label="주간이슈">
        <WeeklyListEditor fieldName="issues_json" initial={existing?.issues ?? []} />
      </Section>

      <Section icon="🍳" label="키친">
        <WeeklyListEditor fieldName="kitchen_items_json" initial={existing?.kitchen_items ?? []} />
      </Section>

      <Section icon="🍽️" label="홀">
        <WeeklyListEditor fieldName="hall_items_json" initial={existing?.hall_items ?? []} />
      </Section>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
      >
        {pending ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
