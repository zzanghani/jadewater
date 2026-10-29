import Link from "next/link";

// 광고 화면 공통 머리글: 뒤로 가기 ‹ 와 제목을 한 줄에, 설명은 짧게 한 줄.
// 폰에서 제목 위에 '‹ 광고 리포트' 한 줄, 아래에 긴 설명 두세 줄이 쌓여 어수선했던 걸 정리한 것.
export default function AdPageHeader({
  back,
  backLabel,
  title,
  desc,
  action,
}: {
  back: string;
  backLabel: string;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Link href={back} aria-label={`${backLabel}으로`} title={backLabel} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-lg leading-none text-muted">
        ‹
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold leading-tight">{title}</h1>
        {desc && <p className="truncate text-xs text-muted">{desc}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
