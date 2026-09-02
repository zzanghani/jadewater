import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // 제이드앤워터·정다미가 같이 쓰는 시스템이라 앱 이름은 운영사(베메컴)
    // 기준으로 둔다. 브랜드 로고·톤은 로그인 후 계정의 브랜드에 따라 갈린다.
    name: "베스트메이트컴퍼니 통합운영관리",
    short_name: "베메컴",
    description: "일 마감 · 정산 · 입금요청 · 스케줄 관리",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#4b5563",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
