"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signup } from "@/app/actions/auth";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, undefined);
  const [role, setRole] = useState<"owner" | "staff">("staff");

  return (
    <div className="flex min-h-dvh w-full flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-xl font-bold">회원가입</h1>
        <p className="mt-1 text-sm text-muted">매장 정산 앱을 시작해 보세요</p>
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          이름
          <input
            type="text"
            name="name"
            required
            autoComplete="name"
            placeholder="홍길동"
            className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          이메일
          <input
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
            minLength={6}
            autoComplete="new-password"
            placeholder="6자 이상"
            className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
          />
        </label>

        <div className="flex flex-col gap-1.5 text-sm font-medium">
          역할
          <div className="grid grid-cols-2 gap-2">
            <input type="hidden" name="role" value={role} />
            {(
              [
                { value: "owner", label: "사장" },
                { value: "staff", label: "직원" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRole(opt.value)}
                className={`rounded-xl border py-3 text-sm font-semibold transition-colors ${
                  role === opt.value
                    ? "border-brand bg-brand-light text-brand"
                    : "border-border bg-card text-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {state?.error && (
          <p className="rounded-lg bg-brand-light px-3 py-2 text-sm text-brand-dark">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
        >
          {pending ? "가입 중..." : "회원가입"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-semibold text-brand">
          로그인
        </Link>
      </p>
    </div>
  );
}
