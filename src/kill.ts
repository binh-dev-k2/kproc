/**
 * Process killing functions with advanced options
 * @module kill
 */

import { findDescendantPids } from './core';
import { InvalidInputError, ProcessNotFoundError } from './errors';
import { log, setDebug } from './logger';
import { findPidByPort, findPidsByName, findPidsByPort } from './lookup';
import type { FindByNameOptions, KillOptions, KillResult, UnixSignal } from './types';
import { execText, isProcessAlive, isWindows, sleep } from './utils';

/**
 * Kill a process by its PID with comprehensive options
 * 
 * This is the core kill function with many advanced features:
 * - Retry mechanism: Auto-retry failed kill attempts
 * - Signal escalation: Auto-escalate SIGTERM → SIGKILL on Unix
 * - Process verification: Confirm process is actually dead
 * - Process tree: Kill all child processes recursively
 * - Dry run: Simulate without actually killing
 * 
 * @param pid - Process ID to kill
 * @param options - Kill options (see KillOptions interface)
 * @returns KillResult with detailed operation information
 * @throws {InvalidInputError} If PID is invalid
 * 
 * @example
 * ```typescript
 * // Simple kill
 * const result = await killByPid(1234);
 * 
 * // Kill with retry and verification
 * const result = await killByPid(1234, {
 *   verify: true,
 *   retries: 3,
 *   tree: true
 * });
 * 
 * // Auto-escalate to SIGKILL if SIGTERM doesn't work (Unix)
 * const result = await killByPid(1234, {
 *   signal: 'SIGTERM',
 *   forceAfterTimeout: true,
 *   escalationDelayMs: 2000
 * });
 * ```
 */
export const killByPid = async (pid: number, options: KillOptions = {}): Promise<KillResult> => {
    // Validate PID
    if (!Number.isInteger(pid) || pid <= 0) {
        throw new InvalidInputError(`Invalid PID: ${pid}. Must be a positive integer.`);
    }

    // Extract options with defaults
    const {
        signal = "SIGTERM",
        dryRun = false,
        tree = false,
        timeoutMs,
        forceAfterTimeout = false,
        escalationDelayMs = 3000,
        verify = false,
        retries = 0,
        debug = false,
    } = options;

    // Enable debug if requested for this operation
    if (debug) setDebug(true);

    // Dry run: don't actually kill
    if (dryRun) {
        log.info(`[DRY RUN] Would kill process ${pid} with signal ${signal}${tree ? ' (tree)' : ''}`);
        return { pid, success: true, signal };
    }

    // Check if process exists before attempting kill
    const exists = await isProcessAlive(pid);
    if (!exists) {
        log.debug(`Process ${pid} is already dead`);
        return { pid, success: true, verified: true };
    }

    let attempt = 0;
    let lastError: Error | undefined;
    let usedSignal: UnixSignal = signal;

    // Retry loop
    while (attempt <= retries) {
        try {
            log.debug(`Kill attempt ${attempt + 1}/${retries + 1} for PID ${pid} with signal ${usedSignal}`);

            if (isWindows) {
                // Windows: Use taskkill
                const flags = tree ? "/T /F" : "/F";
                await execText(`taskkill /PID ${pid} ${flags}`, timeoutMs);
            } else {
                // Unix: Use kill command
                const sig = typeof usedSignal === "number" ? usedSignal : usedSignal.toString();

                // Kill process tree if requested
                if (tree) {
                    const descendants = await findDescendantPids(pid, timeoutMs);
                    log.debug(`Found ${descendants.length} descendant processes for PID ${pid}`);

                    // Kill children first (bottom-up), then parent
                    for (const child of descendants) {
                        try {
                            await execText(`kill -s ${sig} ${child}`, timeoutMs);
                            log.debug(`Killed child process ${child}`);
                        } catch (error) {
                            log.warn(`Failed to kill child process ${child}: ${(error as Error).message}`);
                        }
                    }
                }

                // Kill the main process
                await execText(`kill -s ${sig} ${pid}`, timeoutMs);
            }

            // Command succeeded
            log.debug(`Kill command succeeded for PID ${pid}`);

            // Signal escalation: if process still alive after delay, try SIGKILL
            if (forceAfterTimeout && !isWindows && usedSignal !== "SIGKILL") {
                await sleep(escalationDelayMs);
                const stillAlive = await isProcessAlive(pid);

                if (stillAlive) {
                    log.debug(`Process ${pid} still alive after ${escalationDelayMs}ms, escalating to SIGKILL`);
                    usedSignal = "SIGKILL";
                    await execText(`kill -9 ${pid}`, timeoutMs);
                }
            }

            // Verification: check if process is actually dead
            if (verify) {
                await sleep(100); // Give OS time to clean up
                const stillAlive = await isProcessAlive(pid);

                if (stillAlive) {
                    throw new ProcessNotFoundError(`Process ${pid} is still alive after kill attempt`);
                }

                log.debug(`Verified process ${pid} is dead`);
                return { pid, success: true, signal: usedSignal, verified: true };
            }

            return { pid, success: true, signal: usedSignal };

        } catch (error) {
            lastError = error as Error;
            log.debug(`Kill attempt ${attempt + 1} failed: ${lastError.message}`);

            // Retry if we have attempts left
            if (attempt < retries) {
                await sleep(500); // Wait before retry
                attempt++;
                continue;
            }
            break;
        }
    }

    // All attempts failed
    const errorMsg = lastError?.message || 'Unknown error';
    log.error(`Failed to kill process ${pid} after ${retries + 1} attempts: ${errorMsg}`);

    return {
        pid,
        success: false,
        signal: usedSignal,
        error: errorMsg,
        verified: false,
    };
};

