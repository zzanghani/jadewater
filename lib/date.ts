const KST_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const KST_LABEL_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

// 한국 표준시(KST, UTC+9) 기준 오늘부터 n일 전 날짜를 'YYYY-MM-DD'로 반환.
// KST는 DST가 없으므로 UTC ms에서 24h * n을 빼는 것만으로 정확한 달력 날짜가 나온다.
export function kstDateString(daysAgo = 0): string {
  return KST_DATE_FORMAT.format(new Date(Date.now() - daysAgo * 86_400_000));
}

export function kstDateLabel(dateStr: string): string {
  return KST_LABEL_FORMAT.format(new Date(`${dateStr}T00:00:00+09:00`));
}

// 'YYYY-MM-DD' → "7.20" 형태의 숫자 날짜 표기.
export function kstShortDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}.${d}`;
}

export function last7DaysKST(): string[] {
  return Array.from({ length: 7 }, (_, i) => kstDateString(6 - i));
}

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

// 'YYYY-MM-DD'(KST) 날짜의 요일을 0=일 ~ 6=토로 반환.
// 로컬 서버 타임존과 무관하게 순수 달력 날짜로 취급해 계산한다.
// (참고: "+09:00" 오프셋을 붙여 파싱한 뒤 getUTCDay()를 읽으면 자정 KST가
//  UTC로는 전날 오후가 되어 요일이 하루 밀리므로, 날짜를 직접 분해해 UTC 자정으로 만든다.)
function kstWeekdayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// 'YYYY-MM-DD'(KST) 날짜의 요일을 0=일 ~ 6=토로 반환 (달력 그리드용).
export function kstWeekday(dateStr: string): number {
  return kstWeekdayIndex(dateStr);
}

export function kstWeekdayShortLabel(dateStr: string): string {
  return WEEKDAY_LABELS[(kstWeekdayIndex(dateStr) + 6) % 7];
}

// weeksAgo=0(이번주) 기준 월~일 7일치 'YYYY-MM-DD' 배열(KST).
export function weekDatesKST(weeksAgo = 0): string[] {
  const today = kstDateString(0);
  const daysSinceMonday = (kstWeekdayIndex(today) + 6) % 7;
  const mondayDaysAgo = daysSinceMonday + weeksAgo * 7;
  return Array.from({ length: 7 }, (_, i) => kstDateString(mondayDaysAgo - i));
}

// monthsAgo=0(이번달) 기준 그 달의 첫날/마지막날/라벨(KST).
export function monthRangeKST(monthsAgo = 0): {
  start: string;
  end: string;
  label: string;
} {
  const [year, month] = kstDateString(0).split("-").map(Number);
  const totalMonths = year * 12 + (month - 1) - monthsAgo;
  const y = Math.floor(totalMonths / 12);
  const m = ((totalMonths % 12) + 12) % 12; // 0-indexed month, always positive

  const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const end = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const label = `${y}년 ${m + 1}월`;

  return { start, end, label };
}

// month('YYYY-MM-DD' 아무 날짜)가 속한 달의 1일부터 마지막 날까지 'YYYY-MM-DD' 배열.
export function daysInMonthKST(dateInMonth: string): string[] {
  const [y, m] = dateInMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from(
    { length: lastDay },
    (_, i) => `${y}-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`
  );
}
