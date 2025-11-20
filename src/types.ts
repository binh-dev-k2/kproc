/**
 * Type definitions for kproc
 * @module types
 */

/**
 * Unix signals that can be sent to processes
 * @typedef {string | number} UnixSignal
 */
export type UnixSignal =
    | "SIGTERM"  // Graceful termination (default)
    | "SIGKILL"  // Force kill
    | "SIGINT"   // Interrupt (Ctrl+C)
    | "SIGHUP"   // Hangup
    | "SIGQUIT"  // Quit
    | number;    // Custom signal number

/**
 * Options for killing processes
 * @interface KillOptions
 */
export interface KillOptions {
    /**
     * Signal to send on Unix systems (ignored on Windows)
     * @default "SIGTERM"
     */
    signal?: UnixSignal;

    /**
     * If true, simulate kill without actually killing
     * Useful for testing and dry runs
     * @default false
     */
    dryRun?: boolean;

    /**
     * Kill the entire process tree (parent and all children)
     * - Windows: Uses taskkill /T
     * - Unix: Recursively finds and kills child PIDs
     * @default false
     */
    tree?: boolean;

    /**
     * Maximum time (ms) to wait for a single kill command
     * Operation fails if timeout is exceeded
     */
    timeoutMs?: number;

    /**
     * Auto-escalate from SIGTERM to SIGKILL if process doesn't die
     * Only applies on Unix systems
     * @default false
     */
    forceAfterTimeout?: boolean;

    /**
     * Time (ms) to wait before escalating to SIGKILL
     * @default 3000
     */
    escalationDelayMs?: number;

    /**
     * Verify the process is actually dead after kill attempt
     * Adds small delay to check process status
     * @default false
     */
    verify?: boolean;

    /**
     * Maximum retry attempts if kill fails
     * @default 0 (no retry)
     */
    retries?: number;

    /**
     * Enable debug logging for this specific operation
     * Overrides global debug setting
     * @default false
     */
    debug?: boolean;
}

/**
 * Result of a kill operation with detailed information
 * @interface KillResult
 */
export interface KillResult {
    /** Process ID that was targeted */
    pid: number;

    /** Whether the kill operation succeeded */
    success: boolean;

    /** Signal that was used (if successful) */
    signal?: string | number;

    /** Error message if operation failed */
    error?: string;

    /** Whether process death was verified (if verify option was true) */
    verified?: boolean;
}

/**
 * Options for finding processes by name or pattern
 * @interface FindByNameOptions
 */
export interface FindByNameOptions {
    /**
     * Treat the pattern as a regular expression
     * If false, performs case-insensitive substring match
     * @default false
     */
    useRegex?: boolean;
}

/**
 * Detailed information about a process
 * @interface ProcessInfo
 */
export interface ProcessInfo {
    /** Process ID */
    pid: number;

    /** Process name (executable name) */
    name?: string;

    /** Full command line with arguments */
    command?: string;

    /** List of ports this process is listening on or connected to */
    ports?: number[];

    /** Parent process ID */
    parentPid?: number;

    /** CPU usage (Unix only, format: "2.5%") */
    cpuUsage?: string;

    /** Memory usage (format varies by OS: "128 MB" or "1.5%") */
    memoryUsage?: string;
}

