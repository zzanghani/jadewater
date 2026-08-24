"use client";

import { useMemo, useState, useTransition } from "react";
import {
  daysInMonthKST,
  kstDateString,
  kstWeekday,
  monthRangeFromMonthString,
  shiftMonthString,
} from "@/lib/date";
import { deleteMonthlyPlan } from "@/app/(app)/plan/actions";
import MonthlyPlanDetail, { type PlanComment, type PlanFollower } from "@/components/MonthlyPlanDetail";
import MonthlyPlanForm from "@/components/MonthlyPlanForm";
import { departmentColor } from "@/lib/departmentColors";
import type { Department, MonthlyPlan } from "@/lib/types";

type HqProfile = { id: string; name: string; department?: Department | null };

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const range = monthRangeFromMonthString(month);
  const weeks = useMemo(() => buildWeeks(month), [month]);

  // 일정 색은 만든 사람(부서)마다 고정 — 마스터/마케팅/운영/R&D/디자인 5색.
  const colorByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of hqProfiles) map.set(p.id, departmentColor(p.department));
    return map;
  }, [hqProfiles]);
  const colorFor = (createdBy: string) => colorByUserId.get(createdBy) ?? departmentColor(null);
  const nameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of hqProfiles) map.set(p.id, p.name);
    return map;
  }, [hqProfiles]);
  const nameFor = (createdBy: string) => nameByUserId.get(createdBy) ?? "";

  const visiblePlans = useMemo(
    () =>
      plans.filter(
        (p) =>
          p.start_date <= range.end &&
          p.end_date >= range.start &&
          (!filterUserId || p.created_by === filterUserId)
      ),
    [plans, range.start, range.end, filterUserId]
  );
  const laneOf = useMemo(() => assignLanes(visiblePlans), [visiblePlans]);
  const expandedPlan = plans.find((p) => p.id === expandedId) ?? null;

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
        <MonthlyPlanForm today={today} hqProfiles={hqProfiles} onDone={() => setShowForm(false)} />
      )}

      {hqProfiles.length > 0 && (
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setFilterUserId(null)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              filterUserId === null
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted"
            }`}
          >
            전체
          </button>
          {hqProfiles.map((p) => {
            const active = filterUserId === p.id;
            const color = departmentColor(p.department);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setFilterUserId(active ? null : p.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
                style={
                  active
                    ? { backgroundColor: color, borderColor: color, color: "#fff" }
                    : { borderColor: color, color }
                }
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: active ? "#fff" : color }} />
                {p.name}
              </button>
            );
          })}
        </div>
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

      <div className="grid grid-cols-7 pb-1 text-center text-[10px] font-semibold text-muted">
        {WEEKDAY_HEADER.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border-l border-t border-border">
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
          const rowCount = maxLane + 2; // 날짜 숫자 1행 + 일정 레인 수

          return (
            <div
              key={wi}
              className="grid grid-cols-7"
              style={{ gridTemplateRows: `1.75rem repeat(${maxLane + 1}, 1.3rem)` }}
            >
              {week.map((d, di) => (
                <div
                  key={`bg-${di}`}
                  className="border-b border-r border-border"
                  style={{ gridColumn: di + 1, gridRow: `1 / span ${rowCount}` }}
                />
              ))}
              {week.map((d, di) => (
                <div
                  key={di}
                  className="flex items-start justify-center pt-1 text-[11px] font-semibold"
                  style={{ gridColumn: di + 1, gridRow: 1 }}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full ${
                      d === today ? "bg-brand text-white" : d ? "text-foreground" : ""
                    }`}
                  >
                    {d ? Number(d.slice(-2)) : ""}
                  </span>
                </div>
              ))}
              {segments.map(({ plan, startCol, endCol, lane }) => (
                <button
                  key={plan.id}
                  type="button"
                  title={plan.title}
                  onClick={() => setExpandedId(plan.id)}
                  className="mx-0.5 my-0.5 flex items-center overflow-hidden rounded-md px-1.5 text-left text-[9px] font-semibold text-white"
                  style={{
                    gridColumn: `${startCol + 1} / ${endCol + 2}`,
                    gridRow: lane + 2,
                    backgroundColor: colorFor(plan.created_by),
                  }}
                >
                  <span className="truncate">{plan.title}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {visiblePlans.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
          {visiblePlans.map((p) => {
            const isEditing = editingId === p.id;
            const isAuthor = !!currentUserId && currentUserId === p.created_by;
            const commentCount = commentsByPlan[p.id]?.length ?? 0;
            const followers = followersByPlan[p.id] ?? [];
            const confirmedCount = followers.filter((f) => f.confirmed).length;

            if (isEditing) {
              return (
                <MonthlyPlanForm
                  key={p.id}
                  today={today}
                  existing={p}
                  onDone={() => setEditingId(null)}
                />
              );
            }

            return (
              <div key={p.id} className="flex flex-col gap-2">
                <div className="flex w-full items-center gap-2 rounded-lg py-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setExpandedId(p.id)}
                    className="flex flex-1 items-center gap-2 text-left transition-colors hover:text-brand"
                  >
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
                      style={{ backgroundColor: colorFor(p.created_by) }}
                    >
                      {nameFor(p.created_by)}
                    </span>
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
                      {p.start_time && ` · ${p.start_time}`}
                    </span>
                  </button>
                  {isAuthor && (
                    <button
                      type="button"
                      onClick={() => setEditingId(p.id)}
                      className="shrink-0 text-muted"
                      aria-label="수정"
                    >
                      ✎
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => startTransition(() => deleteMonthlyPlan(p.id))}
                    className="shrink-0 text-muted"
                    aria-label="삭제"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {expandedPlan && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setExpandedId(null)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-2 border-b border-border p-4">
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: colorFor(expandedPlan.created_by) }}
              />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground">{expandedPlan.title}</h3>
                <p className="text-xs text-muted">
                  {expandedPlan.start_date.slice(5).replace("-", ".")} ~{" "}
                  {expandedPlan.end_date.slice(5).replace("-", ".")}
                  {expandedPlan.start_time && ` · ${expandedPlan.start_time}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpandedId(null)}
                className="shrink-0 text-lg text-muted"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <MonthlyPlanDetail
                planId={expandedPlan.id}
                description={expandedPlan.description}
                followers={followersByPlan[expandedPlan.id] ?? []}
                comments={commentsByPlan[expandedPlan.id] ?? []}
                currentUserId={currentUserId}
                hqProfiles={hqProfiles}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
