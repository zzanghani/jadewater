// AI 전략 메모의 구조. 화면(클라이언트)에서도 파싱하므로 서버 전용 코드와 분리해 둔다.
export type AdStrategyMemo = {
  headline: string;
  good: string[];
  issues: string[];
  actions: { title: string; amount: string; why: string }[];
  budget: { verdict: "유지" | "증액" | "감액"; range: string; why: string };
};

export function parseAdStrategyMemo(raw: string | null | undefined): AdStrategyMemo | null {
  if (!raw) return null;
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(text.slice(start, end + 1)) as Partial<AdStrategyMemo>;
    if (!j || typeof j.headline !== "string" || !Array.isArray(j.actions)) return null;
    const strs = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim().length > 0) : []);
    const verdict = j.budget?.verdict === "증액" || j.budget?.verdict === "감액" ? j.budget.verdict : "유지";
    return {
      headline: j.headline,
      good: strs(j.good),
      issues: strs(j.issues),
      actions: j.actions
        .filter((a): a is AdStrategyMemo["actions"][number] => !!a && typeof a === "object" && typeof (a as { title?: unknown }).title === "string")
        .map((a) => ({ title: a.title, amount: typeof a.amount === "string" ? a.amount : "", why: typeof a.why === "string" ? a.why : "" })),
      budget: { verdict, range: typeof j.budget?.range === "string" ? j.budget.range : "", why: typeof j.budget?.why === "string" ? j.budget.why : "" },
    };
  } catch {
    return null;
  }
}

