import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getConfig } from './config';

const PASSWORD_MIN_LENGTH = 12;

export function assertPasswordPolicy(password: unknown): asserts password is string {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH || password.length > 128) {
    throw new Error(`Password must be between ${PASSWORD_MIN_LENGTH} and 128 characters`);
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordPolicy(password);
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash.startsWith('$2')) return false;
  return bcrypt.compare(password, storedHash);
}

export type TokenPayload = { sub: string; role: string; iat: number; exp: number; iss: string; jti: string };

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function createAccessToken(user: { id: string; role: string }): string {
  const config = getConfig();
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ sub: user.id, role: user.role, iat: now, exp: now + 900, iss: config.jwtIssuer, jti: crypto.randomUUID() });
  const signature = crypto.createHmac('sha256', config.jwtSecret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function verifyAccessToken(token: string): TokenPayload {
  const config = getConfig();
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [header, payload, signature] = parts;
  let decoded: TokenPayload;
  try {
    const parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as { alg?: string; typ?: string };
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenPayload;
    if (parsedHeader.alg !== 'HS256' || parsedHeader.typ !== 'JWT') throw new Error('Invalid token header');
  } catch {
    throw new Error('Invalid token');
  }

  const expected = crypto.createHmac('sha256', config.jwtSecret).update(`${header}.${payload}`).digest('base64url');
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    throw new Error('Invalid token signature');
  }
  if (decoded.iss !== config.jwtIssuer || !decoded.sub || !decoded.role || !decoded.jti || !Number.isInteger(decoded.exp) || decoded.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Expired or invalid token');
  }
  return decoded;
}
