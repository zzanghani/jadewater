// 게시글 본문에 노션처럼 토글(접기/펼치기)을 쓸 수 있게 하는 아주 단순한
// 마크업. "▶ 제목" 줄로 시작해서 "◀" 줄로 끝나면 그 사이 내용이 토글
// 안에 들어간다. 직접 타이핑하기보단 ToggleInsertButton으로 틀을 넣고
// 제목/내용만 채우는 걸 기본 사용법으로 삼는다.
export const TOGGLE_OPEN_PREFIX = "▶";
export const TOGGLE_CLOSE_MARK = "◀";

export type BoardBodySegment =
  | { type: "text"; content: string }
  | { type: "toggle"; title: string; content: string };

export function parseBoardBody(body: string): BoardBodySegment[] {
  const lines = body.split("\n");
  const segments: BoardBodySegment[] = [];
  let textBuffer: string[] = [];

  function flushText() {
    const content = textBuffer.join("\n");
    if (content.trim()) segments.push({ type: "text", content });
    textBuffer = [];
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const isToggleOpen = line.startsWith(TOGGLE_OPEN_PREFIX);

    if (isToggleOpen) {
      const title = line.slice(TOGGLE_OPEN_PREFIX.length).trim() || "토글";
      const contentLines: string[] = [];
      let j = i + 1;
      let closeIndex = -1;
      while (j < lines.length) {
        if (lines[j].trim() === TOGGLE_CLOSE_MARK) {
          closeIndex = j;
          break;
        }
        contentLines.push(lines[j]);
        j++;
      }

      if (closeIndex !== -1) {
        flushText();
        segments.push({ type: "toggle", title, content: contentLines.join("\n") });
        i = closeIndex + 1;
        continue;
      }
    }

    textBuffer.push(line);
    i++;
  }
  flushText();

  return segments;
}

// 목록 미리보기처럼 한두 줄로 잘라 보여줘야 하는 곳에서, 토글 표시 기호
// 없이 제목과 내용을 이어서 평문으로 보여주기 위한 변환.
export function flattenBoardBodyForPreview(body: string): string {
  return parseBoardBody(body)
    .map((seg) => (seg.type === "toggle" ? `${seg.title} ${seg.content}` : seg.content))
    .join(" ")
    .trim();
}
