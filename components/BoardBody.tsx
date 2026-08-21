import type { ReactNode } from "react";
import { parseBoardBody, parseInlineContent } from "@/lib/boardBody";

// 본문에 그냥 텍스트로 적힌 http(s) 링크를 눌러서 바로 이동할 수 있는
// <a>로 바꿔준다. 매 호출마다 정규식을 새로 만들어서(lastIndex 공유
// 문제 방지) 안전하게 처리한다.
function linkifyText(text: string): ReactNode[] {
  const urlPattern = /https?:\/\/[^\s]+/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = urlPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const url = match[0];
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
    lastIndex = match.index + url.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return parts;
}

// <details>/<summary>는 JS 없이도 브라우저가 알아서 접고 펼쳐주므로
// 서버 컴포넌트로 그냥 렌더링해도 된다.
export default function BoardBody({
  body,
  urlByPath = {},
}: {
  body: string;
  urlByPath?: Record<string, string>;
}) {
  const segments = parseBoardBody(body);

  return (
    <div className="flex flex-col gap-2">
      {segments.map((seg, i) =>
        seg.type === "toggle" ? (
          <details
            key={i}
            className="rounded-xl border border-border bg-background px-3 py-2.5"
          >
            <summary className="cursor-pointer select-none text-sm font-semibold text-foreground marker:text-brand">
              {seg.title}
            </summary>
            <div className="mt-2 ml-4 flex flex-col gap-2 border-l-2 border-border pl-3">
              <InlineContent content={seg.content} urlByPath={urlByPath} />
            </div>
          </details>
        ) : (
          <InlineContent key={i} content={seg.content} urlByPath={urlByPath} />
        )
      )}
    </div>
  );
}

function InlineContent({
  content,
  urlByPath,
}: {
  content: string;
  urlByPath: Record<string, string>;
}) {
  const nodes = parseInlineContent(content);

  return (
    <>
      {nodes.map((node, i) => {
        if (node.kind === "text") {
          return (
            <p key={i} className="whitespace-pre-wrap break-words text-sm text-foreground">
              {linkifyText(node.text)}
            </p>
          );
        }
        if (node.kind === "image") {
          const src = urlByPath[node.path];
          return src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={node.alt}
              className="max-w-full rounded-xl border border-border"
            />
          ) : (
            <p key={i} className="text-sm text-muted">
              [사진: {node.alt}]
            </p>
          );
        }
        if (node.kind === "file") {
          const href = urlByPath[node.path];
          return href ? (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-brand"
            >
              📎 {node.name}
            </a>
          ) : (
            <p key={i} className="text-sm text-muted">
              [파일: {node.name}]
            </p>
          );
        }
        // table
        const [header, ...rows] = node.rows;
        return (
          <div key={i} className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {header.map((cell, ci) => (
                    <th
                      key={ci}
                      className="border-b border-border bg-background px-3 py-2 text-left font-semibold text-foreground"
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border-b border-border px-3 py-2 text-foreground">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}
