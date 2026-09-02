import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

// 월말정산/스케줄러 수정·삭제처럼 지점장만 할 수 있어야 하는 동작을 잠그는
// 브랜드별 비밀번호. 실제 접근 제어는 Supabase Auth+RLS(매장 단위)가 담당하고,
// 이 비밀번호는 같은 매장 계정을 쓰는 파트타이머 등이 실수로 건드리지 않도록
// 막는 보조 잠금이다.
//
// 암호 자체는 brand_secrets 테이블에 있고 앱은 읽을 수 없다. "이 암호가 맞냐"만
// 물어보고 맞다/틀리다만 돌려받는다. (supabase/migration_brand_admin_password.sql)
export async function verifyAdminPassword(
  supabase: SupabaseClient<Database>,
  brandId: string | null | undefined,
  attempt: string
): Promise<boolean> {
  if (!brandId || !attempt) return false;

  const { data, error } = await supabase.rpc("verify_brand_admin_password", {
    p_brand_id: brandId,
    p_attempt: attempt,
  });

  if (error) return false;
  return data === true;
}
