/**
 * kproc - Production-Grade Process Management Utility
 *
 * Advanced, cross-platform Node.js utility for discovering and terminating processes by PID, port, or pattern.
 *
 * Features:
 * - Cross-platform support (Windows, Linux, macOS)
 * - Kill by PID, port, port range, or process name
 * - Process tree termination (parent and all descendants)
 * - Safe protection against accidental self-kill and system PID termination
 * - Microsecond process existence checks via native syscalls
 * - Retry mechanisms with automatic Unix signal escalation (SIGTERM → SIGKILL)
 * - Process verification to confirm death
 * - Smart TTL caching to minimize kernel query overhead
 * - Zero runtime dependencies
 *
 * @module kproc
 * @version 2.0.0
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
    FindByNameOptions,
    KillOptions,
    KillResult,
    PortLookupOptions,
    ProcessInfo,
    UnixSignal,
} from './types';

export type { LogSink } from './logger';

// ============================================================================
// Error Class Exports
// ============================================================================

export {
    CommandExecutionError,
    InvalidInputError,
    KProcError,
    ProcessNotFoundError,
    TimeoutError,
} from './errors';

// ============================================================================
// Logging & Diagnostics Exports
// ============================================================================

export {
    isDebugEnabled,
    setDebug,
    setLogSink,
} from './logger';

// ============================================================================
// Cache Management Exports
// ============================================================================

export {
    clearCache,
    getCacheStats,
    invalidateCache,
} from './cache';

// ============================================================================
// Process Tree Exports
// ============================================================================

export {
    findChildPidsOnce,
    findDescendantPids,
} from './core';

// ============================================================================
// Utility Exports
// ============================================================================

export {
    isProcessAlive,
    parsePortFromAddress,
    sleep,
} from './utils';

// ============================================================================
// Lookup Function Exports
// ============================================================================

export {
    findPidByPort,
    findPidsByName,
    findPidsByPort,
    findPortsByPid,
    getProcessInfo,
} from './lookup';

// ============================================================================
// Kill Function Exports
// ============================================================================

export {
    killByName,
    killByPid,
    killByPids,
    killByPort,
    killByPortRange,
    killByPorts,
} from './kill';

// ============================================================================
// Default Export (Convenient Namespace)
// ============================================================================

import * as cache from './cache';
import * as core from './core';
import * as kill from './kill';
import * as logger from './logger';
import * as lookup from './lookup';
import * as utils from './utils';

export default {
    ...kill,
    ...lookup,
    ...core,
    ...utils,
    ...cache,
    ...logger,
};
