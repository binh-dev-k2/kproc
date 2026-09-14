/**
 * Process tree traversal and descendant discovery functions
 * @module core/tree
 */

import { CommandExecutionError, InvalidInputError } from '../errors';
import { log } from '../logger';
import { execText, isWindows, parseWindowsPsJson } from '../utils';

/**
 * Find direct child processes of a parent PID (one level only)
 */
export const findChildPidsOnce = async (ppid: number, timeoutMs?: number): Promise<number[]> => {
    if (!Number.isInteger(ppid) || ppid <= 0) {
        throw new InvalidInputError(`Invalid parent PID: ${ppid}. Must be a positive integer.`);
    }

    try {
        if (isWindows) {
            const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq ${ppid} } | Select-Object ProcessId | ConvertTo-Json -Compress"`;
            const out = await execText(psCmd, timeoutMs);
            const arr = parseWindowsPsJson(out);

            return arr
                .map((a) => a.ProcessId)
                .filter((n) => Number.isInteger(n) && n > 0);
        } else {
            // Try pgrep first, fallback to ps
            try {
                const out = await execText(`pgrep -P ${ppid}`, timeoutMs);
                return out
                    .split(/\r?\n/)
                    .map((s) => Number(s.trim()))
                    .filter((n) => Number.isInteger(n) && n > 0);
            } catch {
                const out = await execText(`ps -o pid= --ppid ${ppid}`, timeoutMs);
                return out
                    .split(/\r?\n/)
                    .map((s) => Number(s.trim()))
                    .filter((n) => Number.isInteger(n) && n > 0);
            }
        }
    } catch (error: unknown) {
        if (error instanceof CommandExecutionError) {
            log.debug(`Failed to find child processes of PID ${ppid}: ${error.message}`);
            return [];
        }
        throw error;
    }
};

/**
 * Find all descendant processes of a PID (recursive BFS traversal)
 * Excludes the target PID itself from the returned list
 */
export const findDescendantPids = async (pid: number, timeoutMs?: number): Promise<number[]> => {
    const result: number[] = [];
    const queue: number[] = [pid];
    const visited = new Set<number>();

    log.debug(`Finding descendants of PID ${pid}...`);

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        try {
            const children = await findChildPidsOnce(current, timeoutMs);
            for (const child of children) {
                if (!visited.has(child)) {
                    result.push(child);
                    queue.push(child);
                }
            }
        } catch (error: unknown) {
            log.warn(`Failed to find children of PID ${current}: ${(error as Error).message}`);
        }
    }

    const descendants = result.filter((p) => p !== pid);
    log.debug(`Found ${descendants.length} descendants of PID ${pid}`);
    return descendants;
};
