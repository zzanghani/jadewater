import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 기본 1MB로는 폰 사진 한 장도 넘기기 쉬워서(영수증/게시판 첨부),
  // Server Action 요청 본문 크기 제한을 넉넉히 올려둔다.
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
