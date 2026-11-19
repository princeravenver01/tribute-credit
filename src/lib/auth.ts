import jwt from 'jsonwebtoken';
import type { PortalRole } from '@/config/portal-auth';

interface JwtEnvironment {
  NODE_ENV?: string;
  JWT_SECRET?: string;
}

export interface TokenPayload {
  userId: number;
  email: string;
  role: PortalRole;
  name: string;
}

export function getJwtSecret(environment: JwtEnvironment = process.env): string {
  const secret = environment.JWT_SECRET?.trim();
  if (!secret) throw new Error('JWT_SECRET is required.');
  if (environment.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters in production.');
  }
  return secret;
}

export function signJwtToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyJwtToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as TokenPayload;
  } catch {
    return null;
  }
}
