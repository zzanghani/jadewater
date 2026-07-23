import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { weekRangeLabel } from "@/lib/date";

function ReportSection({
  icon,
  label,
  items,
}: {
  icon: string;
  label: string;
  items: string[];
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
        {icon} {label}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">작성된 내용이 없습니다.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-2 text-sm text-foreground">
              <span className="shrink-0 text-muted">{idx + 1}.</span>
              <span className="whitespace-pre-wrap">{item}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default async function WeeklyReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { storeId, stores } = await getStoreContext(supabase);
  const isMaster = stores.length > 1;

  const { data: report } = await supabase
    .from("weekly_reports")
    .select("*")
    .eq("id", id)
    .single();

  if (!report) notFound();

  const storeName = stores.find((s) => s.id === report.store_id)?.name ?? "알 수 없음";
  const canEdit = !isMaster && report.store_id === storeId;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href="/weekly-report" className="flex items-center gap-1 text-sm font-medium text-muted">
          <span aria-hidden>←</span> 목록으로
        </Link>
        {canEdit && (
          <Link
            href={`/weekly-report/write?week=${report.week_start}`}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand/30"
          >
            수정
          </Link>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold">{weekRangeLabel(report.week_start)} 주간보고</h1>
          {isMaster && (
            <span className="rounded-full bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand">
              {storeName}
            </span>
          )}
        </div>
      </div>

      <ReportSection icon="🎯" label="주간목표" items={report.goals} />
      <ReportSection icon="👥" label="HR - 진행상황" items={report.hr_items} />

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold">💰 매출</h2>
        {report.sales_notes.length > 0 && (
          <ol className="mb-3 flex flex-col gap-1">
            {report.sales_notes.map((item, idx) => (
              <li key={idx} className="flex gap-2 text-sm text-foreground">
                <span className="shrink-0 text-muted">{idx + 1}.</span>
                <span className="whitespace-pre-wrap">{item}</span>
              </li>
            ))}
          </ol>
        )}
        {report.sales_table.length === 0 ? (
          <p className="text-sm text-muted">작성된 매출 비교표가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-2 font-medium">항목</th>
                  <th className="pb-2 font-medium">전주</th>
                  <th className="pb-2 font-medium">금주</th>
                </tr>
              </thead>
              <tbody>
                {report.sales_table.map((row, idx) => (
                  <tr key={idx} className="border-t border-border">
                    <td className="py-1.5 pr-2 font-medium">{row.label}</td>
                    <td className="py-1.5 pr-2 text-muted">{row.lastWeek}</td>
                    <td className="py-1.5 pr-2">{row.thisWeek}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ReportSection icon="⭐" label="주간이슈" items={report.issues} />
      <ReportSection icon="🍳" label="키친" items={report.kitchen_items} />
      <ReportSection icon="🍽️" label="홀" items={report.hall_items} />
    </div>
  );
}
