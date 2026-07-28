"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import {
  daysInMonthKST,
  kstDateString,
  kstWeekday,
  monthRangeFromMonthString,
  shiftMonthString,
} from "@/lib/date";
import { PLAN_COLORS } from "@/lib/planColors";
import { createMonthlyPlan, deleteMonthlyPlan } from "@/app/(app)/plan/actions";
import MonthlyPlanDetail, { type PlanComment, type PlanFollower } from "@/components/MonthlyPlanDetail";
import type { MonthlyPlan, MonthlyPlanType } from "@/lib/types";

type HqProfile = { id: string; name: string };

const PLAN_TYPE_LABEL: Record<MonthlyPlanType, string> = { task: "업무계획", vacation: "휴가" };

const WEEKDAY_HEADER = ["일", "월", "화", "수", "목", "금", "토"];

type Cell = string | null;

function buildWeeks(month: string): Cell[][] {
  const range = monthRangeFromMonthString(month);
  const days = daysInMonthKST(range.start);
  const firstWeekday = kstWeekday(days[0]);
  const leading: Cell[] = Array.from({ length: firstWeekday }, () => null);
  const cells: Cell[] = [...leading, ...days];
  const trailingCount = (7 - (cells.length % 7)) % 7;
  const trailing: Cell[] = Array.from({ length: trailingCount }, () => null);
  const all = [...cells, ...trailing];
  const weeks: Cell[][] = [];
  for (let i = 0; i < all.length; i += 7) weeks.push(all.slice(i, i + 7));
  return weeks;
}

// 겹치지 않는 일정끼리는 같은 줄(레인)을 재사용하고, 겹치면 다음 레인으로 —
// 달 전체에서 같은 일정은 항상 같은 줄에 그려져 주 사이를 오가도 헷갈리지 않는다.
function assignLanes(plans: MonthlyPlan[]): Map<string, number> {
  const sorted = [...plans].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const laneEnds: string[] = [];
  const laneOf = new Map<string, number>();
  for (const p of sorted) {
    let lane = laneEnds.findIndex((end) => end < p.start_date);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(p.end_date);
    } else {
      laneEnds[lane] = p.end_date;
    }
    laneOf.set(p.id, lane);
  }
  return laneOf;
}

