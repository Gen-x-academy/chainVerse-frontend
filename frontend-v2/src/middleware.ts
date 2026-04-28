import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const PUBLIC_PATHS = new Set<string>([
  '/auth/login',
  '/auth/register',
  '/auth/reset-password',
])

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl

	if (pathname.startsWith('/_next') || pathname.startsWith('/assets')) {
		return NextResponse.next()
	}

	// Allow all /auth/* routes through without a session check
	if (pathname.startsWith('/auth/') || PUBLIC_PATHS.has(pathname)) {
		return NextResponse.next()
	}

	// Strategy (a): server sets an HttpOnly 'session' cookie on login.
	// Middleware reads it here — never touches localStorage.
	const hasSession = request.cookies.has('session')
	if (!hasSession) {
		const url = request.nextUrl.clone()
		url.pathname = '/auth/login'
		url.searchParams.set('redirect', pathname)
		return NextResponse.redirect(url)
	}

	return NextResponse.next()
}

export const config = {
	matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
