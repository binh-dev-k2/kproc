/**
 * Utility functions for process management
 * @module utils
 */

import { exec } from "child_process";
import { CommandExecutionError, InvalidInputError, TimeoutError } from './errors';

/**
 * Detect if running on Windows platform
 * Used throughout the codebase to determine which commands to use
 */
export const isWindows = process.platform === "win32";

/**
 * Wrap a promise with a timeout
 * Promise will be rejected with TimeoutError if it doesn't resolve in time
 * 
 * @param promise - The promise to wrap
 * @param ms - Timeout in milliseconds (if 0 or undefined, no timeout)
 * @returns The same promise, but with timeout behavior
 * 
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   fetch('http://example.com'),
 *   5000  // 5 second timeout
 * );
 * ```
 */
export const withTimeout = (promise: Promise<string>, ms?: number): Promise<string> => {
    // No timeout if ms is not provided or <= 0
    if (!ms || ms <= 0) return promise;

    return new Promise((resolve, reject) => {
        // Set up timeout
        const timer = setTimeout(
            () => reject(new TimeoutError(`Operation timed out after ${ms} ms`)),
            ms
        );

        // Race between promise and timeout
        promise
            .then((value) => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch((error) => {
                clearTimeout(timer);
                reject(error);
            });
    });
};

/**
 * Execute a shell command and return stdout as string
 * Wraps Node's exec() with better error handling and timeout support
 * 
 * @param cmd - Shell command to execute
 * @param timeoutMs - Optional timeout in milliseconds
 * @returns Stdout output as string
 * @throws {CommandExecutionError} If command fails
 * @throws {TimeoutError} If command exceeds timeout
 * 
 * @example
 * ```typescript
 * // Simple command
 * const output = await execText('ls -la');
 * 
 * // With timeout
 * const output = await execText('long-running-cmd', 5000);
 * ```
 */
export const execText = async (cmd: string, timeoutMs?: number): Promise<string> => {
    try {
        return await withTimeout(
            new Promise((resolve, reject) => {
                exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
                    if (err) {
                        // Prefer stderr if available, fallback to err.message
                        const errorMsg = stderr?.trim() || err.message;
                        reject(new CommandExecutionError(`Command failed: ${errorMsg}`, cmd));
                        return;
                    }
                    resolve(stdout || "");
                });
            }),
            timeoutMs
        );
    } catch (error) {
        // Re-throw timeout errors as-is
        if (error instanceof TimeoutError) {
            throw error;
        }
        // Wrap other errors in CommandExecutionError
        throw new CommandExecutionError(`Failed to execute command: ${cmd}`, cmd);
    }
};

/**
 * Sleep for specified milliseconds
 * Useful for delays between retry attempts or waiting for process cleanup
 * 
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 * 
 * @example
 * ```typescript
 * console.log('Starting...');
 * await sleep(1000);  // Wait 1 second
 * console.log('Done!');
 * ```
 */
export const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if a process exists/is alive by PID
 * Uses platform-specific commands that don't actually kill the process
 * 
 * - Windows: tasklist /FI "PID eq {pid}"
 * - Unix: kill -0 {pid} (signal 0 checks existence without killing)
 * 
 * @param pid - Process ID to check
 * @returns True if process exists, false otherwise
 * 
 * @example
 * ```typescript
 * if (await isProcessAlive(1234)) {
 *   console.log('Process 1234 is running');
 * } else {
 *   console.log('Process 1234 is not running');
 * }
 * ```
 */
export const isProcessAlive = async (pid: number): Promise<boolean> => {
    try {
        if (isWindows) {
            // Windows: use tasklist to check if PID exists
            const out = await execText(`tasklist /FI "PID eq ${pid}" /NH`, 1000);
            return out.includes(`${pid}`);
        } else {
            // Unix: kill -0 checks if process exists without sending actual signal
            await execText(`kill -0 ${pid}`, 1000);
            return true;
        }
    } catch {
        // Any error means process doesn't exist
        return false;
    }
};

/**
 * Build a matcher function for process name/command matching
 * 
 * @param pattern - Pattern to match
 * @param useRegex - If true, treat pattern as regex; otherwise substring match
 * @returns Function that tests if a string matches the pattern
 * @throws {InvalidInputError} If regex pattern is invalid
 * 
 * @example
 * ```typescript
 * // Substring matcher (case-insensitive)
 * const matcher1 = buildMatcher('node', false);
 * matcher1('node server.js');  // true
 * matcher1('NODE');            // true
 * matcher1('python');          // false
 * 
 * // Regex matcher
 * const matcher2 = buildMatcher('node.*--inspect', true);
 * matcher2('node --inspect');  // true
 * matcher2('node server.js');  // false
 * ```
 */
export const buildMatcher = (pattern: string, useRegex: boolean): ((s: string) => boolean) => {
    if (useRegex) {
        let regex: RegExp;
        try {
            // Case-insensitive regex matching
            regex = new RegExp(pattern, "i");
        } catch (e) {
            throw new InvalidInputError(`Invalid regex pattern: ${(e as Error).message}`);
        }
        return (s: string) => regex.test(s || "");
    }

    // Simple case-insensitive substring matching
    const lowered = pattern.toLowerCase();
    return (s: string) => (s || "").toLowerCase().includes(lowered);
};

/**
 * Parse PowerShell JSON output from Windows process commands
 * Handles both single object and array responses
 * 
 * @param jsonText - JSON string from PowerShell ConvertTo-Json
 * @returns Array of process objects
 * @throws {CommandExecutionError} If JSON parsing fails
 * 
 * @internal
 */
export const parseWindowsPsJson = (jsonText: string): Array<{ ProcessId: number; Name: string; CommandLine?: string }> => {
    const text = jsonText.trim();
    if (!text) return [];

    try {
        const data = JSON.parse(text);
        // PowerShell returns single object if only one result, array if multiple
        if (Array.isArray(data)) return data;
        return [data];
    } catch (error) {
        throw new CommandExecutionError(
            `Failed to parse PowerShell JSON output: ${(error as Error).message}`,
            "PowerShell"
        );
    }
};

/**
 * Parse port number from network address string
 * Handles both IPv4 and IPv6 formats
 * 
 * @param addr - Address string (e.g., "127.0.0.1:3000" or "[::]:3000")
 * @returns Port number or null if not found
 * 
 * @example
 * ```typescript
 * parsePortFromAddress('127.0.0.1:3000');  // 3000
 * parsePortFromAddress('[::1]:8080');      // 8080
 * parsePortFromAddress('invalid');         // null
 * ```
 * 
 * @internal
 */
export const parsePortFromAddress = (addr: string): number | null => {
    // IPv6 format: [2001:db8::1]:3000
    const ipv6Match = addr.match(/\[(.*)\]:(\d+)/);
    if (ipv6Match) return Number(ipv6Match[2]);

    // IPv4 format: 127.0.0.1:3000
    const ipv4Match = addr.match(/:(\d+)$/);
    return ipv4Match ? Number(ipv4Match[1]) : null;
};

/**
 * Parse port number from lsof output line (Unix)
 * 
 * @param line - Line from lsof output
 * @returns Port number or null if not found
 * 
 * @example
 * ```typescript
 * parsePortFromLsof('node  1234  user  TCP *:3000 (LISTEN)');  // 3000
 * ```
 * 
 * @internal
 */
export const parsePortFromLsof = (line: string): number | null => {
    // Look for pattern like ":3000->" or ":3000 (LISTEN)"
    const match = line.match(/:(\d+)(?:->|\s)/);
    return match ? Number(match[1]) : null;
};

