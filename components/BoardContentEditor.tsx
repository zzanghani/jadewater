"use client";

import { useEffect, useRef, useState } from "react";
import { uploadInlineBoardFile } from "@/app/(app)/board/actions";
import MediaInsertButton from "@/components/MediaInsertButton";
import ToggleInsertButton from "@/components/ToggleInsertButton";

type TextSegment = { type: "text"; id: string; value: string };
type TableSegment = { type: "table"; id: string; rows: string[][] };
type Segment = TextSegment | TableSegment;

const TABLE_ROW = /^\|(.+)\|$/;

function sanitizeCell(value: string): string {
  const cleaned = value.replace(/\|/g, "｜").replace(/\n/g, " ").trim();
  return cleaned || " ";
}

// "|칸|칸|" 줄이 연속되는 구간만 표 세그먼트로 떼어내고, 나머지는 그
// 사이사이를 채우는 텍스트 세그먼트가 된다(표 앞뒤에 글이 있으면
// 텍스트 세그먼트가 여러 개로 나뉜다). 토글(▶/◀)이나 사진·파일 참조는
// 표가 아니므로 전부 텍스트 세그먼트 안에 그대로 남는다.
function segmentsFromBody(body: string, makeId: () => string): Segment[] {
  const lines = body.split("\n");
  const segments: Segment[] = [];
  let textBuffer: string[] = [];
  let tableBuffer: string[][] = [];

  function flushText() {
    if (textBuffer.length > 0) {
      segments.push({ type: "text", id: makeId(), value: textBuffer.join("\n") });
    }
    textBuffer = [];
  }
  function flushTable() {
    if (tableBuffer.length > 0) {
      segments.push({ type: "table", id: makeId(), rows: tableBuffer });
    }
    tableBuffer = [];
  }

  for (const line of lines) {
    const match = line.match(TABLE_ROW);
    if (match) {
      flushText();
      tableBuffer.push(match[1].split("|").map((c) => c.trim()));
    } else {
      flushTable();
      textBuffer.push(line);
    }
  }
  flushText();
  flushTable();

  if (segments.length === 0) segments.push({ type: "text", id: makeId(), value: "" });
  return segments;
}

function serializeSegments(segments: Segment[]): string {
  return segments
    .map((seg) =>
      seg.type === "text"
        ? seg.value
        : seg.rows.map((row) => `| ${row.map(sanitizeCell).join(" | ")} |`).join("\n")
    )
    .join("\n");
}

function TableSegmentEditor({
  rows,
  onCellChange,
  onAddRow,
  onRemoveRow,
  onAddCol,
  onRemoveCol,
  onDelete,
}: {
  rows: string[][];
  onCellChange: (r: number, c: number, value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (r: number) => void;
  onAddCol: () => void;
  onRemoveCol: (c: number) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="p-0.5">
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => onCellChange(ri, ci, e.target.value)}
                      placeholder={ri === 0 ? `헤더${ci + 1}` : `값${ci + 1}`}
                      className={`w-24 rounded-lg border px-2 py-1.5 text-xs outline-none ring-brand/30 focus:ring-2 ${
                        ri === 0
                          ? "border-brand/40 bg-brand-light font-semibold text-brand"
                          : "border-border bg-card text-foreground"
                      }`}
                    />
                  </td>
                ))}
                <td className="p-0.5">
                  <button
                    type="button"
                    onClick={() => onRemoveRow(ri)}
                    disabled={rows.length <= 1}
                    aria-label={`${ri + 1}번째 행 삭제`}
                    className="px-1 text-xs text-muted hover:text-red-600 disabled:opacity-30"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              {rows[0]?.map((_, ci) => (
                <td key={ci} className="p-0.5 text-center">
                  <button
                    type="button"
                    onClick={() => onRemoveCol(ci)}
                    disabled={(rows[0]?.length ?? 0) <= 1}
                    aria-label={`${ci + 1}번째 열 삭제`}
                    className="px-1 text-xs text-muted hover:text-red-600 disabled:opacity-30"
                  >
                    ✕
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAddRow}
          className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-muted transition-colors hover:border-brand hover:text-brand"
        >
          + 행
        </button>
        <button
          type="button"
          onClick={onAddCol}
          className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-muted transition-colors hover:border-brand hover:text-brand"
        >
          + 열
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto rounded-lg px-2.5 py-1 text-[11px] font-semibold text-red-600"
        >
          표 삭제
        </button>
      </div>
    </div>
  );
}

