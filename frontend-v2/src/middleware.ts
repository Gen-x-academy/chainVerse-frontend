import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const PUBLIC_PATHS = new Set<string>([
  '/auth/login',
  '/auth/register',
  '/auth/reset-password',
])

// Routes that require both a session and a tenant context.
const TENANT_SCOPED_PREFIXES = ['/workspace'] as const

function isTenantScopedPath(pathname: string): boolean {
  return TENANT_SCOPED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

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

	// Deny-by-default: tenant-scoped routes additionally require a tenant context.
	// Role checks are intentionally NOT performed here; role-aware navigation is
	// enforced in the layout and service layer.
	if (isTenantScopedPath(pathname)) {
		const hasTenant = request.cookies.has('tenant')
		if (!hasSession || !hasTenant) {
			const url = request.nextUrl.clone()
			url.pathname = '/auth/login'
			url.search = ''
			url.searchParams.set('reason', 'tenant_required')
			url.searchParams.set('redirect', pathname)
			return NextResponse.redirect(url)
		}
		return NextResponse.next()
	}

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