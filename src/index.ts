/**
 * kproc - Advanced Process Management Utility
 * 
 * A lightweight, cross-platform Node.js utility for killing processes by PID or port.
 * 
 * Features:
 * - Cross-platform support (Windows, Linux, macOS)
 * - Kill by PID, port, port range, or process name
 * - Process tree killing (kill parent and all children)
 * - Retry mechanism with configurable attempts
 * - Signal escalation (SIGTERM → SIGKILL on Unix)
 * - Process verification (confirm process is dead)
 * - Smart caching to reduce system calls
 * - Detailed operation results
 * - Debug logging support
 * 
 * @module kproc
 * @version 2.0.0
 * 
 * @example
 * ```typescript
 * import { killByPort, setDebug } from 'kproc';
 * 
 * // Enable debug logging
 * setDebug(true);
 * 
 * // Kill process on port 3000 with verification
 * const result = await killByPort(3000, {
 *   tree: true,
 *   verify: true,
 *   retries: 3
 * });
 * 
 * if (result.success) {
 *   console.log('Port 3000 is now free!');
 * }
 * ```
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
    FindByNameOptions, KillOptions,
    KillResult, ProcessInfo, UnixSignal
} from './types';

// ============================================================================
// Error Class Exports
// ============================================================================

export {
    CommandExecutionError, InvalidInputError, ProcessNotFoundError, TimeoutError
} from './errors';

// ============================================================================
// Utility Exports
// ============================================================================

export {
    /** Enable or disable debug logging globally */
    setDebug
} from './logger';

export {
    /** Manually clear the process list cache */
    clearCache,
    /** Get cache statistics for monitoring */
    getCacheStats,
    /** Invalidate a specific cache entry */
    invalidateCache
} from './cache';

export {
    /** Check if a process is alive without killing it */
    isProcessAlive
} from './utils';

// ============================================================================
// Lookup Function Exports
// ============================================================================

export {

    /**
     * Find the main PID bound to a specific port
     * @param port - Port number
     * @param timeoutMs - Optional timeout
     * @returns The first PID found
     * @throws ProcessNotFoundError if no process found
     */
    findPidByPort,

    /**
     * Find PIDs by process name or command pattern
     * @param nameOrPattern - Name or pattern to match
     * @param opts - Options: { useRegex?: boolean }
     * @param timeoutMs - Optional timeout
     * @returns Array of matching PIDs
     */
    findPidsByName,
    /**
     * Find all PIDs bound to a specific port
     * @param port - Port number (1-65535)
     * @param timeoutMs - Optional timeout
     * @returns Array of PIDs
     */
    findPidsByPort,
    /**
     * Reverse lookup: find all ports used by a PID
     * @param pid - Process ID
     * @param timeoutMs - Optional timeout
     * @returns Array of port numbers
     */
    findPortsByPid,

    /**
     * Get comprehensive information about a process
     * @param pid - Process ID
     * @param timeoutMs - Optional timeout
     * @returns ProcessInfo with all available details
     */
    getProcessInfo
} from './lookup';

// ============================================================================
// Kill Function Exports
// ============================================================================

export {

    /**
     * Kill processes by name or command pattern
     * @param nameOrPattern - Pattern to match
     * @param opts - Combined FindByNameOptions & KillOptions
     * @returns Array of KillResult
     */
    killByName,
    /**
     * Kill a process by its PID with advanced options
     * @param pid - Process ID to kill
     * @param options - Kill options
     * @returns KillResult with operation details
     */
    killByPid,

    /**
     * Kill multiple processes by PIDs in parallel
     * @param pids - Array of process IDs
     * @param options - Kill options
     * @returns Array of KillResult
     */
    killByPids,

    /**
     * Kill the main process bound to a port
     * @param port - Port number
     * @param options - Kill options
     * @returns KillResult
     */
    killByPort,
    /**
     * Kill all processes bound to ports in a range
     * @param start - Starting port (inclusive)
     * @param end - Ending port (inclusive)
     * @param options - Kill options
     * @returns Array of KillResult
     */
    killByPortRange,
    /**
     * Kill all processes bound to multiple ports
     * @param ports - Array of port numbers
     * @param options - Kill options
     * @returns Array of KillResult
     */
    killByPorts
} from './kill';

// ============================================================================
// Default Export (for CommonJS compatibility)
// ============================================================================

import * as cache from './cache';
import * as kproc from './kill';
import * as logger from './logger';
import * as lookup from './lookup';
import * as utils from './utils';

export default {
    ...kproc,
    ...lookup,
    ...utils,
    ...cache,
    ...logger,
};
