"use client";

import { useState } from "react";
import Link from "next/link";
import EvalForm from "@/components/EvalForm";
import EvalResult from "@/components/EvalResult";
import type { Employee, PeerFeedback, PerformanceReview } from "@/lib/types";

export default function EvalPageClient({
  employee,
  period,
  currentReview,
  history,
  peerFeedback,
}: {
  employee: Employee;
  period: string;
  currentReview: PerformanceReview | null;
  history: PerformanceReview[];
  peerFeedback: PeerFeedback[];
}) {
  const [editing, setEditing] = useState(!currentReview);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/hr" className="text-sm font-semibold text-muted">
          ← HR
        </Link>
      </div>

      {editing ? (
        <EvalForm
          employee={employee}
          period={period}
          existingScores={currentReview?.scores}
          existingComment={currentReview?.comment}
          existingEvaluatorNote={currentReview?.evaluator_note}
          onSaved={() => setEditing(false)}
        />
      ) : currentReview ? (
        <EvalResult
          employee={employee}
          review={currentReview}
          history={history}
          peerFeedback={peerFeedback}
          onEdit={() => setEditing(true)}
        />
      ) : null}
    </div>
  );
}