/**
 * Kill multiple processes by their PIDs in parallel
 * 
 * Uses Promise.allSettled to kill all processes simultaneously without
 * stopping if one fails. This is much faster than killing sequentially.
 * 
 * @param pids - Array of process IDs to kill
 * @param options - Kill options applied to all processes
 * @returns Array of KillResult, one for each PID
 * @throws {InvalidInputError} If pids array is empty
 * 
 * @example
 * ```typescript
 * // Kill multiple processes in parallel
 * const results = await killByPids([1234, 5678, 9012], {
 *   tree: true,
 *   verify: true
 * });
 * 
 * // Check results
 * const succeeded = results.filter(r => r.success);
 * const failed = results.filter(r => !r.success);
 * console.log(`Killed: ${succeeded.length}, Failed: ${failed.length}`);
 * ```
 */
export const killByPids = async (pids: number[], options: KillOptions = {}): Promise<KillResult[]> => {
    if (!Array.isArray(pids) || pids.length === 0) {
        throw new InvalidInputError("PIDs array must be non-empty");
    }

    log.debug(`Killing ${pids.length} processes in parallel`);

    // Kill all processes in parallel (don't stop on failure)
    const results = await Promise.allSettled(
        pids.map(pid => killByPid(pid, options))
    );

    // Convert Promise results to KillResults
    const killResults: KillResult[] = results.map((result, idx) => {
        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            return {
                pid: pids[idx],
                success: false,
                error: result.reason?.message || 'Unknown error',
            };
        }
    });

    const failed = killResults.filter(r => !r.success);
    if (failed.length > 0) {
        log.warn(`Failed to kill ${failed.length}/${pids.length} processes`);
    } else {
        log.debug(`Successfully killed all ${pids.length} processes`);
    }

    return killResults;
};

/**
 * Kill the main process bound to a specific port
 * 
 * First finds the PID on the port, then kills it.
 * 
 * @param port - Port number (1-65535)
 * @param options - Kill options
 * @returns KillResult with details about the killed process
 * @throws {ProcessNotFoundError} If no process found on port
 * @throws {InvalidInputError} If port is invalid
 * 
 * @example
 * ```typescript
 * // Free up port 3000
 * const result = await killByPort(3000, { tree: true });
 * if (result.success) {
 *   console.log('Port 3000 is now free');
 * }
 * ```
 */
export const killByPort = async (port: number, options: KillOptions = {}): Promise<KillResult> => {
    log.debug(`Finding process on port ${port}`);
    const pid = await findPidByPort(port, options.timeoutMs);
    log.debug(`Found PID ${pid} on port ${port}`);
    return await killByPid(pid, options);
};

/**
 * Kill all processes bound to any of the given ports
 * 
 * Finds all PIDs across all ports in parallel, then kills them all in parallel.
 * Very efficient for cleaning up multiple ports at once.
 * 
 * @param ports - Array of port numbers
 * @param options - Kill options
 * @returns Array of KillResult for all PIDs found
 * @throws {InvalidInputError} If ports array is empty
 * @throws {ProcessNotFoundError} If no processes found on any port
 * 
 * @example
 * ```typescript
 * // Clean up development ports
 * const results = await killByPorts([3000, 3001, 8080, 8081], {
 *   tree: true,
 *   verify: true
 * });
 * 
 * console.log(`Cleaned up ${results.filter(r => r.success).length} processes`);
 * ```
 */
