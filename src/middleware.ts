import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SECURITY_HEADERS, getCSPHeader } from '@/lib/security/headers';
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/security/rate-limiter';

// Routes that require authentication
const PROTECTED_ROUTES = ['/dashboard'];
// Routes only for unauthenticated users
const AUTH_ROUTES = ['/auth/login', '/auth/signup', '/auth/reset-password'];
// Routes accessible regardless of auth state
const PUBLIC_AUTH_ROUTES = ['/auth/update-password', '/auth/callback'];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL !== 'https://your-project-ref.supabase.co');
}

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function applySecurityHeaders(response: NextResponse): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  response.headers.set('Content-Security-Policy', getCSPHeader());
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── API Rate Limiting ──────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const ip = getClientIP(request);

    // Select rate limit config based on route
    const limitConfig = pathname.startsWith('/api/auth')
      ? RATE_LIMITS.auth
      : pathname.startsWith('/api/ingest')
      ? RATE_LIMITS.ingest
      : pathname.startsWith('/api/teach')
      ? RATE_LIMITS.teach
      : pathname.startsWith('/api/score')
      ? RATE_LIMITS.score
      : RATE_LIMITS.api;

    const rateLimitKey = `${ip}:${pathname.split('/').slice(0, 3).join('/')}`;
    const result = checkRateLimit(rateLimitKey, limitConfig);

    if (!result.allowed) {
      const headers = getRateLimitHeaders(result);
      return NextResponse.json(
        { error: "リクエスト制限に達しました。しばらくお待ちください。", code: "RATE_LIMITED" },
        { status: 429, headers }
      );
    }
  }

  // ─── Supabase Auth ──────────────────────────────────────────
  if (!isSupabaseConfigured()) {
    const response = NextResponse.next({ request });
    applySecurityHeaders(response);
    return response;
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh session – important for SSR
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from protected routes
  if (PROTECTED_ROUTES.some(r => pathname.startsWith(r)) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('redirectTo', pathname);
    const redirectResponse = NextResponse.redirect(url);
    applySecurityHeaders(redirectResponse);
    return redirectResponse;
  }

  // Redirect authenticated users away from auth pages
  if (AUTH_ROUTES.includes(pathname) && user && !PUBLIC_AUTH_ROUTES.some(r => pathname.startsWith(r))) {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo') || '/';
    const url = request.nextUrl.clone();
    url.pathname = redirectTo;
    url.search = '';
    const redirectResponse = NextResponse.redirect(url);
    applySecurityHeaders(redirectResponse);
    return redirectResponse;
  }

  applySecurityHeaders(supabaseResponse);
  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