export default function BoardContentEditor({
  name = "body",
  initialBody = "",
  onSerializedChange,
  onUploaded,
}: {
  name?: string;
  initialBody?: string;
  onSerializedChange?: (body: string) => void;
  onUploaded?: (path: string, url: string) => void;
}) {
  const idCounter = useRef(0);
  const makeId = () => `seg-${idCounter.current++}`;
  const [segments, setSegments] = useState<Segment[]>(() => segmentsFromBody(initialBody, makeId));
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const [activeTextId, setActiveTextId] = useState<string | null>(
    () => segments.find((s): s is TextSegment => s.type === "text")?.id ?? null
  );

  const serialized = serializeSegments(segments);

  useEffect(() => {
    onSerializedChange?.(serialized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

  function updateTextValue(id: string, value: string) {
    setSegments((prev) =>
      prev.map((s) => (s.id === id && s.type === "text" ? { ...s, value } : s))
    );
  }

  function activeTextareaRef() {
    return { current: activeTextId ? textareaRefs.current[activeTextId] ?? null : null };
  }

  // 현재 포커스돼 있던(또는 마지막으로 포커스됐던) 텍스트 세그먼트를
  // 커서 위치에서 둘로 쪼개고, 그 사이에 빈 표를 끼워 넣는다.
  function insertTableAtCursor() {
    setSegments((prev) => {
      const targetId =
        activeTextId && prev.some((s) => s.id === activeTextId)
          ? activeTextId
          : prev.find((s): s is TextSegment => s.type === "text")?.id;
      const idx = prev.findIndex((s) => s.id === targetId);
      if (idx === -1 || prev[idx].type !== "text") return prev;

      const target = prev[idx] as TextSegment;
      const el = textareaRefs.current[target.id];
      const liveValue = el?.value ?? target.value;
      const cursor = el?.selectionStart ?? liveValue.length;
      const before = liveValue.slice(0, cursor);
      const after = liveValue.slice(cursor);

      const beforeId = target.id;
      const tableId = makeId();
      const afterId = makeId();

      const next = [...prev];
      next.splice(
        idx,
        1,
        { type: "text", id: beforeId, value: before },
        { type: "table", id: tableId, rows: [["", ""], ["", ""]] },
        { type: "text", id: afterId, value: after }
      );
      setActiveTextId(afterId);
      return next;
    });
  }

  function deleteTable(tableId: string) {
    setSegments((prev) => {
      const idx = prev.findIndex((s) => s.id === tableId);
      if (idx === -1) return prev;

      const before = prev[idx - 1];
      const after = prev[idx + 1];
      if (before?.type === "text" && after?.type === "text") {
        const merged: TextSegment = {
          type: "text",
          id: before.id,
          value: after.value ? `${before.value}\n${after.value}` : before.value,
        };
        const next = [...prev];
        next.splice(idx - 1, 3, merged);
        return next;
      }
      return prev.filter((s) => s.id !== tableId);
    });
  }

  function updateTable(tableId: string, updater: (rows: string[][]) => string[][]) {
    setSegments((prev) =>
      prev.map((s) => (s.id === tableId && s.type === "table" ? { ...s, rows: updater(s.rows) } : s))
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2.5">
        {segments.map((seg) =>
          seg.type === "text" ? (
            <textarea
              key={seg.id}
              ref={(el) => {
                textareaRefs.current[seg.id] = el;
              }}
              defaultValue={seg.value}
              onChange={(e) => updateTextValue(seg.id, e.target.value)}
              onFocus={() => setActiveTextId(seg.id)}
              rows={Math.max(2, seg.value.split("\n").length)}
              placeholder={segments.length === 1 ? "내용을 입력하세요" : undefined}
              className="w-full resize-none rounded-lg border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted"
            />
          ) : (
            <TableSegmentEditor
              key={seg.id}
              rows={seg.rows}
              onCellChange={(r, c, value) =>
                updateTable(seg.id, (rows) =>
                  rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row))
                )
              }
              onAddRow={() =>
                updateTable(seg.id, (rows) => [
                  ...rows,
                  Array.from({ length: rows[0]?.length ?? 2 }, () => ""),
                ])
              }
              onRemoveRow={(r) =>
                updateTable(seg.id, (rows) => (rows.length > 1 ? rows.filter((_, ri) => ri !== r) : rows))
              }
              onAddCol={() => updateTable(seg.id, (rows) => rows.map((row) => [...row, ""]))}
              onRemoveCol={(c) =>
                updateTable(seg.id, (rows) =>
                  (rows[0]?.length ?? 0) > 1 ? rows.map((row) => row.filter((_, ci) => ci !== c)) : rows
                )
              }
              onDelete={() => deleteTable(seg.id)}
            />
          )
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <ToggleInsertButton textareaRef={activeTextareaRef()} />
        {onUploaded && (
          <MediaInsertButton
            textareaRef={activeTextareaRef()}
            onUploaded={onUploaded}
            uploadAction={uploadInlineBoardFile}
          />
        )}
        <button
          type="button"
          onClick={insertTableAtCursor}
          className="self-start rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-brand hover:text-brand"
        >
          ▦ 표 삽입
        </button>
      </div>

      <input type="hidden" name={name} value={serialized} />
    </div>
  );
}
