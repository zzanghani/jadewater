import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "매장 정산 - JADE & WATER",
    short_name: "매장 정산",
    description: "매장 일 마감 · 정산 · 입금요청 관리",
    start_url: "/",
    display: "standalone",
    background_color: "#F4EFE3",
    theme_color: "#86c1ae",
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
