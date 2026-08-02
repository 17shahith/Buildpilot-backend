import crypto from 'node:crypto';
import { getConfig } from './config';
import { getRedisClient } from './rateLimit';

const localRevoked = new Map<string, number>();

function key(token: string): string {
  return `revoked-token:${crypto.createHash('sha256').update(token).digest('hex')}`;
}

export async function revokeToken(token: string, expiresAt: number): Promise<void> {
  const ttl = Math.max(1, expiresAt - Math.floor(Date.now() / 1000));
  const redis = await getRedisClient();
  if (redis) {
    await redis.setEx(key(token), ttl, '1');
    return;
  }
  if (getConfig().nodeEnv === 'production') throw new Error('Token revocation service unavailable');
  localRevoked.set(key(token), Date.now() + ttl * 1000);
}

export async function isTokenRevoked(token: string): Promise<boolean> {
  const redis = await getRedisClient();
  if (redis) return (await redis.exists(key(token))) === 1;
  if (getConfig().nodeEnv === 'production') throw new Error('Token revocation service unavailable');
  const expiresAt = localRevoked.get(key(token));
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) { localRevoked.delete(key(token)); return false; }
  return true;
}

