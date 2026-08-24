import type { PeerFeedback } from "@/lib/types";

// 근무평가 결과 화면에서 보여주는 참고용 섹션 — 익명 피드백이라 누가
// 썼는지는 표시하지 않고, 평점/코멘트만 보여준다. 여기서는 입력할 수
// 없고, 실제 제출은 같은 매장 동료가 /peer-feedback에서 직접 한다.
export default function PeerFeedbackSection({ feedback }: { feedback: PeerFeedback[] }) {
  const average =
    feedback.length > 0
      ? (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1)
      : null;

  if (feedback.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <span className="px-0.5 text-xs font-bold">
          동료 한마디 <span className="font-normal text-muted">(참고용, 점수에 반영 안 됨)</span>
        </span>
        <p className="rounded-2xl border border-dashed border-border bg-background px-4 py-3 text-xs text-muted">
          아직 등록된 동료 한마디가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-xs font-bold">
          동료 한마디 <span className="font-normal text-muted">(참고용, 점수에 반영 안 됨)</span>
        </span>
        <span className="flex items-center gap-1 text-xs font-bold text-muted">
          ★ {average} ({feedback.length})
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {feedback.map((f) => (
          <li key={f.id} className="rounded-2xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted">
              {"★".repeat(f.rating)}
              {"☆".repeat(5 - f.rating)}
            </span>
            {f.comment && <p className="mt-1 text-xs leading-relaxed text-muted">{f.comment}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
