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

const KST_TIME_ONLY_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// 서버(Vercel/Node)는 보통 UTC로 돌아서, new Date(iso).getHours() 같은 로컬
// getter를 그대로 쓰면 서버 컴포넌트에서만 시간이 9시간 밀려 보이는 문제가
// 있었다(클라이언트 컴포넌트는 방문자 기기 시간대라 KST라 문제 없음). 항상
// Asia/Seoul 기준으로 "M/D HH:MM" 라벨을 만들어서 서버/클라이언트 어디서
// 불러도 같은 결과가 나오게 한다.
export function kstDateTimeLabel(iso: string): string {
  const d = new Date(iso);
  const [, m, day] = KST_DATE_FORMAT.format(d).split("-");
  return `${Number(m)}/${Number(day)} ${KST_TIME_ONLY_FORMAT.format(d)}`;
}

// 구글드라이브 백업 파일명 등에 쓰는 "YYYY-MM-DD HH:MM" 전체 형식.
export function kstDateTimeFullLabel(iso: string): string {
  const d = new Date(iso);
  return `${KST_DATE_FORMAT.format(d)} ${KST_TIME_ONLY_FORMAT.format(d)}`;
}

// 한국 표준시(KST, UTC+9) 기준 오늘부터 n일 전 날짜를 'YYYY-MM-DD'로 반환.
// KST는 DST가 없으므로 UTC ms에서 24h * n을 빼는 것만으로 정확한 달력 날짜가 나온다.
export function kstDateString(daysAgo = 0): string {
  return KST_DATE_FORMAT.format(new Date(Date.now() - daysAgo * 86_400_000));
}

// KST 달력 날짜 기준으로 iso 시각으로부터 오늘까지 며칠 지났는지. 당일이면 0.
export function daysSinceKST(iso: string): number {
  const [y, m, d] = KST_DATE_FORMAT.format(new Date(iso)).split("-").map(Number);
  const targetUTC = Date.UTC(y, m - 1, d);
  const [ty, tm, td] = kstDateString(0).split("-").map(Number);
  const todayUTC = Date.UTC(ty, tm - 1, td);
  return Math.round((todayUTC - targetUTC) / 86_400_000);
}

// 입사일('YYYY-MM-DD')로부터 오늘(KST)까지의 근속기간을 "N년 M개월"로 표시.
export function tenureLabel(hireDate: string): string {
  const [hy, hm, hd] = hireDate.split("-").map(Number);
  const [ty, tm, td] = kstDateString(0).split("-").map(Number);

  let months = (ty - hy) * 12 + (tm - hm);
  if (td < hd) months -= 1;
  if (months < 0) return "입사 예정";

  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  if (years === 0 && restMonths === 0) return "이번 달 입사";
  if (years === 0) return `${restMonths}개월`;
  if (restMonths === 0) return `${years}년`;
  return `${years}년 ${restMonths}개월`;
}

// 보건증 발급일 기준 상태. 보건증은 발급일로부터 1년(365일) 동안만 유효해서,
// 그 만료일까지 남은 일수를 기준으로 3단계 경고를 매긴다.
// (만료일이 지난 경우도 d15와 동일하게 가장 강한 경고로 취급한다.)
export type HealthCertStatus = "none" | "ok" | "d45" | "d30" | "d15";

export function healthCertStatus(issuedAt: string | null): HealthCertStatus {
  if (!issuedAt) return "none";
  const elapsedDays = daysSinceKST(`${issuedAt}T00:00:00`);
  const daysUntilDue = 365 - elapsedDays;
  if (daysUntilDue <= 15) return "d15";
  if (daysUntilDue <= 30) return "d30";
  if (daysUntilDue <= 45) return "d45";
  return "ok";
}

// 'YYYY-MM-DD' 날짜에 days일을 더한 'YYYY-MM-DD' (음수면 이전 날짜).
export function shiftDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate()
  ).padStart(2, "0")}`;
}

// 보건증 발급일 기준 만료일과 D-day. healthCertStatus의 3단계 뱃지 옆에
// 실제 만료일/남은 일수를 같이 보여줄 때 쓴다.
export function healthCertExpiry(issuedAt: string | null): { dueDate: string; daysLeft: number } | null {
  if (!issuedAt) return null;
  const dueDate = shiftDateString(issuedAt, 365);
  const elapsedDays = daysSinceKST(`${issuedAt}T00:00:00`);
  return { dueDate, daysLeft: 365 - elapsedDays };
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

// 'YYYY-MM-DD'(월요일) → "7/21 ~ 7/27" 형태의 주간 라벨.
export function weekRangeLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const monday = new Date(Date.UTC(y, m - 1, d));
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return `${monday.getUTCMonth() + 1}/${monday.getUTCDate()} ~ ${sunday.getUTCMonth() + 1}/${sunday.getUTCDate()}`;
}

// weeksAgo=0(이번주) 기준 월~일 7일치 'YYYY-MM-DD' 배열(KST).
export function weekDatesKST(weeksAgo = 0): string[] {
  const today = kstDateString(0);
  const daysSinceMonday = (kstWeekdayIndex(today) + 6) % 7;
  const mondayDaysAgo = daysSinceMonday + weeksAgo * 7;
  return Array.from({ length: 7 }, (_, i) => kstDateString(mondayDaysAgo - i));
}

// date가 속한 월~일 주의 월요일 날짜('YYYY-MM-DD', KST). 스케줄러
// 주간표처럼 임의의 날짜가 속한 주의 시작일이 필요한 화면에서 쓴다.
export function mondayOfWeekKST(date: string): string {
  const daysSinceMonday = (kstWeekdayIndex(date) + 6) % 7;
  return shiftDateString(date, -daysSinceMonday);
}

// 월요일 날짜 기준 월~일 7일치 'YYYY-MM-DD' 배열(KST).
export function mondayWeekDatesKST(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftDateString(monday, i));
}

// 'YYYY-MM-DD'(월요일) → "7/20 ~ 7/26" 형태의 주간 라벨.
export function mondayWeekRangeLabel(monday: string): string {
  const sunday = shiftDateString(monday, 6);
  const [, mm, md] = monday.split("-").map(Number);
  const [, em, ed] = sunday.split("-").map(Number);
  return `${Number(mm)}/${Number(md)} ~ ${Number(em)}/${Number(ed)}`;
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

// 'YYYY-MM' 문자열 기준 그 달의 첫날/마지막날/라벨.
export function monthRangeFromMonthString(monthStr: string): {
  start: string;
  end: string;
  label: string;
} {
  const [y, m] = monthStr.split("-").map(Number);
  const start = `${monthStr}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${monthStr}-${String(lastDay).padStart(2, "0")}`;
  return { start, end, label: `${y}년 ${m}월` };
}

// 'YYYY-MM' 문자열에 delta개월을 더한 'YYYY-MM' 문자열.
export function shiftMonthString(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  return `${ny}-${String(nm + 1).padStart(2, "0")}`;
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
