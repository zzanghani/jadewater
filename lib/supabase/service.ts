import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

// RLS를 우회하는 서비스 롤 클라이언트. 사용자 요청(페이지/서버 액션)에서는
// 절대 쓰지 말고, 크론/자동화처럼 사람이 로그인하지 않은 배치 작업에서만 사용한다.
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
