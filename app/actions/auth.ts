"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  if (!name || !email || !password) {
    return { error: "이름, 이메일, 비밀번호를 모두 입력해 주세요." };
  }
  if (password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }

  const supabase = await createClient();
  // role/status는 여기서 정하지 않는다 — DB의 handle_new_user() 트리거가
  // 항상 role='staff', status='pending'으로 만든다(자기 가입 폼에서
  // 마스터 권한을 스스로 고를 수 없게 하기 위함).
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
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
    return { error: "가입이 완료되었습니다. 이메일의 인증 링크를 확인한 뒤 로그인해 주세요. 로그인 후 관리자 승인을 기다리시면 됩니다." };
  }

  redirect("/");
}

export type ClaimStoreResult = { error?: string } | undefined;

// 승인된 직원 계정이 처음 로그인할 때 자기 소속 매장을 스스로 고른다.
// DB의 prevent_profile_privilege_escalation 트리거가 "store_id가 비어
// 있던 승인된 staff 계정"의 최초 1회 store_id 변경만 허용하므로, 그
// 조건을 벗어난 시도는 트리거가 조용히 무시한다.
export async function claimStore(storeId: string): Promise<ClaimStoreResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!storeId) return { error: "매장을 선택해 주세요." };

  const { error } = await supabase
    .from("profiles")
    .update({ store_id: storeId })
    .eq("id", user.id);

  if (error) {
    return { error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
