import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/googleDrive";

// 마스터 계정이 브라우저로 이 경로에 접속하면 구글 동의 화면으로 이동한다.
// (최초 1회, 구글드라이브 보관 기능을 쓰기 전에 한 번만 하면 된다.)
export async function GET() {
  return NextResponse.redirect(getGoogleAuthUrl());
}
