import { createClient, RedisClientType } from 'redis';
import { NextFunction, Request, Response } from 'express';
import { getConfig } from './config';

let redisClient: RedisClientType | undefined;
let redisConnectPromise: Promise<void> | undefined;
const localBuckets = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of localBuckets.entries()) {
    if (bucket.resetAt <= now) {
      localBuckets.delete(key);
    }
  }
}, 60000).unref();

async function getRedis(): Promise<RedisClientType | undefined> {
  const { redisUrl } = getConfig();
  if (!redisUrl) return undefined;
  if (!redisClient) {
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (error) => console.error('[Redis]', error.message));
    redisConnectPromise = redisClient.connect().then(() => undefined).catch((error) => {
      console.error('[Redis] Connection failed; using local limiter:', error.message);
      redisClient = undefined;
    });
  }
  await redisConnectPromise;
  return redisClient?.isReady ? redisClient : undefined;
}

export async function getRedisClient(): Promise<RedisClientType | undefined> {
  return getRedis();
}

export async function connectRedis(): Promise<void> {
  await getRedis();
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient?.isOpen) await redisClient.quit();
  redisClient = undefined;
  redisConnectPromise = undefined;
}

export function rateLimit(name: string, limit: number, windowSeconds: number) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const identity = req.ip ?? 'unknown';
    const key = `rate-limit:${name}:${identity}`;
    try {
      const redis = await getRedis();
      if (redis) {
        const count = await redis.incr(key);
        if (count === 1) await redis.expire(key, windowSeconds);
        if (count > limit) {
          res.status(429).json({ error: 'Too many requests', retryAfterSeconds: windowSeconds });
          return;
        }
      } else {
        const now = Date.now();
        const bucket = localBuckets.get(key);
        if (!bucket || bucket.resetAt <= now) localBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
        else bucket.count += 1;
        const current = localBuckets.get(key)!;
        if (current.count > limit) {
          res.status(429).json({ error: 'Too many requests', retryAfterSeconds: windowSeconds });
          return;
        }
      }
      next();
    } catch (error) {
      console.error('[Rate Limit]', error instanceof Error ? error.message : 'unknown error');
      if (getConfig().nodeEnv === 'production') {
        res.status(503).json({ error: 'Rate limiting service unavailable' });
        return;
      }
      next();
    }
  };
}