export const killByPorts = async (ports: number[], options: KillOptions = {}): Promise<KillResult[]> => {
    if (!Array.isArray(ports) || ports.length === 0) {
        throw new InvalidInputError("Ports array must be non-empty");
    }

    log.debug(`Searching for processes on ${ports.length} ports`);

    const unique = new Set<number>();
    const errors: string[] = [];

    // Find all PIDs across all ports in parallel
    const portResults = await Promise.allSettled(
        ports.map(port => findPidsByPort(port, options.timeoutMs))
    );

    portResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
            result.value.forEach(pid => unique.add(pid));
        } else {
            errors.push(`Port ${ports[idx]}: ${result.reason?.message || 'Unknown error'}`);
        }
    });

    if (unique.size === 0) {
        throw new ProcessNotFoundError(
            `No processes found on ports: ${ports.join(", ")}${errors.length > 0 ? '. Errors: ' + errors.join('; ') : ''}`
        );
    }

    log.debug(`Found ${unique.size} unique PIDs across ${ports.length} ports`);
    return await killByPids([...unique], options);
};

/**
 * Kill all processes bound to ports within a range
 * 
 * Convenience function for killing processes on a continuous range of ports.
 * Useful for cleaning up development environments.
 * 
 * @param start - Starting port number (inclusive)
 * @param end - Ending port number (inclusive)
 * @param options - Kill options
 * @returns Array of KillResult for all PIDs found in the range
 * @throws {InvalidInputError} If range is invalid
 * @throws {ProcessNotFoundError} If no processes found in range
 * 
 * @example
 * ```typescript
 * // Kill all processes on ports 3000-3010
 * const results = await killByPortRange(3000, 3010, {
 *   tree: true
 * });
 * 
 * console.log(`Scanned ${3010-3000+1} ports, killed ${results.length} processes`);
 * ```
 */
export const killByPortRange = async (start: number, end: number, options: KillOptions = {}): Promise<KillResult[]> => {
    // Validate range
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
        throw new InvalidInputError("Start and end must be integers");
    }
    if (end < start) {
        throw new InvalidInputError("Invalid port range: end < start");
    }
    if (start < 1 || end > 65535) {
        throw new InvalidInputError("Port range must be between 1 and 65535");
    }

    // Build array of all ports in range
    const ports: number[] = [];
    for (let p = start; p <= end; p++) ports.push(p);

    log.debug(`Scanning port range ${start}-${end} (${ports.length} ports)`);
    return await killByPorts(ports, options);
};

/**
 * Kill processes by name or command pattern
 * 
 * Searches all running processes and kills those matching the pattern.
 * Very powerful for cleaning up processes by type.
 * 
 * @param nameOrPattern - Process name or pattern to match
 * @param opts - Combined FindByNameOptions and KillOptions
 * @returns Array of KillResult for all matching processes
 * @throws {InvalidInputError} If pattern is invalid
 * @throws {ProcessNotFoundError} If no matching processes found
 * 
 * @example
 * ```typescript
 * // Kill all node processes (substring match)
 * const results = await killByName('node', { tree: true });
 * 
 * // Kill processes matching regex
 * const results = await killByName('node.*--inspect', {
 *   useRegex: true,
 *   tree: true,
 *   verify: true
 * });
 * 
 * // Case-insensitive by default
 * const results = await killByName('CHROME');
 * ```
 */
export const killByName = async (
    nameOrPattern: string,
    opts: FindByNameOptions & KillOptions = {}
): Promise<KillResult[]> => {
    const { timeoutMs, ...rest } = opts as KillOptions & FindByNameOptions;

    log.debug(`Searching for processes matching pattern: ${nameOrPattern}`);
    const pids = await findPidsByName(
        nameOrPattern,
        { useRegex: (opts as FindByNameOptions).useRegex },
        timeoutMs
    );

    if (pids.length === 0) {
        throw new ProcessNotFoundError(`No process matched pattern: ${nameOrPattern}`);
    }

    log.debug(`Found ${pids.length} processes matching pattern: ${nameOrPattern}`);
    return await killByPids(pids, rest as KillOptions);
};

