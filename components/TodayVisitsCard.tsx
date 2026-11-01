import Link from "next/link";

// 홈 "오늘 체험단 방문" 카드 — 그 매장의 오늘 체험단 방문 예정자.
// 지점장·직원 모두 본다(recruit_visits_between 함수가 매장 소속이면 읽게 해 줌).
// 지점장은 카드를 눌러 체험 진행 탭으로, 직원은 보기만(링크 없음).
export type TodayVisit = {
  id: string;
  applicant_name: string | null;
  blog_id: string;
  visit_at: string;
  visit_party: number | null;
  visit_note: string | null;
  visited_at: string | null;
  no_show: boolean;
  visit_source: string | null;
  campaign_title: string | null;
};

function kstTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function TodayVisitsCard({ visits, canManage }: { visits: TodayVisit[]; canManage: boolean }) {
  if (visits.length === 0) return null;
  const pending = visits.filter((v) => !v.visited_at && !v.no_show);
  const body = (
    <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-violet-900">오늘 체험단 방문 {visits.length}팀</h2>
        <span className="text-[11px] text-violet-700">
          {pending.length > 0 ? `아직 ${pending.length}팀 남음` : "모두 확인됨"}
          {canManage && <span aria-hidden> →</span>}
        </span>
      </div>
      <ul className="mt-2 flex flex-col divide-y divide-violet-100">
        {visits.map((v) => (
          <li key={v.id} className="flex items-start gap-3 py-2 text-sm">
            <span className="w-12 shrink-0 font-semibold tabular-nums text-violet-900">{kstTime(v.visit_at)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">
                {v.applicant_name ?? v.blog_id}
                {v.visit_party ? <span className="ml-1 text-muted">· {v.visit_party}명</span> : null}
                <span className="ml-1 text-[11px] text-muted">블로그 체험단</span>
              </p>
              {v.visit_note && <p className="truncate text-xs text-muted">{v.visit_note}</p>}
            </div>
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                v.no_show ? "bg-red-50 text-red-600" : v.visited_at ? "bg-emerald-100 text-emerald-700" : "bg-white text-violet-700"
              }`}
            >
              {v.no_show ? "노쇼" : v.visited_at ? "방문 완료" : "방문 예정"}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-violet-700">
        {canManage
          ? "손님 오시면 블로그 앱으로 본인 확인 후 체험 진행 탭에서 방문 완료를 눌러 주세요."
          : "체험단 손님이에요. 오시면 점장님께 알려 주세요."}
      </p>
    </section>
  );
  return canManage ? (
    <Link href="/recruit" className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
