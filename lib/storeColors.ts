const STORE_COLORS: [string, string][] = [
  ["옥수", "#FF6900"],
  ["서울역", "#002D72"],
  ["성수", "#3AA021"],
  ["하남", "#BC90BF"],
];

export function storeColor(name: string): string {
  return STORE_COLORS.find(([key]) => name.includes(key))?.[1] ?? "#6b7280";
}

// 매장 전체 이름("제이드앤워터 옥수본점")에서 사람 이름 옆에 붙일
// 짧은 태그("옥수")만 뽑아낸다. 매칭되는 게 없으면 원래 이름 그대로.
export function storeShortLabel(name: string): string {
  return STORE_COLORS.find(([key]) => name.includes(key))?.[0] ?? name;
}

// 목록에서 매장명 라벨처럼 작은 텍스트에 쓰는, 원래 색보다 옅은 버전.
export function storeColorSoft(name: string): string {
  return `${storeColor(name)}99`;
}
