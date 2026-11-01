"use client";

import MacminiNote from "@/components/MacminiNote";
import { useEffect, useState } from "react";
import { deleteRound, draftPostWithAI, loadRounds, saveRound, type RoundFields } from "@/app/(app)/recruit/actions";
import type { RecruitRound } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "작성 중",
  confirmed: "확정 · 리뷰노트 등록 대기",
  registered: "리뷰노트 모집 중",
  selecting: "선정 전",
  approved: "선정 승인됨",
  done: "선정 완료",
};

const EMPTY: RoundFields = {
  title: "",
  offer: "",
  keywords: ["", "", ""],
  information: "",
  possible_days: "",
  possible_time: "",
  schedule_information: "",
  inf_num: 20,
};

function toFields(r: RecruitRound | null | undefined, storeName: string): RoundFields {
  if (!r) return { ...EMPTY, title: storeName };
  const kw = [...r.keywords, "", "", ""].slice(0, 3);
  return {
    title: r.title ?? storeName,
    offer: r.offer ?? "",
    keywords: kw,
    information: r.information ?? "",
    possible_days: r.possible_days ?? "",
    possible_time: r.possible_time ?? "",
    schedule_information: r.schedule_information ?? "",
    inf_num: r.inf_num,
  };
}

// 모집글 — 2주마다 새로 쓰는 리뷰노트 모집글. 확정하면 맥미니가 리뷰노트에 등록한다.
export default function RecruitPostClient({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [rounds, setRounds] = useState<RecruitRound[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoundFields | null>(null);
  const [aiDrafted, setAiDrafted] = useState(false);
  const [busy, setBusy] = useState<null | "ai" | "save" | "confirm">(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    loadRounds(storeId).then((r) => {
      if (!r.ok) return setErr(r.error);
      setRounds(r.rounds);
      // 작성 중·확정 대기인 글이 있으면 그걸 연다.
      const open = r.rounds.find((x) => x.status === "draft" || x.status === "confirmed");
      if (open) {
        setEditingId(open.id);
        setForm(toFields(open, storeName));
        setAiDrafted(open.ai_drafted);
      }
    });
  }, [storeId, storeName]);

  function startNew() {
    // 지난 회차 글을 바탕으로 시작한다(제공 내역·요일·시간은 보통 그대로).
    const last = rounds?.find((x) => x.status !== "draft" && x.status !== "confirmed");
    setEditingId(null);
    setForm(toFields(last, storeName));
    setAiDrafted(false);
    setMsg(last ? "지난 회차 모집글을 불러왔어요. 'AI로 새로 쓰기'를 누르면 키워드와 가이드를 새로 써 줘요." : null);
  }

  const set = <K extends keyof RoundFields>(k: K, v: RoundFields[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function aiDraft() {
    if (!form) return;
    setBusy("ai");
    setErr(null);
    const r = await draftPostWithAI(storeId, form);
    setBusy(null);
    if (!r.ok) return setErr(r.error);
    setForm({ ...form, keywords: [...r.keywords, "", "", ""].slice(0, 3), information: r.information });
    setAiDrafted(true);
    setMsg("AI가 새로 썼어요. 읽어 보고 고칠 곳만 고친 뒤 확정하세요.");
  }

  async function save(confirm: boolean) {
    if (!form) return;
    if (confirm && !window.confirm("이 모집글로 확정할까요? 확정하면 맥미니가 리뷰노트에 등록해요.")) return;
    setBusy(confirm ? "confirm" : "save");
    setErr(null);
    const r = await saveRound(storeId, editingId, form, { confirm, aiDrafted });
    setBusy(null);
    if (!r.ok) return setErr(r.error);
    setEditingId(r.round.id);
    setRounds((prev) => [r.round, ...(prev ?? []).filter((x) => x.id !== r.round.id)]);
    setMsg(confirm ? "확정했어요. 맥미니가 리뷰노트에 등록하면 상태가 '모집 중'으로 바뀌어요." : "저장했어요.");
  }

  async function remove() {
    if (!editingId || !window.confirm("이 모집글을 지울까요?")) return;
    const r = await deleteRound(storeId, editingId);
    if (!r.ok) return setErr(r.error ?? "지우지 못했어요.");
    setRounds((prev) => (prev ?? []).filter((x) => x.id !== editingId));
    setEditingId(null);
    setForm(null);
    setMsg(null);
  }

  if (rounds === null) {
    return <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted">{err ?? "불러오는 중..."}</p>;
  }

  const editing = rounds.find((x) => x.id === editingId);
  const input = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
  const label = "text-xs font-medium text-muted";

  return (
    <div className="flex flex-col gap-4">
      {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}
      {msg && <p className="rounded-xl bg-brand-light px-4 py-3 text-sm text-brand-dark">{msg}</p>}

      {form ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{editing ? "이번 회차 모집글" : "새 모집글"}</h2>
            {editing && <span className="text-xs text-muted">{STATUS_LABEL[editing.status]}</span>}
          </div>
          {editing && <MacminiNote note={editing.macmini_note} at={editing.macmini_at} />}

          <button
            onClick={aiDraft}
            disabled={busy !== null}
            className="rounded-xl border border-brand py-2 text-sm font-semibold text-brand disabled:opacity-40"
          >
            {busy === "ai" ? "AI가 쓰는 중…" : "AI로 새로 쓰기 (키워드·작성 가이드)"}
          </button>

          <label className="flex flex-col gap-1">
            <span className={label}>체험단 이름</span>
            <input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} className={input} />
          </label>
          <div className="grid grid-cols-[1fr_88px] gap-2">
            <label className="flex flex-col gap-1">
              <span className={label}>제공 내역</span>
              <input value={form.offer ?? ""} onChange={(e) => set("offer", e.target.value)} placeholder="매장식사권 5만원권" className={input} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>모집 인원</span>
              <input
                type="number"
                min={1}
                value={form.inf_num}
                onChange={(e) => set("inf_num", Number(e.target.value) || 0)}
                className={input}
              />
            </label>
          </div>
          <div className="flex flex-col gap-1">
            <span className={label}>키워드 (블로거가 제목에 넣을 검색어 3개)</span>
            {form.keywords.map((k, i) => (
              <input
                key={i}
                value={k}
                onChange={(e) => set("keywords", form.keywords.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`키워드 ${i + 1}`}
                className={input}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className={label}>방문 가능 요일</span>
              <input value={form.possible_days ?? ""} onChange={(e) => set("possible_days", e.target.value)} placeholder="월 / 화 / 수 / 목 / 금" className={input} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>방문 가능 시간</span>
              <input value={form.possible_time ?? ""} onChange={(e) => set("possible_time", e.target.value)} placeholder="오전 11시 ~ 오후 7시" className={input} />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className={label}>영업 안내 (라스트오더·브레이크타임 등)</span>
            <input value={form.schedule_information ?? ""} onChange={(e) => set("schedule_information", e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>제목·본문 작성 가이드</span>
            <textarea value={form.information ?? ""} onChange={(e) => set("information", e.target.value)} rows={12} className={`${input} leading-relaxed`} />
          </label>

          <div className="flex gap-2">
            <button onClick={() => save(false)} disabled={busy !== null} className="flex-1 rounded-xl border border-border py-2 text-sm disabled:opacity-40">
              {busy === "save" ? "저장 중…" : "임시 저장"}
            </button>
            <button onClick={() => save(true)} disabled={busy !== null} className="flex-[2] rounded-xl bg-brand py-2 text-sm font-semibold text-white disabled:opacity-40">
              {busy === "confirm" ? "확정 중…" : editing?.status === "confirmed" ? "고친 내용으로 다시 확정" : "확정 · 리뷰노트 등록"}
            </button>
          </div>
          {editingId && (
            <button onClick={remove} className="text-xs text-red-600">
              이 모집글 지우기
            </button>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-sm text-muted">작성 중인 모집글이 없어요.</p>
          <button onClick={startNew} className="mt-3 w-full rounded-xl bg-brand py-2 text-sm font-semibold text-white">
            이번 회차 모집글 쓰기
          </button>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">지난 회차</h2>
        {rounds.filter((x) => x.status !== "draft" && x.status !== "confirmed").length === 0 ? (
          <p className="mt-2 text-xs text-muted">
            아직 기록이 없어요. 리뷰노트 캠페인 화면에서 &lsquo;체험단 검증 보내기&rsquo;를 한 번 누르면 그 회차 모집글이 여기에 들어와서 다음 글의 바탕이 돼요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-border">
            {rounds
              .filter((x) => x.status !== "draft" && x.status !== "confirmed")
              .map((r) => (
                <li key={r.id} className="py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {new Date(r.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" })} · {r.offer ?? "-"} · {r.inf_num}명
                    </span>
                    <span className="text-muted">{STATUS_LABEL[r.status]}</span>
                    <MacminiNote note={r.macmini_note} at={r.macmini_at} />
                  </div>
                  <p className="mt-0.5 text-muted">{r.keywords.join(" · ") || "-"}</p>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
