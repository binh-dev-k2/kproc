/**
 * Port-based process termination functions
 * @module kill/port
 */

import { InvalidInputError, ProcessNotFoundError } from '../errors';
import { log } from '../logger';
import { findPidByPort, findPidsByPort } from '../lookup/port';
import type { KillOptions, KillResult } from '../types';
import { killByPid, killByPids } from './pid';

/**
 * Terminate the process listening on a specific port
 */
export const killByPort = async (port: number, options: KillOptions = {}): Promise<KillResult> => {
    log.debug(`Locating process listening on port ${port}`);
    const pid = await findPidByPort(port, options.timeoutMs);
    log.debug(`Found PID ${pid} on port ${port}`);
    return await killByPid(pid, options);
};

/**
 * Terminate all processes listening on any of the specified ports in parallel
 */
export const killByPorts = async (ports: number[], options: KillOptions = {}): Promise<KillResult[]> => {
    if (!Array.isArray(ports) || ports.length === 0) {
        throw new InvalidInputError('Ports array must be a non-empty array of numbers');
    }

    log.debug(`Searching for processes across ${ports.length} ports`);

    const uniquePids = new Set<number>();
    const errors: string[] = [];

    const portResults = await Promise.allSettled(
        ports.map((port) => findPidsByPort(port, options.timeoutMs))
    );

    portResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
            result.value.forEach((pid) => uniquePids.add(pid));
        } else {
            errors.push(`Port ${ports[idx]}: ${(result.reason as Error)?.message || 'Unknown error'}`);
        }
    });

    if (uniquePids.size === 0) {
        const errorDetails = errors.length > 0 ? ` Errors: ${errors.join('; ')}` : '';
        throw new ProcessNotFoundError(`No processes found on ports: ${ports.join(', ')}.${errorDetails}`);
    }

    log.debug(`Found ${uniquePids.size} unique PIDs across ${ports.length} ports`);
    return await killByPids([...uniquePids], options);
};

/**
 * Terminate all processes bound to ports within an inclusive range
 */
export const killByPortRange = async (
    start: number,
    end: number,
    options: KillOptions = {}
): Promise<KillResult[]> => {
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
        throw new InvalidInputError('Start and end ports must be integers');
    }
    if (end < start) {
        throw new InvalidInputError(`Invalid port range: end (${end}) cannot be less than start (${start})`);
    }
    if (start < 1 || end > 65535) {
        throw new InvalidInputError('Port range must fall within 1 and 65535');
    }

    const ports: number[] = [];
    for (let p = start; p <= end; p++) {
        ports.push(p);
    }

    log.debug(`Scanning port range ${start}-${end} (${ports.length} ports)`);
    return await killByPorts(ports, options);
};
