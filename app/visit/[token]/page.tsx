import { loadBookingInfo } from "./actions";
import VisitBookingForm from "./VisitBookingForm";

// 선정된 블로거용 공개 예약 페이지 — 로그인 없음. 링크 토큰은 회차마다 다르고,
// 저장은 입력한 블로그가 선정자일 때만 된다 (actions.ts).
export default async function VisitBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await loadBookingInfo(token);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-8">
      {!info ? (
        <section className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-base font-bold">예약 링크가 유효하지 않아요</p>
          <p className="mt-2 text-sm text-muted">모집이 끝났거나 링크가 바뀌었어요. 매장에 문의해 주세요.</p>
        </section>
      ) : (
        <>
          <header>
            <p className="text-xs font-semibold text-brand">체험단 방문 예약</p>
            <h1 className="mt-1 text-xl font-bold">{info.storeName}</h1>
            {info.campaignTitle && <p className="mt-1 text-sm text-muted">{info.campaignTitle}</p>}
          </header>

          <section className="rounded-2xl border border-border bg-card p-4 text-sm">
            <p className="font-semibold">방문 안내</p>
            <dl className="mt-2 flex flex-col gap-1.5 text-muted">
              {info.possibleDays && (
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0">가능 요일</dt>
                  <dd className="text-foreground">{info.possibleDays}</dd>
                </div>
              )}
              {info.possibleTime && (
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0">가능 시간</dt>
                  <dd className="text-foreground">{info.possibleTime}</dd>
                </div>
              )}
              {info.scheduleInformation && (
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0">참고</dt>
                  <dd className="text-foreground">{info.scheduleInformation}</dd>
                </div>
              )}
              {info.reviewEndAt && (
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0">리뷰 마감</dt>
                  <dd className="text-foreground">
                    {new Date(info.reviewEndAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" })}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <VisitBookingForm token={token} />
        </>
      )}
    </main>
  );
}
