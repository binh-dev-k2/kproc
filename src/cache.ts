/**
 * Smart caching system to reduce redundant system calls
 * @module cache
 */

import { log } from './logger';

/**
 * Cache entry structure with timestamp for TTL checking
 * @template T - Type of data being cached
 */
interface CacheEntry<T> {
    /** The cached data */
    data: T;
    /** Timestamp when this entry was created (ms since epoch) */
    timestamp: number;
}

/**
 * In-memory cache storage
 * Key format examples:
 * - "port:3000" - PIDs on port 3000
 * - "name:node:false" - PIDs matching "node" (non-regex)
 */
const cache = new Map<string, CacheEntry<any>>();

/**
 * Default cache time-to-live: 1 second
 * Process lists change infrequently, so short TTL is safe
 */
const DEFAULT_CACHE_TTL_MS = 1000;

/**
 * Get cached data or fetch fresh data if cache miss/expired
 * 
 * This function implements a cache-aside pattern:
 * 1. Check if data exists in cache and is still valid (not expired)
 * 2. If yes, return cached data (fast path)
 * 3. If no, call fetcher function to get fresh data
 * 4. Store fresh data in cache with current timestamp
 * 5. Return fresh data
 * 
 * @template T - Type of data being cached
 * @param key - Unique cache key for this data
 * @param fetcher - Async function that fetches the data if cache miss
 * @param ttlMs - Time-to-live in milliseconds (default: 1000ms)
 * @returns The cached or freshly fetched data
 * 
 * @example
 * ```typescript
 * // First call - cache miss, calls fetcher
 * const pids1 = await getCached('port:3000', () => findPidsByPortImpl(3000));
 * 
 * // Second call within 1 second - cache hit, instant return
 * const pids2 = await getCached('port:3000', () => findPidsByPortImpl(3000));
 * 
 * // Custom TTL (5 seconds)
 * const pids3 = await getCached('port:3000', fetcher, 5000);
 * ```
 */
export const getCached = async <T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = DEFAULT_CACHE_TTL_MS
): Promise<T> => {
    const now = Date.now();
    const cached = cache.get(key);

    // Cache hit: entry exists and hasn't expired
    if (cached && (now - cached.timestamp) < ttlMs) {
        log.debug(`Cache hit for key: ${key}`);
        return cached.data as T;
    }

    // Cache miss: fetch fresh data
    log.debug(`Cache miss for key: ${key}, fetching...`);
    const data = await fetcher();

    // Store in cache with current timestamp
    cache.set(key, { data, timestamp: now });

    return data;
};

/**
 * Manually clear the entire cache
 * 
 * Use this when you need to force fresh lookups, for example:
 * - After killing processes, to ensure next lookup is fresh
 * - In testing scenarios
 * - When you know process state has changed
 * 
 * @example
 * ```typescript
 * import { clearCache, findPidsByPort } from 'kproc';
 * 
 * // Get PIDs (may be cached)
 * const pids = await findPidsByPort(3000);
 * 
 * // Clear cache to force fresh lookup
 * clearCache();
 * 
 * // This will definitely be fresh
 * const freshPids = await findPidsByPort(3000);
 * ```
 */
export const clearCache = (): void => {
    const size = cache.size;
    log.debug(`Clearing cache (${size} entries)`);
    cache.clear();
};

/**
 * Get current cache statistics for monitoring/debugging
 * 
 * @returns Object with cache statistics
 * 
 * @example
 * ```typescript
 * const stats = getCacheStats();
 * console.log(`Cache has ${stats.size} entries`);
 * console.log(`Oldest entry: ${stats.oldestAge}ms ago`);
 * ```
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
 * 
 * @param key - Cache key to invalidate
 * @returns True if entry was found and removed
 * 
 * @example
 * ```typescript
 * // Invalidate specific port cache after killing process
 * await killByPort(3000);
 * invalidateCache('port:3000');
 * ```
 */
export const invalidateCache = (key: string): boolean => {
    const deleted = cache.delete(key);
    if (deleted) {
        log.debug(`Invalidated cache key: ${key}`);
    }
    return deleted;
};

