const WON = new Intl.NumberFormat("ko-KR");

export function formatWon(value: number): string {
  return `${WON.format(Math.round(value))}원`;
}

export function formatPercent(value: number, base: number): string {
  if (!base) return "-";
  return `${((value / base) * 100).toFixed(1)}%`;
}
