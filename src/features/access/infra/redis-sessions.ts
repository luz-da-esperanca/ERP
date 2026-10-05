import { randomUUID, createHash } from 'node:crypto';
import { createClient } from 'redis';
import type { ApiConfig } from '../../../core/infra/config.js';
import { DependencyUnavailableError } from '../../../core/application/errors.js';
import { LoginBlockedError } from '../application/access-errors.js';
import type { SessionsStore, StoredSession } from '../application/ports.js';
import { z } from 'zod';

export function createRedis(url: string) {
  return createClient({
    url,
    socket: { connectTimeout: 3000, reconnectStrategy: false },
    disableOfflineQueue: true,
  });
}
export type RedisConnection = ReturnType<typeof createRedis>;
const storedSessionSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  authVersion: z.number().int().positive(),
  createdAt: z.number(),
  absoluteExpiresAt: z.number(),
  lastActivityAt: z.number(),
});
const readSessionScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then return false end
local session = cjson.decode(raw)
local now = tonumber(ARGV[1])
local idle = tonumber(ARGV[2])
if now >= session.absoluteExpiresAt or now - session.lastActivityAt >= idle then
  redis.call('DEL', KEYS[1]); return false
end
if ARGV[3] == '1' then
  session.lastActivityAt = now
  raw = cjson.encode(session)
  redis.call('SET', KEYS[1], raw, 'PX', math.min(idle, session.absoluteExpiresAt - now))
end
return raw`;
const incrementScript = `
local value = redis.call('INCR', KEYS[1])
if value == 1 or value == tonumber(ARGV[2]) then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return {value, redis.call('TTL', KEYS[1])}`;
const failureStatusScript = `return {tonumber(redis.call('GET', KEYS[1]) or '0'), redis.call('TTL', KEYS[1])}`;

export class RedisSessions implements SessionsStore {
  constructor(
    private readonly redis: RedisConnection,
    private readonly config: ApiConfig,
  ) {}
  private key(type: string, value: string) {
    return `${this.config.REDIS_KEY_PREFIX}${type}:${value}`;
  }
  private loginKey(login: string) {
    return this.key('login', createHash('sha256').update(login).digest('hex'));
  }
  private async available<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof LoginBlockedError) throw error;
      throw new DependencyUnavailableError();
    }
  }
  async assertAvailable() {
    await this.available(() => this.redis.ping());
  }
  async create(userId: string, authVersion: number) {
    const now = Date.now();
    const session: StoredSession = {
      id: randomUUID(),
      userId,
      authVersion,
      createdAt: now,
      absoluteExpiresAt: now + this.config.SESSION_MAX_SECONDS * 1000,
      lastActivityAt: now,
    };
    await this.available(() =>
      this.redis.set(this.key('session', session.id), JSON.stringify(session), {
        PX: this.config.SESSION_IDLE_SECONDS * 1000,
      }),
    );
    return session;
  }
  async read(id: string, touch: boolean) {
    return this.available(async () => {
      const raw = await this.redis.eval(readSessionScript, {
        keys: [this.key('session', id)],
        arguments: [
          String(Date.now()),
          String(this.config.SESSION_IDLE_SECONDS * 1000),
          touch ? '1' : '0',
        ],
      });
      if (!raw) return null;
      return storedSessionSchema.parse(JSON.parse(String(raw)));
    });
  }
  async delete(id: string) {
    await this.available(() => this.redis.del(this.key('session', id)));
  }
  async checkLogin(login: string, ip: string) {
    await this.available(async () => {
      const ipKey = this.key(
        'login-ip',
        createHash('sha256').update(ip).digest('hex'),
      );
      const ipResult = await this.redis.eval(incrementScript, {
        keys: [ipKey],
        arguments: [String(this.config.LOGIN_IP_WINDOW_SECONDS)],
      });
      const [count, ttl] = z.tuple([z.number(), z.number()]).parse(ipResult);
      if (count > this.config.LOGIN_IP_MAX_ATTEMPTS)
        throw new LoginBlockedError(Math.max(1, ttl));
      const result = await this.redis.eval(failureStatusScript, {
        keys: [this.loginKey(login)],
        arguments: [],
      });
      const [failures, remaining] = z
        .tuple([z.number(), z.number()])
        .parse(result);
      if (failures >= this.config.LOGIN_MAX_FAILURES)
        throw new LoginBlockedError(Math.max(1, remaining));
    });
  }
  async recordLoginFailure(login: string) {
    await this.available(() =>
      this.redis.eval(incrementScript, {
        keys: [this.loginKey(login)],
        arguments: [
          String(this.config.LOGIN_BLOCK_SECONDS),
          String(this.config.LOGIN_MAX_FAILURES),
        ],
      }),
    );
  }
  async clearLoginFailures(login: string) {
    await this.available(() => this.redis.del(this.loginKey(login)));
  }
}
