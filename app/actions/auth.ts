"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export type AuthFormState = { error: string } | undefined;

function readRedirectTarget(formData: FormData) {
  const redirectTo = formData.get("redirectTo");
  if (typeof redirectTo === "string" && redirectTo.startsWith("/")) {
    return redirectTo;
  }
  return "/";
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력해 주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("[login debug]", error.status, error.code, error.message); // TEMP-DEBUG
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  redirect(readRedirectTarget(formData));
}

export async function signup(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "staff") as Role;

  if (!name || !email || !password) {
    return { error: "이름, 이메일, 비밀번호를 모두 입력해 주세요." };
  }
  if (password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }
  if (role !== "owner" && role !== "staff") {
    return { error: "역할을 다시 선택해 주세요." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role } },
  });

  if (error) {
    console.error("[signup debug]", error.status, error.code, error.message); // TEMP-DEBUG
    if (error.code === "over_email_send_rate_limit") {
      return { error: "이메일 발송 한도 초과입니다. 잠시 후 다시 시도해 주세요." };
    }
    return { error: error.message === "User already registered"
      ? "이미 가입된 이메일입니다."
      : "가입 중 오류가 발생했습니다. 다시 시도해 주세요." };
  }

  if (!data.session) {
    return { error: "가입이 완료되었습니다. 이메일의 인증 링크를 확인한 뒤 로그인해 주세요." };
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
