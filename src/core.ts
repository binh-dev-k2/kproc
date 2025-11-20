/**
 * Core process tree functions
 * Functions for finding child and descendant processes
 * @module core
 */

import { CommandExecutionError, InvalidInputError, ProcessNotFoundError } from './errors';
import { log } from './logger';
import { execText, isWindows, parseWindowsPsJson } from './utils';

/**
 * Find direct child processes of a parent PID (one level only)
 * 
 * Uses platform-specific commands to query parent-child relationships:
 * - Windows: PowerShell Get-CimInstance filtering by ParentProcessId
 * - Unix: ps --ppid to get children of specific parent
 * 
 * @param ppid - Parent process ID
 * @param timeoutMs - Optional command timeout
 * @returns Array of child PIDs (direct children only)
 * @throws {InvalidInputError} If ppid is invalid
 * @throws {ProcessNotFoundError} If command fails
 * 
 * @example
 * ```typescript
 * // Find direct children of process 1234
 * const children = await findChildPidsOnce(1234);
 * console.log(`Process 1234 has ${children.length} direct children`);
 * ```
 * 
 * @internal
 */
export const findChildPidsOnce = async (ppid: number, timeoutMs?: number): Promise<number[]> => {
    if (!Number.isInteger(ppid) || ppid <= 0) {
        throw new InvalidInputError(`Invalid parent PID: ${ppid}. Must be a positive integer.`);
    }

    try {
        if (isWindows) {
            // Windows: Query Win32_Process where ParentProcessId matches
            const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq ${ppid} } | Select-Object ProcessId | ConvertTo-Json -Compress"`;
            const out = await execText(psCmd, timeoutMs);
            const arr = parseWindowsPsJson(out);

            // Filter out any invalid PIDs
            return arr
                .map(a => a.ProcessId)
                .filter((n) => Number.isFinite(n) && n > 0);
        } else {
            // Unix: Use ps with --ppid to get children
            const out = await execText(`ps -o pid= --ppid ${ppid}`, timeoutMs);

            // Parse each line as a PID
            return out
                .split(/\r?\n/)
                .map(s => Number(s.trim()))
                .filter(n => !Number.isNaN(n) && n > 0);
        }
    } catch (error) {
        if (error instanceof CommandExecutionError) {
            // Command failed - might mean no children or ppid doesn't exist
            log.debug(`Failed to find child processes of PID ${ppid}: ${error.message}`);
            return []; // Return empty array instead of throwing
        }
        throw error;
    }
};

/**
 * Find ALL descendant processes of a PID (recursive)
 * 
 * This performs a breadth-first search of the process tree:
 * 1. Start with the target PID
 * 2. Find all direct children
 * 3. For each child, find their children
 * 4. Continue recursively until no more children found
 * 
 * Important: The returned array does NOT include the root PID itself,
 * only its descendants. This allows caller to decide kill order.
 * 
 * @param pid - Root process ID to start from
 * @param timeoutMs - Optional timeout for each command
 * @returns Array of all descendant PIDs (children, grandchildren, etc.)
 * 
 * @example
 * ```typescript
 * // Find entire process tree under PID 1234
 * const descendants = await findDescendantPids(1234);
 * console.log(`Process tree has ${descendants.length} descendants`);
 * 
 * // Kill all descendants first, then parent (common pattern)
 * for (const childPid of descendants) {
 *   await killByPid(childPid);
 * }
 * await killByPid(1234); // Finally kill parent
 * ```
 * 
 * @internal
 */
export const findDescendantPids = async (pid: number, timeoutMs?: number): Promise<number[]> => {
    const result: number[] = [];
    const queue: number[] = [pid];
    const visited = new Set<number>();

    log.debug(`Finding descendants of PID ${pid}...`);

    // Breadth-first search through process tree
    while (queue.length > 0) {
        const current = queue.shift()!;

        // Skip if already processed (prevent infinite loops)
        if (visited.has(current)) continue;
        visited.add(current);

        try {
            // Find direct children of current process
            const children = await findChildPidsOnce(current, timeoutMs);

            log.debug(`PID ${current} has ${children.length} children`);

            for (const child of children) {
                if (!visited.has(child)) {
                    result.push(child);  // Add to results
                    queue.push(child);   // Queue for processing
                }
            }
        } catch (error) {
            // Non-fatal: just log and continue with other processes
            log.warn(`Failed to find children of PID ${current}: ${(error as Error).message}`);
        }
    }

    // Exclude the root pid itself from results
    const filtered = result.filter((p) => p !== pid);

    log.debug(`Found ${filtered.length} descendants of PID ${pid}`);

    return filtered;
};

