import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Add paths that don't require authentication
const publicPaths = [
  '/login',
  '/register',
  '/instructor-register',
  '/',
  '/courses',
  '/instructors',
  '/about'
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Check if the path is public
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Get the token from the cookies
  const token = request.cookies.get('auth-storage')?.value

  // If there's no token and the path is not public, redirect to login
  if (!token) {
    const url = new URL('/login', request.url)
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
} 