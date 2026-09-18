import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Exclude public assets, uploads, and large multipart upload endpoints
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/uploads") ||
    pathname.endsWith("/materials")
  ) {
    return NextResponse.next();
  }

  // 2. Check for session cookie or test headers
  const sessionCookie = request.cookies.get("auth_session")?.value;
  const testUserId = request.headers.get("x-user-id");
  const testUserEmail = request.headers.get("x-user-email");
  const isAuthenticated = Boolean(sessionCookie || testUserId || testUserEmail);

  // 3. Handle /login route
  if (pathname === "/login") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // 4. Protect UI pages: redirect unauthenticated users to /login
  if (!isAuthenticated && !pathname.startsWith("/api/")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Backwards compatibility export
export const middleware = proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and file upload endpoints
     */
    "/((?!_next/static|_next/image|favicon.ico|uploads|api/projects/.*/materials).*)",
  ],
};
