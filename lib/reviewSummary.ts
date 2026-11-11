// 리뷰 리포트 AI 요약의 구조. 화면(클라이언트)과 메일(서버) 양쪽에서 파싱하므로 서버 전용 코드와 분리해 둔다.
// 새 요약은 JSON으로 저장되고, 예전 요약("1) 헤드라인 / 2) 칭찬한 점 / 3) 불만 / 4) 실천 제안" 글)도
// 같은 구조로 풀어서 똑같이 긍정=녹색, 부정=적색으로 보여준다.
export type ReviewPoint = { point: string; detail: string };
export type ReviewSummary = {
  headline: string;
  positives: ReviewPoint[];
  negatives: ReviewPoint[];
  actions: string[];
};

const clean = (s: string) => s.replace(/\*\*/g, "").replace(/^#+\s*/, "").replace(/^[\[［](.*)[\]］]$/, "$1").trim();
const isNone = (s: string) => /^\(?\s*(없음|해당 ?없음|특이 ?사항 ?없음)\s*\)?\.?$/.test(s);
// "불만이 발견되지 않음" 같은 문장은 부정이 아니라 "없음"이다.
const saysNoComplaint = (s: string) => /(불만|개선|부정)[^.]{0,30}(없|발견되지 않|확인되지 않)/.test(s) && s.length < 80;

function points(v: unknown): ReviewPoint[] {
  if (!Array.isArray(v)) return [];
  const out: ReviewPoint[] = [];
  for (const x of v) {
    if (typeof x === "string") {
      if (x.trim() && !isNone(x.trim())) out.push({ point: x.trim(), detail: "" });
    } else if (x && typeof x === "object" && typeof (x as { point?: unknown }).point === "string") {
      const p = (x as { point: string }).point.trim();
      const d = typeof (x as { detail?: unknown }).detail === "string" ? (x as { detail: string }).detail.trim() : "";
      if (p && !isNone(p)) out.push({ point: p, detail: d });
    }
  }
  return out;
}

function parseJson(raw: string): ReviewSummary | null {
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const a = text.indexOf("{");
  const z = text.lastIndexOf("}");
  if (a !== 0 || z <= a) return null; // 글 형식(예전)은 여기서 빠진다
  try {
    const j = JSON.parse(text.slice(a, z + 1)) as Record<string, unknown>;
    if (typeof j.headline !== "string") return null;
    return {
      headline: j.headline.trim(),
      positives: points(j.positives),
      negatives: points(j.negatives).filter((p) => !saysNoComplaint(p.point)),
      actions: Array.isArray(j.actions) ? j.actions.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim()) : [],
    };
  } catch {
    return null;
  }
}

// 예전 글 형식: 제목(#…) 뒤에 "1) 헤드라인", "2) 칭찬한 점", "3) 불만/개선할 점", "4) 오늘 실천 제안" 과 "– 항목".
function parseLegacy(raw: string): ReviewSummary | null {
  const out: ReviewSummary = { headline: "", positives: [], negatives: [], actions: [] };
  let section: "headline" | "pos" | "neg" | "act" | null = null;
  let found = false;
  for (const lineRaw of raw.split("\n")) {
    const line = clean(lineRaw);
    if (!line) continue;
    const head = line.match(/^(\d)\s*[).]\s*(.*)$/);
    if (head) {
      const title = clean(head[2]);
      if (/칭찬|긍정|좋은/.test(title)) section = "pos";
      else if (/불만|개선|부정|아쉬/.test(title)) section = "neg";
      else if (/제안|실천|할 일/.test(title)) section = "act";
      else {
        section = "headline";
        // "1) 한 줄 헤드라인" 은 이름표일 뿐이고, 내용이 같은 줄에 올 때만 헤드라인으로 쓴다.
        if (title && !/헤드라인/.test(title)) out.headline = title;
      }
      found = true;
      continue;
    }
    if (!section) continue;
    const item = line.replace(/^[–—\-•·*]\s*/, "").trim();
    if (!item || isNone(item)) continue;
    if (section === "headline") {
      if (!out.headline) out.headline = item;
    } else if (section === "pos") out.positives.push({ point: item, detail: "" });
    else if (section === "neg") {
      if (!saysNoComplaint(item)) out.negatives.push({ point: item, detail: "" });
    } else out.actions.push(item);
  }
  if (!found || (!out.headline && !out.positives.length && !out.negatives.length && !out.actions.length)) return null;
  return out;
}

export function parseReviewSummary(raw: string | null | undefined): ReviewSummary | null {
  if (!raw || !raw.trim()) return null;
  return parseJson(raw) ?? parseLegacy(raw);
}
