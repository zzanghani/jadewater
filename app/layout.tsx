import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { LAYOUT_MODE_COOKIE, isDesktopMode } from "@/lib/layoutMode";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "매장 정산",
  description: "매장 일 마감 · 정산 · 입금요청 관리",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "베메컴",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#4b5563",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const desktopMode = isDesktopMode(cookieStore.get(LAYOUT_MODE_COOKIE)?.value);

  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div
          className={`mx-auto flex w-full flex-1 flex-col ${
            desktopMode ? "max-w-none" : "max-w-md"
          }`}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
