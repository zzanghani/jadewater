import type { createClient } from "@/lib/supabase/server";

export function avatarPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/avatars/${path}`;
}

// avatar_path는 name 등 기존 필드와 별도 쿼리로 조회한다. 같은 select에
// 묶으면, avatar_path 컬럼을 아직 추가하지 않은 환경(마이그레이션 전)에서는
// 쿼리 전체가 실패해서 이미 잘 되던 이름 표시까지 "알 수 없음"으로 깨진다.
export async function fetchAvatarUrlById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[]
): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("id, avatar_path").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, avatarPublicUrl(p.avatar_path)]));
}
