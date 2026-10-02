"use client";

export type AttendanceCsvRow = {
  date: string;
  time: string;
  name: string;
  type: string;
  scheduled: string;
  verdict: string;
  distance_m: number | null;
  accuracy_m: number | null;
  radius_m: number | null;
  flagged: boolean;
};

// 사양서 8장 "CSV 내보내기". 엑셀에서 한글이 깨지지 않게 BOM을 붙인다.
export default function AttendanceCsvButton({
  rows,
  filename,
}: {
  rows: AttendanceCsvRow[];
  filename: string;
}) {
  function download() {
    const header = ["날짜", "시각", "이름", "구분", "예정", "지각/조퇴", "매장까지(m)", "GPS오차(m)", "허용반경(m)", "반경밖"];
    const lines = rows.map((r) =>
      [r.date, r.time, r.name, r.type, r.scheduled, r.verdict, r.distance_m ?? "", r.accuracy_m ?? "", r.radius_m ?? "", r.flagged ? "Y" : ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={rows.length === 0}
      className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold disabled:opacity-50"
    >
      CSV 내보내기
    </button>
  );
}
