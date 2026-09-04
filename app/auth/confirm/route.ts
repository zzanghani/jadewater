import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 관리자가 대시보드에서 보낸 "Send password recovery" 메일 링크가 도착하는
// 곳. Supabase 이메일 템플릿을 이 라우트로 오도록 바꿔야 동작한다
// ({{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password).
//
// 기본 {{ .ConfirmationURL }}(Supabase 자체 /auth/v1/verify)을 쓰면, 관리자가
// 대시보드에서 대신 보낸 링크라 받는 사람 브라우저에는 PKCE 코드를 교환할
// 상태(code_verifier)가 없어서 링크를 열어도 세션이 안 잡히고 "링크 확인
// 중..."에서 멈춘다. 여기서는 token_hash를 서버에서 직접 검증해 쿠키로
// 세션을 만들기 때문에 그 문제가 없다.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      const redirectTo = request.nextUrl.clone();
      redirectTo.pathname = next;
      redirectTo.search = "";
      return NextResponse.redirect(redirectTo);
    }
  }

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = "/reset-password";
  redirectTo.search = "";
  return NextResponse.redirect(redirectTo);
}
