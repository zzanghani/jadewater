import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/signup']

// Next.js 16: `middleware.ts`/`middleware()`는 `proxy.ts`/`proxy()`로 이름이 바뀌었다.
// 여기서는 Supabase 세션 쿠키를 갱신하고, 비로그인 사용자를 /login으로 보낸다.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser()는 매번 Supabase Auth 서버에 재검증 요청을 보내 왕복이 느리다.
  // 여기서는 로그인 여부에 따른 리다이렉트만 결정하면 되고, 실제 데이터
  // 접근 권한은 각 쿼리마다 RLS가 진짜 토큰으로 다시 검증하므로 이 경로에서는
  // 로컬 쿠키만 읽는 getSession()으로 충분하다 (세션 만료 시 자동 갱신은 그대로 동작).
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  const path = request.nextUrl.pathname
  const isPublicPath = PUBLIC_PATHS.some((p) => path.startsWith(p))

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', path)
    return NextResponse.redirect(url)
  }

  if (user && isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.searchParams.delete('redirectTo')
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // /api는 제외한다 (크론 등 API 라우트는 세션 쿠키가 아니라 자체 인증을 쓴다).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
