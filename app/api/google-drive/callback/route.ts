import { NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/googleDrive";

// 구글 동의 화면에서 돌아오는 콜백. refresh_token을 화면에 한 번 보여주고,
// 그 값을 Vercel 환경변수 GOOGLE_DRIVE_REFRESH_TOKEN에 직접 등록해야 한다
// (서버에 별도 저장소가 없어서, 다른 API 키들과 동일하게 환경변수로 관리한다).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return new NextResponse(`구글 인증 실패: ${error}`, { status: 400 });
  }
  if (!code) {
    return new NextResponse("code 파라미터가 없습니다.", { status: 400 });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      return new NextResponse(
        "refresh_token을 받지 못했습니다. 이미 한 번 연결한 적이 있다면, 구글 계정 설정에서 이 앱 연결을 해제한 뒤 다시 시도해 주세요 (https://myaccount.google.com/permissions).",
        { status: 400 }
      );
    }

    const html = `<!doctype html>
<html><body style="font-family: sans-serif; padding: 24px;">
<h2>구글드라이브 연결 완료</h2>
<p>아래 값을 복사해서 Vercel 환경변수 <b>GOOGLE_DRIVE_REFRESH_TOKEN</b>에 등록해 주세요.</p>
<textarea style="width: 100%; height: 80px;" readonly onclick="this.select()">${tokens.refresh_token}</textarea>
<p style="color: #b91c1c;">이 값은 다시 볼 수 없으니 지금 꼭 복사해 두세요.</p>
</body></html>`;

    return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch (err) {
    console.error("[google-drive/callback] 토큰 교환 실패", err);
    return new NextResponse("토큰 교환 중 오류가 발생했습니다.", { status: 500 });
  }
}
