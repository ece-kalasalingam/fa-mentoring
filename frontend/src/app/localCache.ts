export type BrowserCacheEnvelope<T> = {
  cachedAt: number;
  payload: T;
  sessionKey: string;
};

export function getLocalScopedCacheStorageKey(prefix: string, key: string, sessionKey: string): string {
  return `${prefix}:${sessionKey}:${key}`;
}

export function readLocalScopedCache<T>(prefix: string, key: string, sessionKey: string, ttlMs: number): T | null {
  try {
    const storageKey = getLocalScopedCacheStorageKey(prefix, key, sessionKey);
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BrowserCacheEnvelope<T>;
    if (!parsed || typeof parsed.cachedAt !== "number" || parsed.sessionKey !== sessionKey) return null;
    if (Date.now() - parsed.cachedAt > ttlMs) return null;
    return parsed.payload;
  } catch {
    return null;
  }
}

export function writeLocalScopedCache<T>(prefix: string, key: string, sessionKey: string, payload: T): void {
  try {
    const storageKey = getLocalScopedCacheStorageKey(prefix, key, sessionKey);
    const envelope: BrowserCacheEnvelope<T> = {
      cachedAt: Date.now(),
      payload,
      sessionKey,
    };
    localStorage.setItem(storageKey, JSON.stringify(envelope));
  } catch {
    // Best-effort cache write; ignore storage quota or availability errors.
  }
}

export function removeLocalScopedCache(prefix: string, key: string, sessionKey: string): void {
  try {
    localStorage.removeItem(getLocalScopedCacheStorageKey(prefix, key, sessionKey));
  } catch {
    // Ignore localStorage unavailability.
  }
}
