/**
 * Type definitions for kproc
 * @module types
 */

/**
 * Standard Unix signals or custom numbers
 */
export type UnixSignal =
    | 'SIGTERM'
    | 'SIGKILL'
    | 'SIGINT'
    | 'SIGHUP'
    | 'SIGQUIT'
    | 'SIGUSR1'
    | 'SIGUSR2'
    | 'SIGCONT'
    | 'SIGSTOP'
    | (string & {})
    | number;

/**
 * Options for configuring process kill operations
 */
export interface KillOptions {
    /**
     * Signal to send on Unix systems (ignored on Windows)
     * @default "SIGTERM"
     */
    signal?: UnixSignal;

    /**
     * If true, simulate kill without actually terminating the process
     * @default false
     */
    dryRun?: boolean;

    /**
     * Kill the entire process tree (parent and all descendant children)
     * @default false
     */
    tree?: boolean;

    /**
     * Maximum time in milliseconds to wait for the operation
     */
    timeoutMs?: number;

    /**
     * Auto-escalate from SIGTERM to SIGKILL if process remains alive
     * @default false
     */
    forceAfterTimeout?: boolean;

    /**
     * Milliseconds to wait before escalating to SIGKILL
     * @default 3000
     */
    escalationDelayMs?: number;

    /**
     * Verify the process is dead after kill attempt
     * @default false
     */
    verify?: boolean;

    /**
     * Maximum retry attempts if kill fails
     * @default 0
     */
    retries?: number;

    /**
     * Enable debug logging for this operation
     * @default false
     */
    debug?: boolean;

    /**
     * Safety guard: Allow killing the current Node.js process (process.pid).
     * If false and target PID is process.pid, an InvalidInputError is thrown.
     * @default false
     */
    allowCurrentProcess?: boolean;

    /**
     * Force kill, bypassing checks on critical system PIDs (0, 4 on Windows, 1 on Unix)
     * @default false
     */
    force?: boolean;
}

/**
 * Result of a kill operation with detailed execution metrics
 */
export interface KillResult {
    /** Process ID that was targeted */
    pid: number;

    /** Whether the process was successfully terminated or was already dead */
    success: boolean;

    /** Signal that was delivered */
    signal?: string | number;

    /** Error message if the operation failed */
    error?: string;

    /** True if process non-existence was confirmed via verification */
    verified?: boolean;
}

/**
 * Options for finding processes by name or pattern
 */
export interface FindByNameOptions {
    /**
     * Treat the pattern as a regular expression
     * @default false
     */
    useRegex?: boolean;

    /**
     * Maximum time in milliseconds for the lookup command
     */
    timeoutMs?: number;
}

/**
 * Options for port lookup queries
 */
export interface PortLookupOptions {
    /**
     * Timeout for the lookup command in milliseconds
     */
    timeoutMs?: number;

    /**
     * Socket state to match
     * @default "LISTENING"
     */
    state?: 'LISTENING' | 'ALL';

    /**
     * Protocol to filter
     * @default "all"
     */
    protocol?: 'tcp' | 'udp' | 'all';
}

/**
 * Detailed information about a process
 */
export interface ProcessInfo {
    /** Process ID */
    pid: number;

    /** Process name (executable name) */
    name?: string;

    /** Full command line with arguments */
    command?: string;

    /** List of ports this process is listening on or bound to */
    ports?: number[];

    /** Parent process ID */
    parentPid?: number;

    /** CPU usage percentage string (e.g. "2.5%") */
    cpuUsage?: string;

    /** Memory usage formatted string (e.g. "128 MB") */
    memoryUsage?: string;
}
