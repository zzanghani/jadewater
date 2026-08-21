import { parseBoardBody, parseInlineContent } from "@/lib/boardBody";
import { renderRichText } from "@/lib/richText";

// <details>/<summary>는 JS 없이도 브라우저가 알아서 접고 펼쳐주므로
// 서버 컴포넌트로 그냥 렌더링해도 된다.
export default function BoardBody({
  body,
  urlByPath = {},
  mentionNames = [],
}: {
  body: string;
  urlByPath?: Record<string, string>;
  mentionNames?: string[];
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
              <InlineContent content={seg.content} urlByPath={urlByPath} mentionNames={mentionNames} />
            </div>
          </details>
        ) : (
          <InlineContent key={i} content={seg.content} urlByPath={urlByPath} mentionNames={mentionNames} />
        )
      )}
    </div>
  );
}

function InlineContent({
  content,
  urlByPath,
  mentionNames,
}: {
  content: string;
  urlByPath: Record<string, string>;
  mentionNames: string[];
}) {
  const nodes = parseInlineContent(content);

  return (
    <>
      {nodes.map((node, i) => {
        if (node.kind === "text") {
          return (
            <p key={i} className="whitespace-pre-wrap break-words text-sm text-foreground">
              {renderRichText(node.text, mentionNames)}
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
