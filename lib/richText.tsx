import type { ReactNode } from "react";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 본문 텍스트 안의 URL은 눌러서 바로 이동할 수 있는 링크로, "@이름"
// 태그는 기존 글자색과 헷갈리지 않게 옅은 배경으로 눈에 띄게 바꿔준다.
// 매 호출마다 정규식을 새로 만들어서(lastIndex 공유 문제 방지) 안전하게
// 처리한다. mentionNames가 비어 있으면 태그 매칭 없이 링크만 처리한다.
export function renderRichText(text: string, mentionNames: string[] = []): ReactNode[] {
  const names = [...new Set(mentionNames)].filter(Boolean).sort((a, b) => b.length - a.length);
  const urlPattern = "https?:\\/\\/[^\\s]+";
  const mentionPattern =
    names.length > 0 ? `@(?:${names.map(escapeRegExp).join("|")})(?=\\s|$)` : null;
  const combinedSource = mentionPattern ? `(${urlPattern})|(${mentionPattern})` : `(${urlPattern})`;
  const pattern = new RegExp(combinedSource, "g");

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));

    if (match[1]) {
      const url = match[1];
      parts.push(
        <a
          key={key++}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer break-all text-brand underline"
        >
          {url}
        </a>
      );
    } else if (match[2]) {
      parts.push(
        <span
          key={key++}
          className="rounded bg-brand-light px-1 py-0.5 font-semibold text-brand"
        >
          {match[2]}
        </span>
      );
    }

    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return parts;
}
