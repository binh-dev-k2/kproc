/**
 * Utility functions for process and system operations
 * @module utils
 */

import { exec } from 'child_process';
import { CommandExecutionError, InvalidInputError, TimeoutError } from './errors';

/**
 * Detect if running on Windows platform
 */
export const isWindows = process.platform === 'win32';

/**
 * Wrap a promise with a timeout in milliseconds
 */
export const withTimeout = <T>(promise: Promise<T>, ms?: number): Promise<T> => {
    if (!ms || ms <= 0) return promise;

    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new TimeoutError(`Operation timed out after ${ms} ms`));
        }, ms);

        promise
            .then((value) => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch((error: unknown) => {
                clearTimeout(timer);
                reject(error);
            });
    });
};

/**
 * Execute a shell command and return stdout as string
 */
export const execText = async (cmd: string, timeoutMs?: number): Promise<string> => {
    try {
        return await withTimeout(
            new Promise<string>((resolve, reject) => {
                exec(
                    cmd,
                    {
                        windowsHide: true,
                        maxBuffer: 10 * 1024 * 1024, // 10MB to handle large process tables
                    },
                    (err, stdout, stderr) => {
                        if (err) {
                            const errorMsg = stderr?.trim() || err.message;
                            reject(new CommandExecutionError(`Command failed: ${errorMsg}`, cmd, { cause: err }));
                            return;
                        }
                        resolve(stdout || '');
                    }
                );
            }),
            timeoutMs
        );
    } catch (error: unknown) {
        if (error instanceof TimeoutError || error instanceof CommandExecutionError) {
            throw error;
        }
        throw new CommandExecutionError(`Failed to execute command: ${cmd}`, cmd, { cause: error });
    }
};

/**
 * Sleep for specified milliseconds
 */
export const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Check if a process exists/is alive by PID using native Node.js process checks.
 * Uses POSIX / Win32 syscalls via process.kill(pid, 0) for sub-millisecond checks.
 */
export const isProcessAlive = async (pid: number): Promise<boolean> => {
    if (!Number.isInteger(pid) || pid <= 0) {
        return false;
    }

    try {
        // Signal 0 tests existence without sending a terminating signal
        process.kill(pid, 0);
        return true;
    } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        // EPERM means process exists, but current user doesn't have permission to signal it
        if (nodeErr && nodeErr.code === 'EPERM') {
            return true;
        }
        // ESRCH means process does not exist
        return false;
    }
};

/**
 * Build a matcher function for process name/command matching
 */
export const buildMatcher = (pattern: string, useRegex: boolean): ((s: string) => boolean) => {
    if (useRegex) {
        let regex: RegExp;
        try {
            regex = new RegExp(pattern, 'i');
        } catch (e: unknown) {
            throw new InvalidInputError(`Invalid regex pattern: ${(e as Error).message}`, { cause: e });
        }
        return (s: string): boolean => regex.test(s || '');
    }

    const lowered = pattern.toLowerCase();
    return (s: string): boolean => (s || '').toLowerCase().includes(lowered);
};

/**
 * Parse PowerShell JSON output from Windows process commands
 */
export const parseWindowsPsJson = (
    jsonText: string
): Array<{ ProcessId: number; Name: string; CommandLine?: string; ParentProcessId?: number }> => {
    const text = jsonText.trim();
    if (!text) return [];

    try {
        const data = JSON.parse(text);
        if (Array.isArray(data)) return data;
        return [data];
    } catch (error: unknown) {
        throw new CommandExecutionError(
            `Failed to parse PowerShell JSON output: ${(error as Error).message}`,
            'PowerShell',
            { cause: error }
        );
    }
};

/**
 * Parse port number from a local socket address string
 * Supports IPv4 ("127.0.0.1:3000", "0.0.0.0:8080") and IPv6 ("[::]:3000", "[2001:db8::1]:80")
 */
export const parsePortFromAddress = (addr: string): number | null => {
    if (!addr) return null;

    // IPv6 format: [address]:port or :::port
    const ipv6Match = addr.match(/(?:\[[a-fA-F0-9:]+\]|:{2,}):(\d+)$/);
    if (ipv6Match) {
        const p = Number(ipv6Match[1]);
        return p >= 1 && p <= 65535 ? p : null;
    }

    // IPv4 format: address:port (e.g. 0.0.0.0:3000, 127.0.0.1:80)
    const ipv4Match = addr.match(/:(\d+)$/);
    if (ipv4Match) {
        const p = Number(ipv4Match[1]);
        return p >= 1 && p <= 65535 ? p : null;
    }

    return null;
};

/**
 * Parse port number from lsof output line (Unix)
 */
export const parsePortFromLsof = (line: string): number | null => {
    const match = line.match(/:(\d+)(?:->|\s|\(LISTEN\)|$)/);
    if (match) {
        const p = Number(match[1]);
        return p >= 1 && p <= 65535 ? p : null;
    }
    return null;
};
