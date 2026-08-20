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
  // 윈도우/엑셀 등에서 붙여넣으면 줄바꿈이 \r\n으로 들어올 수 있는데, 남은
  // \r 하나가 정규식 끝 앵커(▶/◀/사진·파일·표 줄 매칭)를 깨뜨리므로 미리 없앤다.
  const lines = body.replace(/\r\n/g, "\n").split("\n");
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

// 목록 미리보기처럼 한두 줄로 잘라 보여줘야 하는 곳에서, 토글 표시 기호나
// 사진/파일/표 마크업 없이 제목과 내용을 이어서 평문으로 보여주기 위한 변환.
export function flattenBoardBodyForPreview(body: string): string {
  return parseBoardBody(body)
    .map((seg) => {
      const content = flattenInlineContentForPreview(seg.content);
      return seg.type === "toggle" ? `${seg.title} ${content}` : content;
    })
    .join(" ")
    .trim();
}

// 본문/토글 내용 한 덩어리 안에 텍스트와 함께 들어갈 수 있는 사진·파일·표.
// 한 줄이 통째로 해당 마크업이면 그 종류로, 아니면 일반 텍스트로 취급한다.
// 표는 "|칸|칸|" 형태 줄이 연속되는 구간을 하나의 표로 묶고, 첫 줄을
// 헤더로 삼는다(구분선 줄 같은 건 따로 없음 — 최대한 단순하게).
export type InlineNode =
  | { kind: "text"; text: string }
  | { kind: "image"; path: string; alt: string }
  | { kind: "file"; path: string; name: string }
  | { kind: "table"; rows: string[][] };

const IMAGE_LINE = /^!\[(.*)\]\((.+)\)$/;
const FILE_LINE = /^\[📎 (.*)\]\((.+)\)$/;
const TABLE_ROW = /^\|(.+)\|$/;

export function parseInlineContent(content: string): InlineNode[] {
  const lines = content.split("\n");
  const nodes: InlineNode[] = [];
  let textBuffer: string[] = [];
  let tableBuffer: string[][] = [];

  function flushText() {
    const text = textBuffer.join("\n");
    if (text.trim()) nodes.push({ kind: "text", text });
    textBuffer = [];
  }
  function flushTable() {
    if (tableBuffer.length > 0) nodes.push({ kind: "table", rows: tableBuffer });
    tableBuffer = [];
  }

  for (const line of lines) {
    const tableMatch = line.match(TABLE_ROW);
    if (tableMatch) {
      flushText();
      tableBuffer.push(tableMatch[1].split("|").map((c) => c.trim()));
      continue;
    }
    flushTable();

    const imageMatch = line.match(IMAGE_LINE);
    if (imageMatch) {
      flushText();
      nodes.push({ kind: "image", alt: imageMatch[1] || "사진", path: imageMatch[2] });
      continue;
    }

    const fileMatch = line.match(FILE_LINE);
    if (fileMatch) {
      flushText();
      nodes.push({ kind: "file", name: fileMatch[1] || "파일", path: fileMatch[2] });
      continue;
    }

    textBuffer.push(line);
  }
  flushText();
  flushTable();

  return nodes;
}

export function flattenInlineContentForPreview(content: string): string {
  return parseInlineContent(content)
    .map((n) => {
      if (n.kind === "text") return n.text;
      if (n.kind === "image") return "[사진]";
      if (n.kind === "file") return `[파일: ${n.name}]`;
      return "[표]";
    })
    .join(" ");
}

// 본문 전체(모든 토글 포함)에서 사진/파일로 참조된 스토리지 경로를 뽑아낸다.
// 글 저장 시 board_attachments에 등록해 첨부파일 목록·삭제 시 정리 대상에
// 포함시키기 위해 쓴다.
export function extractInlineStoragePaths(body: string): { path: string; fileName: string }[] {
  const segments = parseBoardBody(body);
  const found: { path: string; fileName: string }[] = [];
  for (const seg of segments) {
    for (const node of parseInlineContent(seg.content)) {
      if (node.kind === "image") found.push({ path: node.path, fileName: node.alt });
      if (node.kind === "file") found.push({ path: node.path, fileName: node.name });
    }
  }
  return found;
}