export default function MonthlyPlanCalendar({
  plans,
  commentsByPlan = {},
  followersByPlan = {},
  hqProfiles = [],
  currentUserId,
}: {
  plans: MonthlyPlan[];
  commentsByPlan?: Record<string, PlanComment[]>;
  followersByPlan?: Record<string, PlanFollower[]>;
  hqProfiles?: HqProfile[];
  currentUserId?: string;
}) {
  const today = kstDateString(0);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [showForm, setShowForm] = useState(false);
  const [color, setColor] = useState(PLAN_COLORS[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [planType, setPlanType] = useState<MonthlyPlanType>("task");
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(createMonthlyPlan, undefined);
  const [, startTransition] = useTransition();

  function toggleFollower(id: string) {
    setFollowerIds((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }

  const range = monthRangeFromMonthString(month);
  const weeks = useMemo(() => buildWeeks(month), [month]);

  const visiblePlans = useMemo(
    () => plans.filter((p) => p.start_date <= range.end && p.end_date >= range.start),
    [plans, range.start, range.end]
  );
  const laneOf = useMemo(() => assignLanes(visiblePlans), [visiblePlans]);

  useEffect(() => {
    if (state?.success) {
      setShowForm(false);
      setShowColorPicker(false);
      setColor(PLAN_COLORS[0]);
      setPlanType("task");
      setFollowerIds([]);
    }
  }, [state]);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">월간계획</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full border border-brand px-3 py-1 text-xs font-semibold text-brand"
        >
          {showForm ? "닫기" : "+ 일정 추가"}
        </button>
      </div>

      {showForm && (
        <form action={formAction} className="mb-4 flex flex-col gap-2 rounded-xl bg-background p-3">
          <input type="hidden" name="color" value={color} />
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
            placeholder="일정 제목 (예: 여름 시즌 프로모션)"
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
          />
          <textarea
            name="description"
            rows={3}
            placeholder="일정 내용 (선택)"
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
          />
          <div className="flex gap-2">
            <input
              type="date"
              name="start_date"
              required
              defaultValue={today}
              className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none ring-brand/30 focus:ring-2"
            />
            <input
              type="date"
              name="end_date"
              required
              defaultValue={today}
              className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none ring-brand/30 focus:ring-2"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowColorPicker((v) => !v)}
              className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <span className="h-5 w-5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="flex-1 text-left text-muted">색상 선택</span>
              <span className="text-xs text-muted">{showColorPicker ? "닫기 ▲" : "펼치기 ▼"}</span>
            </button>
            {showColorPicker && (
              <div className="mt-2 flex gap-2 overflow-x-auto rounded-lg border border-border bg-card p-2">
                {PLAN_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setColor(c);
                      setShowColorPicker(false);
                    }}
                    aria-label="색상 선택"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
                    style={{ backgroundColor: c }}
                  >
                    {color === c && (
                      <span className="text-xs font-bold text-white drop-shadow">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {hqProfiles.length > 0 && (
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
          )}

          {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "저장 중..." : "추가"}
          </button>
        </form>
      )}

      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonthString(m, -1))}
          aria-label="이전달"
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:text-foreground"
        >
          ←
        </button>
        <span className="text-sm font-bold">{range.label}</span>
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonthString(m, 1))}
          aria-label="다음달"
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:text-foreground"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-x-1 text-center text-[10px] font-semibold text-muted">
        {WEEKDAY_HEADER.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="flex flex-col gap-0.5">
        {weeks.map((week, wi) => {
          const segments = visiblePlans
            .map((p) => {
              let startCol = -1;
              let endCol = -1;
              for (let i = 0; i < 7; i++) {
                const d = week[i];
                if (!d) continue;
                if (d >= p.start_date && d <= p.end_date) {
                  if (startCol === -1) startCol = i;
                  endCol = i;
                }
              }
              return startCol === -1 ? null : { plan: p, startCol, endCol, lane: laneOf.get(p.id) ?? 0 };
            })
            .filter((s): s is { plan: MonthlyPlan; startCol: number; endCol: number; lane: number } => s !== null);
          const maxLane = segments.reduce((m, s) => Math.max(m, s.lane), -1);

          return (
            <div key={wi} className="grid grid-cols-7 gap-x-1 gap-y-0.5" style={{ gridAutoRows: "min-content" }}>
              {week.map((d, di) => (
                <div
                  key={di}
                  className={`flex h-6 items-center justify-center rounded-md text-[11px] font-semibold ${
                    d === today ? "bg-brand text-white" : d ? "text-foreground" : ""
                  }`}
                  style={{ gridColumn: di + 1, gridRow: 1 }}
                >
                  {d ? Number(d.slice(-2)) : ""}
                </div>
              ))}
              {segments.map(({ plan, startCol, endCol, lane }) => (
                <div
                  key={plan.id}
                  title={plan.title}
                  className="flex h-4 items-center overflow-hidden rounded-sm px-1 text-[9px] font-semibold text-white"
                  style={{
                    gridColumn: `${startCol + 1} / ${endCol + 2}`,
                    gridRow: lane + 2,
                    backgroundColor: plan.color,
                  }}
                >
                  <span className="truncate">{plan.title}</span>
                </div>
              ))}
              {maxLane >= 0 &&
                Array.from({ length: maxLane + 1 }, (_, l) => (
                  <div key={`spacer-${l}`} style={{ gridColumn: "1 / 2", gridRow: l + 2 }} className="h-4" />
                ))}
            </div>
          );
        })}
      </div>

      {visiblePlans.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
          {visiblePlans.map((p) => {
            const isExpanded = expandedId === p.id;
            const commentCount = commentsByPlan[p.id]?.length ?? 0;
            const followers = followersByPlan[p.id] ?? [];
            const confirmedCount = followers.filter((f) => f.confirmed).length;
            return (
              <div key={p.id} className="flex flex-col gap-2">
                <div className="flex w-full items-center gap-2 rounded-lg py-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                    className="flex flex-1 items-center gap-2 text-left transition-colors hover:text-brand"
                  >
                    <span
                      className={`shrink-0 text-muted transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      aria-hidden
                    >
                      ▶
                    </span>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="flex-1 truncate text-foreground">{p.title}</span>
                    {p.plan_type === "vacation" && (
                      <span className="shrink-0 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                        휴가
                      </span>
                    )}
                    {followers.length > 0 && (
                      <span
                        className={`shrink-0 ${
                          confirmedCount === followers.length ? "text-brand" : "text-muted"
                        }`}
                      >
                        ✔ {confirmedCount}/{followers.length}
                      </span>
                    )}
                    {commentCount > 0 && (
                      <span className="shrink-0 text-muted">💬 {commentCount}</span>
                    )}
                    <span className="shrink-0 text-muted">
                      {p.start_date.slice(5).replace("-", ".")} ~ {p.end_date.slice(5).replace("-", ".")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => startTransition(() => deleteMonthlyPlan(p.id))}
                    className="shrink-0 text-muted"
                    aria-label="삭제"
                  >
                    ✕
                  </button>
                </div>
                {isExpanded && (
                  <MonthlyPlanDetail
                    planId={p.id}
                    description={p.description}
                    followers={followers}
                    comments={commentsByPlan[p.id] ?? []}
                    currentUserId={currentUserId}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
