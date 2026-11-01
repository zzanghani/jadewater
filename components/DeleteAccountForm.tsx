"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { deleteMyAccount } from "@/app/actions/account";

// 프로필 화면 맨 아래의 "계정 삭제" 영역. 평소에는 한 줄 버튼만 보이고,
// 누르면 삭제되는 것·남는 것 안내 → 확인 체크 → 비밀번호 입력 → 빨간 버튼 순으로 펼쳐진다.
export default function DeleteAccountForm({
  isMaster,
  isManager,
}: {
  /** 대표(마스터) 계정 — 앱에서 삭제 불가, 안내만 보여준다. */
  isMaster: boolean;
  /** 지점장 계정 — 삭제는 가능하지만 매장 운영 공백 안내를 덧붙인다. */
  isManager: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteMyAccount, undefined);

  return (
    <section className="mt-6 flex flex-col gap-3 border-t border-border pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">계정 삭제</h2>
          <p className="text-xs text-muted">탈퇴하면 이 계정으로 다시 로그인할 수 없어요.</p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-red-600"
          >
            계정 삭제
          </button>
        )}
      </div>

      {open && isMaster && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="font-semibold">대표(마스터) 계정은 앱에서 삭제할 수 없어요.</p>
          <p className="mt-1 text-muted">
            가입 승인과 매장 연결을 담당하는 계정이어서, 운영사(베스트메이트컴퍼니)에서 직접 처리합니다.
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted"
          >
            닫기
          </button>
        </div>
      )}

      {open && !isMaster && (
        <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-red-200 bg-card p-4 text-sm">
          <div>
            <p className="font-semibold text-red-600">삭제하면 바로 처리되고 되돌릴 수 없어요.</p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-foreground">
              <li>이름·이메일·프로필 사진·소속 매장 정보가 삭제(익명화)돼요.</li>
              <li>알림 설정, 채팅방 참여, 게시글 팔로우가 모두 해제돼요.</li>
              <li>이 이메일로 다시 로그인할 수 없고, 필요하면 새로 가입해야 해요.</li>
              <li>
                내가 입력한 마감·입고·게시글·출퇴근 기록은 회사의 운영·노무 기록이라 삭제되지
                않고 <b>&ldquo;탈퇴한 사용자&rdquo;</b>가 쓴 것으로 남아요. 보존 기간은{" "}
                <Link href="/privacy" className="underline">
                  개인정보처리방침
                </Link>
                을 따라요.
              </li>
              {isManager && (
                <li>
                  지점장 계정이에요. 삭제하면 매장에 지점장 계정이 없어지니, 먼저 대표에게 알려
                  주세요.
                </li>
              )}
            </ul>
          </div>

          <label className="flex items-start gap-2">
            <input type="checkbox" name="confirm" required className="mt-0.5 h-4 w-4 rounded border-border accent-red-600" />
            <span>위 내용을 확인했고, 계정을 삭제하는 데 동의합니다.</span>
          </label>

          <label className="flex flex-col gap-1.5 font-medium">
            본인 확인 — 비밀번호
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="현재 비밀번호"
              className="rounded-xl border border-border bg-card px-4 py-3 font-normal outline-none ring-red-200 placeholder:text-muted focus:ring-2"
            />
          </label>

          {state?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-semibold text-muted"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white shadow-md shadow-red-600/30 transition-opacity disabled:opacity-60"
            >
              {pending ? "삭제 중..." : "계정 영구 삭제"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
