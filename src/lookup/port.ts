/**
 * Port-to-PID and PID-to-port lookup functions
 * @module lookup/port
 */

import { getCached } from '../cache';
import { CommandExecutionError, InvalidInputError, ProcessNotFoundError } from '../errors';
import { log } from '../logger';
import type { PortLookupOptions } from '../types';
import { execText, isWindows, parsePortFromAddress, parsePortFromLsof } from '../utils';

/**
 * Normalize options argument allowing either number (timeoutMs) or PortLookupOptions object
 */
const normalizePortOptions = (options?: PortLookupOptions | number): PortLookupOptions => {
    if (typeof options === 'number') {
        return { timeoutMs: options, state: 'LISTENING', protocol: 'all' };
    }
    return {
        state: 'LISTENING',
        protocol: 'all',
        ...options,
    };
};

/**
 * Parse Windows netstat output strictly matching the exact local port
 */
const parseWindowsNetstat = (stdout: string, targetPort: number, stateFilter?: 'LISTENING' | 'ALL'): number[] => {
    const pids = new Set<number>();
    const lines = stdout.split(/\r?\n/);

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        const parts = line.split(/\s+/);
        // Netstat lines start with Proto (TCP or UDP)
        const proto = parts[0]?.toUpperCase();
        if (proto !== 'TCP' && proto !== 'UDP') continue;

        const localAddr = parts[1];
        const port = parsePortFromAddress(localAddr);
        if (port !== targetPort) continue;

        // If TCP and filtering by LISTENING
        if (proto === 'TCP' && stateFilter === 'LISTENING') {
            const state = parts[3]?.toUpperCase();
            if (state !== 'LISTENING') continue;
        }

        const pidStr = parts[parts.length - 1];
        const pid = Number(pidStr);
        if (Number.isInteger(pid) && pid > 0) {
            pids.add(pid);
        }
    }

    return [...pids];
};

/**
 * Unix port lookup using lsof with fallbacks to ss and fuser
 */
const parseUnixPortLookup = async (targetPort: number, timeoutMs?: number): Promise<number[]> => {
    const pids = new Set<number>();

    // 1. Primary approach: lsof
    try {
        const out = await execText(`lsof -t -i :${targetPort}`, timeoutMs);
        for (const line of out.split(/\r?\n/)) {
            const pid = Number(line.trim());
            if (Number.isInteger(pid) && pid > 0) {
                pids.add(pid);
            }
        }
        if (pids.size > 0) return [...pids];
    } catch {
        // Fallback if lsof is not installed or returned error
    }

    // 2. Fallback: ss (modern Linux)
    try {
        const out = await execText(`ss -lntp '( sport = :${targetPort} )'`, timeoutMs);
        const matches = out.matchAll(/pid=(\d+)/g);
        for (const match of matches) {
            const pid = Number(match[1]);
            if (Number.isInteger(pid) && pid > 0) {
                pids.add(pid);
            }
        }
        if (pids.size > 0) return [...pids];
    } catch {
        // Fallback to fuser
    }

    // 3. Fallback: fuser
    try {
        const out = await execText(`fuser ${targetPort}/tcp 2>/dev/null`, timeoutMs);
        for (const part of out.trim().split(/\s+/)) {
            const pid = Number(part.trim());
            if (Number.isInteger(pid) && pid > 0) {
                pids.add(pid);
            }
        }
    } catch {
        // No processes or command not found
    }

    return [...pids];
};

/**
 * Find all process IDs (PIDs) bound to a specific port
 */
export const findPidsByPort = async (
    port: number,
    options?: PortLookupOptions | number
): Promise<number[]> => {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new InvalidInputError(`Invalid port number: ${port}. Must be an integer between 1 and 65535.`);
    }

    const opts = normalizePortOptions(options);

    return await getCached(`port:${port}:${opts.state}:${opts.protocol}`, async () => {
        try {
            if (isWindows) {
                // Query netstat on Windows
                const protoFlag = opts.protocol === 'tcp' ? '-p tcp' : opts.protocol === 'udp' ? '-p udp' : '';
                const stdout = await execText(`netstat -ano ${protoFlag}`, opts.timeoutMs);
                return parseWindowsNetstat(stdout, port, opts.state);
            } else {
                return await parseUnixPortLookup(port, opts.timeoutMs);
            }
        } catch (error: unknown) {
            if (error instanceof CommandExecutionError) {
                log.debug(`No processes found on port ${port}: ${error.message}`);
                return [];
            }
            throw error;
        }
    });
};

/**
 * Find the primary process ID bound to a port
 */
export const findPidByPort = async (
    port: number,
    options?: PortLookupOptions | number
): Promise<number> => {
    const pids = await findPidsByPort(port, options);

    if (pids.length === 0) {
        throw new ProcessNotFoundError(`No process found listening on port ${port}`);
    }

    return pids[0];
};

/**
 * Reverse lookup: Find all ports used by a specific PID
 */
export const findPortsByPid = async (pid: number, timeoutMs?: number): Promise<number[]> => {
    if (!Number.isInteger(pid) || pid <= 0) {
        throw new InvalidInputError(`Invalid PID: ${pid}. Must be a positive integer.`);
    }

    try {
        const ports = new Set<number>();

        if (isWindows) {
            const out = await execText('netstat -ano', timeoutMs);
            for (const line of out.split(/\r?\n/)) {
                const parts = line.trim().split(/\s+/);
                if (parts.length < 4) continue;

                const linePid = Number(parts[parts.length - 1]);
                if (linePid !== pid) continue;

                const localAddr = parts[1];
                const port = parsePortFromAddress(localAddr);
                if (port !== null) {
                    ports.add(port);
                }
            }
        } else {
            const out = await execText(`lsof -Pan -p ${pid} -i`, timeoutMs);
            for (const line of out.split(/\r?\n/)) {
                const port = parsePortFromLsof(line);
                if (port !== null) {
                    ports.add(port);
                }
            }
        }

        return [...ports];
    } catch (error: unknown) {
        if (error instanceof CommandExecutionError) {
            log.debug(`No ports found for PID ${pid}`);
            return [];
        }
        throw error;
    }
};
