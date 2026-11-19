export interface LoginRateLimitOptions {
  maxFailures: number;
  windowMs: number;
  maxKeys: number;
}

export interface LoginAttemptResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface FailureEntry {
  count: number;
  firstFailureAt: number;
}

export interface LoginRateLimiter {
  consume(key: string, now?: number): LoginAttemptResult;
  recordFailure(key: string, now?: number): void;
  clear(key: string): void;
  readonly size: number;
}

export function createLoginRateLimiter(options: LoginRateLimitOptions): LoginRateLimiter {
  const entries = new Map<string, FailureEntry>();

  function prune(now: number) {
    for (const [key, entry] of entries) {
      if (now - entry.firstFailureAt >= options.windowMs) entries.delete(key);
    }
  }

  function removeOldestWhenFull() {
    if (entries.size < options.maxKeys) return;
    const oldestKey = entries.keys().next().value as string | undefined;
    if (oldestKey) entries.delete(oldestKey);
  }

  return {
    consume(key, now = Date.now()) {
      prune(now);
      const entry = entries.get(key);
      if (!entry || entry.count < options.maxFailures) {
        return { allowed: true, retryAfterSeconds: 0 };
      }
      const remainingMs = Math.max(0, options.windowMs - (now - entry.firstFailureAt));
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)) };
    },
    recordFailure(key, now = Date.now()) {
      prune(now);
      const entry = entries.get(key);
      if (entry) {
        entry.count += 1;
        return;
      }
      removeOldestWhenFull();
      entries.set(key, { count: 1, firstFailureAt: now });
    },
    clear(key) {
      entries.delete(key);
    },
    get size() {
      return entries.size;
    },
  };
}

const defaultLimiter = createLoginRateLimiter({
  maxFailures: 5,
  windowMs: 15 * 60 * 1000,
  maxKeys: 5000,
});

export function consumeLoginAttempt(key: string, now?: number): LoginAttemptResult {
  return defaultLimiter.consume(key, now);
}

export function recordLoginFailure(key: string, now?: number): void {
  defaultLimiter.recordFailure(key, now);
}

export function clearLoginFailures(key: string): void {
  defaultLimiter.clear(key);
}
