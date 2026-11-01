import Link from "next/link";
import type { ReactNode } from "react";

// 개인정보처리방침·이용약관 같은 공개 문서 화면의 공통 틀.
// 로그인 없이 열리므로(proxy.ts OPEN_PATHS) 앱 레이아웃·브랜드 톤을 쓰지 않고
// 흰 바탕의 읽기용 화면으로만 만든다.
export default function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  /** "2026년 11월 1일" 형식 */
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full flex-col bg-white px-6 py-8 text-[15px] leading-relaxed text-foreground">
      <nav className="mb-6 flex items-center justify-between text-xs text-muted">
        <Link href="/login" className="font-medium">
          ← 앱으로
        </Link>
        <span className="flex gap-3">
          <Link href="/terms" className="underline">
            이용약관
          </Link>
          <Link href="/privacy" className="underline">
            개인정보처리방침
          </Link>
        </span>
      </nav>

      <header className="mb-6">
        <p className="text-xs font-semibold tracking-wide text-muted">베스트메이트컴퍼니 통합운영관리시스템</p>
        <h1 className="mt-1 text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-xs text-muted">시행일 {effectiveDate}</p>
      </header>

      <article className="legal flex flex-col gap-6">{children}</article>

      <footer className="mt-10 border-t border-border pt-4 text-xs text-muted">
        베스트메이트컴퍼니(주) · 문의: 앱 내 채팅 또는 운영사 담당자
      </footer>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-foreground/90">{children}</p>;
}

export function Ul({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5 text-foreground/90">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[320px] text-left text-sm">
        <thead className="bg-background text-xs text-muted">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border align-top">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
