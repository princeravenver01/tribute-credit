import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { getPortalForHostname, getPortalForPath, type PortalConfig, type PortalRole } from '@/config/portal-auth';
import { signJwtToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { clearLoginFailures, consumeLoginAttempt, recordLoginFailure } from '@/lib/login-rate-limit';

interface LoginUserRow {
  id: number;
  name: string;
  email: string;
  password: string;
  role: PortalRole;
  status: string;
}

interface LoginBody {
  email?: unknown;
  password?: unknown;
}

const DUMMY_PASSWORD_HASH = '$2b$10$CJH.HdSEHQdEhNJXEQQ5J.mxBeLzYLSi.MnIEcTfb4MK9ncGdRGUS';

function resolvePortal(req: Request): PortalConfig | null {
  const requestHostname = new URL(req.url).hostname;
  const hostHeader = req.headers.get('host')?.split(':')[0] ?? requestHostname;
  const byHostname = getPortalForHostname(hostHeader);
  if (byHostname) return byHostname;

  const isDevelopmentHost = ['localhost', '127.0.0.1'].includes(requestHostname)
    || requestHostname.endsWith('.local');
  if (!isDevelopmentHost) return null;

  const referer = req.headers.get('referer');
  if (!referer) return null;
  try {
    return getPortalForPath(new URL(referer).pathname);
  } catch {
    return null;
  }
}

function getRequestIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

async function recordAudit(
  userId: number | null,
  action: string,
  portal: PortalConfig | null,
  ipAddress: string,
) {
  try {
    await query(
      'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [userId, action, JSON.stringify({ portal: portal?.key ?? 'unknown' }), ipAddress],
    );
  } catch {
    // Authentication remains available if audit persistence is temporarily unavailable.
  }
}

function invalidCredentialsResponse() {
  return NextResponse.json(
    { error: 'The email or password is incorrect.', code: 'INVALID_CREDENTIALS' },
    { status: 401 },
  );
}

export async function POST(req: Request) {
  const portal = resolvePortal(req);
  if (!portal) {
    return NextResponse.json(
      { error: 'This account cannot access this portal.', code: 'WRONG_PORTAL' },
      { status: 403 },
    );
  }

  let body: LoginBody;
  try {
    body = await req.json() as LoginBody;
  } catch {
    return invalidCredentialsResponse();
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) return invalidCredentialsResponse();

  const ipAddress = getRequestIp(req);
  const limiterKey = email + '|' + ipAddress;
  const attempt = consumeLoginAttempt(limiterKey);
  if (!attempt.allowed) {
    return NextResponse.json(
      { error: 'We could not sign you in right now. Please try again.', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(attempt.retryAfterSeconds) } },
    );
  }

  let user: LoginUserRow | undefined;
  try {
    const users = await query<LoginUserRow[]>(
      'SELECT id, name, email, password, role, status FROM users WHERE email = ? LIMIT 1',
      [email],
    );
    user = users[0];
  } catch {
    await recordAudit(null, 'AUTH_LOGIN_SERVICE_FAILURE', portal, ipAddress);
    return NextResponse.json(
      { error: 'We could not sign you in right now. Please try again.', code: 'SERVICE_UNAVAILABLE' },
      { status: 503 },
    );
  }

  const passwordMatches = await bcrypt.compare(password, user?.password ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches || user.status !== 'active') {
    recordLoginFailure(limiterKey);
    await recordAudit(user?.id ?? null, 'AUTH_LOGIN_FAILURE', portal, ipAddress);
    return invalidCredentialsResponse();
  }

  if (user.role !== portal.expectedRole) {
    recordLoginFailure(limiterKey);
    await recordAudit(user.id, 'AUTH_LOGIN_WRONG_PORTAL', portal, ipAddress);
    return NextResponse.json(
      { error: 'This account cannot access this portal.', code: 'WRONG_PORTAL' },
      { status: 403 },
    );
  }

  const token = signJwtToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });
  clearLoginFailures(limiterKey);
  await recordAudit(user.id, 'AUTH_LOGIN_SUCCESS', portal, ipAddress);

  const response = NextResponse.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    token,
  });
  response.cookies.set('coop_auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
