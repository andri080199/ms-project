import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Route auth/publik — gak butuh session
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

// Validasi session via getToken() — decode JWT-nya sekalian.
// Ini lebih ketat dari sekadar cek keberadaan cookie (yang bisa stale/invalid
// setelah AUTH_SECRET berubah atau cookie ke-tamper di iOS Safari).
//
// Behavior:
//  - Token valid → loloskan
//  - Token invalid + path API → balikin 401 JSON (client handler nge-redirect ke /login)
//  - Token invalid + path halaman → redirect ke /login dengan callbackUrl
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthRoute =
    PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/api/auth');
  if (isAuthRoute) return NextResponse.next();

  // Detect HTTPS: kalau cookie __Secure- prefix ada, berarti cookie di-set via HTTPS.
  // Pakai indikator cookie (bukan request protocol) supaya gak ketipu reverse proxy.
  const hasSecureCookie = !!request.cookies.get('__Secure-authjs.session-token');
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    secureCookie: hasSecureCookie,
  });

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth|login|forgot-password|reset-password|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
  ],
};
