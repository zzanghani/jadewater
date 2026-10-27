"use client";

import { useEffect, useState, useTransition } from "react";
import { loadCampaigns, setBudget, setSchedule, toggleCampaign, type CampaignRow, type ChangeRow, type ManageResult } from "@/app/(app)/ad-report/manage/actions";
import { won } from "@/lib/adInsight";
import AdScheduleGrid, { allOn, hoursOnly, scheduleEquals, scheduleSummary, type WeekSchedule } from "@/components/AdScheduleGrid";

const EFFECT = {
  pending: "bg-gray-100 text-gray-600",
  hold: "bg-amber-50 text-amber-700",
  better: "bg-green-50 text-green-700",
  worse: "bg-red-50 text-red-600",
} as const;
const EFFECT_LABEL = { pending: "판정 대기", hold: "판단 보류", better: "좋아짐", worse: "나빠짐" } as const;

export default function AdManageClient({ storeId }: { storeId: string }) {
  const [res, setRes] = useState<ManageResult | null>(null);
  const [loading, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    start(async () => setRes(await loadCampaigns(storeId)));
  }, [storeId]);

  function reload() {
    start(async () => setRes(await loadCampaigns(storeId)));
  }

  function onToggle(c: CampaignRow) {
    const next = !c.on;
    if (!window.confirm(`'${c.name}' 캠페인을 ${next ? "켤까요" : "끌까요"}?\n${next ? "켜면 바로 광고가 다시 나가요." : "끄면 이 캠페인 광고가 바로 멈춰요."}`)) return;
    setErr(null);
    start(async () => {
      const r = await toggleCampaign(storeId, c.id, next);
      if (!r.ok) setErr(r.error);
      setRes(await loadCampaigns(storeId));
    });
  }

  if (!res) return <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted">{loading ? "네이버에서 캠페인을 읽는 중..." : ""}</p>;
  if (!res.ok) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{res.error}</p>;

  const onCount = res.campaigns.filter((c) => c.on).length;
  const weekCost = res.campaigns.reduce((s, c) => s + c.week.cost, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-background px-3 py-1.5">
          캠페인 <b>{onCount}/{res.campaigns.length}</b> 켜짐
        </span>
        <span className="rounded-full bg-background px-3 py-1.5">
          최근 7일 광고비 <b>{won(weekCost)}</b>원
        </span>
        {res.bizmoney != null && (
          <span className={`rounded-full px-3 py-1.5 ${weekCost > 0 && res.bizmoney / (weekCost / 7) < 5 ? "bg-red-50 text-red-600" : "bg-background"}`}>
            비즈머니 <b>{won(res.bizmoney)}</b>원{weekCost > 0 && ` · 약 ${Math.floor(res.bizmoney / (weekCost / 7))}일분`}
          </span>
        )}
        <button type="button" onClick={reload} disabled={loading} className="ml-auto rounded-xl border border-border px-3 py-1.5 text-xs disabled:opacity-50">
          {loading ? "읽는 중..." : "새로고침"}
        </button>
        <a
          href="https://searchad.naver.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-[#03c75a] px-3 py-1.5 text-xs font-semibold text-white"
          title="키워드·입찰가·노출 시간 등 세부 설정은 네이버 광고주 사이트에서"
        >
          네이버 광고주 ↗
        </a>
      </div>
      {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-600">{err}</p>}

      <section className="flex flex-col gap-2">
        {res.campaigns.length === 0 && <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted">캠페인이 없어요.</p>}
        {res.campaigns.map((c) => (
          <CampaignCard key={c.id} c={c} storeId={storeId} busy={loading} onToggle={() => onToggle(c)} onSaved={reload} onError={setErr} suggest={res.suggest} />
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-bold">변경 이력 · 효과</h2>
        <p className="mb-2 text-[11px] text-muted">바꾼 다음 날부터 7일과 바꾸기 전 7일의 광고비 대비 매출을 비교해요. 변동이 ±34% 안이면 날씨·요일 탓일 수 있어 판단을 보류해요.</p>
        {res.changes.length === 0 ? (
          <p className="text-xs text-muted">아직 앱에서 바꾼 기록이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {res.changes.map((ch) => (
              <ChangeItem key={ch.id} ch={ch} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CampaignCard({ c, storeId, busy, onToggle, onSaved, onError, suggest }: { c: CampaignRow; storeId: string; busy: boolean; onToggle: () => void; onSaved: () => void; onError: (e: string | null) => void; suggest: { open: number[]; focus: number[] } }) {
  const [budget, setBudgetInput] = useState(String(c.dailyBudget));
  const [saving, startSave] = useTransition();
  const changed = Number(budget) !== c.dailyBudget;
  function save() {
    const n = Number(budget);
    if (!window.confirm(`'${c.name}' 하루 예산을 ${c.dailyBudget ? won(c.dailyBudget) + "원" : "제한 없음"} → ${n ? won(n) + "원" : "제한 없음"}으로 바꿀까요?`)) return;
    onError(null);
    startSave(async () => {
      const r = await setBudget(storeId, c.id, n);
      if (!r.ok) onError(r.error);
      else onSaved();
    });
  }
  const ctr = c.week.imp ? (c.week.clk / c.week.imp) * 100 : null;
  const cpc = c.week.clk ? c.week.cost / c.week.clk : null;
  return (
    <div className={`rounded-2xl border bg-card p-4 ${c.on ? "border-border" : "border-dashed border-border opacity-80"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{c.name}</p>
          <p className="text-[11px] text-muted">
            {c.type}
            {c.status && c.status !== "ELIGIBLE" && c.on && <span className="ml-1 text-amber-700">· {STATUS_LABEL[c.status] ?? c.status}</span>}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={c.on}
          onClick={onToggle}
          disabled={busy}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${c.on ? "bg-green-500" : "bg-gray-300"}`}
          aria-label={c.on ? "끄기" : "켜기"}
        >
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${c.on ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px]">
        <div className="rounded-lg bg-background py-1.5">
          <p className="text-muted">7일 광고비</p>
          <p className="font-semibold tabular-nums">{won(c.week.cost)}</p>
        </div>
        <div className="rounded-lg bg-background py-1.5">
          <p className="text-muted">클릭</p>
          <p className="font-semibold tabular-nums">{c.week.clk}</p>
        </div>
        <div className="rounded-lg bg-background py-1.5">
          <p className="text-muted">클릭률</p>
          <p className="font-semibold tabular-nums">{ctr == null ? "-" : ctr.toFixed(1) + "%"}</p>
        </div>
        <div className="rounded-lg bg-background py-1.5">
          <p className="text-muted">클릭당</p>
          <p className="font-semibold tabular-nums">{won(cpc)}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs">
        <span className="text-muted">하루 예산</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1000}
          value={budget}
          onChange={(e) => setBudgetInput(e.target.value)}
          className="w-28 rounded-lg border border-border bg-background px-2 py-1 text-right tabular-nums text-foreground"
        />
        <span className="text-muted">원</span>
        <button type="button" onClick={save} disabled={saving || busy || !changed} className="rounded-lg bg-brand px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40">
          {saving ? "저장 중" : "저장"}
        </button>
        {c.dailyBudget === 0 && <span className="text-[10px] text-muted">0 = 제한 없음</span>}
      </div>
      {c.groups.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {c.groups.map((g) => (
            <ScheduleBlock key={g.id} storeId={storeId} group={g} single={c.groups.length === 1} suggest={suggest} busy={busy} onSaved={onSaved} onError={onError} />
          ))}
        </div>
      )}
    </div>
  );
}

// 광고그룹 노출 시간: 요약 한 줄 + '수정'을 누르면 요일×시간 격자와 프리셋.
function ScheduleBlock({ storeId, group, single, suggest, busy, onSaved, onError }: { storeId: string; group: CampaignRow["groups"][number]; single: boolean; suggest: { open: number[]; focus: number[] }; busy: boolean; onSaved: () => void; onError: (e: string | null) => void }) {
  const [edit, setEdit] = useState(false);
  const base = group.schedule ?? allOn();
  const [draft, setDraft] = useState<WeekSchedule>(base);
  const [saving, startSave] = useTransition();
  const changed = !scheduleEquals(draft, base);
  const hours = Array.from({ length: 24 }, (_, h) => h);
  function save() {
    const beforeText = scheduleSummary(base);
    const afterText = scheduleSummary(draft);
    if (!window.confirm(`'${group.name}' 노출 시간을 바꿀까요?\n${beforeText} → ${afterText}\n저장하면 네이버에 바로 적용돼요.`)) return;
    onError(null);
    startSave(async () => {
      const isAll = Object.values(draft).every((h) => h.length === 24);
      const r = await setSchedule(storeId, group.id, group.name, isAll ? null : draft, beforeText, afterText);
      if (!r.ok) onError(r.error);
      else {
        setEdit(false);
        onSaved();
      }
    });
  }
  const preset = (label: string, hs: number[]) =>
    hs.length ? (
      <button key={label} type="button" onClick={() => setDraft(hoursOnly(hs))} className="rounded-lg border border-border px-2 py-1 text-[11px]">
        {label} {hs[0]}~{hs[hs.length - 1] + 1}시
      </button>
    ) : null;
  return (
    <div className="rounded-xl bg-background px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate">
          <span className="text-muted">노출 시간{!single && ` · ${group.name}`}</span> <span className="font-semibold">{scheduleSummary(base)}</span>
          {!group.on && <span className="ml-1 rounded bg-gray-100 px-1 text-[9px] text-gray-500">그룹 꺼짐</span>}
        </p>
        <button type="button" onClick={() => { setDraft(base); setEdit(!edit); }} className="shrink-0 text-[11px] font-semibold text-brand">
          {edit ? "닫기" : "수정"}
        </button>
      </div>
      {edit && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setDraft(allOn())} className="rounded-lg border border-border px-2 py-1 text-[11px]">항상</button>
            {preset("영업시간", suggest.open)}
            {preset("추천 집중", suggest.focus)}
            {preset("점심 앞", [10, 11, 12, 13])}
            {preset("저녁 앞", [16, 17, 18, 19])}
          </div>
          <AdScheduleGrid value={draft} onChange={setDraft} hours={hours} />
          <p className="text-[10px] text-muted">파란 칸 = 광고 나가는 시간. 요일 글자를 누르면 그 줄 전체, 시간 숫자를 누르면 그 열 전체가 바뀌어요. 지금: {scheduleSummary(draft)}</p>
          <div className="flex gap-1.5">
            <button type="button" onClick={save} disabled={saving || busy || !changed} className="rounded-lg bg-brand px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40">
              {saving ? "적용 중…" : "네이버에 적용"}
            </button>
            <button type="button" onClick={() => setDraft(base)} disabled={!changed} className="rounded-lg border border-border px-3 py-1.5 text-[11px] disabled:opacity-40">
              원래대로
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  PAUSED: "일시중지",
  BUDGET_LIMIT: "하루 예산 소진",
  OUT_OF_BUDGET: "비즈머니 부족",
  DISABLED: "중지됨",
};

function ChangeItem({ ch }: { ch: ChangeRow }) {
  const at = new Date(ch.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <li className="rounded-xl bg-background px-3 py-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            <span className="truncate">{ch.target_name ?? ch.target_id}</span> · {ch.label}
          </p>
          <p className="text-[11px] text-muted">
            {at}
            {ch.user_name && ` · ${ch.user_name}`}
          </p>
        </div>
        {ch.effect && <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${EFFECT[ch.effect.state]}`}>{EFFECT_LABEL[ch.effect.state]}</span>}
      </div>
      {ch.effect && <p className="mt-1 text-[11px] leading-snug text-muted">{ch.effect.text}</p>}
      {ch.effect && ch.effect.state !== "pending" && (
        <p className="mt-0.5 text-[10px] tabular-nums text-muted">
          전 7일 매출 {won(ch.effect.before.sales)} / 광고비 {won(ch.effect.before.cost)} → 후 7일 매출 {won(ch.effect.after.sales)} / 광고비 {won(ch.effect.after.cost)}
        </p>
      )}
    </li>
  );
}
