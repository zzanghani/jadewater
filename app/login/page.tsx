"use client";

import Image from "next/image";
import { Suspense, useActionState, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "@/app/actions/auth";

const SAVED_EMAIL_KEY = "store-settlement:saved-email";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh w-full flex-col justify-center px-6 py-10">
      <div className="mb-10 flex flex-col items-center gap-3 text-center">
        <Image
          src="/logo.png"
          alt="JADE & WATER"
          width={1000}
          height={244}
          priority
          className="h-auto w-48"
        />
        <div>
          <h1 className="text-xl font-bold">매장 정산</h1>
          <p className="mt-1 text-sm text-muted">
            일 마감부터 입금요청까지, 한 곳에서
          </p>
        </div>
      </div>

      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}

function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/";
  const emailRef = useRef<HTMLInputElement>(null);
  const [rememberEmail, setRememberEmail] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(SAVED_EMAIL_KEY);
    if (saved && emailRef.current) {
      emailRef.current.value = saved;
      setRememberEmail(true);
    }
  }, []);

  function handleSubmit() {
    const email = emailRef.current?.value.trim() ?? "";
    if (rememberEmail && email) {
      localStorage.setItem(SAVED_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(SAVED_EMAIL_KEY);
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        이메일
        <input
          ref={emailRef}
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="owner@store.com"
          className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        비밀번호
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="비밀번호"
          className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={rememberEmail}
          onChange={(e) => setRememberEmail(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-brand"
        />
        이메일 저장
      </label>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
      >
        {pending ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}
