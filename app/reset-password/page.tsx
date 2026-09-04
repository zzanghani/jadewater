"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// 관리자가 Supabase 대시보드에서 "Send password recovery"로 보낸 메일의
// 링크가 도착하는 화면. 링크를 열면 Supabase 클라이언트가 URL의 코드를
// 자동으로 처리하고 PASSWORD_RECOVERY 이벤트를 쏴준다 — 그때 폼을 연다.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // 이벤트가 뜨기 전에 이미 세션이 잡혀있는 경우(뒤로가기 등)도 대비.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호가 서로 달라요. 다시 확인해 주세요.");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError("변경 중 오류가 발생했습니다. 링크가 만료됐을 수 있어요 — 관리자에게 다시 요청해 주세요.");
      return;
    }
    setDone(true);
    setTimeout(() => router.replace("/"), 1500);
  }

  if (done) {
    return (
      <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-bold">비밀번호가 변경됐어요</h1>
        <p className="text-sm text-muted">잠시 후 홈으로 이동합니다.</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-bold">링크 확인 중...</h1>
        <p className="text-sm text-muted">
          이 화면이 계속 보이면 링크가 만료됐거나 이미 사용됐을 수 있어요. 관리자에게 재설정 메일을 다시
          요청해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh w-full flex-col justify-center bg-white px-6 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-xl font-bold">새 비밀번호 설정</h1>
        <p className="mt-1 text-sm text-muted">새로 쓸 비밀번호를 입력해 주세요</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          새 비밀번호
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="6자 이상"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          새 비밀번호 확인
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="한 번 더 입력"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
        >
          {submitting ? "변경 중..." : "비밀번호 변경"}
        </button>
      </form>
    </div>
  );
}
