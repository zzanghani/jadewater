// 매장 라벨 색과 짧은 태그는 stores 테이블의 color / short_label 컬럼에서 온다.
// 예전에는 매장 이름 글자를 매칭해서 뽑았는데("서울역"이 들어가면 남색),
// 브랜드가 늘면서 "정다미 서울역점"이 "제이드앤워터 서울역점"으로 오인식되는
// 문제가 생겨 컬럼 값으로 옮겼다. (supabase/migration_brands.sql 참고)

const FALLBACK_COLOR = "#6b7280";

type StoreLike = {
  name: string;
  color?: string | null;
  short_label?: string | null;
};

export function storeColor(store: StoreLike | null | undefined): string {
  return store?.color || FALLBACK_COLOR;
}

// 사람 이름 옆에 붙일 짧은 태그("옥수"). 값이 없으면 매장 전체 이름을 그대로 쓴다.
export function storeShortLabel(store: StoreLike | null | undefined): string {
  return store?.short_label || store?.name || "";
}

// 목록에서 매장명 라벨처럼 작은 텍스트에 쓰는, 원래 색보다 옅은 버전.
export function storeColorSoft(store: StoreLike | null | undefined): string {
  return `${storeColor(store)}99`;
}
