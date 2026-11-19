import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getPortalForHostname,
  getPortalForPath,
  roleCanAccessPortal,
  type PortalConfig,
} from '@/config/portal-auth';
import { verifyJwtToken } from '@/lib/auth';

function redirectTo(request: NextRequest, pathname: string, clearSession = false): NextResponse {
  const response = NextResponse.redirect(new URL(pathname, request.url));

  if (clearSession) {
    response.cookies.set('coop_auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(0),
      path: '/',
    });
  }

  return response;
}

function continueRequest(clearSession = false): NextResponse {
  const response = NextResponse.next();

  if (clearSession) {
    response.cookies.set('coop_auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(0),
      path: '/',
    });
  }

  return response;
}

function isPublicPortalPath(pathname: string, portal: PortalConfig): boolean {
  return pathname === portal.loginPath || (portal.key === 'borrower' && pathname === '/borrower/apply');
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // API handlers perform authoritative authorization and database checks.
  if (pathname.startsWith('/api/')) return NextResponse.next();

  const forwardedHost = request.headers.get('x-forwarded-host');
  const requestHost = forwardedHost ?? request.headers.get('host') ?? request.nextUrl.hostname;
  const hostnamePortal = getPortalForHostname(requestHost);
  const isProductionPortalHost = hostnamePortal !== null;
  const requestedPortal = getPortalForPath(pathname);
  const portal = hostnamePortal ?? requestedPortal;

  if (!portal) return NextResponse.next();

  const token = request.cookies.get('coop_auth_token')?.value;
  const session = token ? verifyJwtToken(token) : null;
  const hasValidPortalSession = session !== null && roleCanAccessPortal(session.role, portal);
  const shouldClearSession = Boolean(token && !hasValidPortalSession);

  if (isProductionPortalHost && pathname === '/') {
    return redirectTo(
      request,
      hasValidPortalSession ? portal.dashboardPath : portal.loginPath,
      shouldClearSession,
    );
  }

  // A production role hostname never serves pages belonging to another portal.
  if (isProductionPortalHost && requestedPortal && requestedPortal.key !== portal.key) {
    return redirectTo(
      request,
      hasValidPortalSession ? portal.dashboardPath : portal.loginPath,
      shouldClearSession,
    );
  }

  // Unknown paths on a role hostname return users to that portal rather than
  // exposing a shared or cross-role surface.
  if (isProductionPortalHost && !requestedPortal) {
    return redirectTo(
      request,
      hasValidPortalSession ? portal.dashboardPath : portal.loginPath,
      shouldClearSession,
    );
  }

  // Disbursement is part of the administrative portal and has no public login.
  if (isProductionPortalHost && pathname === '/disbursement/login') {
    return redirectTo(request, portal.loginPath, shouldClearSession);
  }

  if (isPublicPortalPath(pathname, portal)) {
    if (pathname === portal.loginPath && hasValidPortalSession) {
      return redirectTo(request, portal.dashboardPath);
    }
    return continueRequest(shouldClearSession);
  }

  if (!token || !hasValidPortalSession) {
    return redirectTo(request, portal.loginPath, shouldClearSession);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
