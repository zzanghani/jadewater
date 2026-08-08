const WON = new Intl.NumberFormat("ko-KR");

export function formatWon(value: number): string {
  return `${WON.format(Math.round(value))}원`;
}

export function formatPercent(value: number, base: number): string {
  if (!base) return "-";
  return `${((value / base) * 100).toFixed(1)}%`;
}

// 숫자만 입력받는 금액 입력칸에서, 입력 중에도 천 단위 콤마가 보이게
// 표시용으로 변환한다. (state에는 여전히 숫자만 든 문자열을 들고 있는다.)
export function formatAmountInput(digits: string): string {
  if (!digits) return "";
  return WON.format(Number(digits));
}
