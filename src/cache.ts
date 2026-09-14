/**
 * Smart caching system to reduce redundant system queries
 * @module cache
 */

import { log } from './logger';

/**
 * Cache entry structure with timestamp for TTL checking
 */
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

const DEFAULT_CACHE_TTL_MS = 1000;

/**
 * Get cached data or fetch fresh data if expired or missing
 */
export const getCached = async <T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = DEFAULT_CACHE_TTL_MS
): Promise<T> => {
    const now = Date.now();
    const cached = cache.get(key) as CacheEntry<T> | undefined;

    if (cached && (now - cached.timestamp) < ttlMs) {
        log.debug(`Cache hit for key: ${key}`);
        return cached.data;
    }

    log.debug(`Cache miss for key: ${key}, fetching fresh data...`);
    const data = await fetcher();
    cache.set(key, { data, timestamp: now });
    return data;
};

/**
 * Manually clear the entire cache
 */
export const clearCache = (): void => {
    const size = cache.size;
    log.debug(`Clearing cache (${size} entries)`);
    cache.clear();
};

/**
 * Get current cache statistics
 */
export const getCacheStats = (): { size: number; oldestAge: number | null } => {
    const now = Date.now();
    let oldestAge: number | null = null;

    for (const entry of cache.values()) {
        const age = now - entry.timestamp;
        if (oldestAge === null || age > oldestAge) {
            oldestAge = age;
        }
    }

    return {
        size: cache.size,
        oldestAge,
    };
};

/**
 * Remove a specific cache entry by key
 */
export const invalidateCache = (key: string): boolean => {
    const deleted = cache.delete(key);
    if (deleted) {
        log.debug(`Invalidated cache key: ${key}`);
    }
    return deleted;
};
