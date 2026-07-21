import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import type { Database } from '@/lib/types'

// 서버 컴포넌트 / 서버 액션 / 라우트 핸들러에서 사용하는 Supabase 클라이언트.
// Next.js 16에서 cookies()는 항상 비동기이므로 await 후 어댑터로 넘긴다.
// React cache()로 감싸서 같은 요청(레이아웃 + 페이지 등) 안에서 여러 번
// 호출돼도 클라이언트를 한 번만 만들고, 쿠키 파싱도 한 번만 하도록 한다.
export const createClient = cache(async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // 서버 컴포넌트에서 호출된 경우 쿠키 쓰기가 무시될 수 있음.
            // proxy.ts가 세션 갱신을 담당하므로 문제 없음.
          }
        },
      },
    }
  )
})
