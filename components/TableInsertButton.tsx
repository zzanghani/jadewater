"use client";

import { useState, type RefObject } from "react";

const DEFAULT_ROWS = 2;
const DEFAULT_COLS = 2;

function emptyGrid(rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
}

// 칸 안에 "|"나 줄바꿈이 들어가면 표 마크업("|칸|칸|" 줄 단위) 자체가
// 깨지므로, 저장 전에 안전한 문자로 바꿔 둔다.
function sanitizeCell(value: string): string {
  const cleaned = value.replace(/\|/g, "｜").replace(/\n/g, " ").trim();
  return cleaned || " ";
}

export default function TableInsertButton({
  textareaRef,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [grid, setGrid] = useState<string[][]>(() => emptyGrid(DEFAULT_ROWS, DEFAULT_COLS));

  function openModal() {
    setGrid(emptyGrid(DEFAULT_ROWS, DEFAULT_COLS));
    setOpen(true);
  }

  function setCell(r: number, c: number, value: string) {
    setGrid((prev) =>
      prev.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row))
    );
  }

  function addRow() {
    setGrid((prev) => [...prev, Array.from({ length: prev[0]?.length ?? DEFAULT_COLS }, () => "")]);
  }

  function removeRow(r: number) {
    setGrid((prev) => (prev.length > 1 ? prev.filter((_, ri) => ri !== r) : prev));
  }

  function addCol() {
    setGrid((prev) => prev.map((row) => [...row, ""]));
  }

  function removeCol(c: number) {
    setGrid((prev) => ((prev[0]?.length ?? 0) > 1 ? prev.map((row) => row.filter((_, ci) => ci !== c)) : prev));
  }

  function insertTable() {
    const el = textareaRef.current;
    if (!el) return;

    const tableText = grid.map((row) => `| ${row.map(sanitizeCell).join(" | ")} |`).join("\n");

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const needsLeadingNewline = start > 0 && el.value[start - 1] !== "\n";
    const insertion = `${needsLeadingNewline ? "\n" : ""}${tableText}\n`;
    const newValue = el.value.slice(0, start) + insertion + el.value.slice(end);

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    setter?.call(el, newValue);
    el.dispatchEvent(new Event("input", { bubbles: true }));

    const cursorPos = start + insertion.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursorPos, cursorPos);
    });

    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="self-start rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-brand hover:text-brand"
      >
        ▦ 표 삽입
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex w-full max-w-lg flex-col gap-3 rounded-2xl bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">표 만들기</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-lg text-muted"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-muted">첫 번째 줄은 표의 제목(헤더) 칸이 됩니다.</p>

            <div className="overflow-x-auto">
              <table className="border-collapse">
                <tbody>
                  {grid.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="p-0.5">
                          <input
                            type="text"
                            value={cell}
                            onChange={(e) => setCell(ri, ci, e.target.value)}
                            placeholder={ri === 0 ? `헤더${ci + 1}` : `값${ci + 1}`}
                            className={`w-24 rounded-lg border px-2 py-1.5 text-xs outline-none ring-brand/30 focus:ring-2 ${
                              ri === 0
                                ? "border-brand/40 bg-brand-light font-semibold text-brand"
                                : "border-border bg-background text-foreground"
                            }`}
                          />
                        </td>
                      ))}
                      <td className="p-0.5">
                        <button
                          type="button"
                          onClick={() => removeRow(ri)}
                          disabled={grid.length <= 1}
                          aria-label={`${ri + 1}번째 행 삭제`}
                          className="px-1 text-xs text-muted hover:text-red-600 disabled:opacity-30"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    {grid[0]?.map((_, ci) => (
                      <td key={ci} className="p-0.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeCol(ci)}
                          disabled={(grid[0]?.length ?? 0) <= 1}
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

            <div className="flex gap-2">
              <button
                type="button"
                onClick={addRow}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-brand hover:text-brand"
              >
                + 행 추가
              </button>
              <button
                type="button"
                onClick={addCol}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-brand hover:text-brand"
              >
                + 열 추가
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted"
              >
                취소
              </button>
              <button
                type="button"
                onClick={insertTable}
                className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-md shadow-brand/30"
              >
                삽입
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
