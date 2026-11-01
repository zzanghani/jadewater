"use client";

import { useActionState } from "react";
import { submitBooking, type BookingState } from "./actions";

const inputClass = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground";

export default function VisitBookingForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<BookingState, FormData>(submitBooking, undefined);

  if (state?.ok) {
    return (
      <section className="rounded-2xl border border-brand bg-brand-light p-5 text-center">
        <p className="text-base font-bold text-brand-dark">예약이 접수됐어요 🎉</p>
        <p className="mt-2 text-sm text-foreground">{state.summary}</p>
        <p className="mt-3 text-xs text-muted">매장에서 확인 후 변동이 있으면 연락드려요. 일정이 바뀌면 같은 링크에서 다시 적어 주세요 — 새 내용으로 바뀝니다.</p>
      </section>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        <span>
          네이버 블로그 주소 또는 아이디 <span className="font-normal text-muted/80">(리뷰노트에 등록한 블로그)</span>
        </span>
        <input name="blog" required placeholder="blog.naver.com/abcd 또는 abcd" autoComplete="off" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        <span>
          리뷰노트에 등록한 이름 <span className="font-normal text-muted/80">(선정 명단과 대조해요)</span>
        </span>
        <input name="name" required placeholder="홍길동" autoComplete="off" className={inputClass} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col justify-end gap-1 text-xs font-medium text-muted">
          <span className="whitespace-nowrap">방문 날짜</span>
          <input type="date" name="date" required className={inputClass} />
        </label>
        <label className="flex flex-col justify-end gap-1 text-xs font-medium text-muted">
          <span className="whitespace-nowrap">시간</span>
          <input type="time" name="time" required step={600} className={inputClass} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col justify-end gap-1 text-xs font-medium text-muted">
          <span className="whitespace-nowrap">인원</span>
          <input type="number" name="party" required min={1} max={20} defaultValue={2} inputMode="numeric" className={inputClass} />
        </label>
        <label className="flex flex-col justify-end gap-1 text-xs font-medium text-muted">
          <span className="whitespace-nowrap">
            연락처 <span className="font-normal">(선택)</span>
          </span>
          <input type="tel" name="contact" placeholder="010-0000-0000" autoComplete="tel" className={inputClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        <span className="whitespace-nowrap">
          요청사항 <span className="font-normal">(선택)</span>
        </span>
        <input name="note" placeholder="예: 아기의자 1개, 창가 자리" className={inputClass} />
      </label>

      {state?.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending} className="rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "접수 중..." : "방문 예약하기"}
      </button>
      <p className="text-[11px] text-muted">
        블로그와 이름이 이번 체험단 선정 명단과 맞아야 접수돼요. 방문 당일 매장에서 네이버 블로그 앱(또는 리뷰노트 선정 내역)으로 본인 확인을 해요. 연락처는 방문 안내에만 쓰고 체험이 끝나면 지워요.
      </p>
    </form>
  );
}
