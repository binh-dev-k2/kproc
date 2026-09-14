/**
 * PID-based process termination functions with safety guards
 * @module kill/pid
 */

import { findDescendantPids } from '../core/tree';
import { InvalidInputError, ProcessNotFoundError } from '../errors';
import { log, setDebug } from '../logger';
import type { KillOptions, KillResult, UnixSignal } from '../types';
import { execText, isProcessAlive, isWindows, sleep } from '../utils';

/**
 * Validate that target PID is safe to kill
 */
const validatePidSafety = (pid: number, options: KillOptions): void => {
    if (!Number.isInteger(pid) || pid <= 0) {
        throw new InvalidInputError(`Invalid PID: ${pid}. Must be a positive integer.`);
    }

    // Safety Guard: Prevent accidental suicide of the host Node process
    if (pid === process.pid && !options.allowCurrentProcess) {
        throw new InvalidInputError(
            `Refusing to kill current process (PID: ${pid}). Set allowCurrentProcess: true if this is intentional.`
        );
    }

    // Safety Guard: Prevent killing critical system processes (System Idle / System on Windows, init on Unix)
    const isSystemPid = pid === 0 || (isWindows && pid === 4) || (!isWindows && pid === 1);
    if (isSystemPid && !options.force) {
        throw new InvalidInputError(
            `Refusing to kill system-critical process (PID: ${pid}). Set force: true if this is intentional.`
        );
    }
};

/**
 * Deliver kill signal on Unix systems using native syscalls
 */
const sendUnixKill = async (pid: number, signal: UnixSignal, tree: boolean, timeoutMs?: number): Promise<void> => {
    if (tree) {
        const descendants = await findDescendantPids(pid, timeoutMs);
        log.debug(`Found ${descendants.length} descendant processes for PID ${pid}`);

        // Kill descendants bottom-up
        for (const child of descendants.reverse()) {
            try {
                process.kill(child, signal);
                log.debug(`Killed descendant process ${child}`);
            } catch (err: unknown) {
                log.warn(`Failed to signal descendant process ${child}: ${(err as Error).message}`);
            }
        }
    }

    process.kill(pid, signal);
};

/**
 * Kill a process by its PID with comprehensive options and retry support
 */
export const killByPid = async (pid: number, options: KillOptions = {}): Promise<KillResult> => {
    validatePidSafety(pid, options);

    const {
        signal = 'SIGTERM',
        dryRun = false,
        tree = false,
        timeoutMs,
        forceAfterTimeout = false,
        escalationDelayMs = 3000,
        verify = false,
        retries = 0,
        debug = false,
    } = options;

    if (debug) setDebug(true);

    if (dryRun) {
        log.info(`[DRY RUN] Would terminate process ${pid} with signal ${signal}${tree ? ' (tree)' : ''}`);
        return { pid, success: true, signal, verified: false };
    }

    // If already dead, return immediately
    const exists = await isProcessAlive(pid);
    if (!exists) {
        log.debug(`Process ${pid} is already dead`);
        return { pid, success: true, verified: true };
    }

    let attempt = 0;
    let lastError: Error | undefined;
    let usedSignal: UnixSignal = signal;

    while (attempt <= retries) {
        try {
            log.debug(`Kill attempt ${attempt + 1}/${retries + 1} for PID ${pid} with signal ${usedSignal}`);

            if (isWindows) {
                const flags = tree ? '/T /F' : '/F';
                await execText(`taskkill /PID ${pid} ${flags}`, timeoutMs);
            } else {
                await sendUnixKill(pid, usedSignal, tree, timeoutMs);
            }

            log.debug(`Kill signal dispatched for PID ${pid}`);

            // Unix signal escalation if process refuses to exit
            if (forceAfterTimeout && !isWindows && usedSignal !== 'SIGKILL') {
                await sleep(escalationDelayMs);
                const stillAlive = await isProcessAlive(pid);

                if (stillAlive) {
                    log.debug(`Process ${pid} still alive after ${escalationDelayMs}ms, escalating to SIGKILL`);
                    usedSignal = 'SIGKILL';
                    process.kill(pid, 'SIGKILL');
                }
            }

            // Optional verification
            if (verify) {
                await sleep(50); // Yield to kernel process cleanup
                const stillAlive = await isProcessAlive(pid);

                if (stillAlive) {
                    throw new ProcessNotFoundError(`Process ${pid} is still alive after kill attempt`);
                }

                log.debug(`Verified process ${pid} is dead`);
                return { pid, success: true, signal: usedSignal, verified: true };
            }

            return { pid, success: true, signal: usedSignal, verified: false };
        } catch (error: unknown) {
            lastError = error as Error;
            log.debug(`Kill attempt ${attempt + 1} failed: ${lastError.message}`);

            if (attempt < retries) {
                await sleep(200);
                attempt++;
                continue;
            }
            break;
        }
    }

    const errorMsg = lastError?.message || 'Unknown kill error';
    log.error(`Failed to terminate process ${pid} after ${retries + 1} attempts: ${errorMsg}`);

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
 */
export const killByPids = async (pids: number[], options: KillOptions = {}): Promise<KillResult[]> => {
    if (!Array.isArray(pids) || pids.length === 0) {
        throw new InvalidInputError('PIDs array must be a non-empty array of integers');
    }

    log.debug(`Terminating ${pids.length} processes in parallel`);

    const results = await Promise.allSettled(
        pids.map((pid) => killByPid(pid, options))
    );

    return results.map((result, idx) => {
        if (result.status === 'fulfilled') {
            return result.value;
        }
        return {
            pid: pids[idx],
            success: false,
            error: (result.reason as Error)?.message || 'Unknown error',
            verified: false,
        };
    });
};
