import { cookies } from 'next/headers';
import { verifyJwtToken, type TokenPayload } from '@/lib/auth';
import type { PortalRole } from '@/config/portal-auth';

export type ApiAuthorizationResult =
  | { ok: true; session: TokenPayload }
  | { ok: false; status: 401 | 403; error: string };

export async function getSessionFromCookies(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('coop_auth_token')?.value;
  return token ? verifyJwtToken(token) : null;
}

export async function requireApiRole(...allowedRoles: PortalRole[]): Promise<ApiAuthorizationResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get('coop_auth_token')?.value;

  if (!token) return { ok: false, status: 401, error: 'Authentication required.' };

  const session = verifyJwtToken(token);
  if (!session) return { ok: false, status: 401, error: 'Authentication required.' };
  if (!allowedRoles.includes(session.role)) {
    return { ok: false, status: 403, error: 'You do not have access to this resource.' };
  }

  return { ok: true, session };
}
