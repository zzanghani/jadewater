import { parseBoardBody } from "@/lib/boardBody";

// <details>/<summary>는 JS 없이도 브라우저가 알아서 접고 펼쳐주므로
// 서버 컴포넌트로 그냥 렌더링해도 된다.
export default function BoardBody({ body }: { body: string }) {
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
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
              {seg.content}
            </p>
          </details>
        ) : (
          <p key={i} className="whitespace-pre-wrap text-sm text-foreground">
            {seg.content}
          </p>
        )
      )}
    </div>
  );
}
