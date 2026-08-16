// 게시글 본문에 노션처럼 토글(접기/펼치기)을 쓸 수 있게 하는 아주 단순한
// 마크업. "▶ 제목" 줄로 시작하면 토글이 열리고, 그 다음 "▶" 줄(다음
// 토글) 또는 본문 끝에서 자동으로 닫힌다. "◀" 줄을 직접 넣으면 다음
// 토글을 기다리지 않고 그 자리에서 먼저 닫을 수 있다(토글 뒤에 일반
// 문단을 이어 쓰고 싶을 때). 명시적으로 닫아야만 하던 예전 방식보다
// 실수할 일이 적도록, ◀는 있으면 쓰고 없어도 되는 선택 사항으로 뒀다.
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
      let explicitCloseIndex = -1;
      while (j < lines.length) {
        if (lines[j].trim() === TOGGLE_CLOSE_MARK) {
          explicitCloseIndex = j;
          break;
        }
        if (lines[j].startsWith(TOGGLE_OPEN_PREFIX)) break;
        contentLines.push(lines[j]);
        j++;
      }

      flushText();
      segments.push({ type: "toggle", title, content: contentLines.join("\n") });
      i = explicitCloseIndex !== -1 ? explicitCloseIndex + 1 : j;
      continue;
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
