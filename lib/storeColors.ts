const STORE_COLORS: [string, string][] = [
  ["옥수", "#FF6900"],
  ["서울역", "#002D72"],
  ["성수", "#3AA021"],
  ["하남", "#BC90BF"],
];

export function storeColor(name: string): string {
  return STORE_COLORS.find(([key]) => name.includes(key))?.[1] ?? "#6b7280";
}
