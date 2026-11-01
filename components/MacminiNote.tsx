// 체험단 화면 공용 — 맥미니 작업기가 마지막으로 한 일/오류 한 줄. "맥미니 10/28 19:45 · 지원자 32명 가져옴"
export default function MacminiNote({ note, at }: { note: string | null; at: string | null }) {
  if (!note) return null;
  const when = at
    ? new Date(at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
    : "";
  const isError = note.startsWith("오류");
  return (
    <p className={`mt-1 text-[11px] ${isError ? "font-medium text-red-600" : "text-muted"}`}>
      맥미니 {when && `${when} · `}
      {note}
    </p>
  );
}
